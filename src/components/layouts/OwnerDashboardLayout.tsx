import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  const { activeBusiness, profile, user } = useAuth();
  const location = useLocation();
  const activeItem = findOwnerNavigationItem(location.pathname);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isAIOpen, setIsAIOpen] = React.useState(false);
  const [isTourOpen, setIsTourOpen] = React.useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <IndustryThemeRoot industryKey={activeBusiness?.industry_key}>
      <div className="min-h-screen bg-background" data-tour="owner-workspace">
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

          <main className="min-h-[calc(100dvh-64px)] min-w-0 overflow-x-clip px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:min-h-[calc(100dvh-72px)] sm:px-5 sm:py-6 lg:px-7 lg:pb-7 xl:px-8">
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
