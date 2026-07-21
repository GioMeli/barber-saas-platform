import type { TFunction } from 'i18next';

type TermKey = 'staff' | 'staff_member' | 'staff_plural' | 'customer' | 'customers' | 'service' | 'services' | 'appointment' | 'appointments';
const industryTerms: Record<string, Partial<Record<TermKey, string>>> = {
  barber: { staff: 'Barbers', staff_member: 'Barber', staff_plural: 'Barbers' },
  hair_salon: { staff: 'Stylists', staff_member: 'Stylist', staff_plural: 'Stylists' },
  spa: { staff: 'Therapists', staff_member: 'Therapist', staff_plural: 'Therapists' },
  dental: { staff: 'Dentists', staff_member: 'Dentist', staff_plural: 'Dentists', appointment: 'Visit', appointments: 'Visits' },
  gym: { staff: 'Trainers', staff_member: 'Trainer', staff_plural: 'Trainers', appointment: 'Session', appointments: 'Sessions' },
  pet_grooming: { staff: 'Groomers', staff_member: 'Groomer', staff_plural: 'Groomers' },
};
export function getIndustryTerm(t: TFunction, industryKey: string | null | undefined, term: TermKey): string {
  const language = t('language.label', { lng: undefined });
  const override = industryKey && industryTerms[industryKey]?.[term];
  // Industry-specific English labels are intentionally used only in English until each term is professionally localized.
  if (override && language === 'Language') return override;
  return t(`terminology.${term}`);
}
