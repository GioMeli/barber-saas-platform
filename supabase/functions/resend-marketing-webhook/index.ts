import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from 'npm:svix@1.76.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!RESEND_WEBHOOK_SECRET) return json({ error: 'Webhook secret not configured' }, 503);

  const payload = await req.text();
  const eventId = req.headers.get('svix-id');
  const timestamp = req.headers.get('svix-timestamp');
  const signature = req.headers.get('svix-signature');
  if (!eventId || !timestamp || !signature) return json({ error: 'Missing webhook signature headers' }, 400);

  let event: any;
  try {
    event = new Webhook(RESEND_WEBHOOK_SECRET).verify(payload, {
      'svix-id': eventId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    });
  } catch (error) {
    console.error('Invalid Resend webhook signature', error);
    return json({ error: 'Invalid signature' }, 400);
  }

  const providerMessageId = event?.data?.email_id || event?.data?.id || null;
  const [{ data: marketingDelivery }, { data: notificationDelivery }] = providerMessageId
    ? await Promise.all([
        supabase.from('marketing_deliveries').select('*').eq('provider_message_id', providerMessageId).maybeSingle(),
        supabase.from('notification_deliveries').select('*').eq('provider_message_id', providerMessageId).maybeSingle(),
      ])
    : [{ data: null }, { data: null }] as any;

  if (marketingDelivery) {
    const duplicate = await insertMarketingEvent(eventId, providerMessageId, event, marketingDelivery);
    if (duplicate) return json({ received: true, duplicate: true });

    const update = mapMarketingStatus(event?.type, event);
    if (update) {
      await supabase.from('marketing_deliveries').update({ ...update, updated_at: new Date().toISOString() }).eq('id', marketingDelivery.id);
    }

    if (event?.type === 'email.bounced' || event?.type === 'email.complained') {
      await suppressMarketingEmail(marketingDelivery, event);
    }

    return json({ received: true, matched: true, kind: 'marketing', delivery_id: marketingDelivery.id });
  }

  if (notificationDelivery) {
    const { error: eventError } = await supabase.from('notification_delivery_events').insert({
      delivery_id: notificationDelivery.id,
      business_id: notificationDelivery.business_id,
      provider: 'resend',
      provider_event_id: eventId,
      provider_message_id: providerMessageId,
      event_type: String(event?.type || 'unknown'),
      occurred_at: event?.created_at || null,
      payload: event,
    });
    if (eventError?.code === '23505') return json({ received: true, duplicate: true });
    if (eventError) return json({ error: 'Failed to store notification webhook event' }, 500);

    const update = mapNotificationStatus(event?.type, event);
    if (update) {
      await supabase.from('notification_deliveries').update({ ...update, updated_at: new Date().toISOString() }).eq('id', notificationDelivery.id);
    }

    return json({ received: true, matched: true, kind: 'transactional', delivery_id: notificationDelivery.id });
  }

  const { error: unmatchedError } = await supabase.from('marketing_delivery_events').insert({
    delivery_id: null,
    business_id: null,
    provider: 'resend',
    provider_event_id: eventId,
    provider_message_id: providerMessageId,
    event_type: String(event?.type || 'unknown'),
    occurred_at: event?.created_at || null,
    payload: event,
  });
  if (unmatchedError?.code === '23505') return json({ received: true, duplicate: true });
  if (unmatchedError) return json({ error: 'Failed to store unmatched webhook event' }, 500);
  return json({ received: true, matched: false });
});

async function insertMarketingEvent(eventId: string, providerMessageId: string | null, event: any, delivery: any) {
  const { error } = await supabase.from('marketing_delivery_events').insert({
    delivery_id: delivery.id,
    business_id: delivery.business_id,
    provider: 'resend',
    provider_event_id: eventId,
    provider_message_id: providerMessageId,
    event_type: String(event?.type || 'unknown'),
    occurred_at: event?.created_at || null,
    payload: event,
  });
  if (error?.code === '23505') return true;
  if (error) throw new Error(error.message);
  return false;
}

async function suppressMarketingEmail(delivery: any, event: any) {
  const reason = event?.type === 'email.complained'
    ? 'spam_complaint'
    : String(event?.data?.bounce?.message || 'email_bounce').slice(0, 500);

  await supabase.from('marketing_suppressions').upsert({
    business_id: delivery.business_id,
    customer_id: delivery.customer_id,
    channel: 'email',
    destination: String(delivery.destination).trim().toLowerCase(),
    reason,
    source: event?.type === 'email.complained' ? 'complaint' : 'bounce',
    lifted_at: null,
  }, { onConflict: 'business_id,channel,destination' });

  if (delivery.customer_id) {
    await supabase.from('customer_business_profiles').update({
      email_notifications_enabled: false,
      email_unsubscribed_at: new Date().toISOString(),
      marketing_consent_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('business_id', delivery.business_id).eq('customer_id', delivery.customer_id);
  }
}

function mapMarketingStatus(type: string, event: any) {
  const now = new Date().toISOString();
  switch (type) {
    case 'email.delivered': return { status: 'delivered', delivered_at: event?.created_at || now, failure_code: null, failure_message: null };
    case 'email.bounced': return { status: 'bounced', failed_at: event?.created_at || now, failure_code: 'email_bounced', failure_message: String(event?.data?.bounce?.message || 'Email bounced').slice(0, 2000) };
    case 'email.complained': return { status: 'complained', failed_at: event?.created_at || now, failure_code: 'spam_complaint', failure_message: 'Recipient marked this email as spam' };
    case 'email.failed': return { status: 'failed', failed_at: event?.created_at || now, failure_code: 'email_failed', failure_message: String(event?.data?.failed?.reason || 'Email failed').slice(0, 2000) };
    case 'email.delivery_delayed': return { failure_code: 'delivery_delayed', failure_message: 'Email delivery is delayed' };
    default: return null;
  }
}

function mapNotificationStatus(type: string, event: any) {
  const now = new Date().toISOString();
  switch (type) {
    case 'email.delivered': return { status: 'delivered', delivered_at: event?.created_at || now, failure_code: null, failure_reason: null };
    case 'email.bounced': return { status: 'bounced', failure_code: 'email_bounced', failure_reason: String(event?.data?.bounce?.message || 'Email bounced').slice(0, 2000) };
    case 'email.complained': return { status: 'complained', failure_code: 'spam_complaint', failure_reason: 'Recipient marked this email as spam' };
    case 'email.failed': return { status: 'failed', failure_code: 'email_failed', failure_reason: String(event?.data?.failed?.reason || 'Email failed').slice(0, 2000) };
    case 'email.delivery_delayed': return { failure_code: 'delivery_delayed', failure_reason: 'Email delivery is delayed' };
    default: return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
