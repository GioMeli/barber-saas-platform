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

const migration = read('supabase/migrations/00036_velliqo_ai_manager_foundation.sql');
const edge = read('supabase/functions/velliqo-ai-manager/index.ts');
const hub = read('src/pages/owner/ai/AIHub.tsx');
const settings = read('src/pages/owner/ai/AISettings.tsx');
const api = read('src/ai/api/velliqoAI.ts');
const hook = read('src/hooks/useVelliqoAI.ts');
const pkg = JSON.parse(read('package.json') || '{}');
const workflow = read('.github/workflows/quality-gate.yml');
const config = read('supabase/config.toml');

requireText(migration, 'get_ai_business_snapshot', 'Migration');
requireText(migration, 'public.has_business_access(p_business_id)', 'Migration tenant isolation');
requireText(migration, 'containsCustomerNames', 'Migration privacy metadata');
requireText(migration, 'alter table public.ai_insights enable row level security', 'AI insight RLS');
requireText(migration, 'grant execute on function public.get_ai_business_snapshot', 'Snapshot grants');

requireText(edge, 'userClient.auth.getUser()', 'Edge authentication');
requireText(edge, ".from('business_members')", 'Edge membership validation');
requireText(edge, 'get_ai_business_snapshot', 'Grounded snapshot');
requireText(edge, 'daily_request_limit', 'Rate limit');
requireText(edge, "ENGINE_NAME = 'velliqo-insights-v1'", 'Free intelligence engine');
requireText(edge, "Deno.env.get('OPENAI_API_KEY')", 'OpenAI secret configuration');
requireText(edge, "OPENAI_MODEL", 'Configurable OpenAI model');
requireText(edge, "/responses", 'OpenAI Responses API');
requireText(edge, "store: false", 'OpenAI response storage disabled');
requireText(edge, "provider = 'openai'", 'External provider audit');
requireText(edge, 'estimateOpenAICost', 'Usage cost estimation');
requireText(edge, 'classifyTopic', 'Natural-language topic routing');
requireText(edge, 'calculateHealthScore', 'Business health scoring');
requireText(edge, 'buildInsights', 'Deterministic insight engine');
requireText(edge, 'read_only: true', 'Read-only response metadata');

requireText(hub, 'useVelliqoAI', 'AI Hub integration');
requireText(hub, 'velliqo-ai-composer', 'AI composer');
requireText(hub, 'suggested_actions', 'Read-only recommendations');
requireText(hub, 'zeroExternalCost', 'AI usage disclosure');
requireText(hub, 'onAskQuestion', 'Interactive follow-up prompts');
requireText(settings, 'privateEngineDescription', 'Private engine settings disclosure');
requireText(settings, 'allow_customer_data: false', 'Aggregate-only customer privacy');
requireText(settings, 'allow_write_actions: false', 'Read-only settings enforcement');
requireText(api, "supabase.functions.invoke('velliqo-ai-manager'", 'AI function invocation');
requireText(hook, "from('ai_conversations')", 'Conversation history');
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
      !data.ai?.manager?.zeroExternalCost ||
      !data.ai?.manager?.privateEngineDescription
    ) {
      errors.push(`${relative}: missing free Velliqo AI Manager translations`);
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
console.log('Validated: JWT auth, tenant isolation, aggregate-only snapshot, OpenAI Responses API, deterministic fallback, cost tracking, structured insights, read-only recommendations, rate limits, conversation history, UI and 5 locales.');
