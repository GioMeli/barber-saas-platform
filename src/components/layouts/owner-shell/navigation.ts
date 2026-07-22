import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CreditCard,
  Images,
  LayoutDashboard,
  Megaphone,
  Package,
  Scissors,
  Settings2,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

export type OwnerNavigationItem = {
  key: string;
  labelKey: string;
  path: string;
  icon: LucideIcon;
  keywords: string[];
};

export const OWNER_NAVIGATION_ITEMS: OwnerNavigationItem[] = [
  {
    key: 'home',
    labelKey: 'dashboard.home',
    path: '/dashboard',
    icon: LayoutDashboard,
    keywords: ['overview', 'home', 'dashboard'],
  },
  {
    key: 'calendar',
    labelKey: 'dashboard.calendar',
    path: '/dashboard/calendar',
    icon: CalendarDays,
    keywords: ['calendar', 'appointments', 'schedule', 'booking'],
  },
  {
    key: 'customers',
    labelKey: 'dashboard.customers',
    path: '/dashboard/customers',
    icon: Users,
    keywords: ['customers', 'clients', 'crm'],
  },
  {
    key: 'staff',
    labelKey: 'dashboard.staff',
    path: '/dashboard/staff',
    icon: BriefcaseBusiness,
    keywords: ['staff', 'team', 'employees'],
  },
  {
    key: 'services',
    labelKey: 'dashboard.services',
    path: '/dashboard/services',
    icon: Scissors,
    keywords: ['services', 'pricing', 'duration'],
  },
  {
    key: 'products',
    labelKey: 'dashboard.products',
    path: '/dashboard/products',
    icon: Package,
    keywords: ['products', 'inventory', 'retail'],
  },
  {
    key: 'posts',
    labelKey: 'navigation.posts',
    path: '/dashboard/posts',
    icon: Megaphone,
    keywords: ['posts', 'announcements', 'marketing'],
  },
  {
    key: 'gallery',
    labelKey: 'navigation.gallery',
    path: '/dashboard/gallery',
    icon: Images,
    keywords: ['gallery', 'photos', 'portfolio'],
  },
  {
    key: 'storefront',
    labelKey: 'navigation.storefront',
    path: '/dashboard/storefront',
    icon: Store,
    keywords: ['storefront', 'public page', 'online booking'],
  },
  {
    key: 'business',
    labelKey: 'navigation.business',
    path: '/dashboard/business',
    icon: Building2,
    keywords: ['business', 'closures', 'profile'],
  },
  {
    key: 'reports',
    labelKey: 'dashboard.reports',
    path: '/dashboard/reports',
    icon: BarChart3,
    keywords: ['reports', 'analytics', 'performance'],
  },
  {
    key: 'billing',
    labelKey: 'dashboard.billing',
    path: '/dashboard/billing',
    icon: CreditCard,
    keywords: ['billing', 'subscription', 'payments'],
  },
  {
    key: 'ai',
    labelKey: 'navigation.ai',
    path: '/dashboard/ai',
    icon: Sparkles,
    keywords: ['velliqo ai', 'assistant', 'insights'],
  },
  {
    key: 'settings',
    labelKey: 'dashboard.settings',
    path: '/dashboard/settings',
    icon: Settings2,
    keywords: ['settings', 'preferences', 'configuration'],
  },
];

export function isOwnerNavigationItemActive(pathname: string, item: OwnerNavigationItem) {
  return item.path === '/dashboard'
    ? pathname === item.path
    : pathname.startsWith(item.path);
}

export function findOwnerNavigationItem(pathname: string) {
  return OWNER_NAVIGATION_ITEMS.find((item) => isOwnerNavigationItemActive(pathname, item))
    ?? OWNER_NAVIGATION_ITEMS[0];
}
