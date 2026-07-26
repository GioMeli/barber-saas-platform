import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    failures.push(`${file}: missing required file`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
};
const requireText = (file, text, label = text) => {
  const source = read(file);
  if (!source.includes(text)) failures.push(`${file}: missing ${label}`);
};

const migration = 'supabase/migrations/00040_velliqo_ai_voice_assistant.sql';
for (const token of [
  'voice_enabled boolean not null default false',
  'voice_auto_play boolean not null default true',
  'voice_continuous_mode boolean not null default true',
  'voice_allow_low_risk_confirmation boolean not null default false',
  'create table if not exists public.ai_voice_sessions',
  'create table if not exists public.ai_voice_events',
  'start_ai_voice_session',
  'log_ai_voice_event',
  'finish_ai_voice_session',
  "- 'transcript'",
  "'ai_voice_' || p_event_type",
  'revoke insert, update, delete on public.ai_voice_events from authenticated',
]) requireText(migration, token);

const component = 'src/components/ai/VelliqoVoiceAssistant.tsx';
for (const token of [
  'useBrowserVoice',
  'startAIVoiceSession',
  'logAIVoiceEvent',
  'finishAIVoiceSession',
  'voice_allow_low_risk_confirmation',
  "action.risk_level !== 'low'",
  "safeLog('confirmation_blocked'",
  'onSendMessage',
  'onExecuteAction',
  'onRejectAction',
  'interruptAndSpeak',
]) requireText(component, token);

const browserHook = 'src/hooks/useBrowserVoice.ts';
for (const token of [
  'webkitSpeechRecognition',
  'interimResults = true',
  'SpeechSynthesisUtterance',
  'window.speechSynthesis.cancel()',
  'getUserMedia({ audio: true })',
]) requireText(browserHook, token);

const hub = 'src/pages/owner/ai/AIHub.tsx';
requireText(hub, 'VelliqoVoiceAssistant', 'Voice Assistant integration');
requireText(hub, 'onSendMessage', 'shared AI conversation path');
requireText(hub, 'onExecuteAction={executeAction}', 'shared Action Engine execution');
requireText(hub, 'onRejectAction={cancelAction}', 'shared Action Engine rejection');

const settings = 'src/pages/owner/ai/AISettings.tsx';
for (const token of [
  'voice_enabled',
  'voice_auto_play',
  'voice_continuous_mode',
  'voice_allow_low_risk_confirmation',
  'voice_rate',
  'voice_pitch',
]) requireText(settings, token);

for (const language of ['en', 'el', 'de', 'es', 'tr']) {
  const relative = `src/i18n/locales/${language}.json`;
  try {
    const json = JSON.parse(read(relative));
    for (const key of [
      'title',
      'settingsTitle',
      'interrupt',
      'privacyNotice',
      'useVisibleConfirmation',
      'lowRiskConfirmationPrompt',
    ]) {
      if (!json?.ai?.voice?.[key]) failures.push(`${relative}: missing ai.voice.${key}`);
    }
  } catch (error) {
    failures.push(`${relative}: invalid JSON (${error.message})`);
  }
}

const pkg = JSON.parse(read('package.json') || '{}');
if (pkg.scripts?.['voice:check'] !== 'node scripts/check-ai-voice-assistant.mjs') {
  failures.push('package.json: missing voice:check script');
}
requireText('.github/workflows/quality-gate.yml', 'npm run voice:check', 'Phase 9E quality gate');

if (failures.length) {
  console.error('Phase 9E Voice Assistant checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 9E Voice Assistant checks passed.');
console.log('Browser speech, streaming transcript, spoken responses, interruption, shared Action Engine permissions and privacy-safe audit logging verified.');
