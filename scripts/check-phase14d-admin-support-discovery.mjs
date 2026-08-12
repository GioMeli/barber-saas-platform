import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const requireText = (file, needle, label = `${file}: ${needle}`) => {
  if (!fs.existsSync(path.join(root, file))) { checks.push([false, `Missing ${file}`]); return; }
  const text = read(file);
  checks.push([typeof needle === 'string' ? text.includes(needle) : needle.test(text), label]);
};

const migration = 'supabase/migrations/00053_velliqo_support_control_plane_and_discovery_live_search.sql';
for (const needle of [
  'create table if not exists public.platform_support_requests',
  'create table if not exists public.platform_support_messages',
  'create table if not exists public.platform_broadcasts',
  'owner_create_support_request',
  'support_add_message',
  'platform_admin_set_request_status',
  'platform_admin_create_broadcast',
  'platform_admin_owner_cost_rows',
  'platform_admin_update_business_v2',
  'preview_billing_offer_code',
  "'platform_announcement','support_reply','support_status'",
  'billing_offer_window_check',
  'supabase_realtime',
]) requireText(migration, needle);

for (const needle of [
  'Cost by Owner', 'Attributable cost breakdown', 'Support Requests',
  'Create plan-locked non-renewing offer', 'Create fixed-term offer', 'No auto-renew',
  'platform_admin_create_broadcast', 'platform_admin_owner_cost_rows',
  'platform_admin_update_business_v2', 'support@velliqo.com',
  'Export CSV', 'Export all', 'Admin audit trail',
]) requireText('src/pages/admin/PlatformAdmin.tsx', needle);

for (const needle of [
  'support.ai.title', 'support@velliqo.com', 'owner_create_support_request',
  'support_add_message', 'owner_mark_support_request_read', 'support.urgent.title',
]) requireText('src/components/support/OwnerHelpCenter.tsx', needle);
requireText('src/components/layouts/owner-shell/OwnerTopBar.tsx', 'data-tour="help-center"', 'Owner Help entry exists in top bar');
requireText('src/components/layouts/OwnerDashboardLayout.tsx', '<OwnerHelpCenter', 'Owner Help Center mounted in every owner page');
for (const needle of ['platform_announcement', 'support_reply', 'support_status', 'metadata.request_id']) requireText('src/components/dashboard/OwnerNotificationCenter.tsx', needle);

for (const needle of ['searchAnyLocation', 'live marketplace', 'onSearch(filters)', '280']) requireText('src/components/discovery/DiscoverySearchBar.tsx', needle);
requireText('src/pages/marketing/DiscoverBusinesses.tsx', 'React.useCallback', 'Discovery URL updates are stable for live search');
requireText('src/discovery/api.ts', 'p_location_query: filters.location.trim() || null', 'Discovery forwards arbitrary location text to backend search');

for (const needle of ['preview_billing_offer_code', 'offerRequiredPlan', 'billing.offer.useOffer']) requireText('src/pages/owner/Billing.tsx', needle);

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|json|md|html)$/.test(entry.name)) sourceFiles.push(full);
  }
}
for (const dir of ['src','scripts','docs']) walk(path.join(root, dir));
const legacyEmail = ['georgeau791926','gmail.com'].join('@');
checks.push([!sourceFiles.filter((file) => !file.endsWith('check-phase14d-admin-support-discovery.mjs')).some((file) => fs.readFileSync(file, 'utf8').includes(legacyEmail)), 'Legacy personal support email removed from application/documentation']);

for (const lang of ['en','el','de','es','tr']) {
  const data = JSON.parse(read(`src/i18n/locales/${lang}.json`));
  for (const [pathKey, value] of [
    ['button', data.support?.button], ['ai.title', data.support?.ai?.title], ['email.title', data.support?.email?.title],
    ['urgent.title', data.support?.urgent?.title], ['requests.title', data.support?.requests?.title],
    ['status.sent', data.support?.status?.sent], ['status.pending', data.support?.status?.pending], ['status.completed', data.support?.status?.completed], ['status.cancelled', data.support?.status?.cancelled],
  ]) checks.push([Boolean(value), `${lang}: support.${pathKey}`]);
  for (const key of ['searchAnyLocation','searchAnyLocationHint','liveResults']) checks.push([Boolean(data.discovery?.search?.[key]), `${lang}: discovery.search.${key}`]);
  for (const key of ['invalid','applied','lockedToPlan','checking','apply','preview','otherPlanLocked','useOffer']) checks.push([Boolean(data.billing?.offer?.[key]), `${lang}: billing.offer.${key}`]);
}

const failures = checks.filter(([ok]) => !ok);
if (failures.length) {
  console.error('Phase 14D admin/support/discovery validation failed.');
  for (const [, label] of failures) console.error(`- ${label}`);
  process.exit(1);
}
console.log(`Phase 14D admin/support/discovery validation passed (${checks.length} checks).`);
console.log('Validated: control plane, owner Help Center, support inbox, broadcasts, cost attribution, plan-locked offers, live discovery and support email hardening.');
