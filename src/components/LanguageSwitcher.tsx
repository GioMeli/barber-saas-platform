import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  useEffect(() => {
    // Handle RTL for Arabic
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <select 
      className="bg-transparent border border-border text-sm rounded-md px-2 py-1 outline-none"
      value={i18n.language}
      onChange={handleLanguageChange}
    >
      <option value="en">English</option>
      <option value="el">Ελληνικά (Greek)</option>
      <option value="ru">Русский (Russian)</option>
      <option value="hi">हिन्दी (Hindi)</option>
      <option value="ar">العربية (Arabic)</option>
    </select>
  );
}