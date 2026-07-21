import { LANGUAGE_TO_LOCALE, normalizeLanguage, type SupportedLanguage } from '../config';

export type DateInput = Date | string | number;
const localeFor = (language?: string): string => LANGUAGE_TO_LOCALE[normalizeLanguage(language)];
const toDate = (value: DateInput): Date => value instanceof Date ? value : new Date(value);

export function formatDate(value: DateInput, language?: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(localeFor(language), options).format(toDate(value));
}
export function formatTime(value: DateInput, language?: string, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  return new Intl.DateTimeFormat(localeFor(language), options).format(toDate(value));
}
export function formatNumber(value: number, language?: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}
export function formatCurrency(value: number, currency = 'EUR', language?: string): string {
  return formatNumber(value, language, { style: 'currency', currency });
}
export function formatPercent(value: number, language?: string, maximumFractionDigits = 1): string {
  return formatNumber(value, language, { style: 'percent', maximumFractionDigits });
}
export function getLocale(language?: string): string { return localeFor(language); }
export type { SupportedLanguage };
