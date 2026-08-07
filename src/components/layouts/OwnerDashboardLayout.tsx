import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { IndustryThemeRoot } from '@/theme';
import OwnerSidebar from './owner-shell/OwnerSidebar';
import OwnerTopBar from './owner-shell/OwnerTopBar';
import OwnerMobileNavigation from './owner-shell/OwnerMobileNavigation';
import ConnectivityBanner from '@/components/pwa/ConnectivityBanner';
import OwnerAIAssistantDrawer from '@/components/ai/OwnerAIAssistantDrawer';
import OwnerProductTour from '@/components/tour/OwnerProductTour';
import { findOwnerNavigationItem } from './owner-shell/navigation';

export default function OwnerDashboardLayout() {
  const { t } = useTranslation();
  const { activeBusiness, profile, user } = useAuth();
  const location = useLocation();
  const activeItem = findOwnerNavigationItem(location.pathname);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isAIOpen, setIsAIOpen] = React.useState(false);
  const [isTourOpen, setIsTourOpen] = React.useState(false);
  const [billingAccess, setBillingAccess] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!activeBusiness?.id) {
      setBillingAccess(null);
      return;
    }
    let cancelled = false;
    void (supabase as any).rpc('get_business_billing_summary', { p_business_id: activeBusiness.id }).then(({ data, error }: any) => {
      if (cancelled) return;
      if (error) {
        console.warn('Unable to validate billing access', error);
        // Do not destroy an active form because of a transient network check.
        // Database/Edge Function entitlements still protect privileged actions.
        setBillingAccess((current) => current ?? true);
        return;
      }
      setBillingAccess(Boolean(data?.access_allowed));
    });
    return () => { cancelled = true; };
  }, [activeBusiness?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isBillingRoute = location.pathname === '/dashboard/billing';
  if (billingAccess === false && !isBillingRoute) {
    return <Navigate to="/dashboard/billing?setup=required" replace />;
  }

  return (
    <IndustryThemeRoot industryKey={activeBusiness?.industry_key}>
      <div className="min-h-screen bg-background" data-tour="owner-workspace">
        <a
          href="#owner-main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-xl transition-transform focus:translate-y-0"
        >
          {t('ownerExperience.accessibility.skipToContent')}
        </a>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {t('ownerExperience.accessibility.pageChanged', { page: t(activeItem.labelKey) })}
        </p>
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-sidebar-border bg-sidebar lg:block">
          <OwnerSidebar
            business={activeBusiness}
            profile={profile}
            onLogout={handleLogout}
          />
        </aside>

        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetContent
            side="left"
            className="w-[92vw] max-w-[340px] border-0 bg-sidebar p-0 [&>button]:z-10 [&>button]:text-white"
          >
            <OwnerSidebar
              business={activeBusiness}
              profile={profile}
              mobile
              onNavigate={() => setIsMobileOpen(false)}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 lg:pl-[264px]">
          <OwnerTopBar
            businessId={activeBusiness?.id}
            businessName={activeBusiness?.name}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            onOpenAI={() => setIsAIOpen(true)}
            onStartTour={() => setIsTourOpen(true)}
          />

          <ConnectivityBanner />

          <main
            id="owner-main-content"
            tabIndex={-1}
            aria-label={t(activeItem.labelKey)}
            className="min-h-[calc(100dvh-64px)] min-w-0 overflow-x-clip px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none sm:min-h-[calc(100dvh-72px)] sm:px-5 sm:py-6 lg:px-7 lg:pb-7 xl:px-8"
          >
            <div data-tour-page={activeItem.key} className="min-w-0">
              <Outlet />
            </div>
          </main>

          <OwnerMobileNavigation onOpenMenu={() => setIsMobileOpen(true)} />
        </div>

        <OwnerAIAssistantDrawer
          open={isAIOpen}
          onOpenChange={setIsAIOpen}
          businessId={activeBusiness?.id}
        />

        <OwnerProductTour
          open={isTourOpen}
          businessId={activeBusiness?.id}
          userId={user?.id}
          onOpenChange={setIsTourOpen}
        />
      </div>
    </IndustryThemeRoot>
  );
}
