export const SUPPORTED_LANGUAGES = ['en', 'el', 'de', 'es', 'tr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'velliqo.language';

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: SupportedLanguage; labelKey: string; nativeLabel: string }> = [
  { code: 'en', labelKey: 'language.english', nativeLabel: 'English' },
  { code: 'el', labelKey: 'language.greek', nativeLabel: 'Ελληνικά' },
  { code: 'de', labelKey: 'language.german', nativeLabel: 'Deutsch' },
  { code: 'es', labelKey: 'language.spanish', nativeLabel: 'Español' },
  { code: 'tr', labelKey: 'language.turkish', nativeLabel: 'Türkçe' },
];

export const LANGUAGE_TO_LOCALE: Record<SupportedLanguage, string> = {
  en: 'en-GB', el: 'el-GR', de: 'de-DE', es: 'es-ES', tr: 'tr-TR',
};

export function normalizeLanguage(value?: string | null): SupportedLanguage {
  const base = value?.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(base as SupportedLanguage) ? (base as SupportedLanguage) : DEFAULT_LANGUAGE;
}
