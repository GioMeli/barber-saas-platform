import type { TFunction } from 'i18next';
import { getIndustryConfig } from '@/config/industries';

type TermKey = 'staff' | 'staff_member' | 'staff_plural' | 'customer' | 'customers' | 'service' | 'services' | 'appointment' | 'appointments';

export function getIndustryTerm(
  t: TFunction,
  industryKey: string | null | undefined,
  term: TermKey
): string {
  const language = t('language.label', { lng: undefined });
  const industry = getIndustryConfig(industryKey);

  // Industry-specific professional labels are used only in English until
  // every professional term has a reviewed translation in all supported locales.
  if (language === 'Language') {
    if (term === 'staff_member') return industry.labels.professional;
    if (term === 'staff' || term === 'staff_plural') return industry.labels.professionals;
  }

  return t(`terminology.${term}`);
}
