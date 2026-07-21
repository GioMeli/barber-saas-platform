import type { AILanguage } from '../core/types';
export const SUPPORTED_AI_LANGUAGES: Array<{ code: AILanguage; label: string; nativeLabel: string; locale: string }> = [
  { code: 'en', label: 'English', nativeLabel: 'English', locale: 'en-GB' },
  { code: 'el', label: 'Greek', nativeLabel: 'Ελληνικά', locale: 'el-GR' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', locale: 'de-DE' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', locale: 'es-ES' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', locale: 'tr-TR' },
];
export function normalizeLanguage(value?: string | null): AILanguage {
  const code = value?.toLowerCase().split('-')[0];
  return SUPPORTED_AI_LANGUAGES.some((item) => item.code === code) ? code as AILanguage : 'en';
}
export function languageLocale(language: AILanguage) {
  return SUPPORTED_AI_LANGUAGES.find((item) => item.code === language)?.locale ?? 'en-GB';
}
