import type { IndustryConfig, IndustryKey } from './industry.types';

const darkLuxury = {
  primary: '45 70% 50%',
  primaryForeground: '222 47% 11%',
  accent: '45 85% 94%',
  accentForeground: '40 75% 30%',
  ring: '45 70% 50%',
  sidebarBackground: '222 47% 9%',
  sidebarForeground: '214 32% 91%',
  sidebarPrimary: '45 70% 50%',
  sidebarPrimaryForeground: '222 47% 11%',
  sidebarAccent: '222 34% 15%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '222 28% 18%',
};

const roseElegant = {
  primary: '338 72% 62%',
  primaryForeground: '0 0% 100%',
  accent: '338 75% 95%',
  accentForeground: '338 55% 34%',
  ring: '338 72% 62%',
  sidebarBackground: '336 30% 16%',
  sidebarForeground: '336 24% 92%',
  sidebarPrimary: '338 72% 62%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '336 24% 23%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '336 20% 27%',
};

const calmWellness = {
  primary: '165 43% 42%',
  primaryForeground: '0 0% 100%',
  accent: '164 40% 93%',
  accentForeground: '165 45% 26%',
  ring: '165 43% 42%',
  sidebarBackground: '168 35% 13%',
  sidebarForeground: '160 20% 92%',
  sidebarPrimary: '165 43% 42%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '168 28% 20%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '168 24% 24%',
};

const clinical = {
  primary: '217 72% 55%',
  primaryForeground: '0 0% 100%',
  accent: '216 85% 95%',
  accentForeground: '217 58% 32%',
  ring: '217 72% 55%',
  sidebarBackground: '222 44% 12%',
  sidebarForeground: '214 32% 92%',
  sidebarPrimary: '217 72% 55%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '220 34% 19%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '220 29% 23%',
};

const energetic = {
  primary: '24 90% 54%',
  primaryForeground: '0 0% 100%',
  accent: '28 100% 94%',
  accentForeground: '20 72% 32%',
  ring: '24 90% 54%',
  sidebarBackground: '220 24% 11%',
  sidebarForeground: '210 20% 92%',
  sidebarPrimary: '24 90% 54%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '220 20% 18%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '220 18% 22%',
};

