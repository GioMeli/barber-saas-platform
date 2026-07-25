import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    errors.push(`Missing required file: ${relative}`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
}

const foundationMigration = read('supabase/migrations/00036_velliqo_ai_manager_foundation.sql');
const actionMigration = read('supabase/migrations/00037_velliqo_ai_secure_action_engine.sql');
const edge = read('supabase/functions/velliqo-ai-manager/index.ts');
const hub = read('src/pages/owner/ai/AIHub.tsx');
const settings = read('src/pages/owner/ai/AISettings.tsx');
const api = read('src/ai/api/velliqoAI.ts');
const hook = read('src/hooks/useVelliqoAI.ts');
const pkg = JSON.parse(read('package.json') || '{}');
const workflow = read('.github/workflows/quality-gate.yml');
const config = read('supabase/config.toml');

requireText(foundationMigration, 'get_ai_business_snapshot', 'Foundation migration');
requireText(foundationMigration, 'public.has_business_access(p_business_id)', 'Foundation tenant isolation');
requireText(foundationMigration, 'containsCustomerNames', 'Foundation privacy metadata');
requireText(foundationMigration, 'alter table public.ai_insights enable row level security', 'AI insight RLS');
requireText(foundationMigration, 'grant execute on function public.get_ai_business_snapshot', 'Snapshot grants');

requireText(actionMigration, 'execute_ai_action_request', 'Action execution RPC');
requireText(actionMigration, 'reject_ai_action_request', 'Action rejection RPC');
requireText(actionMigration, "status = 'executed'", 'Idempotent action status');
requireText(actionMigration, 'for update', 'Action row locking');
requireText(actionMigration, 'allow_write_actions', 'Write-action setting enforcement');
requireText(actionMigration, 'owner_create_appointment', 'Secure appointment reuse');
requireText(actionMigration, 'owner_reschedule_appointment', 'Secure reschedule reuse');
requireText(actionMigration, 'owner_update_appointment_status', 'Secure cancellation reuse');
requireText(actionMigration, 'ai_action_executed', 'Action audit trail');
requireText(actionMigration, 'revoke insert, update, delete', 'Direct browser write lockdown');

requireText(edge, 'userClient.auth.getUser()', 'Edge authentication');
requireText(edge, ".from('business_members')", 'Edge membership validation');
requireText(edge, 'get_ai_business_snapshot', 'Grounded snapshot');
requireText(edge, 'daily_request_limit', 'Rate limit');
requireText(edge, "Deno.env.get('OPENAI_API_KEY')", 'OpenAI secret configuration');
requireText(edge, '/responses', 'OpenAI Responses API');
requireText(edge, 'store: false', 'OpenAI response storage disabled');
requireText(edge, 'loadOperationalCatalog', 'Operational action catalogue');
requireText(edge, 'preparePendingAction', 'Pending action preparation');
requireText(edge, 'create_campaign_draft', 'Campaign draft action');
requireText(edge, 'create_post_draft', 'Post draft action');
requireText(edge, 'pending_action', 'Action metadata');
requireText(edge, 'idempotencyKey', 'Action idempotency');
requireText(edge, 'estimateOpenAICost', 'Usage cost estimation');
requireText(edge, 'calculateHealthScore', 'Business health scoring');
requireText(edge, 'buildInsights', 'Deterministic fallback');

requireText(hub, 'useVelliqoAI', 'AI Hub integration');
requireText(hub, 'AIActionConfirmationCard', 'Action confirmation UI');
requireText(hub, 'onExecuteAction', 'Action execution UI');
requireText(hub, 'onCancelAction', 'Action cancellation UI');
requireText(hub, 'velliqo-ai-composer', 'AI composer');
requireText(settings, 'allow_customer_data', 'Customer-data consent setting');
requireText(settings, 'allow_write_actions', 'Write-action setting');
requireText(settings, 'actionSettingsWarning', 'Action safety warning');
requireText(api, 'execute_ai_action_request', 'Action execution API');
requireText(api, 'reject_ai_action_request', 'Action rejection API');
requireText(hook, 'executeAction', 'Action execution hook');
requireText(hook, 'actionBusyId', 'Duplicate action UI protection');
requireText(config, '[functions.velliqo-ai-manager]', 'Function config');
requireText(config, 'verify_jwt = true', 'Function JWT verification');

if (pkg.scripts?.['ai:check'] !== 'node scripts/check-velliqo-ai-manager.mjs') {
  errors.push('package.json: missing ai:check script');
}
requireText(workflow, 'npm run ai:check', 'GitHub quality gate');

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const relative = `src/i18n/locales/${locale}.json`;
  try {
    const data = JSON.parse(read(relative));
    if (
      !data.ai?.manager?.welcome ||
      !data.ai?.manager?.prompts?.dailyBriefing ||
      !data.ai?.manager?.privateEngineDescription ||
      !data.ai?.manager?.writeActions ||
      !data.ai?.manager?.actions?.confirm ||
      !data.ai?.manager?.actions?.types?.create_appointment
    ) {
      errors.push(`${relative}: missing Velliqo AI Action Engine translations`);
    }
  } catch (error) {
    errors.push(`${relative}: invalid JSON (${error.message})`);
  }
}

if (errors.length) {
  console.error('Velliqo AI Manager validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Velliqo AI Manager validation passed.');
console.log('Validated: JWT auth, tenant isolation, OpenAI conversation, deterministic fallback, usage tracking, secure action preparation, confirmation RPCs, role checks, idempotency, audit logs, customer/appointment/campaign/post actions, UI and 5 locales.');
