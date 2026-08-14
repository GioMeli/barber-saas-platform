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
export type TrainingVideoAudience = 'owner' | 'staff' | 'public';

export type TrainingVideoAsset = {
  id: string;
  filename: string;
  guideSlug: TrainingGuideSlug;
  audiences: TrainingVideoAudience[];
  titleKey: string;
  descriptionKey: string;
  provider?: TrainingVideoProvider;
  posterUrl?: string | null;
};

export type TrainingGuide = {
  slug: TrainingGuideSlug;
  category: TrainingCategory;
  estimatedMinutes: number;
  route?: string;
  demoRoute?: string;
  /** Legacy single-video URL. Multi-video courses use TRAINING_VIDEO_ASSETS. */
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

export const TRAINING_VIDEO_ASSETS: TrainingVideoAsset[] = [
  { id: 'create-account', filename: 'Createaccountguide.mp4', guideSlug: 'getting-started', audiences: ['owner', 'public'], titleKey: 'createAccount', descriptionKey: 'createAccountDescription' },
  { id: 'home-page', filename: 'Homepage.mp4', guideSlug: 'getting-started', audiences: ['owner', 'public'], titleKey: 'homePage', descriptionKey: 'homePageDescription' },
  { id: 'training-portal', filename: 'Trainingportal.mp4', guideSlug: 'getting-started', audiences: ['owner', 'staff', 'public'], titleKey: 'trainingPortal', descriptionKey: 'trainingPortalDescription' },
  { id: 'design-customer-page', filename: 'Designcustomerpage.mp4', guideSlug: 'business-storefront', audiences: ['owner', 'public'], titleKey: 'designCustomerPage', descriptionKey: 'designCustomerPageDescription' },
  { id: 'discover-shop-from-map', filename: 'Discovershopfrommap.mp4', guideSlug: 'business-storefront', audiences: ['owner', 'public'], titleKey: 'discoverShopFromMap', descriptionKey: 'discoverShopFromMapDescription' },
  { id: 'customer-book-appointment', filename: 'Customerbookappointment.mp4', guideSlug: 'business-storefront', audiences: ['owner', 'public'], titleKey: 'customerBookAppointment', descriptionKey: 'customerBookAppointmentDescription' },
  { id: 'create-services', filename: 'Createservices.mp4', guideSlug: 'services-pricing', audiences: ['owner', 'public'], titleKey: 'createServices', descriptionKey: 'createServicesDescription' },
  { id: 'edit-staff', filename: 'Editstaff.mp4', guideSlug: 'staff-availability', audiences: ['owner', 'public'], titleKey: 'editStaff', descriptionKey: 'editStaffDescription' },
  { id: 'staff-personal-page', filename: 'Staffpersonalpage.mp4', guideSlug: 'staff-availability', audiences: ['owner', 'staff', 'public'], titleKey: 'staffPersonalPage', descriptionKey: 'staffPersonalPageDescription' },
  { id: 'calendar-new-appointment', filename: 'Calendar-Newappointment.mp4', guideSlug: 'calendar-appointments', audiences: ['owner', 'staff', 'public'], titleKey: 'calendarNewAppointment', descriptionKey: 'calendarNewAppointmentDescription' },
  { id: 'customer-history', filename: 'CustomerHistory.mp4', guideSlug: 'customers-profiles', audiences: ['owner', 'public'], titleKey: 'customerHistory', descriptionKey: 'customerHistoryDescription' },
  { id: 'create-products', filename: 'CreateProducts.mp4', guideSlug: 'products-sales', audiences: ['owner', 'public'], titleKey: 'createProducts', descriptionKey: 'createProductsDescription' },
  { id: 'marketing-page', filename: 'Marketingpage.mp4', guideSlug: 'marketing-content', audiences: ['owner', 'public'], titleKey: 'marketingPage', descriptionKey: 'marketingPageDescription' },
  { id: 'post-page', filename: 'Postpage.mp4', guideSlug: 'marketing-content', audiences: ['owner', 'public'], titleKey: 'postPage', descriptionKey: 'postPageDescription' },
  { id: 'reports-page', filename: 'Reportspage.mp4', guideSlug: 'reports-finance', audiences: ['owner', 'public'], titleKey: 'reportsPage', descriptionKey: 'reportsPageDescription' },
  { id: 'velliqo-ai', filename: 'Velliqo AI.mp4', guideSlug: 'velliqo-ai', audiences: ['owner', 'public'], titleKey: 'velliqoAi', descriptionKey: 'velliqoAiDescription' },
];

const LESSON_VIDEO_MAP: Record<string, string> = {
  'owner-sign-up': 'create-account',
  'owner-onboarding': 'create-account',
  'owner-navigation': 'home-page',
  'owner-support': 'training-portal',
  'owner-storefront-brand': 'design-customer-page',
  'owner-storefront-contact': 'design-customer-page',
  'owner-storefront-booking': 'customer-book-appointment',
  'owner-service-create': 'create-services',
  'owner-service-manage': 'create-services',
  'owner-staff-create': 'edit-staff',
  'owner-staff-availability': 'edit-staff',
  'owner-staff-access': 'staff-personal-page',
  'owner-calendar-views': 'calendar-new-appointment',
  'owner-appointment-create': 'calendar-new-appointment',
  'owner-appointment-manage': 'calendar-new-appointment',
  'owner-customer-create': 'customer-history',
  'owner-customer-history': 'customer-history',
  'owner-product-create': 'create-products',
  'owner-inventory': 'create-products',
  'owner-campaign': 'marketing-page',
  'owner-delivery': 'marketing-page',
  'owner-reviews': 'marketing-page',
  'owner-posts': 'post-page',
  'owner-gallery': 'post-page',
  'owner-reports-executive': 'reports-page',
  'owner-reports-operations': 'reports-page',
  'owner-reports-export': 'reports-page',
  'owner-ai-conversation': 'velliqo-ai',
  'owner-ai-voice': 'velliqo-ai',
  'staff-install': 'staff-personal-page',
  'staff-workspace': 'staff-personal-page',
  'staff-profile': 'staff-personal-page',
  'staff-schedule': 'calendar-new-appointment',
  'staff-create-appointment': 'calendar-new-appointment',
  'staff-status': 'calendar-new-appointment',
  'staff-edit': 'calendar-new-appointment',
};

export const TRAINING_CATEGORIES: TrainingCategory[] = ['setup', 'operations', 'growth', 'intelligence', 'account'];

export function normalizeTrainingLanguage(language?: string | null) {
  const value = (language || 'en').toLowerCase().split('-')[0];
  return ['en', 'el', 'de', 'es', 'tr'].includes(value) ? value : 'en';
}

export function getTrainingPdfPath(slug: TrainingGuideSlug, language?: string | null) {
  return `/training/guides/${normalizeTrainingLanguage(language)}/${slug}.pdf`;
}

export function getTrainingVideoPublicUrl(filename: string) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return '';
  const encodedPath = filename.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${base}/storage/v1/object/public/training-videos/${encodedPath}`;
}

export function getTrainingVideosForGuide(slug: TrainingGuideSlug, audience: TrainingVideoAudience = 'public') {
  return TRAINING_VIDEO_ASSETS
    .filter((video) => video.guideSlug === slug && video.audiences.includes(audience))
    .map((video) => ({ ...video, url: getTrainingVideoPublicUrl(video.filename) }))
    .filter((video) => Boolean(video.url));
}

export function getTrainingVideoForLesson(lessonId: string) {
  const videoId = LESSON_VIDEO_MAP[lessonId];
  if (!videoId) return null;
  const video = TRAINING_VIDEO_ASSETS.find((item) => item.id === videoId);
  if (!video) return null;
  const url = getTrainingVideoPublicUrl(video.filename);
  return url ? { ...video, url } : null;
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
