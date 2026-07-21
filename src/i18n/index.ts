import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import el from './locales/el.json';
import en from './locales/en.json';
import es from './locales/es.json';
import tr from './locales/tr.json';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, normalizeLanguage } from './config';

void i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: { translation: en }, el: { translation: el }, de: { translation: de }, es: { translation: es }, tr: { translation: tr } },
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: ['en', 'el', 'de', 'es', 'tr'],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: LANGUAGE_STORAGE_KEY, caches: ['localStorage'] },
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (language) => {
  const normalized = normalizeLanguage(language);
  document.documentElement.lang = normalized;
  document.documentElement.dir = 'ltr';
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
});

export default i18n;
