import { OWNER_NAVIGATION_ITEMS } from '@/components/layouts/owner-shell/navigation';

export const DEMO_NAVIGATION_ITEMS = OWNER_NAVIGATION_ITEMS.map((item) => ({
  ...item,
  path: item.path === '/dashboard' ? '/demo' : item.path.replace('/dashboard', '/demo'),
  labelKey: item.key === 'training' ? 'navigation.courses' : item.labelKey,
}));

export function isDemoNavigationItemActive(pathname: string, path: string) {
  return path === '/demo' ? pathname === '/demo' : pathname.startsWith(path);
}
