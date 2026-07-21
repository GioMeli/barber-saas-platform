import React from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_OPTIONS, normalizeLanguage, type SupportedLanguage } from '@/i18n/config';

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageSwitcher({ compact = false, className = '' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    await i18n.changeLanguage(event.target.value as SupportedLanguage);
  };

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('language.label')}</span>
      {!compact && <Languages aria-hidden="true" className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />}
      <select
        aria-label={t('language.label')}
        className={`h-9 rounded-lg border border-border bg-background text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${compact ? 'w-12 px-1 text-center' : 'min-w-[142px] pl-8 pr-7'} `}
        value={currentLanguage}
        onChange={handleLanguageChange}
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <option key={language.code} value={language.code}>
            {compact ? language.code.toUpperCase() : language.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
