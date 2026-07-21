import type { AILanguage } from '../core/types';
import { languageLocale } from './languages';
export const formatAICurrency = (value: number, language: AILanguage, currency = 'EUR') => new Intl.NumberFormat(languageLocale(language), { style: 'currency', currency }).format(value);
export const formatAINumber = (value: number, language: AILanguage) => new Intl.NumberFormat(languageLocale(language)).format(value);
export const formatAIPercent = (value: number, language: AILanguage) => new Intl.NumberFormat(languageLocale(language), { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
export const formatAIDate = (value: Date | string, language: AILanguage, timezone?: string) => new Intl.DateTimeFormat(languageLocale(language), { dateStyle: 'medium', timeZone: timezone }).format(new Date(value));
