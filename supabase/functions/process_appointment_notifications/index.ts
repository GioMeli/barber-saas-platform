import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const NOTIFICATION_FUNCTION_SECRET =
  Deno.env.get('NOTIFICATION_FUNCTION_SECRET')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!;
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 25;

type NotificationJob = {
  id: string;
  business_id: string;
  appointment_id: string;
  event_type:
    | 'booking_confirmation'
    | 'owner_new_booking'
    | 'appointment_cancelled'
    | 'appointment_rescheduled'
    | 'owner_appointment_rescheduled';
  recipient_type: 'customer' | 'owner';
  channel: 'email';
  status: string;
  attempt_count: number;
  max_attempts: number;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const suppliedSecret = req.headers.get('x-notification-secret');

  if (
    !NOTIFICATION_FUNCTION_SECRET ||
    suppliedSecret !== NOTIFICATION_FUNCTION_SECRET
  ) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return json({ error: 'Email provider is not configured' }, 500);
  }

  const { data: jobs, error } = await supabase
    .from('appointment_notification_jobs')
    .select('*')
    .eq('channel', 'email')
    .eq('status', 'queued')
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('Failed to load notification jobs', error);
    return json({ error: 'Failed to load notification jobs' }, 500);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const job of (jobs ?? []) as NotificationJob[]) {
    results.push(await processJob(job));
  }

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

  const { data: claimed, error: claimError } = await supabase
    .from('appointment_notification_jobs')
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
    return {
      job_id: job.id,
      status: 'failed',
      reason: claimError.message,
    };
  }

  if (!claimed) {
    return {
      job_id: job.id,
      status: 'skipped',
      reason: 'already_claimed',
    };
  }

  try {
    const context = await loadAppointmentContext(job.appointment_id);

    if (!context) {
      throw new Error('Appointment context not found');
    }

    const recipients =
      job.recipient_type === 'customer'
        ? resolveCustomerRecipients(context)
        : await resolveOwnerRecipients(job.business_id);

    if (recipients.length === 0) {
      await cancelJob(job.id, `No ${job.recipient_type} email address found`);

      return {
        job_id: job.id,
        status: 'skipped',
        reason: 'missing_recipient',
      };
    }

    const content = buildContent(job.event_type, context);

    const deliveryIds: string[] = [];
    const providerIds: string[] = [];

    for (const recipient of recipients) {
      const { data: delivery, error: deliveryError } = await supabase
        .from('notification_deliveries')
        .insert({
          business_id: job.business_id,
          appointment_id: job.appointment_id,
          channel: 'email',
          provider: 'resend',
          recipient,
          subject: content.subject,
          message: content.plainText,
          status: 'queued',
        })
        .select('id')
        .single();

      if (deliveryError) {
        throw new Error(deliveryError.message);
      }

      deliveryIds.push(delivery.id);

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [recipient],
          subject: content.subject,
          html: content.html,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        await supabase
          .from('notification_deliveries')
          .update({
            status: 'failed',
            failure_reason: String(
              body?.message || JSON.stringify(body)
            ).slice(0, 2000),
          })
          .eq('id', delivery.id);

        throw new Error(
          `Resend ${response.status}: ${
            body?.message || JSON.stringify(body)
          }`
        );
      }

      providerIds.push(body.id);

      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          provider_message_id: body.id,
          sent_at: new Date().toISOString(),
          failure_reason: null,
        })
        .eq('id', delivery.id);
    }

    const sentAt = new Date().toISOString();

    await supabase
      .from('appointment_notification_jobs')
      .update({
        status: 'sent',
        sent_at: sentAt,
        provider_message_id: providerIds.join(','),
        last_error: null,
        locked_at: null,
        updated_at: sentAt,
      })
      .eq('id', job.id);

    return {
      job_id: job.id,
      status: 'sent',
      recipients: recipients.length,
      provider_message_ids: providerIds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const terminalFailure = nextAttempt >= job.max_attempts;

    await supabase
      .from('appointment_notification_jobs')
      .update({
        status: terminalFailure ? 'failed' : 'queued',
        last_error: message.slice(0, 2000),
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return {
      job_id: job.id,
      status: 'failed',
      retryable: !terminalFailure,
      reason: message,
    };
  }
}

async function loadAppointmentContext(appointmentId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      business_id,
      start_time,
      end_time,
      status,
      total_duration,
      total_price,
      booking_reference,
      notes,
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
        email,
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
    .eq('id', appointmentId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function resolveCustomerRecipients(context: any): string[] {
  const customer = one(context.customers);
  return customer?.email ? [String(customer.email).trim().toLowerCase()] : [];
}

async function resolveOwnerRecipients(businessId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select(`
      user_id,
      role,
      profiles (
        email
      )
    `)
    .eq('business_id', businessId)
    .in('role', ['Owner', 'Manager']);

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row: any) => one(row.profiles)?.email)
        .filter(Boolean)
        .map((email: string) => email.trim().toLowerCase())
    )
  );
}

