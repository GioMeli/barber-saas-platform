import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MARKETING_FUNCTION_SECRET = Deno.env.get('MARKETING_FUNCTION_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');
const MARKETING_TEST_EMAIL = Deno.env.get('MARKETING_TEST_EMAIL') || '';
const MARKETING_TEST_PHONE = Deno.env.get('MARKETING_TEST_PHONE') || '';
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '';
const TWILIO_STATUS_CALLBACK_URL = Deno.env.get('TWILIO_STATUS_CALLBACK_URL') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 25;
const TERMINAL_FAILURE_CODES = new Set([
  'invalid_recipient',
  'email_consent_missing',
  'sms_consent_missing',
  'email_suppressed',
  'sms_suppressed',
  'customer_account_missing',
  'email_provider_not_configured',
  'sms_provider_not_configured',
]);

type Delivery = {
  id: string;
  run_id: string;
  business_id: string;
  campaign_id: string | null;
  automation_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  appointment_id: string | null;
  channel: 'email' | 'sms' | 'in_app';
  destination: string;
  customer_name: string | null;
  subject: string | null;
  message: string;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
  metadata: Record<string, unknown> | null;
};

type Revalidation = {
  allowed: boolean;
  current_destination: string | null;
  delivery_mode: 'disabled' | 'test' | 'live';
  reason: string | null;
  unsubscribe_token: string | null;
  business_name: string | null;
  business_slug: string | null;
};

type DeliverySettings = {
  business_id: string;
  delivery_mode: 'disabled' | 'test' | 'live';
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  daily_email_limit: number;
  daily_sms_limit: number;
  from_name: string | null;
  reply_to_email: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!MARKETING_FUNCTION_SECRET || req.headers.get('x-marketing-secret') !== MARKETING_FUNCTION_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const workerId = crypto.randomUUID();

  try {
    await recoverStaleClaims();

    const { data: campaignsQueued, error: campaignError } = await supabase.rpc(
      'service_queue_due_marketing_campaigns',
      { p_limit: 20 },
    );
    if (campaignError) throw campaignError;

    const { data: automationsQueued, error: automationError } = await supabase.rpc(
      'service_prepare_marketing_automations',
      { p_limit: 100 },
    );
    if (automationError) throw automationError;

    const { data: claimed, error: claimError } = await supabase.rpc(
      'claim_marketing_deliveries',
      { p_worker_id: workerId, p_limit: BATCH_SIZE },
    );
    if (claimError) throw claimError;

    const settingsCache = new Map<string, DeliverySettings>();
    const dailyCountCache = new Map<string, number>();
    const results: Array<Record<string, unknown>> = [];

    for (const delivery of (claimed ?? []) as Delivery[]) {
      results.push(
        await processDelivery(delivery, settingsCache, dailyCountCache),
      );
    }

    return json({
      worker_id: workerId,
      campaigns_queued: Number(campaignsQueued ?? 0),
      automations_queued: Number(automationsQueued ?? 0),
      claimed: results.length,
      sent: results.filter((item) => item.status === 'sent').length,
      delivered: results.filter((item) => item.status === 'delivered').length,
      simulated: results.filter((item) => item.status === 'simulated').length,
      failed: results.filter((item) => item.status === 'failed').length,
      skipped: results.filter((item) => item.status === 'skipped').length,
      results,
    });
  } catch (error) {
    console.error('Marketing delivery worker failed', error);
    return json({ error: errorMessage(error) }, 500);
  }
});

