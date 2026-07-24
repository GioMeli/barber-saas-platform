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
  const preferenceKeywords = new Set([
    'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT',
    'START', 'YES', 'UNSTOP',
  ]);

  if (inboundFrom && inboundBody && (inboundStatus === 'received' || preferenceKeywords.has(inboundKeyword))) {
    const inboundSid = params.get('MessageSid') || params.get('SmsSid') || crypto.randomUUID();
    const { data: profilesUpdated, error: keywordError } = await supabase.rpc(
      'service_apply_sms_marketing_keyword',
      { p_phone: inboundFrom, p_keyword: inboundKeyword },
    );

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
      payload: {
        ...Object.fromEntries(params.entries()),
        profiles_updated: Number(profilesUpdated || 0),
      },
    });

    return twiml(200);
  }

  const messageSid = params.get('MessageSid') || params.get('SmsSid');
  const messageStatus = params.get('MessageStatus') || params.get('SmsStatus') || 'unknown';
  const errorCode = params.get('ErrorCode');
  const errorMessage = params.get('ErrorMessage');

  if (!messageSid) return json({ error: 'MessageSid is required' }, 400);

  const { data: delivery } = await supabase
    .from('marketing_deliveries')
    .select('*')
    .eq('provider_message_id', messageSid)
    .maybeSingle();

  const eventKey = [messageSid, messageStatus, errorCode || '', params.get('RawDlrDoneDate') || ''].join(':');
  const payload = Object.fromEntries(params.entries());

  const { error: eventError } = await supabase
    .from('marketing_delivery_events')
    .insert({
      delivery_id: delivery?.id ?? null,
      business_id: delivery?.business_id ?? null,
      provider: 'twilio',
      provider_event_id: eventKey,
      provider_message_id: messageSid,
      event_type: `sms.${messageStatus}`,
      occurred_at: new Date().toISOString(),
      payload,
    });

  if (eventError?.code === '23505') return json({ received: true, duplicate: true });
  if (eventError) return json({ error: 'Failed to store webhook event' }, 500);
  if (!delivery) return json({ received: true, matched: false });

  const statusUpdate = mapTwilioStatus(messageStatus, errorCode, errorMessage);
  if (statusUpdate) {
    await supabase
      .from('marketing_deliveries')
      .update({ ...statusUpdate, updated_at: new Date().toISOString() })
      .eq('id', delivery.id);
  }

  if (errorCode && INVALID_DESTINATION_CODES.has(errorCode)) {
    await supabase.from('marketing_suppressions').upsert(
      {
        business_id: delivery.business_id,
        customer_id: delivery.customer_id,
        channel: 'sms',
        destination: String(delivery.destination).replace(/[^0-9+]/g, ''),
        reason: `twilio_${errorCode}`,
        source: 'provider',
        lifted_at: null,
      },
      { onConflict: 'business_id,channel,destination' },
    );

    if (delivery.customer_id) {
      await supabase
        .from('customer_business_profiles')
        .update({
          sms_notifications_enabled: false,
          sms_unsubscribed_at: new Date().toISOString(),
          marketing_consent_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', delivery.business_id)
        .eq('customer_id', delivery.customer_id);
    }
  }

  return json({ received: true, matched: true, delivery_id: delivery.id });
});

function mapTwilioStatus(status: string, errorCode: string | null, errorMessage: string | null) {
  const now = new Date().toISOString();
  switch (status) {
    case 'delivered':
    case 'read':
      return { status: 'delivered', delivered_at: now, failure_code: null, failure_message: null };
    case 'failed':
      return {
        status: 'failed',
        failed_at: now,
        failure_code: errorCode ? `twilio_${errorCode}` : 'twilio_failed',
        failure_message: errorMessage || 'SMS failed',
      };
    case 'undelivered':
      return {
        status: 'undelivered',
        failed_at: now,
        failure_code: errorCode ? `twilio_${errorCode}` : 'twilio_undelivered',
        failure_message: errorMessage || 'SMS was not delivered',
      };
    case 'sent':
    case 'queued':
    case 'accepted':
      return { status: 'sent', sent_at: now };
    case 'canceled':
      return { status: 'cancelled', failed_at: now, failure_code: 'twilio_cancelled' };
    default:
      return null;
  }
}

async function verifyTwilioSignature(
  requestUrl: string,
  params: URLSearchParams,
  suppliedSignature: string,
  authToken: string,
) {
  if (!suppliedSignature) return false;

  const entries = Array.from(params.entries()).sort(([aKey, aValue], [bKey, bValue]) => {
    const keyCompare = aKey.localeCompare(bKey);
    return keyCompare !== 0 ? keyCompare : aValue.localeCompare(bValue);
  });

  let data = requestUrl;
  for (const [key, value] of entries) data += `${key}${value}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const expected = bytesToBase64(new Uint8Array(signature));

  return timingSafeEqual(expected, suppliedSignature);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function twiml(status = 200) {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
