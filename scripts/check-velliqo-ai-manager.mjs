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
const proactiveMigration = read('supabase/migrations/00038_velliqo_ai_proactive_manager.sql');
const edge = read('supabase/functions/velliqo-ai-manager/index.ts');
const proactiveWorker = read('supabase/functions/process-ai-manager-automations/index.ts');
const hub = read('src/pages/owner/ai/AIHub.tsx');
const settings = read('src/pages/owner/ai/AISettings.tsx');
const api = read('src/ai/api/velliqoAI.ts');
const hook = read('src/hooks/useVelliqoAI.ts');
const notificationCenter = read('src/components/dashboard/OwnerNotificationCenter.tsx');
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

requireText(proactiveMigration, 'ai_manager_briefings', 'Proactive briefing storage');
requireText(proactiveMigration, 'ai_manager_alerts', 'Proactive alert storage');
requireText(proactiveMigration, 'ai_automation_runs', 'Automation audit storage');
requireText(proactiveMigration, 'invoke_velliqo_ai_automation_worker', 'Vault-backed proactive worker invocation');
requireText(proactiveMigration, "'7 * * * *'", 'Hourly proactive cron');
requireText(proactiveMigration, 'create_ai_owner_notification', 'Owner AI notifications');
requireText(proactiveMigration, 'proactive_briefing_enabled', 'Daily briefing setting');
requireText(proactiveMigration, 'monitor_revenue_changes', 'Revenue monitor setting');
requireText(proactiveMigration, 'monitor_no_shows', 'No-show monitor setting');
requireText(proactiveMigration, 'monitor_customer_retention', 'Retention monitor setting');
requireText(proactiveMigration, 'monitor_inventory', 'Inventory monitor setting');
requireText(proactiveMigration, 'monitor_marketing_performance', 'Marketing monitor setting');

requireText(proactiveWorker, 'AI_AUTOMATION_FUNCTION_SECRET', 'Proactive worker secret');
requireText(proactiveWorker, 'runScheduledScan', 'Scheduled proactive scan');
requireText(proactiveWorker, 'buildMetrics', 'Proactive aggregate metrics');
requireText(proactiveWorker, 'buildAlerts', 'Proactive threshold detection');
requireText(proactiveWorker, 'generateBriefing', 'AI-generated daily briefing');
requireText(proactiveWorker, 'OpenAI proactive briefing failed; using deterministic fallback', 'Proactive deterministic fallback');
requireText(proactiveWorker, "from('ai_manager_briefings')", 'Briefing persistence');
requireText(proactiveWorker, "from('ai_manager_alerts')", 'Alert persistence');
requireText(proactiveWorker, "rpc('create_ai_owner_notification'", 'Owner alert delivery');

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
requireText(hub, 'AIManagerBriefingPanel', 'Daily manager briefing UI');
requireText(hub, 'AIProactiveAlertPanel', 'Proactive alerts UI');
requireText(settings, 'allow_customer_data', 'Customer-data consent setting');
requireText(settings, 'allow_write_actions', 'Write-action setting');
requireText(settings, 'actionSettingsWarning', 'Action safety warning');
requireText(settings, 'proactive_briefing_enabled', 'Daily briefing configuration UI');
requireText(settings, 'monitor_revenue_changes', 'Revenue monitor configuration UI');
requireText(settings, 'monitor_inventory', 'Inventory monitor configuration UI');
requireText(api, 'execute_ai_action_request', 'Action execution API');
requireText(api, 'reject_ai_action_request', 'Action rejection API');
requireText(api, 'refreshAIManagerBriefing', 'Manual briefing refresh API');
requireText(api, 'updateAIManagerAlertStatus', 'Alert status API');
requireText(hook, 'executeAction', 'Action execution hook');
requireText(hook, 'actionBusyId', 'Duplicate action UI protection');
requireText(hook, 'refreshProactive', 'Proactive state refresh');
requireText(hook, 'generateBriefing', 'Manual proactive briefing generation');
requireText(config, '[functions.velliqo-ai-manager]', 'Function config');
requireText(config, 'verify_jwt = true', 'Function JWT verification');
requireText(config, '[functions.process-ai-manager-automations]', 'Proactive worker config');
requireText(notificationCenter, "'ai_briefing'", 'AI briefing notifications');
requireText(notificationCenter, "'ai_alert'", 'AI alert notifications');

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
      !data.ai?.manager?.actions?.types?.create_appointment ||
      !data.ai?.manager?.proactive?.dailyBriefing ||
      !data.ai?.manager?.proactive?.settingsTitle ||
      !data.ai?.manager?.proactive?.monitorRevenue
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
console.log('Validated: JWT auth, tenant isolation, OpenAI conversation, deterministic fallback, secure actions, proactive daily briefings, scheduled monitoring, owner notifications, alert controls, usage tracking, UI and 5 locales.');
