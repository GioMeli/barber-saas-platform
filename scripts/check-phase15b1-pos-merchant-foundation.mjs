import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (ok, label) => checks.push([Boolean(ok), label]);
const has = (file, needle, label = `${file}: ${needle}`) => {
  const text = read(file);
  check(typeof needle === 'string' ? text.includes(needle) : needle.test(text), label);
};

const migration = 'supabase/migrations/00056_velliqo_pos_merchant_foundation.sql';
has(migration, 'requirements_currently_due', 'Merchant requirements are persisted per business');
has(migration, "bm.role = 'Owner'", 'Payment account RLS is Owner-only');
has(migration, 'business_payment_accounts_provider_account_uidx', 'Provider account IDs are uniquely mapped');
has(migration, 'complete_business_sale_legacy_impl', 'Original checkout implementation is isolated behind a hardened wrapper');
has(migration, "v_payment_method in ('card', 'online')", 'Manual checkout cannot fake card or online completion');
has(migration, 'Stripe-backed payments must be refunded', 'Provider-backed transactions cannot be locally voided as fake refunds');

const merchantFn = 'supabase/functions/pos_merchant_account/index.ts';
has(merchantFn, ".eq('role', 'Owner')", 'Merchant onboarding Edge Function is Owner-only');
has(merchantFn, 'get_business_addon_allowances', 'Merchant onboarding requires the active POS entitlement');
has(merchantFn, "'/v2/core/accounts'", 'New connected accounts are created through Stripe Accounts v2');
has(merchantFn, "fees_collector: 'stripe'", 'Connected business pays Stripe processing fees');
has(merchantFn, "losses_collector: 'stripe'", 'Stripe carries connected-account payment losses');
has(merchantFn, "dashboard: 'full'", 'Connected business receives a full Stripe Dashboard');
has(merchantFn, "Idempotency-Key", 'Accounts v2 creation uses a Stripe idempotency key');
has(merchantFn, 'velliqo-connect-account-v2-${businessId}-${country.toLowerCase()}', 'Connected account idempotency is tenant-and-country scoped');
has(merchantFn, 'does not match the Velliqo business country', 'Existing connected-account country mismatches are blocked');
has(merchantFn, "'/v2/core/account_links'", 'Stripe-hosted onboarding link is generated with Account Links v2');
has(merchantFn, "configurations: ['merchant']", 'Onboarding targets the merchant configuration');
has(merchantFn, "collection_options: { fields: 'eventually_due' }", 'Onboarding collects eventually-due requirements up front');
has(merchantFn, "action === 'refresh_status'", 'Merchant verification status can be refreshed securely');
has(merchantFn, 'account.charges_enabled === true && account.payouts_enabled === true', 'Ready status requires both charges and payouts');
has(merchantFn, 'stripe.accounts.retrieve(accountId)', 'Accounts v1 compatibility projection is used only for status caching');


const countryMigration = 'supabase/migrations/00057_velliqo_business_country_currency_hardening.sql';
has(countryMigration, 'alter column country drop default', 'New businesses no longer silently default to the United States');
has(countryMigration, 'alter column currency drop default', 'New businesses no longer silently default to USD');
has('src/pages/onboarding/OnboardingWizard.tsx', 'country: businessData.country.toUpperCase()', 'Onboarding persists the legal business country');
has('src/pages/onboarding/OnboardingWizard.tsx', 'currency: businessData.currency.toUpperCase()', 'Onboarding persists the business currency');

has('supabase/functions/stripe_webhook/index.ts', "case 'account.updated':", 'Stripe webhook listens for connected-account compatibility updates');
has('supabase/functions/stripe_webhook/index.ts', 'syncConnectedPaymentAccount', 'Connected-account webhook changes are synchronized to tenant state');
has('supabase/config.toml', '[functions.pos_merchant_account]', 'Merchant Edge Function is registered');
has('supabase/config.toml', 'verify_jwt = true', 'JWT verification remains enabled for authenticated merchant management');

has('src/pages/owner/PosSuite.tsx', "functions.invoke('pos_merchant_account'", 'POS workspace invokes protected merchant onboarding');
has('src/pages/owner/PosSuite.tsx', "action: 'start_onboarding'", 'Owner can start/continue Stripe onboarding');
has('src/pages/owner/PosSuite.tsx', "action: 'refresh_status'", 'Owner can refresh merchant status');
has('src/pages/owner/PosSuite.tsx', 'getFunctionErrorMessage', 'POS surfaces the real Edge Function error body');
has('src/pages/owner/PosSuite.tsx', 'posWorkspace.secureFlowLocked', 'POS clearly separates onboarding from payment execution');
has('src/pages/owner/Sales.tsx', "paymentMethod === 'card' || paymentMethod === 'online'", 'Sales UI blocks provider methods until real payment orchestration exists');
has('src/pages/owner/Sales.tsx', 'disabled: method === \'card\' || method === \'online\'', 'Card/online options are disabled in the manual payment selector');

for (const locale of ['en','el','de','es','tr']) {
  const json = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  check(Boolean(json?.posWorkspace?.connectStripe), `${locale} translates Stripe onboarding action`);
  check(Boolean(json?.posWorkspace?.messages?.statusRefreshed), `${locale} translates merchant status feedback`);
  check(Boolean(json?.sales?.messages?.providerPaymentRequired), `${locale} translates provider-payment lock`);
}

const failures = checks.filter(([ok]) => !ok);
if (failures.length) {
  console.error('Phase 15B.1 POS merchant foundation validation failed.');
  for (const [, label] of failures) console.error(`- ${label}`);
  process.exit(1);
}

console.log(`Phase 15B.1 POS merchant foundation validation passed (${checks.length} checks).`);