function buildContent(eventType: NotificationJob['event_type'], context: any) {
  const business = one(context.businesses);
  const customer = one(context.customers);
  const employee = one(context.employees);

  if (!business) {
    throw new Error('Business not found');
  }

  const timezone = business.timezone || 'UTC';
  const start = new Date(context.start_time);

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

  const services = (context.appointment_services ?? [])
    .map((row: any) => one(row.services)?.name)
    .filter(Boolean) as string[];

  const storeUrl = APP_PUBLIC_URL
    ? `${APP_PUBLIC_URL}/app/${encodeURIComponent(business.slug)}`
    : '';

  const customerName = customer?.full_name || 'Customer';
  const professionalName = employee?.name || 'Any available professional';

  const common = {
    businessName: business.name,
    logoUrl: business.logo_url,
    customerName,
    dateText,
    timeText,
    services,
    professionalName,
    totalPrice: Number(context.total_price || 0),
    bookingReference: context.booking_reference,
    address: [
      business.address_line_1 || business.address,
      business.address_line_2,
      business.city,
      business.district,
      business.postal_code,
    ]
      .filter(Boolean)
      .join(', '),
    phone: business.phone,
    storeUrl,
  };

  switch (eventType) {
    case 'booking_confirmation':
      return emailTemplate({
        ...common,
        eyebrow: 'Booking confirmed',
        heading: 'Your appointment is confirmed',
        intro: `Hello ${customerName}, your appointment at ${business.name} has been booked successfully.`,
        subject: `${business.name}: booking confirmation`,
        actionLabel: 'View store',
      });

    case 'owner_new_booking':
      return emailTemplate({
        ...common,
        eyebrow: 'New appointment',
        heading: 'A new appointment was booked',
        intro: `${customerName} created a new appointment at ${business.name}.`,
        subject: `${business.name}: new appointment from ${customerName}`,
        actionLabel: 'Open booking page',
      });

    case 'appointment_cancelled':
      return emailTemplate({
        ...common,
        eyebrow: 'Appointment cancelled',
        heading: 'Your appointment has been cancelled',
        intro: `Your appointment at ${business.name} is no longer active.`,
        subject: `${business.name}: appointment cancelled`,
        actionLabel: 'Book another appointment',
        danger: true,
      });

    case 'appointment_rescheduled':
      return emailTemplate({
        ...common,
        eyebrow: 'Appointment updated',
        heading: 'Your appointment details changed',
        intro: `Your appointment at ${business.name} has been updated. Please review the new date and time below.`,
        subject: `${business.name}: appointment updated`,
        actionLabel: 'View store',
      });

    case 'owner_appointment_rescheduled':
      return emailTemplate({
        ...common,
        eyebrow: 'Appointment updated',
        heading: 'An appointment was rescheduled',
        intro: `${customerName}'s appointment details have changed.`,
        subject: `${business.name}: appointment rescheduled`,
        actionLabel: 'Open booking page',
      });
  }
}

