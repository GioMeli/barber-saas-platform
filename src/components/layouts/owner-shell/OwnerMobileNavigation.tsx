import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  OWNER_NAVIGATION_ITEMS,
  isOwnerNavigationItemActive,
} from './navigation';

type OwnerMobileNavigationProps = {
  onOpenMenu: () => void;
};

const MOBILE_NAV_KEYS = ['home', 'calendar', 'sales', 'ai'] as const;

export default function OwnerMobileNavigation({
  onOpenMenu,
}: OwnerMobileNavigationProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const items = MOBILE_NAV_KEYS.map((key) =>
    OWNER_NAVIGATION_ITEMS.find((item) => item.key === key),
  ).filter(Boolean) as typeof OWNER_NAVIGATION_ITEMS;

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pt-2 shadow-[0_-12px_32px_rgba(15,23,42,.10)] backdrop-blur-xl lg:hidden"
      aria-label={t('navigation.workspace_navigation')}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isOwnerNavigationItemActive(location.pathname, item);
          const isAI = item.key === 'ai';

          return (
            <Link
              key={item.key}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                active
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                isAI && 'text-violet-700 dark:text-violet-300',
              )}
            >
              <span
                className={cn(
                  'relative flex h-7 w-7 items-center justify-center rounded-xl',
                  active && 'bg-primary text-primary-foreground shadow-sm',
                  isAI && active && 'bg-violet-600 text-white',
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={active ? 2.3 : 2} />
                {isAI && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,.9)]" />
                )}
              </span>
              <span className="w-full truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={t('navigation.open_menu')}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-xl">
            <Menu className="h-4 w-4" />
          </span>
          <span className="w-full truncate">{t('navigation.open_menu')}</span>
        </button>
      </div>
    </nav>
  );
}
