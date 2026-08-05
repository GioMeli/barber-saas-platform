import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  errorCode,
  errorMessage,
  formatAppointmentDateTime,
  normalizeCommunicationLocale,
  normalizePhone,
  renderReminder,
  resolveTenantFrom,
  retryAt,
  sendResendEmail,
  sendTwilioSms,
  type CommunicationLocale,
  type ReminderType,
} from '../_shared/communication.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REMINDER_FUNCTION_SECRET = Deno.env.get('REMINDER_FUNCTION_SECRET') || '';
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

const ACTIVE_STATUSES = ['pending', 'confirmed', 'arrived', 'in_progress'];
const BATCH_SIZE = 30;
const STALE_LOCK_MINUTES = 10;

type ReminderJob = {
  id: string;
  business_id: string;
  appointment_id: string;
  channel: 'email' | 'sms';
  reminder_type: ReminderType;
  scheduled_for: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
};

type DeliveryRow = { id: string; status: string; provider_message_id: string | null };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const suppliedSecret = req.headers.get('x-reminder-secret');
  if (!REMINDER_FUNCTION_SECRET || suppliedSecret !== REMINDER_FUNCTION_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  await recoverStaleJobs();

  const now = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from('reminder_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', now)
    .lte('available_at', now)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return json({ error: 'Failed to load reminder jobs' }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const job of (jobs ?? []) as ReminderJob[]) results.push(await processJob(job));

  return json({
    processed: results.length,
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    results,
  });
});

