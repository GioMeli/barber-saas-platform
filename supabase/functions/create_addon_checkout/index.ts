import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? 'https://velliqo.com').replace(/\/$/, '');
const STRIPE_AUTOMATIC_TAX = (Deno.env.get('STRIPE_AUTOMATIC_TAX') ?? 'false').toLowerCase() === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PurchaseMode = 'cycle' | 'recurring';
type CheckoutLocale = 'en' | 'el' | 'de' | 'es' | 'tr';

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
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData } = await userClient.auth.getUser();
    if (!authData.user) return json({ error: 'Invalid session' }, 401);

    const body = await request.json();
    const businessId = String(body.businessId || '').trim();
    const addonId = String(body.addonId || '').trim();
    const purchaseMode = String(body.purchaseMode || 'cycle') as PurchaseMode;
    const locale = normalizeLocale(body.locale);
    if (!businessId || !addonId || !['cycle', 'recurring'].includes(purchaseMode)) return json({ error: 'Invalid add-on request' }, 400);

    const { data: membership } = await admin.from('business_members').select('id').eq('business_id', businessId).eq('user_id', authData.user.id).eq('role', 'Owner').maybeSingle();
    if (!membership) return json({ error: 'Only the business owner can purchase add-ons' }, 403);

    const { data: addon, error: addonError } = await admin.from('billing_addon_catalog').select('*').eq('addon_id', addonId).eq('active', true).maybeSingle();
    if (addonError || !addon) return json({ error: 'This add-on is unavailable' }, 404);
    if (purchaseMode === 'cycle' && !addon.allows_cycle_purchase) return json({ error: 'This add-on is available only as a monthly subscription' }, 400);
    if (purchaseMode === 'recurring' && !addon.allows_recurring_purchase) return json({ error: 'This add-on cannot renew monthly' }, 400);

    const { data: subscription } = await admin.from('subscriptions').select('stripe_customer_id,status,current_period_end').eq('business_id', businessId).maybeSingle();
    if (!subscription?.stripe_customer_id || !['trialing','active','past_due'].includes(String(subscription.status))) return json({ error: 'An active Velliqo plan is required before purchasing add-ons' }, 409);

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
    const recurring = purchaseMode === 'recurring';
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: recurring ? 'subscription' : 'payment',
      customer: subscription.stripe_customer_id,
      locale,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: String(addon.currency || 'eur'),
          unit_amount: Number(addon.monthly_price_cents),
          tax_behavior: 'inclusive',
          product_data: {
            name: `Velliqo · ${addon.name}`,
            description: addon.description || undefined,
            metadata: { velliqo_addon_id: addonId, category: String(addon.category) },
          },
          ...(recurring ? { recurring: { interval: 'month' } } : {}),
        },
      }],
      success_url: `${APP_PUBLIC_URL}/dashboard/addons?success=true&addon=${encodeURIComponent(addonId)}`,
      cancel_url: `${APP_PUBLIC_URL}/dashboard/addons?canceled=true`,
      metadata: {
        business_id: businessId,
        owner_user_id: authData.user.id,
        velliqo_addon: 'true',
        addon_id: addonId,
        purchase_mode: purchaseMode,
        units: String(addon.units || 0),
        token_units: String(addon.token_units || 0),
      },
      ...(recurring ? {
        subscription_data: { metadata: { business_id: businessId, velliqo_addon: 'true', addon_id: addonId, purchase_mode: purchaseMode, units: String(addon.units || 0), token_units: String(addon.token_units || 0) } },
      } : {
        invoice_creation: {
          enabled: true,
          invoice_data: { metadata: { business_id: businessId, velliqo_addon: 'true', addon_id: addonId, purchase_mode: purchaseMode } },
        },
      }),
    };
    if (STRIPE_AUTOMATIC_TAX) sessionParams.automatic_tax = { enabled: true };

    const session = await stripe.checkout.sessions.create(sessionParams);
    await admin.from('business_addon_entitlements').insert({
      business_id: businessId,
      addon_id: addonId,
      purchase_mode: purchaseMode,
      status: 'pending',
      units: Number(addon.units || 0),
      token_units: Number(addon.token_units || 0),
      stripe_checkout_session_id: session.id,
      stripe_customer_id: subscription.stripe_customer_id,
    });
    return json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('create_addon_checkout failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to start add-on checkout' }, 500);
  }
});

function normalizeLocale(value: unknown): CheckoutLocale {
  const base = String(value ?? 'en').toLowerCase().split('-')[0];
  return ['en','el','de','es','tr'].includes(base) ? base as CheckoutLocale : 'en';
}
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
