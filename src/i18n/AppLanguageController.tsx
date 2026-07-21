import React from 'react';
import { useTranslation } from 'react-i18next';
const supported = new Set(['en','el','de','es','tr']);
export default function AppLanguageController() {
  const { i18n } = useTranslation();
  React.useEffect(() => {
    const language = supported.has(i18n.resolvedLanguage || '') ? i18n.resolvedLanguage! : 'en';
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    window.localStorage.setItem('velliqo.language', language);
  }, [i18n.resolvedLanguage]);
  return null;
}
