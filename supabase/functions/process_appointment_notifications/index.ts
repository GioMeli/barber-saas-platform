import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  errorCode,
  errorMessage,
  formatAppointmentDateTime,
  normalizeCommunicationLocale,
  normalizePhone,
  renderAppointmentEvent,
  resolveTenantFrom,
  retryAt,
  sendResendEmail,
  sendTwilioSms,
  type AppointmentEventType,
  type CommunicationLocale,
} from '../_shared/communication.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NOTIFICATION_FUNCTION_SECRET = Deno.env.get('NOTIFICATION_FUNCTION_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || '';
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '';
const TWILIO_STATUS_CALLBACK_URL =
  Deno.env.get('TRANSACTIONAL_TWILIO_STATUS_CALLBACK_URL') ||
  Deno.env.get('TWILIO_STATUS_CALLBACK_URL') ||
  '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 30;
const STALE_LOCK_MINUTES = 10;

type NotificationJob = {
  id: string;
  business_id: string;
  appointment_id: string;
  event_type: AppointmentEventType;
  recipient_type: 'customer' | 'owner';
  channel: 'email' | 'sms';
  status: string;
  attempt_count: number;
  max_attempts: number;
};

type DeliveryRow = {
  id: string;
  status: string;
  provider_message_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const suppliedSecret = req.headers.get('x-notification-secret');
  if (!NOTIFICATION_FUNCTION_SECRET || suppliedSecret !== NOTIFICATION_FUNCTION_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  await recoverStaleJobs();

  const now = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from('appointment_notification_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('available_at', now)
    .order('available_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('Failed to load appointment notification jobs', error);
    return json({ error: 'Failed to load notification jobs' }, 500);
  }

  const results: Array<Record<string, unknown>> = [];
  for (const job of (jobs ?? []) as NotificationJob[]) results.push(await processJob(job));

  return json({
    processed: results.length,
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    results,
  });
});

async function processJob(job: NotificationJob) {
  const nextAttempt = job.attempt_count + 1;
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await supabase
    .from('appointment_notification_jobs')
    .update({
      status: 'processing',
      locked_at: now,
      attempt_count: nextAttempt,
      updated_at: now,
    })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('id')
    .maybeSingle();

  if (claimError) return { job_id: job.id, status: 'failed', reason: claimError.message };
  if (!claimed) return { job_id: job.id, status: 'skipped', reason: 'already_claimed' };

  try {
    const context = await loadAppointmentContext(job.appointment_id);
    if (!context) throw new Error('Appointment context not found');

    const business = one(context.businesses);
    const customer = one(context.customers);
    const employee = one(context.employees);
    if (!business) throw new Error('Business not found');

    const settings = await loadCommunicationSettings(job.business_id);
    if (job.channel === 'email' && settings.transactional_email_enabled === false) {
      await cancelJob(job.id, 'Transactional email is disabled for this business');
      return { job_id: job.id, status: 'skipped', reason: 'email_disabled' };
    }
    if (job.channel === 'sms' && settings.transactional_sms_enabled !== true) {
      await cancelJob(job.id, 'Transactional SMS is disabled for this business');
      return { job_id: job.id, status: 'skipped', reason: 'sms_disabled' };
    }

    const { data: quota, error: quotaError } = await supabase.rpc('billing_can_send_communication', { p_business_id: job.business_id, p_channel: job.channel });
    if (quotaError) throw quotaError;
    if (quota?.allowed === false) {
      await cancelJob(job.id, `Monthly ${job.channel} allowance reached (${quota.used}/${quota.limit})`);
      return { job_id: job.id, status: 'skipped', reason: 'plan_monthly_quota_reached', used: quota.used, limit: quota.limit };
    }

    const recipients = job.recipient_type === 'customer'
      ? resolveCustomerRecipients(job.channel, customer)
      : await resolveOwnerRecipients(job.business_id, job.channel);

    if (recipients.length === 0) {
      await cancelJob(job.id, `No ${job.recipient_type} ${job.channel} destination found`);
      return { job_id: job.id, status: 'skipped', reason: 'missing_recipient' };
    }

    const locale = normalizeCommunicationLocale(settings.communication_locale) as CommunicationLocale;
    const { dateText, timeText } = formatAppointmentDateTime(
      context.start_time,
      business.timezone || 'UTC',
      locale,
    );
    const services = (context.appointment_services ?? [])
      .map((row: any) => one(row.services)?.name)
      .filter(Boolean) as string[];
    const storeUrl = APP_PUBLIC_URL && business.slug
      ? `${APP_PUBLIC_URL}/app/${encodeURIComponent(business.slug)}`
      : '';
    const rendered = renderAppointmentEvent(job.event_type, {
      businessName: business.name,
      businessEmail: business.email,
      replyToEmail: settings.communication_reply_to_email,
      logoUrl: business.logo_url,
      customerName: customer?.full_name || 'Customer',
      professionalName: employee?.name || 'Any available professional',
      dateText,
      timeText,
      services,
      totalPrice: Number(context.total_price || 0),
      currency: business.currency || 'EUR',
      bookingReference: context.booking_reference || context.id,
      address: [
        business.address_line_1 || business.address,
        business.address_line_2,
        business.city,
        business.district,
        business.postal_code,
      ].filter(Boolean).join(', '),
      phone: business.phone,
      storeUrl,
    }, locale);

    const providerIds: string[] = [];
    let deliveredCount = 0;

    for (const recipient of recipients) {
      const existing = await findOrCreateDelivery(job, recipient, rendered.subject, job.channel === 'email' ? rendered.text : rendered.sms);
      if (existing.status === 'sent' || existing.status === 'delivered') {
        if (existing.provider_message_id) providerIds.push(existing.provider_message_id);
        deliveredCount += 1;
        continue;
      }

      try {
        const providerMessageId = job.channel === 'email'
          ? await sendResendEmail({
              apiKey: RESEND_API_KEY,
              from: resolveTenantFrom(EMAIL_FROM, business.name),
              to: recipient,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              replyTo: settings.communication_reply_to_email || business.email || undefined,
              idempotencyKey: `appointment:${job.id}:${recipient}`,
            })
          : await sendTwilioSms({
              accountSid: TWILIO_ACCOUNT_SID,
              authToken: TWILIO_AUTH_TOKEN,
              messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID || undefined,
              fromNumber: TWILIO_FROM_NUMBER || undefined,
              to: recipient,
              body: rendered.sms,
              statusCallbackUrl: TWILIO_STATUS_CALLBACK_URL || undefined,
            });

        const sentAt = new Date().toISOString();
        await supabase
          .from('notification_deliveries')
          .update({
            status: 'sent',
            provider_message_id: providerMessageId,
            sent_at: sentAt,
            failure_code: null,
            failure_reason: null,
            updated_at: sentAt,
          })
          .eq('id', existing.id);

        providerIds.push(providerMessageId);
        deliveredCount += 1;
      } catch (deliveryError) {
        const code = errorCode(deliveryError);
        const message = errorMessage(deliveryError).slice(0, 2000);
        await supabase
          .from('notification_deliveries')
          .update({ status: 'failed', failure_code: code, failure_reason: message, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        throw deliveryError;
      }
    }

    const sentAt = new Date().toISOString();
    await supabase
      .from('appointment_notification_jobs')
      .update({
        status: 'sent',
        sent_at: sentAt,
        provider_message_id: providerIds.filter(Boolean).join(','),
        last_error: null,
        locked_at: null,
        updated_at: sentAt,
      })
      .eq('id', job.id);

    return { job_id: job.id, status: 'sent', channel: job.channel, recipients: deliveredCount, provider_message_ids: providerIds };
  } catch (error) {
    const message = errorMessage(error).slice(0, 2000);
    const terminalFailure = nextAttempt >= job.max_attempts;
    await supabase
      .from('appointment_notification_jobs')
      .update({
        status: terminalFailure ? 'failed' : 'queued',
        available_at: terminalFailure ? new Date().toISOString() : retryAt(nextAttempt),
        last_error: message,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return { job_id: job.id, status: 'failed', retryable: !terminalFailure, reason: message };
  }
}

async function loadAppointmentContext(appointmentId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, business_id, start_time, end_time, status, total_duration, total_price,
      booking_reference, notes,
      businesses (
        id, name, slug, logo_url, address, address_line_1, address_line_2,
        city, district, postal_code, phone, email, timezone, currency
      ),
      customers (id, full_name, email, phone),
      employees (id, name),
      appointment_services (price, duration, services (id, name))
    `)
    .eq('id', appointmentId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadCommunicationSettings(businessId: string) {
  const { data, error } = await supabase
    .from('business_settings')
    .select('transactional_email_enabled, transactional_sms_enabled, communication_locale, communication_reply_to_email')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    transactional_email_enabled: data?.transactional_email_enabled !== false,
    transactional_sms_enabled: data?.transactional_sms_enabled === true,
    communication_locale: data?.communication_locale || 'en',
    communication_reply_to_email: data?.communication_reply_to_email || null,
  };
}

function resolveCustomerRecipients(channel: 'email' | 'sms', customer: any): string[] {
  if (!customer) return [];
  if (channel === 'email') {
    const email = String(customer.email || '').trim().toLowerCase();
    return email ? [email] : [];
  }
  const phone = normalizePhone(customer.phone);
  return phone ? [phone] : [];
}

async function resolveOwnerRecipients(businessId: string, channel: 'email' | 'sms'): Promise<string[]> {
  if (channel === 'sms') return [];
  const { data, error } = await supabase
    .from('business_members')
    .select('user_id, role, profiles (email)')
    .eq('business_id', businessId)
    .in('role', ['Owner', 'Manager']);
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? [])
    .map((row: any) => one(row.profiles)?.email)
    .filter(Boolean)
    .map((email: string) => email.trim().toLowerCase())));
}

async function findOrCreateDelivery(
  job: NotificationJob,
  recipient: string,
  subject: string,
  message: string,
): Promise<DeliveryRow> {
  const { data: existing, error: existingError } = await supabase
    .from('notification_deliveries')
    .select('id, status, provider_message_id')
    .eq('appointment_notification_job_id', job.id)
    .eq('recipient', recipient)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as DeliveryRow;

  const { data, error } = await supabase
    .from('notification_deliveries')
    .insert({
      business_id: job.business_id,
      appointment_id: job.appointment_id,
      appointment_notification_job_id: job.id,
      channel: job.channel,
      provider: job.channel === 'email' ? 'resend' : 'twilio',
      recipient,
      subject: job.channel === 'email' ? subject : null,
      message,
      status: 'queued',
      idempotency_key: `appointment:${job.id}:${recipient}`,
      updated_at: new Date().toISOString(),
    })
    .select('id, status, provider_message_id')
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: raced, error: racedError } = await supabase
        .from('notification_deliveries')
        .select('id, status, provider_message_id')
        .eq('appointment_notification_job_id', job.id)
        .eq('recipient', recipient)
        .single();
      if (racedError) throw new Error(racedError.message);
      return raced as DeliveryRow;
    }
    throw new Error(error.message);
  }
  return data as DeliveryRow;
}

async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000).toISOString();
  await supabase
    .from('appointment_notification_jobs')
    .update({ status: 'queued', locked_at: null, available_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: 'Recovered stale processing lock' })
    .eq('status', 'processing')
    .lt('locked_at', cutoff);
}

async function cancelJob(jobId: string, reason: string) {
  await supabase
    .from('appointment_notification_jobs')
    .update({ status: 'cancelled', last_error: reason, locked_at: null, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

function one(value: any): any {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
