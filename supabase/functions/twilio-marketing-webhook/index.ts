import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const INVALID_DESTINATION_CODES = new Set(['21211', '21614', '30003', '30005', '30006']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!TWILIO_AUTH_TOKEN) return json({ error: 'Twilio auth token not configured' }, 503);

  const rawBody = await req.text();
  const signature = req.headers.get('x-twilio-signature') || '';
  const params = new URLSearchParams(rawBody);
  const valid = await verifyTwilioSignature(req.url, params, signature, TWILIO_AUTH_TOKEN);
  if (!valid) return json({ error: 'Invalid signature' }, 403);

  const inboundBody = params.get('Body');
  const inboundFrom = params.get('From');
  const inboundStatus = params.get('SmsStatus') || params.get('MessageStatus');
  const inboundKeyword = String(inboundBody || '').trim().split(/\s+/)[0]?.toUpperCase() || '';
  const preferenceKeywords = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'START', 'YES', 'UNSTOP']);

  if (inboundFrom && inboundBody && (inboundStatus === 'received' || preferenceKeywords.has(inboundKeyword))) {
    const inboundSid = params.get('MessageSid') || params.get('SmsSid') || crypto.randomUUID();
    const { data: profilesUpdated, error: keywordError } = await supabase.rpc('service_apply_sms_marketing_keyword', {
      p_phone: inboundFrom,
      p_keyword: inboundKeyword,
    });
    if (keywordError) {
      console.error('Failed to apply SMS marketing keyword', keywordError);
      return twiml(500);
    }
    await supabase.from('marketing_delivery_events').insert({
      delivery_id: null,
      business_id: null,
      provider: 'twilio',
      provider_event_id: `inbound:${inboundSid}`,
      provider_message_id: inboundSid,
      event_type: `sms.inbound.${inboundKeyword || 'message'}`,
      occurred_at: new Date().toISOString(),
      payload: { ...Object.fromEntries(params.entries()), profiles_updated: Number(profilesUpdated || 0) },
    });
    return twiml(200);
  }

  const messageSid = params.get('MessageSid') || params.get('SmsSid');
  const messageStatus = params.get('MessageStatus') || params.get('SmsStatus') || 'unknown';
  const errorCode = params.get('ErrorCode');
  const errorMessage = params.get('ErrorMessage');
  if (!messageSid) return json({ error: 'MessageSid is required' }, 400);

  const [{ data: marketingDelivery }, { data: notificationDelivery }] = await Promise.all([
    supabase.from('marketing_deliveries').select('*').eq('provider_message_id', messageSid).maybeSingle(),
    supabase.from('notification_deliveries').select('*').eq('provider_message_id', messageSid).maybeSingle(),
  ]);

  const eventKey = [messageSid, messageStatus, errorCode || '', params.get('RawDlrDoneDate') || ''].join(':');
  const payload = Object.fromEntries(params.entries());

  if (marketingDelivery) {
    const { error: eventError } = await supabase.from('marketing_delivery_events').insert({
      delivery_id: marketingDelivery.id,
      business_id: marketingDelivery.business_id,
      provider: 'twilio',
      provider_event_id: eventKey,
      provider_message_id: messageSid,
      event_type: `sms.${messageStatus}`,
      occurred_at: new Date().toISOString(),
      payload,
    });
    if (eventError?.code === '23505') return json({ received: true, duplicate: true });
    if (eventError) return json({ error: 'Failed to store marketing webhook event' }, 500);

    const statusUpdate = mapMarketingStatus(messageStatus, errorCode, errorMessage);
    if (statusUpdate) {
      await supabase.from('marketing_deliveries').update({ ...statusUpdate, updated_at: new Date().toISOString() }).eq('id', marketingDelivery.id);
    }
    if (errorCode && INVALID_DESTINATION_CODES.has(errorCode)) await suppressInvalidDestination(marketingDelivery, errorCode);
    return json({ received: true, matched: true, kind: 'marketing', delivery_id: marketingDelivery.id });
  }

  if (notificationDelivery) {
    const { error: eventError } = await supabase.from('notification_delivery_events').insert({
      delivery_id: notificationDelivery.id,
      business_id: notificationDelivery.business_id,
      provider: 'twilio',
      provider_event_id: eventKey,
      provider_message_id: messageSid,
      event_type: `sms.${messageStatus}`,
      occurred_at: new Date().toISOString(),
      payload,
    });
    if (eventError?.code === '23505') return json({ received: true, duplicate: true });
    if (eventError) return json({ error: 'Failed to store notification webhook event' }, 500);

    const statusUpdate = mapNotificationStatus(messageStatus, errorCode, errorMessage);
    if (statusUpdate) {
      await supabase.from('notification_deliveries').update({ ...statusUpdate, updated_at: new Date().toISOString() }).eq('id', notificationDelivery.id);
    }
    if (errorCode && INVALID_DESTINATION_CODES.has(errorCode)) {
      await supabase.from('marketing_suppressions').upsert({
        business_id: notificationDelivery.business_id,
        customer_id: null,
        channel: 'sms',
        destination: String(notificationDelivery.recipient).replace(/[^0-9+]/g, ''),
        reason: `twilio_${errorCode}`,
        source: 'provider',
        lifted_at: null,
      }, { onConflict: 'business_id,channel,destination' });
    }
    return json({ received: true, matched: true, kind: 'transactional', delivery_id: notificationDelivery.id });
  }

  const { error: unmatchedError } = await supabase.from('marketing_delivery_events').insert({
    delivery_id: null,
    business_id: null,
    provider: 'twilio',
    provider_event_id: eventKey,
    provider_message_id: messageSid,
    event_type: `sms.${messageStatus}`,
    occurred_at: new Date().toISOString(),
    payload,
  });
  if (unmatchedError?.code === '23505') return json({ received: true, duplicate: true });
  if (unmatchedError) return json({ error: 'Failed to store unmatched webhook event' }, 500);
  return json({ received: true, matched: false });
});

