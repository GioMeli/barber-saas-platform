import { useLocation } from 'react-router-dom';
import { BookOpenCheck, Menu } from 'lucide-react';
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
  onOpenAI: () => void;
  onStartTour: () => void;
};

export default function OwnerTopBar({
  businessId,
  businessName,
  onOpenMobileMenu,
  onOpenAI,
  onStartTour,
}: OwnerTopBarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const activeItem = findOwnerNavigationItem(location.pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="flex h-16 min-w-0 items-center gap-1.5 px-3 sm:h-[72px] sm:gap-2 sm:px-5 lg:px-7">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl bg-card/80 shadow-sm lg:hidden"
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

        <div className="hidden md:block">
          <OwnerCommandPalette />
        </div>

        <div data-tour="quick-add">
          <OwnerQuickAdd />
        </div>

        {businessId && (
          <div data-tour="notifications">
            <OwnerNotificationCenter businessId={businessId} variant="icon" />
          </div>
        )}

        <div className="hidden sm:block">
          <PWAStatusCenter />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          data-tour="desktop-ai"
          className="relative hidden h-10 w-10 shrink-0 rounded-xl border-violet-300/40 bg-violet-600 text-white shadow-[0_8px_20px_rgba(124,58,237,.22)] hover:bg-violet-700 hover:text-white lg:inline-flex"
          aria-label={t('navigation.open_ai')}
          onClick={onOpenAI}
        >
          <img
            src="/brand/velliqo-ai.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 rounded-lg object-cover mix-blend-screen"
          />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,.9)]" />
        </Button>

        <Button
          type="button"
          variant="outline"
          data-tour="tour-button"
          className="hidden h-10 shrink-0 items-center gap-2 rounded-xl bg-card/80 px-3 font-bold shadow-sm lg:inline-flex"
          onClick={onStartTour}
        >
          <BookOpenCheck className="h-4 w-4 text-violet-600" />
          {t('ownerExperience.tour.button')}
        </Button>

        <div data-tour="language" className="hidden lg:block">
          <LanguageSwitcher compact />
        </div>
      </div>
    </header>
  );
}