async function processDelivery(
  delivery: Delivery,
  settingsCache: Map<string, DeliverySettings>,
  dailyCountCache: Map<string, number>,
) {
  try {
    const revalidation = await revalidate(delivery.id);

    if (!revalidation.allowed) {
      if (revalidation.reason === 'delivery_disabled') {
        await releaseForRetry(delivery, 'delivery_disabled', 'Delivery mode is disabled', 30);
        return { delivery_id: delivery.id, status: 'deferred', reason: 'delivery_disabled' };
      }

      await markSkipped(delivery.id, revalidation.reason || 'not_eligible');
      return { delivery_id: delivery.id, status: 'skipped', reason: revalidation.reason };
    }

    if (!revalidation.current_destination) {
      await markSkipped(delivery.id, 'invalid_recipient');
      return { delivery_id: delivery.id, status: 'skipped', reason: 'invalid_recipient' };
    }

    const settings = await loadSettings(delivery.business_id, settingsCache);
    const destination = revalidation.current_destination;

    if (settings.delivery_mode === 'disabled') {
      await releaseForRetry(delivery, 'delivery_disabled', 'Delivery mode is disabled', 30);
      return { delivery_id: delivery.id, status: 'deferred', reason: 'delivery_disabled' };
    }

    const channelEnabled = delivery.channel === 'email'
      ? settings.email_enabled
      : delivery.channel === 'sms'
        ? settings.sms_enabled
        : settings.in_app_enabled;

    if (!channelEnabled) {
      await releaseForRetry(delivery, 'channel_disabled', 'The selected delivery channel is disabled', 30);
      return { delivery_id: delivery.id, status: 'deferred', reason: 'channel_disabled' };
    }

    const content = renderContent(delivery, revalidation);

    if (settings.delivery_mode === 'test') {
      return await processTestDelivery(delivery, content, settings);
    }

    if (delivery.channel !== 'in_app') {
      const allowedToday = await withinDailyLimit(delivery, settings, dailyCountCache);
      if (!allowedToday) {
        await deferUntilTomorrow(delivery.id, 'daily_limit_reached');
        return { delivery_id: delivery.id, status: 'deferred', reason: 'daily_limit_reached' };
      }
    }

    if (delivery.channel === 'email') {
      const providerId = await sendEmail(
        delivery,
        destination,
        content,
        settings,
        revalidation.unsubscribe_token,
      );
      await markSent(delivery.id, 'resend', providerId, destination);
      incrementDailyCount(delivery, dailyCountCache);
      return { delivery_id: delivery.id, status: 'sent', provider: 'resend', provider_message_id: providerId };
    }

    if (delivery.channel === 'sms') {
      const providerId = await sendSms(delivery, destination, content.text);
      await markSent(delivery.id, 'twilio', providerId, destination);
      incrementDailyCount(delivery, dailyCountCache);
      return { delivery_id: delivery.id, status: 'sent', provider: 'twilio', provider_message_id: providerId };
    }

    await createInAppNotification(delivery, content);
    await supabase
      .from('marketing_deliveries')
      .update({
        status: 'delivered',
        provider: 'velliqo_in_app',
        destination,
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        failure_code: null,
        failure_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id);

    return { delivery_id: delivery.id, status: 'delivered', provider: 'velliqo_in_app' };
  } catch (error) {
    const message = errorMessage(error);
    const code = providerErrorCode(error);
    const retryable = delivery.attempt_count < delivery.max_attempts
      && !TERMINAL_FAILURE_CODES.has(code)
      && isRetryableProviderFailure(delivery.channel, code);

    if (!retryable) {
      await supabase
        .from('marketing_deliveries')
        .update({
          status: 'failed',
          failure_code: code,
          failure_message: message.slice(0, 2000),
          failed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
    } else {
      await releaseForRetry(delivery, code, message, backoffMinutes(delivery.attempt_count));
    }

    return {
      delivery_id: delivery.id,
      status: 'failed',
      retryable,
      reason: message,
      code,
    };
  }
}

async function processTestDelivery(
  delivery: Delivery,
  content: { subject: string; html: string; text: string },
  settings: DeliverySettings,
) {
  const testProvider = delivery.channel === 'email'
    ? 'resend_test'
    : delivery.channel === 'sms'
      ? 'twilio_test'
      : null;

  if (testProvider && await testSampleAlreadySent(delivery.run_id, testProvider)) {
    await markSimulated(delivery, 'test_sample_already_sent');
    return { delivery_id: delivery.id, status: 'simulated', test: true, reason: 'test_sample_already_sent' };
  }

  if (delivery.channel === 'email' && MARKETING_TEST_EMAIL) {
    const providerId = await sendEmail(
      delivery,
      MARKETING_TEST_EMAIL,
      { ...content, subject: `[Velliqo test] ${content.subject}` },
      settings,
      null,
    );
    await markSent(delivery.id, 'resend_test', providerId, MARKETING_TEST_EMAIL, {
      ...(delivery.metadata || {}),
      original_destination: delivery.destination,
      test_sample: true,
    });
    return { delivery_id: delivery.id, status: 'sent', test: true, provider_message_id: providerId };
  }

  if (delivery.channel === 'sms' && MARKETING_TEST_PHONE) {
    const providerId = await sendSms(delivery, MARKETING_TEST_PHONE, `[Velliqo test] ${content.text}`);
    await markSent(delivery.id, 'twilio_test', providerId, MARKETING_TEST_PHONE, {
      ...(delivery.metadata || {}),
      original_destination: delivery.destination,
      test_sample: true,
    });
    return { delivery_id: delivery.id, status: 'sent', test: true, provider_message_id: providerId };
  }

  await markSimulated(delivery, 'test_destination_not_configured');
  return { delivery_id: delivery.id, status: 'simulated', test: true, reason: 'test_destination_not_configured' };
}

async function testSampleAlreadySent(runId: string, provider: string) {
  const { count, error } = await supabase
    .from('marketing_deliveries')
    .select('id', { head: true, count: 'exact' })
    .eq('run_id', runId)
    .eq('provider', provider)
    .in('status', ['sent', 'delivered']);

  if (error) throw error;
  return (count || 0) > 0;
}

async function markSimulated(delivery: Delivery, reason: string) {
  const { error } = await supabase
    .from('marketing_deliveries')
    .update({
      status: 'simulated',
      provider: 'velliqo_simulator',
      sent_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      failure_code: reason,
      failure_message: reason,
      metadata: {
        ...(delivery.metadata || {}),
        simulated_destination: delivery.destination,
        simulation_reason: reason,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id);
  if (error) throw error;
}

async function sendEmail(
  delivery: Delivery,
  destination: string,
  content: { subject: string; html: string; text: string },
  settings: DeliverySettings,
  unsubscribeToken: string | null,
) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw codedError('email_provider_not_configured', 'Resend is not configured');
  }

  const unsubscribeUrl = unsubscribeToken
    ? `${SUPABASE_URL}/functions/v1/marketing-unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&channel=email`
    : null;

  const from = settings.from_name
    ? `${sanitizeHeader(settings.from_name)} <${extractEmailAddress(EMAIL_FROM)}>`
    : EMAIL_FROM;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': delivery.idempotency_key.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [destination],
      subject: content.subject,
      html: unsubscribeUrl
        ? `${content.html}<p style="margin-top:24px;font-size:12px;color:#64748b"><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from marketing emails</a></p>`
        : content.html,
      text: unsubscribeUrl ? `${content.text}\n\nUnsubscribe: ${unsubscribeUrl}` : content.text,
      reply_to: settings.reply_to_email || undefined,
      headers: unsubscribeUrl
        ? {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
    }),
  });

  const body = await safeJson(response);
  if (!response.ok || !body?.id) {
    throw codedError(
      `resend_${response.status}`,
      String(body?.message || body?.error || JSON.stringify(body)).slice(0, 2000),
    );
  }

  return String(body.id);
}

