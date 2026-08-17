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

const PRICE_TO_PLAN = new Map<string, { planId: string; unitAmount: number }>([
  [Deno.env.get('STRIPE_PRICE_STANDARD') ?? '', { planId: 'standard', unitAmount: 3499 }],
  [Deno.env.get('STRIPE_PRICE_PRO') ?? '', { planId: 'pro', unitAmount: 5999 }],
  [Deno.env.get('STRIPE_PRICE_PREMIUM') ?? '', { planId: 'premium', unitAmount: 10099 }],
].filter(([priceId]) => Boolean(priceId)) as Array<[string, { planId: string; unitAmount: number }]>);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe is not configured' }, 503);

  try {
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

    const body = await request.json().catch(() => ({}));
    const businessId = String(body.businessId ?? '').trim();
    if (!businessId) return json({ error: 'Business is required' }, 400);

    const { data: membership } = await admin
      .from('business_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', authData.user.id)
      .eq('role', 'Owner')
      .maybeSingle();
    if (!membership) return json({ error: 'Only the business owner can reconcile billing' }, 403);

    const { data: billing, error: billingError } = await admin
      .from('subscriptions')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();
    if (billingError) throw billingError;
    if (!billing) return json({ synced: false, reason: 'subscription_row_missing' }, 404);

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
    let subscriptionId = String(billing.stripe_subscription_id || '').trim();
    let session: Stripe.Checkout.Session | null = null;

    const checkoutSessionId = String(billing.stripe_checkout_session_id || '').trim();
    if (checkoutSessionId) {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      const metadataBusinessId = String(session.metadata?.business_id || '').trim();
      if (metadataBusinessId && metadataBusinessId !== businessId) {
        return json({ error: 'Checkout session does not belong to this business' }, 403);
      }
      if (session.status !== 'complete' || !session.subscription) {
        return json({ synced: false, checkoutStatus: session.status, paymentStatus: session.payment_status });
      }
      subscriptionId = idOf(session.subscription);
    }

    if (!subscriptionId) return json({ synced: false, reason: 'stripe_subscription_missing' });

    let subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const metadataBusinessId = String(subscription.metadata?.business_id || '').trim();
    if (metadataBusinessId && metadataBusinessId !== businessId) {
      return json({ error: 'Stripe subscription does not belong to this business' }, 403);
    }

    const fixedTermMonths = Number(
      session?.metadata?.fixed_term_months || subscription.metadata?.fixed_term_months || billing.fixed_term_months || 0,
    );
    if (fixedTermMonths > 0 && !subscription.cancel_at) {
      const trialEndSeconds = numberOrNull((subscription as any).trial_end);
      const periodStartSeconds = subscriptionPeriod(subscription, 'start');
      const anchor = new Date((trialEndSeconds || periodStartSeconds || Math.floor(Date.now() / 1000)) * 1000);
      const fixedTermEnd = addUtcMonths(anchor, fixedTermMonths);
      subscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at: Math.floor(fixedTermEnd.getTime() / 1000),
        proration_behavior: 'none',
        metadata: { ...subscription.metadata, velliqo_fixed_term_end: fixedTermEnd.toISOString() },
      });
    }

    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const mappedPlan = priceId ? PRICE_TO_PLAN.get(priceId) : null;
    const metadataPlan = String(subscription.metadata?.plan_id || session?.metadata?.plan_id || billing.plan_id || '').trim();
    const planId = mappedPlan?.planId || (['standard', 'pro', 'premium'].includes(metadataPlan) ? metadataPlan : billing.plan_id);
    const trialStart = numberOrNull((subscription as any).trial_start);
    const trialEnd = numberOrNull((subscription as any).trial_end);
    const currentPeriodStart = subscriptionPeriod(subscription, 'start');
    const currentPeriodEnd = subscriptionPeriod(subscription, 'end');
    const cancelAt = numberOrNull((subscription as any).cancel_at);
    const canceledAt = numberOrNull((subscription as any).canceled_at);
    const endedAt = numberOrNull((subscription as any).ended_at);
    const billingMode = fixedTermMonths > 0 || String(subscription.metadata?.billing_mode || '') === 'fixed_term'
      ? 'fixed_term'
      : 'auto_renew';

    const payload: Record<string, unknown> = {
      business_id: businessId,
      stripe_customer_id: idOf(session?.customer) || idOf(subscription.customer) || billing.stripe_customer_id || null,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_id: planId,
      status: subscription.status,
      payment_method_collected: true,
      checkout_completed_at: billing.checkout_completed_at || new Date().toISOString(),
      stripe_checkout_session_id: null,
      checkout_session_expires_at: null,
      cancel_at_period_end: Boolean((subscription as any).cancel_at_period_end),
      canceled_at: timestamp(canceledAt),
      ended_at: timestamp(endedAt),
      trial_started_at: timestamp(trialStart),
      trial_ends_at: timestamp(trialEnd),
      current_period_start: timestamp(currentPeriodStart),
      current_period_end: timestamp(currentPeriodEnd),
      unit_amount: subscription.items?.data?.[0]?.price?.unit_amount ?? mappedPlan?.unitAmount ?? billing.unit_amount ?? null,
      currency: String(subscription.currency || billing.currency || 'eur').toLowerCase(),
      billing_interval: String(subscription.items?.data?.[0]?.price?.recurring?.interval || billing.billing_interval || 'month'),
      billing_mode: billingMode,
      fixed_term_months: fixedTermMonths > 0 ? fixedTermMonths : null,
      fixed_term_ends_at: fixedTermMonths > 0 && cancelAt ? timestamp(cancelAt) : null,
      grace_until: ['active', 'trialing'].includes(subscription.status) ? null : billing.grace_until,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await admin.from('subscriptions').upsert(payload, { onConflict: 'business_id' });
    if (updateError) throw updateError;

    const redemptionId = String(session?.metadata?.offer_redemption_id || subscription.metadata?.offer_redemption_id || '').trim();
    if (redemptionId) {
      await admin.from('billing_offer_redemptions').update({
        status: 'redeemed',
        stripe_checkout_session_id: session?.id || null,
        stripe_subscription_id: subscription.id,
        redeemed_at: new Date().toISOString(),
        released_at: null,
      }).eq('id', redemptionId);
    }

    return json({
      synced: true,
      status: subscription.status,
      planId,
      paymentMethodCollected: true,
      trialEndsAt: timestamp(trialEnd),
    });
  } catch (error) {
    console.error('reconcile_subscription_checkout failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to reconcile billing' }, 500);
  }
});

function idOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return String((value as any).id || '');
  return '';
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function timestamp(seconds: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionPeriod(subscription: Stripe.Subscription, side: 'start' | 'end') {
  const direct = numberOrNull((subscription as any)[`current_period_${side}`]);
  if (direct) return direct;
  const item = subscription.items?.data?.[0] as any;
  return numberOrNull(item?.[`current_period_${side}`]);
}

function addUtcMonths(date: Date, months: number) {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
