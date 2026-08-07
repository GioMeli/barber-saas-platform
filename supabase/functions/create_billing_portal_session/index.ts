import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? 'https://velliqo.com').replace(/\/$/, '');
const STRIPE_PORTAL_CONFIGURATION_ID = Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID') ?? '';
const STRIPE_PORTAL_FIXED_CONFIGURATION_ID = Deno.env.get('STRIPE_PORTAL_FIXED_CONFIGURATION_ID') ?? '';

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
    const businessId = String(body.businessId ?? '').trim();
    if (!businessId) return json({ error: 'Business is required' }, 400);

    const { data: owner } = await admin
      .from('business_members').select('id')
      .eq('business_id', businessId).eq('user_id', authData.user.id).eq('role', 'Owner').maybeSingle();
    if (!owner) return json({ error: 'Only the business owner can manage billing' }, 403);

    const { data: subscription } = await admin
      .from('subscriptions').select('stripe_customer_id,billing_mode')
      .eq('business_id', businessId).maybeSingle();
    if (!subscription?.stripe_customer_id) return json({ error: 'No Stripe customer exists for this business' }, 409);

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
    const fixedTerm = subscription.billing_mode === 'fixed_term';
    if (fixedTerm && !STRIPE_PORTAL_FIXED_CONFIGURATION_ID) {
      return json({ error: 'Fixed-term billing portal configuration is not available yet' }, 503);
    }
    const configuration = fixedTerm ? STRIPE_PORTAL_FIXED_CONFIGURATION_ID : STRIPE_PORTAL_CONFIGURATION_ID;
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: safeReturnUrl(body.returnUrl),
      ...(configuration ? { configuration } : {}),
    });
    return json({ url: session.url });
  } catch (error) {
    console.error('create_billing_portal_session failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to open billing portal' }, 500);
  }
});

function safeReturnUrl(value: unknown) {
  const fallback = `${APP_PUBLIC_URL}/dashboard/billing`;
  try {
    const url = new URL(String(value ?? ''));
    const productionOrigin = new URL(APP_PUBLIC_URL).origin;
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    const preview = url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
    return url.origin === productionOrigin || local || preview ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