async function sendSms(delivery: Delivery, destination: string, message: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER)) {
    throw codedError('sms_provider_not_configured', 'Twilio is not configured');
  }

  const form = new URLSearchParams({
    To: destination,
    Body: message.slice(0, 1500),
  });

  if (TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
  else form.set('From', TWILIO_FROM_NUMBER);

  if (TWILIO_STATUS_CALLBACK_URL) {
    form.set('StatusCallback', TWILIO_STATUS_CALLBACK_URL);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
  );

  const body = await safeJson(response);
  if (!response.ok || !body?.sid) {
    throw codedError(
      `twilio_${body?.code || response.status}`,
      String(body?.message || JSON.stringify(body)).slice(0, 2000),
    );
  }

  return String(body.sid);
}

async function createInAppNotification(
  delivery: Delivery,
  content: { subject: string; text: string },
) {
  if (!delivery.user_id) throw codedError('customer_account_missing', 'Customer account is missing');

  const { error } = await supabase.from('customer_notifications').upsert(
    {
      business_id: delivery.business_id,
      user_id: delivery.user_id,
      customer_id: delivery.customer_id,
      delivery_id: delivery.id,
      title: content.subject,
      message: content.text,
      notification_type: 'marketing',
      metadata: {
        campaign_id: delivery.campaign_id,
        automation_id: delivery.automation_id,
      },
    },
    { onConflict: 'delivery_id' },
  );

  if (error) throw codedError('in_app_insert_failed', error.message);
}

