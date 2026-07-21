import React from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '../config';

export function LocalizationRoot({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  React.useEffect(() => {
    const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [i18n.language, i18n.resolvedLanguage]);
  return <>{children}</>;
}
