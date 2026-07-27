import { Link, useLocation } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  OWNER_NAVIGATION_ITEMS,
  isOwnerNavigationItemActive,
} from './navigation';

type OwnerMobileNavigationProps = {
  onOpenMenu: () => void;
};

const MOBILE_NAV_KEYS = ['home', 'calendar'] as const;

export default function OwnerMobileNavigation({
  onOpenMenu,
}: OwnerMobileNavigationProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const items = MOBILE_NAV_KEYS.map((key) =>
    OWNER_NAVIGATION_ITEMS.find((item) => item.key === key),
  ).filter(Boolean) as typeof OWNER_NAVIGATION_ITEMS;
  const aiItem = OWNER_NAVIGATION_ITEMS.find((item) => item.key === 'ai');
  const aiActive = aiItem
    ? isOwnerNavigationItemActive(location.pathname, aiItem)
    : false;

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar px-2 pt-2 text-sidebar-foreground shadow-[0_-18px_42px_rgba(10,8,28,.28)] lg:hidden"
      aria-label={t('navigation.workspace_navigation')}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
        {items.map((item) => {
          const active = isOwnerNavigationItemActive(location.pathname, item);

          return (
            <Link
              key={item.key}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex min-h-[62px] min-w-0 flex-col items-center justify-start gap-1 rounded-2xl px-1 py-1.5 text-center transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/75',
                active
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/75 hover:text-white',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition',
                  active && 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_20px_hsl(var(--sidebar-primary)/0.3)]',
                )}
              >
                <item.icon className="h-4.5 w-4.5" strokeWidth={active ? 2.3 : 2} />
              </span>
              <span className="line-clamp-2 min-h-[2rem] w-full text-center text-[10px] font-semibold leading-4">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}

        <Link
          to="/dashboard/calendar?action=new"
          className="group relative flex min-h-[62px] min-w-0 flex-col items-center justify-start gap-1 rounded-2xl px-1 py-1.5 text-center text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/75"
          aria-label={t('navigation.quick_actions.appointment')}
        >
          <span className="-mt-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-sidebar bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_28px_hsl(var(--sidebar-primary)/0.42)] transition group-hover:-translate-y-0.5 group-hover:scale-[1.03]">
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <span className="line-clamp-2 min-h-[2rem] w-full text-center text-[10px] font-semibold leading-4 text-sidebar-foreground/86">
            {t('navigation.mobile_appointment')}
          </span>
        </Link>

        {aiItem ? (
          <Link
            to="/dashboard/ai?mode=assistant"
            aria-current={aiActive ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-[62px] min-w-0 flex-col items-center justify-start gap-1 rounded-2xl px-1 py-1.5 text-center transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/75',
              aiActive
                ? 'bg-sidebar-accent text-white'
                : 'text-sidebar-foreground/72 hover:bg-sidebar-accent/75 hover:text-white',
            )}
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
              <img
                src="/brand/velliqo-ai.png"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 rounded-[10px] object-cover mix-blend-screen drop-shadow-[0_0_10px_rgba(168,85,247,.55)]"
              />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,.95)]" />
            </span>
            <span className="line-clamp-2 min-h-[2rem] w-full text-center text-[10px] font-semibold leading-4">
              {t(aiItem.labelKey)}
            </span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex min-h-[62px] min-w-0 flex-col items-center justify-start gap-1 rounded-2xl px-1 py-1.5 text-center text-sidebar-foreground/62 transition hover:bg-sidebar-accent/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/75"
          aria-label={t('navigation.open_menu')}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
            <Menu className="h-4.5 w-4.5" />
          </span>
          <span className="line-clamp-2 min-h-[2rem] w-full text-center text-[10px] font-semibold leading-4">
            {t('navigation.more')}
          </span>
        </button>
      </div>
    </nav>
  );
}
