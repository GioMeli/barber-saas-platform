import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe is not configured' }, 503);
    const authHeader = request.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication is required' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401);

    const body = await request.json();
    const businessId = String(body.businessId || '').trim();
    const entitlementId = String(body.entitlementId || '').trim();
    if (!businessId || !entitlementId) return json({ error: 'Business and add-on are required' }, 400);

    const { data: owner } = await admin.from('business_members').select('id')
      .eq('business_id', businessId).eq('user_id', authData.user.id).eq('role', 'Owner').maybeSingle();
    if (!owner) return json({ error: 'Only the business owner can cancel add-ons' }, 403);

    const { data: entitlement } = await admin.from('business_addon_entitlements')
      .select('id,business_id,purchase_mode,status,stripe_subscription_id,cancel_at_period_end')
      .eq('id', entitlementId).eq('business_id', businessId).maybeSingle();
    if (!entitlement) return json({ error: 'Add-on not found' }, 404);
    if (entitlement.purchase_mode !== 'recurring' || !entitlement.stripe_subscription_id) {
      return json({ error: 'Only monthly add-ons can be canceled' }, 409);
    }
    if (['canceled','expired'].includes(String(entitlement.status))) return json({ ok: true, alreadyCanceled: true });

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
    const subscription = await stripe.subscriptions.update(entitlement.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: { velliqo_addon_cancel_requested_by: authData.user.id },
    });

    const endsAt = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
    await admin.from('business_addon_entitlements').update({
      cancel_at_period_end: true,
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
    }).eq('id', entitlementId);

    return json({ ok: true, cancelAtPeriodEnd: true, endsAt });
  } catch (error) {
    console.error('cancel_addon_subscription failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to cancel add-on' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
