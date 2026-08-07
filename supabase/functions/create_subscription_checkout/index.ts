import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? 'https://velliqo.com').replace(/\/$/, '');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_AUTOMATIC_TAX = (Deno.env.get('STRIPE_AUTOMATIC_TAX') ?? 'false').toLowerCase() === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PlanId = 'standard' | 'pro' | 'premium';
const PRICE_ENV: Record<PlanId, string> = {
  standard: 'STRIPE_PRICE_STANDARD',
  pro: 'STRIPE_PRICE_PRO',
  premium: 'STRIPE_PRICE_PREMIUM',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let reservedRedemptionId: string | null = null;
  try {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe is not configured' }, 503);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });

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
    const user = authData.user;

    const body = await request.json();
    const businessId = String(body.businessId ?? '').trim();
    const planId = String(body.planId ?? '').trim() as PlanId;
    const offerCode = String(body.offerCode ?? '').trim().toUpperCase();
    const successUrl = safeReturnUrl(body.successUrl, '/dashboard/billing?success=true');
    const cancelUrl = safeReturnUrl(body.cancelUrl, '/dashboard/billing?canceled=true');

    if (!businessId || !['standard', 'pro', 'premium'].includes(planId)) {
      return json({ error: 'A valid business and plan are required' }, 400);
    }

    const { data: ownerMembership } = await admin
      .from('business_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .eq('role', 'Owner')
      .maybeSingle();
    if (!ownerMembership) return json({ error: 'Only the business owner can manage billing' }, 403);

    const { data: plan, error: planError } = await admin
      .from('billing_plans')
      .select('*')
      .eq('plan_id', planId)
      .eq('active', true)
      .maybeSingle();
    if (planError || !plan) return json({ error: 'The selected plan is unavailable' }, 400);

    const priceId = Deno.env.get(PRICE_ENV[planId]) ?? '';
    if (!priceId) return json({ error: `Stripe price is not configured for ${planId}` }, 503);

    const { data: business, error: businessError } = await admin
      .from('businesses')
      .select('id,name,email,address,country,currency')
      .eq('id', businessId)
      .single();
    if (businessError || !business) return json({ error: 'Business not found' }, 404);

    const { data: existingSubscription } = await admin
      .from('subscriptions')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (existingSubscription?.stripe_subscription_id && ['trialing', 'active', 'past_due'].includes(existingSubscription.status)) {
      return json({ error: 'This business already has a subscription. Use Manage Billing to change the plan.' }, 409);
    }

    // Do not let double-clicks, browser retries, or a second onboarding tab create
    // two live Stripe subscriptions for the same Velliqo business. Reuse an open
    // Checkout Session when the selected plan/offer is unchanged; otherwise expire
    // the old session before reserving a new offer and creating a replacement.
    if (existingSubscription?.stripe_checkout_session_id) {
      try {
        const openSession = await stripe.checkout.sessions.retrieve(existingSubscription.stripe_checkout_session_id);
        if (openSession.status === 'open') {
          const samePlan = String(openSession.metadata?.plan_id || '') === planId;
          const sameOffer = String(openSession.metadata?.offer_code || '').toUpperCase() === offerCode;
          if (samePlan && sameOffer && openSession.url) {
            return json({
              url: openSession.url,
              sessionId: openSession.id,
              reused: true,
              trialDays: Number(existingSubscription.trial_days || 0),
              billingMode: existingSubscription.billing_mode || 'auto_renew',
            });
          }
          await stripe.checkout.sessions.expire(openSession.id);
          const oldRedemptionId = String(openSession.metadata?.offer_redemption_id || '').trim();
          if (oldRedemptionId) {
            await admin.from('billing_offer_redemptions').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', oldRedemptionId).eq('status', 'reserved');
          }
        }
      } catch (sessionError) {
        console.warn('Unable to reuse/expire previous Checkout Session; creating a new one', sessionError);
      }
    }

    let customerId = existingSubscription?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: business.name,
        email: business.email || user.email || undefined,
        metadata: { business_id: businessId, owner_user_id: user.id },
      });
      customerId = customer.id;
    }

    let offer: any = null;
    if (offerCode) {
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_billing_offer_code', {
        p_code: offerCode,
        p_business_id: businessId,
        p_plan_id: planId,
        p_user_id: user.id,
      });
      if (reserveError || !reserved) return json({ error: reserveError?.message || 'Offer code is unavailable' }, 400);
      offer = reserved;
      reservedRedemptionId = String(reserved.redemption_id);

      if (Number(offer.percent_off || 0) > 0 && !offer.stripe_coupon_id) {
        const coupon = await stripe.coupons.create({
          duration: 'forever',
          percent_off: Number(offer.percent_off),
          name: `Velliqo ${offer.code}`.slice(0, 40),
          metadata: {
            velliqo_offer_id: String(offer.offer_id),
            fixed_term_months: String(offer.duration_months),
            plan_id: planId,
          },
        });
        offer.stripe_coupon_id = coupon.id;
        await admin.from('billing_offer_codes').update({ stripe_coupon_id: coupon.id, updated_at: new Date().toISOString() }).eq('id', offer.offer_id);
      }
    }

    // A customer receives the launch trial only once. If trial_started_at is
    // already set, recreating Checkout after a cancellation cannot create a new trial.
    const trialAlreadyUsed = Boolean(existingSubscription?.trial_started_at);
    const requestedTrialDays = trialAlreadyUsed ? 0 : Number(offer?.trial_days ?? 14);
    const trialDays = Math.max(0, Math.min(requestedTrialDays, 60));

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        business_id: businessId,
        owner_user_id: user.id,
        plan_id: planId,
        billing_mode: offer ? 'fixed_term' : 'auto_renew',
        offer_code: offer ? String(offer.code) : '',
        offer_code_id: offer ? String(offer.offer_id) : '',
        offer_redemption_id: offer ? String(offer.redemption_id) : '',
        fixed_term_months: offer ? String(offer.duration_months) : '',
      },
    };
    if (trialDays > 0) subscriptionData.trial_period_days = trialDays;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: businessId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: subscriptionData,
      metadata: {
        business_id: businessId,
        owner_user_id: user.id,
        plan_id: planId,
        offer_code: offer ? String(offer.code) : '',
        offer_code_id: offer ? String(offer.offer_id) : '',
        offer_redemption_id: offer ? String(offer.redemption_id) : '',
        fixed_term_months: offer ? String(offer.duration_months) : '',
      },
    };
    if (offer?.stripe_coupon_id) sessionParams.discounts = [{ coupon: String(offer.stripe_coupon_id) }];
    if (STRIPE_AUTOMATIC_TAX) sessionParams.automatic_tax = { enabled: true };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (reservedRedemptionId) {
      await admin.from('billing_offer_redemptions').update({ stripe_checkout_session_id: session.id }).eq('id', reservedRedemptionId);
    }

    await admin.from('subscriptions').upsert({
      business_id: businessId,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      stripe_checkout_session_id: session.id,
      checkout_session_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      plan_id: planId,
      status: 'incomplete',
      trial_days: trialDays,
      currency: 'eur',
      unit_amount: Number(plan.monthly_price_cents),
      billing_interval: 'month',
      billing_mode: offer ? 'fixed_term' : 'auto_renew',
      fixed_term_months: offer ? Number(offer.duration_months) : null,
      offer_code_id: offer ? String(offer.offer_id) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id' });

    return json({
      url: session.url,
      sessionId: session.id,
      trialDays,
      billingMode: offer ? 'fixed_term' : 'auto_renew',
      offer: offer ? { code: offer.code, durationMonths: offer.duration_months, percentOff: offer.percent_off } : null,
    });
  } catch (error) {
    console.error('create_subscription_checkout failed', error);
    if (reservedRedemptionId) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await admin.from('billing_offer_redemptions').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', reservedRedemptionId).eq('status', 'reserved');
    }
    return json({ error: error instanceof Error ? error.message : 'Unable to start secure checkout' }, 500);
  }
});

function safeReturnUrl(value: unknown, fallbackPath: string) {
  const fallback = `${APP_PUBLIC_URL}${fallbackPath}`;
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    const productionOrigin = new URL(APP_PUBLIC_URL).origin;
    const isLocal = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    const isVercelPreview = url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
    if (url.origin === productionOrigin || isLocal || isVercelPreview) return url.toString();
  } catch { /* use fallback */ }
  return fallback;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
