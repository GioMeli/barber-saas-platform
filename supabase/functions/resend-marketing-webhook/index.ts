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

  if (!eventId || !timestamp || !signature) {
    return json({ error: 'Missing webhook signature headers' }, 400);
  }

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
  const { data: delivery } = providerMessageId
    ? await supabase
        .from('marketing_deliveries')
        .select('*')
        .eq('provider_message_id', providerMessageId)
        .maybeSingle()
    : { data: null };

  const { error: eventError } = await supabase
    .from('marketing_delivery_events')
    .insert({
      delivery_id: delivery?.id ?? null,
      business_id: delivery?.business_id ?? null,
      provider: 'resend',
      provider_event_id: eventId,
      provider_message_id: providerMessageId,
      event_type: String(event?.type || 'unknown'),
      occurred_at: event?.created_at || null,
      payload: event,
    });

  if (eventError?.code === '23505') {
    return json({ received: true, duplicate: true });
  }
  if (eventError) {
    console.error('Failed to store Resend webhook', eventError);
    return json({ error: 'Failed to store webhook event' }, 500);
  }

  if (!delivery) return json({ received: true, matched: false });

  const update = mapStatus(event?.type, event);
  if (update) {
    await supabase
      .from('marketing_deliveries')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', delivery.id);
  }

  if (event?.type === 'email.bounced' || event?.type === 'email.complained') {
    const reason = event?.type === 'email.complained'
      ? 'spam_complaint'
      : String(event?.data?.bounce?.message || 'email_bounce').slice(0, 500);

    await supabase.from('marketing_suppressions').upsert(
      {
        business_id: delivery.business_id,
        customer_id: delivery.customer_id,
        channel: 'email',
        destination: String(delivery.destination).trim().toLowerCase(),
        reason,
        source: event?.type === 'email.complained' ? 'complaint' : 'bounce',
        lifted_at: null,
      },
      { onConflict: 'business_id,channel,destination' },
    );

    if (delivery.customer_id) {
      await supabase
        .from('customer_business_profiles')
        .update({
          email_notifications_enabled: false,
          email_unsubscribed_at: new Date().toISOString(),
          marketing_consent_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', delivery.business_id)
        .eq('customer_id', delivery.customer_id);
    }
  }

  return json({ received: true, matched: true, delivery_id: delivery.id });
});

function mapStatus(type: string, event: any) {
  const now = new Date().toISOString();
  switch (type) {
    case 'email.delivered':
      return { status: 'delivered', delivered_at: event?.created_at || now, failure_code: null, failure_message: null };
    case 'email.bounced':
      return {
        status: 'bounced',
        failed_at: event?.created_at || now,
        failure_code: 'email_bounced',
        failure_message: String(event?.data?.bounce?.message || 'Email bounced').slice(0, 2000),
      };
    case 'email.complained':
      return {
        status: 'complained',
        failed_at: event?.created_at || now,
        failure_code: 'spam_complaint',
        failure_message: 'Recipient marked this email as spam',
      };
    case 'email.failed':
      return {
        status: 'failed',
        failed_at: event?.created_at || now,
        failure_code: 'email_failed',
        failure_message: String(event?.data?.failed?.reason || 'Email failed').slice(0, 2000),
      };
    case 'email.delivery_delayed':
      return {
        failure_code: 'delivery_delayed',
        failure_message: 'Email delivery is delayed',
      };
    default:
      return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
