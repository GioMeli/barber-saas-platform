import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const REMINDER_FUNCTION_SECRET = Deno.env.get('REMINDER_FUNCTION_SECRET')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!;
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ACTIVE_STATUSES = ['pending', 'confirmed', 'arrived', 'in_progress'];
const BATCH_SIZE = 25;

type ReminderJob = {
  id: string;
  business_id: string;
  appointment_id: string;
  channel: 'email' | 'sms';
  reminder_type: '24_hour' | '2_hour';
  scheduled_for: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const suppliedSecret = req.headers.get('x-reminder-secret');
  if (!REMINDER_FUNCTION_SECRET || suppliedSecret !== REMINDER_FUNCTION_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return json({ error: 'Email provider is not configured' }, 500);
  }

  const now = new Date().toISOString();

  const { data: jobs, error: jobsError } = await supabase
    .from('reminder_jobs')
    .select('*')
    .eq('channel', 'email')
    .eq('status', 'queued')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE);

  if (jobsError) {
    console.error('Failed to load reminder jobs', jobsError);
    return json({ error: 'Failed to load reminder jobs' }, 500);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const job of (jobs ?? []) as ReminderJob[]) {
    const result = await processEmailJob(job);
    results.push(result);
  }

  return json({
    processed: results.length,
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    results,
  });
});

async function processEmailJob(job: ReminderJob) {
  const nextAttempt = job.attempt_count + 1;

  // Atomic claim: only one invocation can move this queued job to processing.
  const { data: claimedJob, error: claimError } = await supabase
    .from('reminder_jobs')
    .update({
      status: 'processing',
      locked_at: new Date().toISOString(),
      attempt_count: nextAttempt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.error(`Claim failed for ${job.id}`, claimError);
    return { job_id: job.id, status: 'failed', reason: 'claim_failed' };
  }

  if (!claimedJob) {
    return { job_id: job.id, status: 'skipped', reason: 'already_claimed' };
  }

  let deliveryId: string | null = null;

  try {
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        id,
        business_id,
        customer_id,
        employee_id,
        start_time,
        end_time,
        status,
        total_price,
        booking_reference,
        businesses (
          id,
          name,
          slug,
          logo_url,
          address,
          address_line_1,
          address_line_2,
          city,
          district,
          postal_code,
          phone,
          timezone
        ),
        customers (
          id,
          full_name,
          email,
          phone
        ),
        employees (
          id,
          name
        ),
        appointment_services (
          price,
          duration,
          services (
            id,
            name
          )
        )
      `)
      .eq('id', job.appointment_id)
      .single();

    if (appointmentError || !appointment) {
      throw new Error(appointmentError?.message || 'Appointment not found');
    }

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      await cancelJob(job.id, `Appointment status is ${appointment.status}`);
      return { job_id: job.id, status: 'skipped', reason: 'appointment_inactive' };
    }

    const customer = one(appointment.customers);
    const business = one(appointment.businesses);
    const employee = one(appointment.employees);

    if (!customer?.email) {
      await cancelJob(job.id, 'Customer has no email address');
      return { job_id: job.id, status: 'skipped', reason: 'missing_email' };
    }

    if (!business) {
      throw new Error('Business not found');
    }

    const services = (appointment.appointment_services ?? [])
      .map((row: any) => one(row.services)?.name)
      .filter(Boolean) as string[];

    const timezone = business.timezone || 'UTC';
    const start = new Date(appointment.start_time);
    const dateText = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(start);

    const timeText = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(start);

    const reminderLabel =
      job.reminder_type === '24_hour' ? 'tomorrow' : 'in about 2 hours';

    const subject = `${business.name}: appointment reminder ${reminderLabel}`;
    const storeUrl = APP_PUBLIC_URL
      ? `${APP_PUBLIC_URL}/app/${encodeURIComponent(business.slug)}`
      : '';

    const address = [
      business.address_line_1 || business.address,
      business.address_line_2,
      business.city,
      business.district,
      business.postal_code,
    ]
      .filter(Boolean)
      .join(', ');

    const html = buildEmail({
      businessName: business.name,
      logoUrl: business.logo_url,
      customerName: customer.full_name,
      reminderLabel,
      dateText,
      timeText,
      employeeName: employee?.name || 'Your professional',
      services,
      totalPrice: Number(appointment.total_price || 0),
      bookingReference: appointment.booking_reference,
      address,
      phone: business.phone,
      storeUrl,
    });

    const message = [
      `Appointment reminder ${reminderLabel} at ${business.name}.`,
      `${dateText} at ${timeText}.`,
      services.length ? `Services: ${services.join(', ')}.` : '',
      `Booking reference: ${appointment.booking_reference}.`,
    ]
      .filter(Boolean)
      .join(' ');

    const { data: delivery, error: deliveryError } = await supabase
      .from('notification_deliveries')
      .insert({
        business_id: job.business_id,
        appointment_id: job.appointment_id,
        reminder_job_id: job.id,
        channel: 'email',
        provider: 'resend',
        recipient: customer.email,
        subject,
        message,
        status: 'queued',
      })
      .select('id')
      .single();

    if (deliveryError) throw new Error(deliveryError.message);
    deliveryId = delivery.id;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [customer.email],
        subject,
        html,
      }),
    });

    const resendBody = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        `Resend ${resendResponse.status}: ${
          resendBody?.message || JSON.stringify(resendBody)
        }`
      );
    }

    const sentAt = new Date().toISOString();

    const { error: jobUpdateError } = await supabase
      .from('reminder_jobs')
      .update({
        status: 'sent',
        sent_at: sentAt,
        provider_message_id: resendBody.id,
        last_error: null,
        locked_at: null,
        updated_at: sentAt,
      })
      .eq('id', job.id);

    if (jobUpdateError) throw new Error(jobUpdateError.message);

    await supabase
      .from('notification_deliveries')
      .update({
        status: 'sent',
        provider_message_id: resendBody.id,
        sent_at: sentAt,
        failure_reason: null,
      })
      .eq('id', deliveryId);

    return {
      job_id: job.id,
      status: 'sent',
      provider_message_id: resendBody.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Reminder job ${job.id} failed`, message);

    const terminalFailure = nextAttempt >= job.max_attempts;
    const nextStatus = terminalFailure ? 'failed' : 'queued';

    await supabase
      .from('reminder_jobs')
      .update({
        status: nextStatus,
        last_error: message.slice(0, 2000),
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (deliveryId) {
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          failure_reason: message.slice(0, 2000),
        })
        .eq('id', deliveryId);
    }

    return {
      job_id: job.id,
      status: 'failed',
      retryable: !terminalFailure,
      reason: message,
    };
  }
}