async function suppressInvalidDestination(delivery: any, code: string) {
  await supabase.from('marketing_suppressions').upsert({
    business_id: delivery.business_id,
    customer_id: delivery.customer_id,
    channel: 'sms',
    destination: String(delivery.destination).replace(/[^0-9+]/g, ''),
    reason: `twilio_${code}`,
    source: 'provider',
    lifted_at: null,
  }, { onConflict: 'business_id,channel,destination' });

  if (delivery.customer_id) {
    await supabase.from('customer_business_profiles').update({
      sms_notifications_enabled: false,
      sms_unsubscribed_at: new Date().toISOString(),
      marketing_consent_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('business_id', delivery.business_id).eq('customer_id', delivery.customer_id);
  }
}

function mapMarketingStatus(status: string, code: string | null, message: string | null) {
  const now = new Date().toISOString();
  switch (status) {
    case 'delivered': return { status: 'delivered', delivered_at: now, failure_code: null, failure_message: null };
    case 'sent': case 'queued': case 'accepted': return { status: 'sent', sent_at: now };
    case 'undelivered': case 'failed': return { status: 'failed', failed_at: now, failure_code: code || `sms_${status}`, failure_message: String(message || `SMS ${status}`).slice(0, 2000) };
    default: return null;
  }
}

function mapNotificationStatus(status: string, code: string | null, message: string | null) {
  const now = new Date().toISOString();
  switch (status) {
    case 'delivered': return { status: 'delivered', delivered_at: now, failure_code: null, failure_reason: null };
    case 'sent': case 'queued': case 'accepted': return { status: 'sent', sent_at: now };
    case 'undelivered': case 'failed': return { status: 'failed', failure_code: code || `sms_${status}`, failure_reason: String(message || `SMS ${status}`).slice(0, 2000) };
    default: return null;
  }
}

async function verifyTwilioSignature(url: string, params: URLSearchParams, signature: string, authToken: string) {
  if (!signature) return false;
  const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  let data = url;
  for (const [key, value] of sorted) data += `${key}${value}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function twiml(status: number) {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: { 'Content-Type': 'application/xml' },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
