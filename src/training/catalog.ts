export const TRAINING_GUIDE_SLUGS = [
  'getting-started',
  'business-storefront',
  'services-pricing',
  'staff-availability',
  'calendar-appointments',
  'customers-profiles',
  'products-sales',
  'marketing-content',
  'reports-finance',
  'velliqo-ai',
  'automations-security',
  'billing-subscription',
] as const;

export type TrainingGuideSlug = (typeof TRAINING_GUIDE_SLUGS)[number];
export type TrainingCategory = 'setup' | 'operations' | 'growth' | 'intelligence' | 'account';

export type TrainingGuide = {
  slug: TrainingGuideSlug;
  category: TrainingCategory;
  estimatedMinutes: number;
  route?: string;
};

export const TRAINING_GUIDES: TrainingGuide[] = [
  { slug: 'getting-started', category: 'setup', estimatedMinutes: 8, route: '/dashboard/business' },
  { slug: 'business-storefront', category: 'setup', estimatedMinutes: 10, route: '/dashboard/storefront' },
  { slug: 'services-pricing', category: 'operations', estimatedMinutes: 8, route: '/dashboard/services' },
  { slug: 'staff-availability', category: 'operations', estimatedMinutes: 10, route: '/dashboard/staff' },
  { slug: 'calendar-appointments', category: 'operations', estimatedMinutes: 12, route: '/dashboard/calendar' },
  { slug: 'customers-profiles', category: 'operations', estimatedMinutes: 9, route: '/dashboard/customers' },
  { slug: 'products-sales', category: 'growth', estimatedMinutes: 10, route: '/dashboard/products' },
  { slug: 'marketing-content', category: 'growth', estimatedMinutes: 12, route: '/dashboard/marketing' },
  { slug: 'reports-finance', category: 'intelligence', estimatedMinutes: 12, route: '/dashboard/reports' },
  { slug: 'velliqo-ai', category: 'intelligence', estimatedMinutes: 10, route: '/dashboard/ai?mode=assistant' },
  { slug: 'automations-security', category: 'intelligence', estimatedMinutes: 12, route: '/dashboard/ai/settings' },
  { slug: 'billing-subscription', category: 'account', estimatedMinutes: 7, route: '/dashboard/billing' },
];

export const TRAINING_CATEGORIES: TrainingCategory[] = ['setup', 'operations', 'growth', 'intelligence', 'account'];

export function normalizeTrainingLanguage(language?: string | null) {
  const value = (language || 'en').toLowerCase().split('-')[0];
  return ['en', 'el', 'de', 'es', 'tr'].includes(value) ? value : 'en';
}

export function getTrainingPdfPath(slug: TrainingGuideSlug, language?: string | null) {
  return `/training/guides/${normalizeTrainingLanguage(language)}/${slug}.pdf`;
}