async function cancelJob(jobId: string, reason: string) {
  await supabase
    .from('reminder_jobs')
    .update({
      status: 'cancelled',
      last_error: reason,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

function one(value: any): any {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmail(data: {
  businessName: string;
  logoUrl?: string | null;
  customerName: string;
  reminderLabel: string;
  dateText: string;
  timeText: string;
  employeeName: string;
  services: string[];
  totalPrice: number;
  bookingReference: string;
  address: string;
  phone?: string | null;
  storeUrl: string;
}) {
  const serviceRows = data.services.length
    ? data.services
        .map(
          (service) =>
            `<div style="padding:8px 0;border-bottom:1px solid #ececec;">${escapeHtml(service)}</div>`
        )
        .join('')
    : '<div style="padding:8px 0;color:#666;">Appointment service</div>';

  const logo = data.logoUrl
    ? `<img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.businessName)}" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:14px;object-fit:cover;margin-bottom:18px;">`
    : '';

  const button = data.storeUrl
    ? `<a href="${escapeHtml(data.storeUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700;">View store</a>`
    : '';

  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;padding:28px 14px;">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;">
      <div style="background:#111;padding:28px;color:#fff;">
        ${logo}
        <div style="font-size:13px;color:#d4af37;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;">Appointment reminder</div>
        <h1 style="margin:10px 0 0;font-size:27px;line-height:1.25;">See you ${escapeHtml(data.reminderLabel)}</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 20px;line-height:1.7;">Hello ${escapeHtml(data.customerName)}, this is a reminder for your appointment at <strong>${escapeHtml(data.businessName)}</strong>.</p>

        <div style="background:#fafafa;border:1px solid #ececec;border-radius:14px;padding:18px;margin-bottom:22px;">
          <div style="font-size:13px;color:#71717a;">Date</div>
          <div style="font-weight:700;margin-top:4px;">${escapeHtml(data.dateText)}</div>
          <div style="font-size:13px;color:#71717a;margin-top:14px;">Time</div>
          <div style="font-size:24px;font-weight:800;margin-top:4px;">${escapeHtml(data.timeText)}</div>
          <div style="font-size:13px;color:#71717a;margin-top:14px;">Professional</div>
          <div style="font-weight:700;margin-top:4px;">${escapeHtml(data.employeeName)}</div>
        </div>

        <h2 style="font-size:16px;margin:0 0 8px;">Services</h2>
        <div style="margin-bottom:20px;">${serviceRows}</div>

        <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid #ececec;padding-top:16px;margin-bottom:22px;">
          <span style="color:#71717a;">Total</span>
          <strong>€${data.totalPrice.toFixed(2)}</strong>
        </div>

        <p style="font-size:13px;color:#71717a;line-height:1.6;">
          Booking reference: <strong>${escapeHtml(data.bookingReference)}</strong><br>
          ${data.address ? `${escapeHtml(data.address)}<br>` : ''}
          ${data.phone ? `${escapeHtml(data.phone)}` : ''}
        </p>

        ${button}
      </div>
    </div>
    <p style="text-align:center;color:#a1a1aa;font-size:11px;line-height:1.5;margin:16px 0 0;">
      This transactional reminder was sent for an existing appointment.
    </p>
  </div>
</body>
</html>`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