export const INDUSTRY_REGISTRY: Record<IndustryKey, IndustryConfig> = {
  hair_salon: {
    key: 'hair_salon', name: 'Hair Salon', shortName: 'Hair', icon: '✂️', launchEnabled: true,
    description: 'Hair styling, colouring and salon services.', defaultCategory: 'Hair Services', palette: darkLuxury,
    labels: { singular: 'hair salon', plural: 'hair salons', professional: 'stylist', professionals: 'stylists', bookingCta: 'Book Appointment', storefrontTagline: 'Professional hair care with effortless online booking.', serviceSectionDescription: 'Hair services, transparent pricing and real-time availability.', teamSectionTitle: 'Meet the Stylists' },
    defaultServices: [
      { name: 'Haircut', category: 'Hair Services', price: 25, duration: 30 },
      { name: 'Wash & Blow Dry', category: 'Hair Services', price: 30, duration: 45 },
      { name: 'Hair Colour', category: 'Colour Services', price: 65, duration: 90 },
    ],
  },
  barber_shop: {
    key: 'barber_shop', name: 'Barber Shop', shortName: 'Barber', icon: '💈', launchEnabled: true,
    description: 'Cuts, grooming and barbering services.', defaultCategory: 'Barber Services', palette: darkLuxury,
    labels: { singular: 'barber shop', plural: 'barber shops', professional: 'barber', professionals: 'barbers', bookingCta: 'Book a Cut', storefrontTagline: 'Precision grooming with simple online booking.', serviceSectionDescription: 'Cuts and grooming services with clear pricing.', teamSectionTitle: 'Meet the Barbers' },
    defaultServices: [
      { name: 'Standard Haircut', category: 'Barber Services', price: 25, duration: 30 },
      { name: 'Beard Trim', category: 'Barber Services', price: 15, duration: 20 },
      { name: 'Haircut & Beard', category: 'Barber Services', price: 35, duration: 45 },
    ],
  },
  beauty_studio: {
    key: 'beauty_studio', name: 'Beauty Studio', shortName: 'Beauty', icon: '🌸', launchEnabled: true,
    description: 'Beauty, skincare, lashes and cosmetic services.', defaultCategory: 'Beauty Treatments', palette: roseElegant,
    labels: { singular: 'beauty studio', plural: 'beauty studios', professional: 'beauty professional', professionals: 'beauty professionals', bookingCta: 'Book Treatment', storefrontTagline: 'Personalised beauty care in an elegant setting.', serviceSectionDescription: 'Beauty treatments with transparent pricing and easy booking.', teamSectionTitle: 'Meet the Beauty Team' },
    defaultServices: [
      { name: 'Facial Treatment', category: 'Beauty Treatments', price: 45, duration: 60 },
      { name: 'Lash Extensions', category: 'Lashes', price: 55, duration: 75 },
      { name: 'Waxing', category: 'Beauty Treatments', price: 25, duration: 30 },
    ],
  },
  nail_salon: {
    key: 'nail_salon', name: 'Nail Salon', shortName: 'Nails', icon: '💅', launchEnabled: false,
    description: 'Manicure, pedicure and nail-art services.', defaultCategory: 'Nail Services', palette: roseElegant,
    labels: { singular: 'nail salon', plural: 'nail salons', professional: 'nail technician', professionals: 'nail technicians', bookingCta: 'Book Nails', storefrontTagline: 'Beautiful nails, professionally delivered.', serviceSectionDescription: 'Nail services with clear prices and durations.', teamSectionTitle: 'Meet the Nail Team' },
    defaultServices: [{ name: 'Gel Manicure', category: 'Nail Services', price: 30, duration: 45 }],
  },
  spa: {
    key: 'spa', name: 'Spa', shortName: 'Spa', icon: '🧖', launchEnabled: false,
    description: 'Relaxation, body treatments and spa experiences.', defaultCategory: 'Spa Treatments', palette: calmWellness,
    labels: { singular: 'spa', plural: 'spas', professional: 'therapist', professionals: 'therapists', bookingCta: 'Book Experience', storefrontTagline: 'Time to restore, relax and recharge.', serviceSectionDescription: 'Spa experiences designed around your wellbeing.', teamSectionTitle: 'Meet the Therapists' },
    defaultServices: [{ name: 'Signature Spa Treatment', category: 'Spa Treatments', price: 70, duration: 60 }],
  },
  massage_center: {
    key: 'massage_center', name: 'Massage Center', shortName: 'Massage', icon: '💆', launchEnabled: false,
    description: 'Therapeutic and relaxation massage services.', defaultCategory: 'Massage', palette: calmWellness,
    labels: { singular: 'massage center', plural: 'massage centers', professional: 'massage therapist', professionals: 'massage therapists', bookingCta: 'Book Massage', storefrontTagline: 'Professional massage tailored to your needs.', serviceSectionDescription: 'Choose the treatment and duration that suits you.', teamSectionTitle: 'Meet the Therapists' },
    defaultServices: [{ name: 'Relaxation Massage', category: 'Massage', price: 50, duration: 60 }],
  },
  wellness_center: {
    key: 'wellness_center', name: 'Wellness Center', shortName: 'Wellness', icon: '🌿', launchEnabled: false,
    description: 'Integrated wellness and personal care services.', defaultCategory: 'Wellness Services', palette: calmWellness,
    labels: { singular: 'wellness center', plural: 'wellness centers', professional: 'wellness professional', professionals: 'wellness professionals', bookingCta: 'Book Session', storefrontTagline: 'Wellness services built around your goals.', serviceSectionDescription: 'Explore available wellness sessions.', teamSectionTitle: 'Meet the Wellness Team' },
    defaultServices: [{ name: 'Wellness Consultation', category: 'Wellness Services', price: 40, duration: 45 }],
  },
  aesthetic_clinic: {
    key: 'aesthetic_clinic', name: 'Aesthetic Clinic', shortName: 'Aesthetics', icon: '✨', launchEnabled: false,
    description: 'Professional non-surgical aesthetic services.', defaultCategory: 'Aesthetic Treatments', palette: clinical,
    labels: { singular: 'aesthetic clinic', plural: 'aesthetic clinics', professional: 'practitioner', professionals: 'practitioners', bookingCta: 'Book Consultation', storefrontTagline: 'Professional aesthetic care with a personalised approach.', serviceSectionDescription: 'Treatments and consultations with transparent booking.', teamSectionTitle: 'Meet the Practitioners' },
    defaultServices: [{ name: 'Aesthetic Consultation', category: 'Consultations', price: 40, duration: 30 }],
  },
  tattoo_studio: {
    key: 'tattoo_studio', name: 'Tattoo Studio', shortName: 'Tattoo', icon: '🖋️', launchEnabled: false,
    description: 'Tattoo consultations, sessions and aftercare.', defaultCategory: 'Tattoo Services', palette: darkLuxury,
    labels: { singular: 'tattoo studio', plural: 'tattoo studios', professional: 'artist', professionals: 'artists', bookingCta: 'Book Consultation', storefrontTagline: 'Original work, professional artists and simple consultation booking.', serviceSectionDescription: 'Consultations and studio services.', teamSectionTitle: 'Meet the Artists' },
    defaultServices: [{ name: 'Tattoo Consultation', category: 'Tattoo Services', price: 0, duration: 30 }],
  },
  pet_grooming: {
    key: 'pet_grooming', name: 'Pet Grooming', shortName: 'Grooming', icon: '🐾', launchEnabled: false,
    description: 'Professional pet grooming and care appointments.', defaultCategory: 'Grooming Services', palette: clinical,
    labels: { singular: 'pet grooming business', plural: 'pet grooming businesses', professional: 'groomer', professionals: 'groomers', bookingCta: 'Book Grooming', storefrontTagline: 'Professional grooming for happy, well-cared-for pets.', serviceSectionDescription: 'Grooming packages with clear pricing.', teamSectionTitle: 'Meet the Groomers' },
    defaultServices: [{ name: 'Full Groom', category: 'Grooming Services', price: 40, duration: 60 }],
  },
  personal_training: {
    key: 'personal_training', name: 'Personal Training Studio', shortName: 'Training', icon: '🏋️', launchEnabled: false,
    description: 'Personal coaching, fitness sessions and programmes.', defaultCategory: 'Training Sessions', palette: energetic,
    labels: { singular: 'training studio', plural: 'training studios', professional: 'trainer', professionals: 'trainers', bookingCta: 'Book Session', storefrontTagline: 'Focused coaching, measurable progress and easy scheduling.', serviceSectionDescription: 'Choose a training session that matches your goals.', teamSectionTitle: 'Meet the Trainers' },
    defaultServices: [{ name: 'Personal Training Session', category: 'Training Sessions', price: 35, duration: 60 }],
  },
};

export const DEFAULT_INDUSTRY_KEY: IndustryKey = 'hair_salon';

export function isIndustryKey(value: unknown): value is IndustryKey {
  return typeof value === 'string' && value in INDUSTRY_REGISTRY;
}

export function getIndustryConfig(value: unknown): IndustryConfig {
  return isIndustryKey(value) ? INDUSTRY_REGISTRY[value] : INDUSTRY_REGISTRY[DEFAULT_INDUSTRY_KEY];
}

export const LAUNCH_INDUSTRIES = Object.values(INDUSTRY_REGISTRY).filter((industry) => industry.launchEnabled);
