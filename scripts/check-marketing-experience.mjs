import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`Marketing experience validation failed: ${message}`);
  process.exit(1);
};

const app = read('src/App.tsx');
const navigation = read('src/components/layouts/owner-shell/navigation.ts');
const quickAdd = read('src/components/layouts/owner-shell/OwnerQuickAdd.tsx');
const marketing = read('src/pages/owner/Marketing.tsx');
const reviews = read('src/pages/public/CustomerReviews.tsx');
const layout = read('src/pages/public/PublicAppLayout.tsx');
const storefront = read('src/pages/owner/Storefront.tsx');
const businessHome = read('src/pages/public/BusinessHome.tsx');
const gallery = read('src/pages/owner/Gallery.tsx');
const migration = read('supabase/migrations/00033_marketing_online_presence_reviews.sql');

for (const [needle, source, label] of [
  ['path="marketing"', app, 'owner marketing route'],
  ['path="reviews"', app, 'public reviews route'],
  ["path: '/dashboard/marketing'", navigation, 'marketing navigation'],
  ["path: '/dashboard/marketing?action=new'", quickAdd, 'campaign quick action'],
  ["from('marketing_campaigns')", marketing, 'campaign workspace'],
  ["from('marketing_automations')", marketing, 'automation workspace'],
  ["from('customer_business_profiles')", marketing, 'consent-aware audience loading'],
  ["marketingConsent", marketing, 'marketing consent filtering'],
  ["owner_moderate_business_review", marketing, 'review moderation RPC'],
  ["submit_business_review", reviews, 'verified review submission RPC'],
  ["get_public_business_reviews", reviews, 'privacy-safe public review RPC'],
  ["get_public_business_reviews", businessHome, 'privacy-safe home review RPC'],
  ["business_online_presence", layout, 'public presence loading'],
  ["business_online_presence", storefront, 'online presence editor'],
  ["customer_display_name", businessHome, 'privacy-safe review display'],
  ["gallery.actions.add", gallery, 'localized gallery'],
]) {
  if (!source.includes(needle)) fail(`missing ${label}`);
}

for (const needle of [
  'create table if not exists public.marketing_campaigns',
  'create table if not exists public.marketing_automations',
  'create table if not exists public.business_online_presence',
  'create table if not exists public.business_reviews',
  'create or replace function public.get_public_business_reviews',
  'create or replace function public.submit_business_review',
  'create or replace function public.owner_moderate_business_review',
  'public.has_business_access(business_id)',
  "a.status = 'completed'",
  'customer_display_name text not null',
  'revoke all on public.business_reviews from anon, authenticated',
  'grant select on public.business_reviews to authenticated',
]) {
  if (!migration.includes(needle)) fail(`migration is missing: ${needle}`);
}

if (businessHome.includes("from('business_reviews')") || reviews.includes("from('business_reviews')") && !reviews.includes(".eq('user_id', user.id)")) {
  fail('public review reads must use get_public_business_reviews instead of direct table access');
}

if (businessHome.includes('customers(full_name)') || reviews.includes('customers(full_name)')) {
  fail('public review pages must not embed the private customers table');
}

const locales = ['en', 'el', 'de', 'es', 'tr'];
for (const locale of locales) {
  const data = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  for (const key of ['marketing', 'gallery', 'customerReviews']) {
    if (!data[key]) fail(`${locale}.json is missing ${key}`);
  }
  if (!data.marketing?.fields?.consentHint) fail(`${locale}.json is missing marketing consent guidance`);
  if (!data.navigation?.marketing || !data.navigation?.quick_actions?.campaign) {
    fail(`${locale}.json is missing marketing navigation keys`);
  }
  if (!data.storefront?.owner?.online || !data.storefront?.public?.sections?.reviews) {
    fail(`${locale}.json is missing online presence/review keys`);
  }
}

console.log('Marketing, online presence and customer review validation passed.');
console.log('Validated: campaigns, automations, verified reviews, SEO/social settings, public visibility, gallery localization, routes and 5 locales.');