function emailTemplate(data: {
  businessName: string;
  logoUrl?: string | null;
  customerName: string;
  dateText: string;
  timeText: string;
  services: string[];
  professionalName: string;
  totalPrice: number;
  bookingReference: string;
  address: string;
  phone?: string | null;
  storeUrl: string;
  eyebrow: string;
  heading: string;
  intro: string;
  subject: string;
  actionLabel: string;
  danger?: boolean;
}) {
  const accent = data.danger ? '#dc2626' : '#d4af37';

  const servicesHtml = data.services.length
    ? data.services
        .map(
          (service) =>
            `<div style="padding:7px 0;border-bottom:1px solid #ececec;">${escapeHtml(service)}</div>`
        )
        .join('')
    : '<div style="padding:7px 0;color:#71717a;">Appointment service</div>';

  const logo = data.logoUrl
    ? `<img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.businessName)}" width="54" height="54" style="display:block;width:54px;height:54px;border-radius:14px;object-fit:cover;margin-bottom:18px;">`
    : '';

  const action = data.storeUrl
    ? `<a href="${escapeHtml(data.storeUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700;">${escapeHtml(data.actionLabel)}</a>`
    : '';

  const plainText = [
    data.heading,
    data.intro,
    `${data.dateText} at ${data.timeText}`,
    `Professional: ${data.professionalName}`,
    data.services.length ? `Services: ${data.services.join(', ')}` : '',
    `Booking reference: ${data.bookingReference}`,
  ]
    .filter(Boolean)
    .join(' ');

  const html = `<!doctype html>
<html>
<body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;padding:28px 14px;">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;">
      <div style="background:#111;padding:28px;color:#fff;">
        ${logo}
        <div style="font-size:13px;color:${accent};font-weight:700;text-transform:uppercase;letter-spacing:1.4px;">${escapeHtml(data.eyebrow)}</div>
        <h1 style="margin:10px 0 0;font-size:27px;line-height:1.25;">${escapeHtml(data.heading)}</h1>
      </div>

      <div style="padding:28px;">
        <p style="margin:0 0 20px;line-height:1.7;">${escapeHtml(data.intro)}</p>

        <div style="background:#fafafa;border:1px solid #ececec;border-radius:14px;padding:18px;margin-bottom:22px;">
          <div style="font-size:13px;color:#71717a;">Date</div>
          <div style="font-weight:700;margin-top:4px;">${escapeHtml(data.dateText)}</div>

          <div style="font-size:13px;color:#71717a;margin-top:14px;">Time</div>
          <div style="font-size:24px;font-weight:800;margin-top:4px;">${escapeHtml(data.timeText)}</div>

          <div style="font-size:13px;color:#71717a;margin-top:14px;">Professional</div>
          <div style="font-weight:700;margin-top:4px;">${escapeHtml(data.professionalName)}</div>
        </div>

        <h2 style="font-size:16px;margin:0 0 8px;">Services</h2>
        <div style="margin-bottom:20px;">${servicesHtml}</div>

        <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid #ececec;padding-top:16px;margin-bottom:22px;">
          <span style="color:#71717a;">Total</span>
          <strong>€${data.totalPrice.toFixed(2)}</strong>
        </div>

        <p style="font-size:13px;color:#71717a;line-height:1.6;">
          Booking reference: <strong>${escapeHtml(data.bookingReference)}</strong><br>
          ${data.address ? `${escapeHtml(data.address)}<br>` : ''}
          ${data.phone ? escapeHtml(data.phone) : ''}
        </p>

        ${action}
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: data.subject,
    plainText,
    html,
  };
}

async function cancelJob(jobId: string, reason: string) {
  await supabase
    .from('appointment_notification_jobs')
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
