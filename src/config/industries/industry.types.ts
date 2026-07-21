import type { ModuleKey } from '../modules';

export type IndustryCategoryKey =
  | 'beauty_personal_care'
  | 'health_wellness'
  | 'fitness'
  | 'pet_services'
  | 'automotive'
  | 'home_services'
  | 'professional_services'
  | 'education'
  | 'creative_services'
  | 'events';

export type IndustryKey =
  | 'hair_salon' | 'barber_shop' | 'beauty_studio' | 'nail_salon' | 'spa' | 'massage_center' | 'wellness_center' | 'aesthetic_clinic' | 'tattoo_studio'
  | 'physiotherapy' | 'chiropractic' | 'nutritionist' | 'psychology_practice' | 'speech_therapy' | 'dental_clinic' | 'medical_practice'
  | 'personal_training' | 'gym_studio' | 'pilates_studio' | 'yoga_studio' | 'dance_studio'
  | 'pet_grooming' | 'veterinary_clinic' | 'dog_training'
  | 'car_wash' | 'car_detailing' | 'mechanic' | 'tyre_shop'
  | 'cleaning_company' | 'electrician' | 'plumber' | 'hvac' | 'pest_control'
  | 'law_firm' | 'accounting_firm' | 'consultancy' | 'financial_advisor' | 'real_estate'
  | 'tutoring' | 'language_school' | 'music_school' | 'driving_school'
  | 'photography_studio' | 'videography_studio'
  | 'wedding_planner' | 'event_planner' | 'venue_booking';

export type IndustryServiceTemplate = { name: string; category: string; price: number; duration: number };
export type IndustryPalette = {
  primary: string; primaryForeground: string; accent: string; accentForeground: string; ring: string;
  sidebarBackground: string; sidebarForeground: string; sidebarPrimary: string; sidebarPrimaryForeground: string;
  sidebarAccent: string; sidebarAccentForeground: string; sidebarBorder: string;
};
export type IndustryLabels = {
  singular: string; plural: string; professional: string; professionals: string;
  bookingCta: string; storefrontTagline: string; serviceSectionDescription: string; teamSectionTitle: string;
};
export type IndustryConfig = {
  key: IndustryKey;
  category: IndustryCategoryKey;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  launchEnabled: boolean;
  defaultCategory: string;
  defaultServices: IndustryServiceTemplate[];
  defaultModules: ModuleKey[];
  palette: IndustryPalette;
  labels: IndustryLabels;
};
export type IndustryCategory = { key: IndustryCategoryKey; name: string; description: string; icon: string };
