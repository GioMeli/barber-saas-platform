import { Link, useLocation } from 'react-router-dom';
import { Menu, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import OwnerNotificationCenter from '@/components/dashboard/OwnerNotificationCenter';
import OwnerCommandPalette from './OwnerCommandPalette';
import OwnerQuickAdd from './OwnerQuickAdd';
import { findOwnerNavigationItem } from './navigation';
import PWAStatusCenter from '@/components/pwa/PWAStatusCenter';

type OwnerTopBarProps = {
  businessId?: string | null;
  businessName?: string | null;
  onOpenMobileMenu: () => void;
};

export default function OwnerTopBar({
  businessId,
  businessName,
  onOpenMobileMenu,
}: OwnerTopBarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const activeItem = findOwnerNavigationItem(location.pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="flex h-[72px] min-w-0 items-center gap-2 px-3 sm:px-5 lg:px-7">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl bg-card/80 shadow-sm md:hidden"
          aria-label={t('navigation.open_menu')}
          onClick={onOpenMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold sm:text-base">
            {t(activeItem.labelKey)}
          </div>
          <div className="hidden truncate text-xs text-muted-foreground sm:block">
            {businessName || t('navigation.my_business')}
          </div>
        </div>

        <OwnerCommandPalette />

        <OwnerQuickAdd />

        {businessId && (
          <OwnerNotificationCenter businessId={businessId} variant="icon" />
        )}

        <PWAStatusCenter />

        <Button
          asChild
          variant="outline"
          size="icon"
          className="relative hidden h-10 w-10 rounded-xl border-primary/25 bg-primary/10 text-primary shadow-sm hover:bg-primary/15 hover:text-primary sm:inline-flex"
        >
          <Link to="/dashboard/ai" aria-label={t('navigation.open_ai')}>
            <Sparkles className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,.9)]" />
          </Link>
        </Button>

        <LanguageSwitcher compact className="hidden lg:inline-flex" />
      </div>
    </header>
  );
}
