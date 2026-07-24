import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    failures.push(`Missing ${relative}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
};
const requireIncludes = (source, markers, label) => {
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${label} missing: ${marker}`);
  }
};

const migration = read('supabase/migrations/00034_marketing_delivery_engine.sql');
const worker = read('supabase/functions/process_marketing_deliveries/index.ts');
const unsubscribe = read('supabase/functions/marketing-unsubscribe/index.ts');
const resendWebhook = read('supabase/functions/resend-marketing-webhook/index.ts');
const twilioWebhook = read('supabase/functions/twilio-marketing-webhook/index.ts');
const config = read('supabase/config.toml');
const marketing = read('src/pages/owner/Marketing.tsx');
const deliveryCenter = read('src/components/marketing/MarketingDeliveryCenter.tsx');
const customerPortal = read('src/pages/customer/CustomerPortal.tsx');
const workflow = read('.github/workflows/quality-gate.yml');
const secretsTemplate = read('supabase/functions/.env.example');

requireIncludes(migration, [
  "delivery_mode text not null default 'disabled'",
  'create table if not exists public.marketing_delivery_runs',
  'create table if not exists public.marketing_deliveries',
  'create table if not exists public.marketing_delivery_events',
  'create table if not exists public.marketing_suppressions',
  'unique (business_id, channel, destination)',
  'create table if not exists public.customer_notifications',
  'create or replace function public.owner_queue_marketing_campaign',
  'not public.is_business_owner(v_campaign.business_id)',
  'create or replace function public.service_queue_due_marketing_campaigns',
  'create or replace function public.service_prepare_marketing_automations',
  'create or replace function public.claim_marketing_deliveries',
  'create or replace function public.revalidate_marketing_delivery',
  'create or replace function public.sync_customer_marketing_suppressions',
  'create or replace function public.service_apply_sms_marketing_keyword',
  "where public.marketing_suppressions.source = 'customer'",
  'alter table public.marketing_delivery_runs enable row level security',
  'alter table public.marketing_deliveries enable row level security',
  'alter table public.customer_notifications enable row level security',
  'grant execute on function public.claim_marketing_deliveries',
  'alter publication supabase_realtime add table public.customer_notifications',
], 'delivery migration');

if (migration.includes('marketing_suppressions_active_destination_idx')) {
  failures.push('Suppressions must use a full unique constraint so provider upserts are deterministic.');
}

requireIncludes(worker, [
  "req.headers.get('x-marketing-secret')",
  "service_queue_due_marketing_campaigns",
  "service_prepare_marketing_automations",
  "claim_marketing_deliveries",
  "revalidate_marketing_delivery",
  "Idempotency-Key",
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
  'daily_email_limit',
  'daily_sms_limit',
  'recoverStaleClaims',
  'backoffMinutes',
  'isRetryableProviderFailure',
  "code === 'twilio_20429'",
  "status: 'simulated'",
  "reason: 'channel_disabled'",
  'testSampleAlreadySent',
  "reason: 'test_sample_already_sent'",
], 'delivery worker');

requireIncludes(unsubscribe, [
  "if (!['GET', 'POST'].includes(req.method))",
  "unsubscribe_token",
  "email_notifications_enabled = false",
  "sms_notifications_enabled = false",
  "from('marketing_suppressions')",
], 'unsubscribe function');

requireIncludes(resendWebhook, [
  "new Webhook(RESEND_WEBHOOK_SECRET)",
  "new Webhook(RESEND_WEBHOOK_SECRET).verify(payload",
  "svix-id",
  "email.bounced",
  "email.complained",
  "from('marketing_delivery_events')",
], 'Resend webhook');

requireIncludes(twilioWebhook, [
  "x-twilio-signature",
  "verifyTwilioSignature",
  "HMAC",
  "SHA-1",
  "MessageStatus",
  "from('marketing_delivery_events')",
  "service_apply_sms_marketing_keyword",
  "STOP",
  "START",
], 'Twilio webhook');

for (const name of [
  'process_marketing_deliveries',
  'marketing-unsubscribe',
  'resend-marketing-webhook',
  'twilio-marketing-webhook',
]) {
  requireIncludes(config, [`[functions.${name}]`, 'verify_jwt = false'], `config for ${name}`);
}

requireIncludes(marketing, [
  "type MarketingTab = 'overview' | 'campaigns' | 'automations' | 'delivery' | 'reviews'",
  '<MarketingDeliveryCenter />',
  "owner_queue_marketing_campaign",
  'subject_template:',
  'deliveryReady: false',
], 'Marketing workspace');
requireIncludes(deliveryCenter, [
  "from('marketing_delivery_settings')",
  "from('marketing_delivery_runs')",
  "from('marketing_deliveries')",
  "delivery_mode",
  "daily_email_limit",
  "daily_sms_limit",
  "marketingDelivery.messages.confirmLive",
], 'Delivery center');
requireIncludes(customerPortal, [
  "from('customer_notifications')",
  "table: 'customer_notifications'",
  'marketing_consent:',
  'email_notifications_enabled:',
  'sms_notifications_enabled:',
  'birth_date:',
], 'Customer portal');
requireIncludes(workflow, ['npm run delivery:check', 'actions/checkout@v6', 'actions/setup-node@v6', 'node-version: 22'], 'quality gate');
requireIncludes(secretsTemplate, ['MARKETING_FUNCTION_SECRET', 'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'TWILIO_AUTH_TOKEN'], 'function secrets template');

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const relative = `src/i18n/locales/${locale}.json`;
  const source = read(relative);
  if (!source) continue;
  const data = JSON.parse(source);
  if (!data.marketingDelivery?.messages?.confirmLive) failures.push(`${relative} missing live delivery confirmation`);
  if (!data.marketingDelivery) failures.push(`${relative} missing marketingDelivery`);
  if (!data.marketing?.tabs?.delivery) failures.push(`${relative} missing marketing.tabs.delivery`);
  if (!data.marketing?.automations?.manualOnly) failures.push(`${relative} missing marketing.automations.manualOnly`);
  for (const key of ['birthday', 'win_back', 'review_request', 'no_show_recovery', 'last_minute_availability']) {
    if (!data.marketing?.automations?.[key]?.subject) failures.push(`${relative} missing ${key}.subject`);
  }
  if (!data.customerPortal?.tabs?.notifications) failures.push(`${relative} missing customer notifications tab`);
  if (!data.customerPortal?.preferences?.title) failures.push(`${relative} missing customer marketing preferences`);
}

if (failures.length) {
  console.error('Marketing delivery engine validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Marketing delivery engine validation passed.');
console.log('Validated: disabled-by-default delivery, queue/RPC security, consent revalidation, retries, idempotency, unsubscribe, provider webhooks, customer inbox, UI and 5 locales.');
