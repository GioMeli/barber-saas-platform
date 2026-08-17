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

// Global five-language public experience.
has('src/components/marketing/MarketingChrome.tsx', 'LanguageSwitcher', 'Marketing header exposes the shared language switcher');
for (const file of ['IndustrySelection','BusinessTypeSelection','Pricing','WhyVelliqo','Experience','VelliqoAI','Contact','DiscoverBusinesses','Courses']) {
  has(`src/pages/marketing/${file}.tsx`, 'MarketingHeader', `${file} uses translated marketing chrome`);
  has(`src/pages/marketing/${file}.tsx`, 'useTranslation', `${file} is wired to i18n`);
}
has('src/components/demo/DemoOwnerLayout.tsx', 'LanguageSwitcher', 'Public Demo exposes language switching');
has('src/pages/demo/DemoModulePage.tsx', 'useTranslation', 'Demo module copy is translated');
has('src/pages/public/PublicAppLayout.tsx', 'LanguageSwitcher', 'Public customer/storefront pages expose language switching');
for (const file of ['SignIn','SignUp','CheckEmail','EmailConfirmed']) has(`src/pages/auth/${file}.tsx`, 'LanguageSwitcher', `${file} exposes language switching`);
for (const locale of ['en','el','de','es','tr']) {
  const json = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  check(json?.addons?.title, `${locale} has Addons translations`);
  check(json?.posWorkspace?.title, `${locale} has POS translations`);
  check(json?.demoPage, `${locale} has Demo translations`);
}

// Revised VAT-inclusive plans and add-ons.
const plans = read('src/billing/plans.ts');
check(plans.includes("name: 'Standard'") && plans.includes('price: 34.99'), 'Standard is €34.99');
check(plans.includes("name: 'Professional'") && plans.includes('price: 59.99'), 'Professional is €59.99');
check(plans.includes("name: 'Premium'") && plans.includes('price: 100.99'), 'Premium is €100.99');
check(/id: 'premium'[\s\S]*?smsMonthly: 250/.test(plans), 'Premium SMS allowance is 250');
has('supabase/functions/create_subscription_checkout/index.ts', "tax_behavior !== 'inclusive'", 'Plan checkout rejects non-inclusive Stripe prices');
has('supabase/functions/create_addon_checkout/index.ts', "tax_behavior: 'inclusive'", 'Add-on checkout uses inclusive tax behavior');
has('src/pages/marketing/Pricing.tsx', 'marketingSite.pages.pricing.vat', 'Public pricing explains VAT-inclusive presentation');

const migration = 'supabase/migrations/00055_velliqo_addons_vat_localization_pos.sql';
for (const addon of ['sms_100','sms_250','sms_500','sms_1000','email_1000','email_5000','email_10000','ai_100','ai_500','ai_1000','pos_suite']) has(migration, `'${addon}'`, `${addon} is in the add-on catalogue`);
has(migration, 'get_business_addon_allowances', 'Plan allowances expand with add-ons');
has(migration, 'billing_create_quota_alert', 'Quota alerts are persisted');
has(migration, 'owner_check_quota_alerts', 'Owner quota popups can be queried');
has(migration, 'business_payment_accounts', 'POS provider account state is tenant-scoped');
has(migration, "'addon_paid_revenue_eur'", 'Admin economics separates add-on paid revenue');
has(migration, "'addon_mrr_eur'", 'Admin economics separates add-on MRR');
has(migration, 'platform_fixed_cost_items', 'Detailed recurring platform costs are stored for Platform Admin');
has(migration, "'fixed_cost_items_monthly_eur'", 'Admin economics includes detailed recurring platform costs');

has('src/pages/owner/Addons.tsx', "functions.invoke('create_addon_checkout'", 'Owner can buy add-ons');
has('src/pages/owner/Addons.tsx', "functions.invoke('cancel_addon_subscription'", 'Owner can cancel recurring add-ons');
has('src/components/billing/OwnerQuotaLimitAlert.tsx', "'/dashboard/addons'", 'Quota exhaustion popup links to Addons');
has('src/components/layouts/OwnerDashboardLayout.tsx', 'OwnerQuotaLimitAlert', 'Quota popup is mounted globally for Owners');
has('src/components/layouts/owner-shell/navigation.ts', "key: 'addons'", 'Addons is in Owner navigation');
has('src/components/layouts/owner-shell/navigation.ts', "key: 'pos'", 'POS is in Owner navigation');
has('src/App.tsx', 'path="addons"', 'Addons route exists');
has('src/App.tsx', 'path="pos"', 'POS route exists');

// Provider-ready POS: entitlement now, financial execution at live Connect/Terminal cutover.
has('src/pages/owner/PosSuite.tsx', 'processing_fees_paid_by_owner', 'POS explicitly keeps processing fees with the Owner');
has('src/pages/owner/PosSuite.tsx', 'posWorkspace.nativeNote', 'Tap to Pay native SDK requirement is disclosed');
has(migration, 'processing_fees_paid_by_owner boolean not null default true', 'Payment account model defaults fees to Owner-paid');
has('supabase/functions/stripe_webhook/index.ts', 'cancelRecurringAddonsForBusiness', 'Canceling base subscription stops recurring add-ons');

// Platform economics / CSV reflects plan + add-on economics.
has('src/pages/admin/PlatformAdmin.tsx', 'addon_paid_revenue_eur', 'Admin shows add-on paid revenue');
has('src/pages/admin/PlatformAdmin.tsx', 'addon_mrr_eur', 'Admin shows add-on MRR');
has('src/pages/admin/PlatformAdmin.tsx', 'Add-on paid revenue', 'Economics CSV exports add-on revenue');
has('src/pages/admin/PlatformAdmin.tsx', 'AI ledger CSV', 'Detailed AI cost ledger remains exportable');
has('src/pages/admin/PlatformAdmin.tsx', 'Recurring platform cost ledger', 'Admin can manage named recurring Velliqo operating costs');
has('src/pages/admin/PlatformAdmin.tsx', 'platform_fixed_cost_items', 'Admin loads detailed platform operating costs');
has('src/pages/admin/PlatformAdmin.tsx', 'velliqo-fixed-cost-ledger.csv', 'Detailed recurring cost ledger is exportable to CSV');

const failures = checks.filter(([ok]) => !ok);
if (failures.length) {
  console.error('Phase 15A validation failed.');
  for (const [, label] of failures) console.error(`- ${label}`);
  process.exit(1);
}
console.log(`Phase 15A global localization, VAT pricing, add-ons and POS validation passed (${checks.length} checks).`);