async function revalidate(deliveryId: string): Promise<Revalidation> {
  const { data, error } = await supabase.rpc('revalidate_marketing_delivery', {
    p_delivery_id: deliveryId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw codedError('revalidation_failed', 'Delivery revalidation returned no result');
  return row as Revalidation;
}

async function loadSettings(
  businessId: string,
  cache: Map<string, DeliverySettings>,
): Promise<DeliverySettings> {
  const cached = cache.get(businessId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('marketing_delivery_settings')
    .select('*')
    .eq('business_id', businessId)
    .single();
  if (error) throw error;

  cache.set(businessId, data as DeliverySettings);
  return data as DeliverySettings;
}

async function withinDailyLimit(
  delivery: Delivery,
  settings: DeliverySettings,
  cache: Map<string, number>,
) {
  const limit = delivery.channel === 'email' ? settings.daily_email_limit : settings.daily_sms_limit;
  if (limit <= 0) return false;

  const key = `${delivery.business_id}:${delivery.channel}`;
  let count = cache.get(key);
  if (count === undefined) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    const { count: rowCount, error } = await supabase
      .from('marketing_deliveries')
      .select('id', { head: true, count: 'exact' })
      .eq('business_id', delivery.business_id)
      .eq('channel', delivery.channel)
      .in('status', ['sent', 'delivered'])
      .gte('sent_at', start.toISOString());
    if (error) throw error;

    count = rowCount || 0;
    cache.set(key, count);
  }

  return count < limit;
}

function incrementDailyCount(delivery: Delivery, cache: Map<string, number>) {
  const key = `${delivery.business_id}:${delivery.channel}`;
  cache.set(key, (cache.get(key) || 0) + 1);
}

async function markSent(
  deliveryId: string,
  provider: string,
  providerMessageId: string,
  destination: string,
  metadata?: Record<string, unknown>,
) {
  const update: Record<string, unknown> = {
    status: 'sent',
    provider,
    provider_message_id: providerMessageId,
    destination,
    sent_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    failure_code: null,
    failure_message: null,
    updated_at: new Date().toISOString(),
  };
  if (metadata) update.metadata = metadata;

  const { error } = await supabase.from('marketing_deliveries').update(update).eq('id', deliveryId);
  if (error) throw error;
}

async function markSkipped(deliveryId: string, reason: string) {
  await supabase
    .from('marketing_deliveries')
    .update({
      status: 'skipped',
      failure_code: reason,
      failure_message: reason,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryId);
}

async function releaseForRetry(
  delivery: Delivery,
  code: string,
  message: string,
  delayMinutes: number,
) {
  const nextAttempt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
  await supabase
    .from('marketing_deliveries')
    .update({
      status: 'queued',
      next_attempt_at: nextAttempt,
      failure_code: code,
      failure_message: message.slice(0, 2000),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id);
}

async function deferUntilTomorrow(deliveryId: string, reason: string) {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 5, 0, 0);

  await supabase
    .from('marketing_deliveries')
    .update({
      status: 'queued',
      next_attempt_at: next.toISOString(),
      failure_code: reason,
      failure_message: reason,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryId);
}

async function recoverStaleClaims() {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  await supabase
    .from('marketing_deliveries')
    .update({
      status: 'queued',
      locked_at: null,
      locked_by: null,
      next_attempt_at: new Date().toISOString(),
      failure_code: 'stale_claim_recovered',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('locked_at', cutoff);
}

function renderContent(delivery: Delivery, context: Revalidation) {
  const bookingUrl = context.business_slug && APP_PUBLIC_URL
    ? `${APP_PUBLIC_URL}/app/${context.business_slug}/book`
    : APP_PUBLIC_URL;

  const replacements: Record<string, string> = {
    customer_name: delivery.customer_name || 'Customer',
    business_name: context.business_name || 'Velliqo business',
    booking_url: bookingUrl || '',
  };

  const replace = (value: string) => value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => replacements[key] ?? '');
  const subject = replace(delivery.subject || `A message from ${context.business_name || 'your business'}`);
  const text = replace(delivery.message);
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>${bookingUrl ? `<p><a href="${escapeHtml(bookingUrl)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#111827;color:#fff;text-decoration:none">Book now</a></p>` : ''}</div>`;

  return { subject, text, html };
}

function isRetryableProviderFailure(channel: Delivery['channel'], code: string) {
  if (channel === 'email') {
    // Resend requests use a stable idempotency key, so transient retries are safe.
    return code === 'delivery_error'
      || code === 'resend_408'
      || code === 'resend_409'
      || code === 'resend_429'
      || /^resend_5\d\d$/.test(code);
  }

  if (channel === 'sms') {
    // Twilio's Messages API does not provide the same request idempotency guarantee.
    // Retry only explicit throttling/server responses, never ambiguous network failures.
    return code === 'twilio_429'
      || code === 'twilio_20429'
      || /^twilio_5\d\d$/.test(code);
  }

  return false;
}

function backoffMinutes(attempt: number) {
  const schedule = [5, 30, 120, 300, 600];
  return schedule[Math.min(Math.max(attempt - 1, 0), schedule.length - 1)];
}

function codedError(code: string, message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function providerErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'delivery_error';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n<>]/g, '').trim().slice(0, 100);
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
