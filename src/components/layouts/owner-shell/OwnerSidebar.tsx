import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';
import {
  OWNER_NAVIGATION_ITEMS,
  isOwnerNavigationItemActive,
} from './navigation';

type BusinessLike = { name?: string | null; logo_url?: string | null };
type ProfileLike = { full_name?: string | null };

type OwnerSidebarProps = {
  business?: BusinessLike | null;
  profile?: ProfileLike | null;
  onNavigate?: () => void;
  onLogout: () => Promise<void>;
  mobile?: boolean;
};

export default function OwnerSidebar({
  business,
  profile,
  onNavigate,
  onLogout,
  mobile = false,
}: OwnerSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/brand/velliqo-mark.png"
            alt="Velliqo"
            className="h-11 w-11 rounded-2xl border border-white/10 object-cover shadow-lg"
          />
          <div className="min-w-0">
            <div className="text-base font-extrabold tracking-tight text-white">Velliqo</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
              {t('navigation.owner_workspace')}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.045] p-3">
          {business?.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              className="h-10 w-10 rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {business?.name?.charAt(0) || 'B'}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">
              {business?.name || t('navigation.my_business')}
            </div>
            <div className="truncate text-[11px] text-sidebar-foreground/55">
              {profile?.full_name || t('navigation.business_owner')}
            </div>
          </div>
        </div>
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40">
          {t('navigation.workspace_navigation')}
        </div>

        <nav className="grid grid-cols-2 gap-2" aria-label={t('navigation.workspace_navigation')}>
          {OWNER_NAVIGATION_ITEMS.map((item) => {
            const active = isOwnerNavigationItemActive(location.pathname, item);
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-[74px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center outline-none transition duration-200',
                  'focus-visible:ring-2 focus-visible:ring-sidebar-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                  active
                    ? 'border-sidebar-primary/35 bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_30px_hsl(var(--sidebar-primary)/0.22)]'
                    : 'border-white/[0.055] bg-white/[0.025] text-sidebar-foreground/68 hover:-translate-y-0.5 hover:border-white/10 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.9} />
                <span className="line-clamp-2 text-[11px] font-semibold leading-4">
                  {t(item.labelKey)}
                </span>
                {item.key === 'ai' && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,.9)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={cn('border-t border-sidebar-border p-3', mobile && 'safe-bottom')}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            variant="ghost"
            className="h-10 justify-start rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
            onClick={() => void onLogout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('dashboard.sign_out')}
          </Button>
          <LanguageSwitcher compact appearance="sidebar" />
        </div>
      </div>
    </div>
  );
}