async function processJob(job: ReminderJob) {
  const nextAttempt = job.attempt_count + 1;
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('reminder_jobs')
    .update({ status: 'processing', locked_at: now, attempt_count: nextAttempt, updated_at: now })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('id')
    .maybeSingle();
  if (claimError) return { job_id: job.id, status: 'failed', reason: claimError.message };
  if (!claimed) return { job_id: job.id, status: 'skipped', reason: 'already_claimed' };

  try {
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        id, business_id, customer_id, employee_id, start_time, end_time, status,
        total_price, booking_reference,
        businesses (
          id, name, slug, logo_url, address, address_line_1, address_line_2,
          city, district, postal_code, phone, email, timezone, currency
        ),
        customers (id, full_name, email, phone),
        employees (id, name),
        appointment_services (price, duration, services (id, name))
      `)
      .eq('id', job.appointment_id)
      .single();
    if (appointmentError || !appointment) throw new Error(appointmentError?.message || 'Appointment not found');

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      await cancelJob(job.id, `Appointment status is ${appointment.status}`);
      return { job_id: job.id, status: 'skipped', reason: 'appointment_inactive' };
    }

    const customer = one(appointment.customers);
    const business = one(appointment.businesses);
    const employee = one(appointment.employees);
    if (!business) throw new Error('Business not found');

    const settings = await loadCommunicationSettings(job.business_id);
    if (job.channel === 'email' && settings.email_reminders_enabled === false) {
      await cancelJob(job.id, 'Email reminders are disabled');
      return { job_id: job.id, status: 'skipped', reason: 'email_reminders_disabled' };
    }
    if (job.channel === 'sms' && settings.sms_reminders_enabled !== true) {
      await cancelJob(job.id, 'SMS reminders are disabled');
      return { job_id: job.id, status: 'skipped', reason: 'sms_reminders_disabled' };
    }

    const recipient = job.channel === 'email'
      ? String(customer?.email || '').trim().toLowerCase()
      : normalizePhone(customer?.phone);
    if (!recipient) {
      await cancelJob(job.id, `Customer has no valid ${job.channel} destination`);
      return { job_id: job.id, status: 'skipped', reason: 'missing_destination' };
    }

    const locale = normalizeCommunicationLocale(settings.communication_locale) as CommunicationLocale;
    const { dateText, timeText } = formatAppointmentDateTime(appointment.start_time, business.timezone || 'UTC', locale);
    const services = (appointment.appointment_services ?? [])
      .map((row: any) => one(row.services)?.name)
      .filter(Boolean) as string[];
    const storeUrl = APP_PUBLIC_URL && business.slug
      ? `${APP_PUBLIC_URL}/app/${encodeURIComponent(business.slug)}`
      : '';
    const rendered = renderReminder(job.reminder_type, {
      businessName: business.name,
      businessEmail: business.email,
      replyToEmail: settings.communication_reply_to_email,
      logoUrl: business.logo_url,
      customerName: customer?.full_name || 'Customer',
      professionalName: employee?.name || 'Any available professional',
      dateText,
      timeText,
      services,
      totalPrice: Number(appointment.total_price || 0),
      currency: business.currency || 'EUR',
      bookingReference: appointment.booking_reference || appointment.id,
      address: [business.address_line_1 || business.address, business.address_line_2, business.city, business.district, business.postal_code].filter(Boolean).join(', '),
      phone: business.phone,
      storeUrl,
    }, locale);

    const delivery = await findOrCreateDelivery(job, recipient, rendered.subject, job.channel === 'email' ? rendered.text : rendered.sms);
    if (delivery.status === 'sent' || delivery.status === 'delivered') {
      await markJobSent(job.id, delivery.provider_message_id || '');
      return { job_id: job.id, status: 'sent', channel: job.channel, reused_delivery: true };
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
            idempotencyKey: `reminder:${job.id}:${recipient}`,
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
        .update({ status: 'sent', provider_message_id: providerMessageId, sent_at: sentAt, failure_code: null, failure_reason: null, updated_at: sentAt })
        .eq('id', delivery.id);
      await markJobSent(job.id, providerMessageId);
      return { job_id: job.id, status: 'sent', channel: job.channel, provider_message_id: providerMessageId };
    } catch (deliveryError) {
      await supabase
        .from('notification_deliveries')
        .update({ status: 'failed', failure_code: errorCode(deliveryError), failure_reason: errorMessage(deliveryError).slice(0, 2000), updated_at: new Date().toISOString() })
        .eq('id', delivery.id);
      throw deliveryError;
    }
  } catch (error) {
    const message = errorMessage(error).slice(0, 2000);
    const terminalFailure = nextAttempt >= job.max_attempts;
    await supabase
      .from('reminder_jobs')
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

async function loadCommunicationSettings(businessId: string) {
  const { data, error } = await supabase
    .from('business_settings')
    .select('email_reminders_enabled, sms_reminders_enabled, communication_locale, communication_reply_to_email')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    email_reminders_enabled: data?.email_reminders_enabled !== false,
    sms_reminders_enabled: data?.sms_reminders_enabled === true,
    communication_locale: data?.communication_locale || 'en',
    communication_reply_to_email: data?.communication_reply_to_email || null,
  };
}

async function findOrCreateDelivery(job: ReminderJob, recipient: string, subject: string, message: string): Promise<DeliveryRow> {
  const { data: existing, error: existingError } = await supabase
    .from('notification_deliveries')
    .select('id, status, provider_message_id')
    .eq('reminder_job_id', job.id)
    .eq('recipient', recipient)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as DeliveryRow;

  const { data, error } = await supabase
    .from('notification_deliveries')
    .insert({
      business_id: job.business_id,
      appointment_id: job.appointment_id,
      reminder_job_id: job.id,
      channel: job.channel,
      provider: job.channel === 'email' ? 'resend' : 'twilio',
      recipient,
      subject: job.channel === 'email' ? subject : null,
      message,
      status: 'queued',
      idempotency_key: `reminder:${job.id}:${recipient}`,
      updated_at: new Date().toISOString(),
    })
    .select('id, status, provider_message_id')
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: raced, error: racedError } = await supabase
        .from('notification_deliveries')
        .select('id, status, provider_message_id')
        .eq('reminder_job_id', job.id)
        .eq('recipient', recipient)
        .single();
      if (racedError) throw new Error(racedError.message);
      return raced as DeliveryRow;
    }
    throw new Error(error.message);
  }
  return data as DeliveryRow;
}

async function markJobSent(jobId: string, providerMessageId: string) {
  const sentAt = new Date().toISOString();
  await supabase
    .from('reminder_jobs')
    .update({ status: 'sent', sent_at: sentAt, provider_message_id: providerMessageId, last_error: null, locked_at: null, updated_at: sentAt })
    .eq('id', jobId);
}

async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000).toISOString();
  await supabase
    .from('reminder_jobs')
    .update({ status: 'queued', locked_at: null, available_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: 'Recovered stale processing lock' })
    .eq('status', 'processing')
    .lt('locked_at', cutoff);
}

async function cancelJob(jobId: string, reason: string) {
  await supabase
    .from('reminder_jobs')
    .update({ status: 'cancelled', last_error: reason, locked_at: null, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

function one(value: any): any {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
