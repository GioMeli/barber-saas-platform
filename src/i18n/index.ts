import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enTranslations from './locales/en.json';
import elTranslations from './locales/el.json';
import ruTranslations from './locales/ru.json';
import hiTranslations from './locales/hi.json';
import arTranslations from './locales/ar.json';

const resources = {
  en: { translation: enTranslations },
  el: { translation: elTranslations },
  ru: { translation: ruTranslations },
  hi: { translation: hiTranslations },
  ar: { translation: arTranslations }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
