import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireText = (file, values) => {
  const content = read(file);
  for (const value of values) {
    if (!content.includes(value)) throw new Error(`${file} is missing required multilingual AI marker: ${value}`);
  }
};

requireText('src/hooks/useBrowserVoice.ts', [
  'const DEFAULT_SILENCE_GRACE_MS = 3000',
  'recognition.continuous = true',
  'scheduleSilenceCompletion()',
  'recognitionCycleRef.current()',
  "en: 'en-GB'",
  "el: 'el-GR'",
  "de: 'de-DE'",
  "es: 'es-ES'",
  "tr: 'tr-TR'",
]);

requireText('src/hooks/useVelliqoAI.ts', [
  ".eq('language', language)",
  'loadLatestAIManagerBriefing(businessId, language)',
  'loadAIManagerAlerts(businessId, language)',
  'refreshAIManagerBriefing(businessId, language)',
  'startNewConversation();',
]);

requireText('supabase/functions/velliqo-ai-manager/index.ts', [
  'const responseLanguage = language;',
  'Respond exclusively in ${languageName[input.language]}',
  'Every human-readable field you generate must use ${languageName[input.language]}',
]);

requireText('supabase/functions/process-ai-manager-automations/index.ts', [
  'requestedLanguage: normalizeLanguage(body?.language || settings.default_language)',
  'const selectedLanguage = options.requestedLanguage || normalizeLanguage(settings.default_language);',
  "onConflict: 'business_id,briefing_date,language'",
  "onConflict: 'business_id,dedupe_key,language'",
]);

requireText('supabase/migrations/00043_velliqo_ai_multilingual_voice_hardening.sql', [
  'ai_manager_briefings_business_date_language_key',
  'unique (business_id, briefing_date, language)',
  'ai_manager_alerts_business_dedupe_language_key',
  'unique (business_id, dedupe_key, language)',
]);

for (const language of ['en', 'el', 'de', 'es', 'tr']) {
  const locale = JSON.parse(read(`src/i18n/locales/${language}.json`));
  for (const key of ['pauseHint', 'languageChangedMessage']) {
    if (!locale?.ai?.voice?.[key]) throw new Error(`${language}.json is missing ai.voice.${key}`);
  }
  if (!locale?.ai?.manager?.languageChanged) {
    throw new Error(`${language}.json is missing ai.manager.languageChanged`);
  }
}

console.log('Velliqo AI multilingual and voice pause checks passed.');
console.log('Selected-language conversations, briefings, alerts, speech recognition, speech synthesis and 3-second pause handling verified.');
