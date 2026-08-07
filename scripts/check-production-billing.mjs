import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const requireText = (file, needle, label = `${file}: ${needle}`) => {
  const text = read(file);
  const ok = typeof needle === 'string' ? text.includes(needle) : needle.test(text);
  checks.push([ok, label]);
};

// Launch plans and commercial terms.
const plans = read('src/billing/plans.ts');
for (const [id, price] of [['standard', '29.99'], ['pro', '49.99'], ['premium', '89.99']]) {
  checks.push([plans.includes(`id: '${id}'`) && plans.includes(`price: ${price}`), `${id} plan price €${price}`]);
}
requireText('src/billing/plans.ts', 'export const BILLING_TRIAL_DAYS = 14', '14-day launch trial');
requireText('src/billing/plans.ts', "staffAppInstall: false", 'Standard installable Staff App disabled');

// Signup/onboarding must capture the selected plan and route through Stripe before trial activation.
requireText('src/pages/auth/SignUp.tsx', 'BILLING_PLANS.map', 'Signup plan selector');
requireText('src/pages/auth/SignUp.tsx', 'selected_plan: selectedPlan', 'Signup persists selected plan');
requireText('src/pages/onboarding/OnboardingWizard.tsx', "rpc('initialize_business_billing'", 'Onboarding billing bootstrap');
requireText('src/pages/onboarding/OnboardingWizard.tsx', "functions.invoke('create_subscription_checkout'", 'Onboarding secure Stripe Checkout');

// Stripe checkout must collect payment details before trial and support fixed non-renewing offers.
requireText('supabase/functions/create_subscription_checkout/index.ts', "payment_method_collection: 'always'", 'Checkout always collects payment method');
requireText('supabase/functions/create_subscription_checkout/index.ts', 'subscriptionData.trial_period_days = trialDays', 'Checkout sets trial period');
requireText('supabase/functions/create_subscription_checkout/index.ts', "rpc('reserve_billing_offer_code'", 'Offer code is atomically reserved');
requireText('supabase/functions/create_subscription_checkout/index.ts', "duration: 'forever'", 'Offer discount spans fixed Stripe term');
requireText('supabase/functions/create_subscription_checkout/index.ts', "billing_mode: offer ? 'fixed_term' : 'auto_renew'", 'Checkout distinguishes renewable vs fixed term');
requireText('supabase/functions/create_subscription_checkout/index.ts', 'stripe.checkout.sessions.retrieve', 'Open Checkout session reuse prevents duplicate subscriptions');
requireText('supabase/functions/create_subscription_checkout/index.ts', 'stripe.checkout.sessions.expire', 'Changed plan/offer expires stale Checkout session');
requireText('supabase/functions/create_billing_portal_session/index.ts', 'stripe.billingPortal.sessions.create', 'Stripe Billing Portal session exists');
requireText('supabase/functions/create_billing_portal_session/index.ts', 'STRIPE_PORTAL_CONFIGURATION_ID', 'Normal portal configuration supported');
requireText('supabase/functions/create_billing_portal_session/index.ts', 'STRIPE_PORTAL_FIXED_CONFIGURATION_ID', 'Fixed-term portal configuration supported');

// Webhook integrity, subscription sync, fixed-term cancellation and payment recovery.
const webhook = 'supabase/functions/stripe_webhook/index.ts';
requireText(webhook, 'stripe.webhooks.constructEvent', 'Stripe webhook signature validation');
requireText(webhook, "case 'checkout.session.completed'", 'Checkout completion webhook');
requireText(webhook, "case 'checkout.session.expired'", 'Checkout expiration webhook');
requireText(webhook, "case 'customer.subscription.updated'", 'Subscription update webhook');
requireText(webhook, "case 'customer.subscription.deleted'", 'Subscription deletion webhook');
requireText(webhook, "case 'invoice.paid'", 'Paid invoice webhook');
requireText(webhook, "case 'invoice.payment_failed'", 'Failed payment webhook');
requireText(webhook, 'stripe_webhook_events', 'Webhook idempotency storage');
requireText(webhook, 'cancel_at:', 'Fixed-term Stripe cancellation date');
requireText(webhook, 'PAYMENT_GRACE_DAYS = 7', 'Failed-payment grace window');

// Database source of truth and server-side entitlements.
const migration = 'supabase/migrations/00051_velliqo_subscription_billing_entitlements.sql';
requireText(migration, 'create table if not exists public.billing_plans', 'Server plan catalogue');
requireText(migration, 'create table if not exists public.billing_offer_codes', 'Fixed-term offer catalogue');
requireText(migration, 'duration_months between 1 and 36', 'Offer fixed-term duration constraint');
requireText(migration, "billing_mode in ('auto_renew','fixed_term')", 'Billing mode constraint');
requireText(migration, 'create or replace function public.get_business_billing_summary', 'Billing/usage entitlement summary');
requireText(migration, 'create or replace function public.enforce_employee_plan_limit', 'Database staff-limit enforcement');
requireText(migration, 'create or replace function public.enforce_appointment_billing_access', 'Database appointment billing gate');
requireText(migration, 'staff_app_install_enabled', 'Staff app entitlement persisted server-side');
requireText(migration, "v_subscription.status = 'past_due' and v_subscription.grace_until", 'Expired payment grace blocks access');

// Expensive provider paths must use plan allowances.
requireText('supabase/functions/velliqo-ai-manager/index.ts', "rpc('get_business_billing_summary'", 'Velliqo AI monthly entitlement check');
requireText('supabase/functions/process-ai-manager-automations/index.ts', 'billingAutomationEntitlement', 'AI automation entitlement check');
for (const file of ['process_appointment_notifications', 'process_reminder_jobs', 'process_marketing_deliveries']) {
  requireText(`supabase/functions/${file}/index.ts`, "rpc('billing_can_send_communication'", `${file} communication quota`);
}

// Product surfaces must reflect the launch model, not legacy pricing/card claims.
const pricing = read('src/pages/marketing/Pricing.tsx');
checks.push([pricing.includes('BILLING_PLANS') && pricing.includes('/sign-up?plan='), 'Pricing is sourced from three launch plans']);
for (const file of ['src/pages/marketing/BusinessTypeSelection.tsx', 'src/pages/marketing/IndustrySelection.tsx']) {
  const text = read(file);
  checks.push([!text.includes('No card required'), `${file} does not make stale no-card claim`]);
}
requireText('src/pages/owner/Billing.tsx', 'get_business_billing_summary', 'Owner Billing uses server billing summary');
requireText('src/pages/admin/PlatformAdmin.tsx', 'Create fixed-term offer', 'Platform Admin can create fixed-term offers');
requireText('src/pages/admin/PlatformAdmin.tsx', 'No auto-renew', 'Offer UI states non-renewal');
requireText('api/staff-manifest.ts', 'staff_app_install_enabled', 'Staff PWA manifest enforces plan entitlement');

const failures = checks.filter(([ok]) => !ok);
if (failures.length) {
  console.error('Phase 14 production billing validation failed.');
  for (const [, label] of failures) console.error(`- ${label}`);
  process.exit(1);
}
console.log(`Phase 14 production billing validation passed (${checks.length} checks).`);
console.log('Validated: plans, payment-method-backed trial, fixed-term offers, Stripe lifecycle, quotas, server entitlements, Billing/Admin surfaces.');
