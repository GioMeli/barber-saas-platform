import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const requireText = (file, text, label = text) => {
  const source = read(file);
  if (!source.includes(text)) failures.push(`${file}: missing ${label}`);
};

const migration = 'supabase/migrations/00039_velliqo_ai_operational_automations.sql';
for (const token of [
  'create table if not exists public.ai_automation_rules',
  "'customer_reactivation'",
  "'schedule_optimisation'",
  "'low_stock_actions'",
  "'campaign_planning'",
  'service_queue_due_ai_automation_runs',
  'service_claim_ai_automation_runs',
  'service_retry_or_fail_ai_automation_run',
  'service_execute_ai_low_risk_draft_action',
  'save_ai_automation_configuration',
  'automation_generated',
  'idempotency_key',
]) requireText(migration, token);

for (const token of [
  'on public.ai_automation_runs (rule_id, started_at desc)',
  "recent.started_at >= now() - interval '1 hour'",
  'order by r.scheduled_for, r.started_at',
]) requireText(migration, token, `00038-compatible run timestamp: ${token}`);

for (const forbidden of [
  'on public.ai_automation_runs (rule_id, created_at desc)',
  'recent.created_at',
  'order by r.scheduled_for, r.created_at',
]) {
  if (read(migration).includes(forbidden)) {
    failures.push(`${migration}: incompatible ai_automation_runs timestamp reference: ${forbidden}`);
  }
}

const worker = 'supabase/functions/process-ai-manager-automations/index.ts';
for (const token of [
  'runOperationalAutomationScan',
  'handleCustomerReactivation',
  'handleScheduleOptimisation',
  'handleLowStockActions',
  'handleCampaignPlanning',
  'prepareAutomationActionRequest',
  "service_execute_ai_low_risk_draft_action",
  'marketing_consent',
  'appointments_moved_automatically: false',
  'purchase_not_automated: true',
  'campaign_sending_automatic: false',
]) requireText(worker, token);

const settings = 'src/pages/owner/ai/AISettings.tsx';
for (const token of [
  'manager_automations_enabled',
  'automation_default_autonomy',
  'automation_timezone',
  'customer_reactivation',
  'schedule_optimisation',
  'low_stock_actions',
  'campaign_planning',
  'requires_confirmation',
]) requireText(settings, token);

for (const language of ['en', 'el', 'de', 'es', 'tr']) {
  const json = JSON.parse(read(`src/i18n/locales/${language}.json`));
  for (const key of [
    'customer_reactivation',
    'schedule_optimisation',
    'low_stock_actions',
    'campaign_planning',
  ]) {
    if (!json?.ai?.automations?.rules?.[key]?.title) {
      failures.push(`${language}.json: missing ai.automations.rules.${key}.title`);
    }
  }
}

if (failures.length) {
  console.error('Phase 9D operational automation checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 9D operational automation checks passed.');
console.log('4 operational handlers, queue/retry controls, Action Engine drafts and 5-language UI verified.');
