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
export type TrainingVideoProvider = 'direct' | 'youtube' | 'vimeo';

export type TrainingGuide = {
  slug: TrainingGuideSlug;
  category: TrainingCategory;
  estimatedMinutes: number;
  route?: string;
  demoRoute?: string;
  /** Public or signed CDN URL. Leave null until the lesson is ready. */
  videoUrl?: string | null;
  /** Optional override. If omitted, Velliqo detects YouTube/Vimeo and otherwise uses the direct player. */
  videoProvider?: TrainingVideoProvider;
  /** Optional 16:9 poster for direct MP4/WebM lessons. */
  videoPosterUrl?: string | null;
};

export const TRAINING_GUIDES: TrainingGuide[] = [
  { slug: 'getting-started', category: 'setup', estimatedMinutes: 8, route: '/dashboard/business', demoRoute: '/demo/business', videoUrl: null },
  { slug: 'business-storefront', category: 'setup', estimatedMinutes: 10, route: '/dashboard/storefront', demoRoute: '/demo/storefront', videoUrl: null },
  { slug: 'services-pricing', category: 'operations', estimatedMinutes: 8, route: '/dashboard/services', demoRoute: '/demo/services', videoUrl: null },
  { slug: 'staff-availability', category: 'operations', estimatedMinutes: 10, route: '/dashboard/staff', demoRoute: '/demo/staff', videoUrl: null },
  { slug: 'calendar-appointments', category: 'operations', estimatedMinutes: 12, route: '/dashboard/calendar', demoRoute: '/demo/calendar', videoUrl: null },
  { slug: 'customers-profiles', category: 'operations', estimatedMinutes: 9, route: '/dashboard/customers', demoRoute: '/demo/customers', videoUrl: null },
  { slug: 'products-sales', category: 'growth', estimatedMinutes: 10, route: '/dashboard/products', demoRoute: '/demo/products', videoUrl: null },
  { slug: 'marketing-content', category: 'growth', estimatedMinutes: 12, route: '/dashboard/marketing', demoRoute: '/demo/marketing', videoUrl: null },
  { slug: 'reports-finance', category: 'intelligence', estimatedMinutes: 12, route: '/dashboard/reports', demoRoute: '/demo/reports', videoUrl: null },
  { slug: 'velliqo-ai', category: 'intelligence', estimatedMinutes: 10, route: '/dashboard/ai?mode=assistant', demoRoute: '/demo/ai', videoUrl: null },
  { slug: 'automations-security', category: 'intelligence', estimatedMinutes: 12, route: '/dashboard/ai/settings', demoRoute: '/demo/settings', videoUrl: null },
  { slug: 'billing-subscription', category: 'account', estimatedMinutes: 7, route: '/dashboard/billing', demoRoute: '/demo/billing', videoUrl: null },
];

export const TRAINING_CATEGORIES: TrainingCategory[] = ['setup', 'operations', 'growth', 'intelligence', 'account'];

export function normalizeTrainingLanguage(language?: string | null) {
  const value = (language || 'en').toLowerCase().split('-')[0];
  return ['en', 'el', 'de', 'es', 'tr'].includes(value) ? value : 'en';
}

export function getTrainingPdfPath(slug: TrainingGuideSlug, language?: string | null) {
  return `/training/guides/${normalizeTrainingLanguage(language)}/${slug}.pdf`;
}

export function detectTrainingVideoProvider(url: string): TrainingVideoProvider {
  const normalized = url.toLowerCase();
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube';
  if (normalized.includes('vimeo.com')) return 'vimeo';
  return 'direct';
}

export function buildTrainingVideoEmbedUrl(url: string, provider: TrainingVideoProvider) {
  if (provider === 'youtube') {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
      }
      if (parsed.pathname.includes('/embed/')) return url;
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
    } catch {
      return url;
    }
  }

  if (provider === 'vimeo') {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('player.vimeo.com')) return url;
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    } catch {
      return url;
    }
  }

  return url;
}
