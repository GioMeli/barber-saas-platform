import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const PAYMENT_GRACE_DAYS = 7;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRICE_TO_PLAN = new Map<string, { planId: string; unitAmount: number }>([
  [Deno.env.get('STRIPE_PRICE_STANDARD') ?? '', { planId: 'standard', unitAmount: 2999 }],
  [Deno.env.get('STRIPE_PRICE_PRO') ?? '', { planId: 'pro', unitAmount: 4999 }],
  [Deno.env.get('STRIPE_PRICE_PREMIUM') ?? '', { planId: 'premium', unitAmount: 8999 }],
].filter(([priceId]) => Boolean(priceId)) as Array<[string, { planId: string; unitAmount: number }]>);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook secrets are missing');
    return new Response('Stripe webhook is not configured', { status: 503 });
  }

  const signature = request.headers.get('Stripe-Signature');
  if (!signature) return new Response('Missing Stripe signature', { status: 400 });

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe signature verification failed', error);
    return new Response('Invalid Stripe signature', { status: 400 });
  }

  const { data: existingEvent } = await admin
    .from('stripe_webhook_events')
    .select('processed_at')
    .eq('stripe_event_id', event.id)
    .maybeSingle();
  if (existingEvent?.processed_at) return json({ received: true, duplicate: true });

  if (!existingEvent) {
    const { error: insertError } = await admin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: Boolean(event.livemode),
      payload: event as unknown as Record<string, unknown>,
    });
    // A concurrent delivery may have inserted the row first. Continue unless it
    // is an unrelated database error; all downstream writes are idempotent.
    if (insertError && insertError.code !== '23505') {
      console.error('Unable to persist Stripe event', insertError);
      return new Response('Unable to persist Stripe event', { status: 500 });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
        await syncInvoice(event.data.object as Stripe.Invoice, event.type);
        break;
      default:
        break;
    }

    await admin
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq('stripe_event_id', event.id);

    return json({ received: true });
  } catch (error) {
    const message = errorMessage(error).slice(0, 4000);
    console.error(`Stripe webhook ${event.id} failed`, error);
    await admin
      .from('stripe_webhook_events')
      .update({ processing_error: message })
      .eq('stripe_event_id', event.id);
    // Stripe will retry 5xx webhook deliveries, which is exactly what we want.
    return new Response('Stripe webhook processing failed', { status: 500 });
  }
});

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return;

  const subscriptionId = idOf(session.subscription);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const businessId = String(session.metadata?.business_id || subscription.metadata?.business_id || '').trim();
  if (!businessId) throw new Error('Checkout session is missing business_id metadata');

  const offerRedemptionId = String(session.metadata?.offer_redemption_id || subscription.metadata?.offer_redemption_id || '').trim();
  const fixedTermMonths = Number(session.metadata?.fixed_term_months || subscription.metadata?.fixed_term_months || 0);

  if (fixedTermMonths > 0 && !subscription.cancel_at) {
    const trialEndSeconds = numberOrNull((subscription as any).trial_end);
    const periodStartSeconds = subscriptionPeriod(subscription, 'start');
    const anchorSeconds = trialEndSeconds || periodStartSeconds;
    const anchor = anchorSeconds ? new Date(anchorSeconds * 1000) : new Date();
    const fixedTermEnd = addUtcMonths(anchor, fixedTermMonths);

    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at: Math.floor(fixedTermEnd.getTime() / 1000),
      proration_behavior: 'none',
      metadata: {
        ...subscription.metadata,
        velliqo_fixed_term_end: fixedTermEnd.toISOString(),
      },
    });
    await syncSubscription(updated);
  } else {
    await syncSubscription(subscription);
  }

  const updatePayload: Record<string, unknown> = {
    stripe_customer_id: idOf(session.customer) || null,
    stripe_subscription_id: subscription.id,
    payment_method_collected: true,
    checkout_completed_at: new Date().toISOString(),
    stripe_checkout_session_id: null,
    checkout_session_expires_at: null,
    updated_at: new Date().toISOString(),
  };

  if (fixedTermMonths > 0) {
    updatePayload.billing_mode = 'fixed_term';
    updatePayload.fixed_term_months = fixedTermMonths;
    const endSeconds = numberOrNull((await stripe.subscriptions.retrieve(subscription.id) as any).cancel_at);
    if (endSeconds) updatePayload.fixed_term_ends_at = new Date(endSeconds * 1000).toISOString();
  }

  await admin.from('subscriptions').update(updatePayload).eq('business_id', businessId);

  if (offerRedemptionId) {
    await admin.from('billing_offer_redemptions').update({
      status: 'redeemed',
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: subscription.id,
      redeemed_at: new Date().toISOString(),
      released_at: null,
    }).eq('id', offerRedemptionId);
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const businessId = String(session.metadata?.business_id || '').trim();
  if (businessId) {
    await admin.from('subscriptions').update({
      stripe_checkout_session_id: null,
      checkout_session_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq('business_id', businessId).eq('stripe_checkout_session_id', session.id);
  }
  const redemptionId = String(session.metadata?.offer_redemption_id || '').trim();
  if (!redemptionId) return;
  await admin.from('billing_offer_redemptions').update({
    status: 'released',
    released_at: new Date().toISOString(),
  }).eq('id', redemptionId).eq('status', 'reserved');
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const businessId = await resolveBusinessIdForSubscription(subscription);
  if (!businessId) throw new Error(`Unable to map Stripe subscription ${subscription.id} to a Velliqo business`);

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = priceId ? PRICE_TO_PLAN.get(priceId) : null;
  const metadataPlan = String(subscription.metadata?.plan_id || '').trim();
  const planId = plan?.planId || (['standard', 'pro', 'premium'].includes(metadataPlan) ? metadataPlan : undefined);
  const unitAmount = subscription.items?.data?.[0]?.price?.unit_amount ?? plan?.unitAmount ?? null;

  const trialStart = numberOrNull((subscription as any).trial_start);
  const trialEnd = numberOrNull((subscription as any).trial_end);
  const currentPeriodStart = subscriptionPeriod(subscription, 'start');
  const currentPeriodEnd = subscriptionPeriod(subscription, 'end');
  const cancelAt = numberOrNull((subscription as any).cancel_at);
  const canceledAt = numberOrNull((subscription as any).canceled_at);
  const endedAt = numberOrNull((subscription as any).ended_at);
  const billingMode = String(subscription.metadata?.billing_mode || '') === 'fixed_term' || Boolean(cancelAt && subscription.metadata?.fixed_term_months)
    ? 'fixed_term'
    : undefined;

  const payload: Record<string, unknown> = {
    stripe_customer_id: idOf(subscription.customer) || null,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    cancel_at_period_end: Boolean((subscription as any).cancel_at_period_end),
    canceled_at: timestamp(canceledAt),
    ended_at: timestamp(endedAt),
    trial_started_at: timestamp(trialStart),
    trial_ends_at: timestamp(trialEnd),
    current_period_start: timestamp(currentPeriodStart),
    current_period_end: timestamp(currentPeriodEnd),
    unit_amount: unitAmount,
    currency: String(subscription.currency || 'eur').toLowerCase(),
    billing_interval: String(subscription.items?.data?.[0]?.price?.recurring?.interval || 'month'),
    updated_at: new Date().toISOString(),
  };
  if (planId) payload.plan_id = planId;
  if (billingMode) payload.billing_mode = billingMode;
  if (cancelAt && (billingMode === 'fixed_term' || subscription.metadata?.fixed_term_months)) {
    payload.fixed_term_ends_at = timestamp(cancelAt);
    payload.fixed_term_months = Number(subscription.metadata?.fixed_term_months || 0) || null;
  }

  // Stripe event delivery order is not guaranteed. If subscription.updated
  // reaches us before invoice.payment_failed, establish the same short grace
  // immediately so a recoverable payment failure does not momentarily lock the
  // business. A return to active/trialing clears stale grace state.
  if (subscription.status === 'past_due') {
    const { data: currentBilling } = await admin.from('subscriptions').select('grace_until').eq('business_id', businessId).maybeSingle();
    payload.grace_until = currentBilling?.grace_until || new Date(Date.now() + PAYMENT_GRACE_DAYS * 86_400_000).toISOString();
  } else if (subscription.status === 'active' || subscription.status === 'trialing') {
    payload.grace_until = null;
  }

  await admin.from('subscriptions').upsert({ business_id: businessId, ...payload }, { onConflict: 'business_id' });
}

async function syncInvoice(invoice: Stripe.Invoice, eventType: string) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = idOf(invoice.customer);
  const businessId = await resolveBusinessIdForInvoice(invoice, subscriptionId, customerId);
  if (!businessId) {
    console.warn(`Skipping Stripe invoice ${invoice.id}: no Velliqo business mapping found`);
    return;
  }

  const paidAt = numberOrNull((invoice as any).status_transitions?.paid_at);
  const periodStart = numberOrNull((invoice as any).period_start);
  const periodEnd = numberOrNull((invoice as any).period_end);

  await admin.from('billing_invoices').upsert({
    business_id: businessId,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    invoice_number: invoice.number || null,
    status: invoice.status || 'draft',
    currency: String(invoice.currency || 'eur').toLowerCase(),
    amount_due: Number(invoice.amount_due || 0),
    amount_paid: Number(invoice.amount_paid || 0),
    amount_remaining: Number(invoice.amount_remaining || 0),
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf_url: invoice.invoice_pdf || null,
    period_start: timestamp(periodStart),
    period_end: timestamp(periodEnd),
    paid_at: timestamp(paidAt),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_invoice_id' });

  if (eventType === 'invoice.paid') {
    await admin.from('subscriptions').update({
      last_payment_status: 'paid',
      last_payment_at: timestamp(paidAt) || new Date().toISOString(),
      grace_until: null,
      updated_at: new Date().toISOString(),
    }).eq('business_id', businessId);
  } else if (eventType === 'invoice.payment_failed') {
    const graceUntil = new Date(Date.now() + PAYMENT_GRACE_DAYS * 86_400_000).toISOString();
    const { data: current } = await admin.from('subscriptions').select('grace_until').eq('business_id', businessId).maybeSingle();
    await admin.from('subscriptions').update({
      last_payment_status: 'failed',
      grace_until: current?.grace_until || graceUntil,
      updated_at: new Date().toISOString(),
    }).eq('business_id', businessId);
  } else if (eventType === 'invoice.voided') {
    await admin.from('subscriptions').update({ last_payment_status: 'void', updated_at: new Date().toISOString() }).eq('business_id', businessId);
  } else if (eventType === 'invoice.marked_uncollectible') {
    await admin.from('subscriptions').update({ last_payment_status: 'uncollectible', updated_at: new Date().toISOString() }).eq('business_id', businessId);
  }
}

async function resolveBusinessIdForSubscription(subscription: Stripe.Subscription) {
  const metadataBusinessId = String(subscription.metadata?.business_id || '').trim();
  if (metadataBusinessId) return metadataBusinessId;

  const { data } = await admin.from('subscriptions').select('business_id')
    .eq('stripe_subscription_id', subscription.id).maybeSingle();
  if (data?.business_id) return data.business_id;

  const customerId = idOf(subscription.customer);
  if (!customerId) return null;
  const { data: byCustomer } = await admin.from('subscriptions').select('business_id')
    .eq('stripe_customer_id', customerId).maybeSingle();
  return byCustomer?.business_id || null;
}

async function resolveBusinessIdForInvoice(invoice: Stripe.Invoice, subscriptionId: string | null, customerId: string | null) {
  const metadataBusinessId = String((invoice as any).parent?.subscription_details?.metadata?.business_id || invoice.metadata?.business_id || '').trim();
  if (metadataBusinessId) return metadataBusinessId;
  if (subscriptionId) {
    const { data } = await admin.from('subscriptions').select('business_id').eq('stripe_subscription_id', subscriptionId).maybeSingle();
    if (data?.business_id) return data.business_id;
  }
  if (customerId) {
    const { data } = await admin.from('subscriptions').select('business_id').eq('stripe_customer_id', customerId).maybeSingle();
    if (data?.business_id) return data.business_id;
  }
  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const direct = idOf((invoice as any).subscription);
  if (direct) return direct;
  return idOf((invoice as any).parent?.subscription_details?.subscription) || null;
}

function subscriptionPeriod(subscription: Stripe.Subscription, side: 'start' | 'end') {
  const direct = numberOrNull((subscription as any)[`current_period_${side}`]);
  if (direct) return direct;
  const item = subscription.items?.data?.[0] as any;
  return numberOrNull(item?.[`current_period_${side}`]);
}

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

function addUtcMonths(date: Date, months: number) {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown webhook error');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
