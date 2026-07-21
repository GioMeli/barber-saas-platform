import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { BarChart3, Building2, CalendarDays, CreditCard, Images, LayoutDashboard, LogOut, Megaphone, Menu, Package, Scissors, Store, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { IndustryThemeRoot } from '@/theme';

export default function OwnerDashboardLayout() {
  const { activeBusiness, profile } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const business = activeBusiness;
  const { t } = useTranslation();

  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard.home'), path: '/dashboard' },
    { icon: CalendarDays, label: t('dashboard.calendar'), path: '/dashboard/calendar' },
    { icon: Users, label: t('dashboard.customers'), path: '/dashboard/customers' },
    { icon: Users, label: t('dashboard.staff'), path: '/dashboard/staff' },
    { icon: Scissors, label: t('dashboard.services'), path: '/dashboard/services' },
    { icon: Package, label: t('dashboard.products'), path: '/dashboard/products' },
    { icon: Megaphone, label: t('navigation.posts'), path: '/dashboard/posts' },
    { icon: Images, label: t('navigation.gallery'), path: '/dashboard/gallery' },
    { icon: Store, label: t('navigation.storefront'), path: '/dashboard/storefront' },
    { icon: Building2, label: t('navigation.business'), path: '/dashboard/business' },
    { icon: BarChart3, label: t('dashboard.reports'), path: '/dashboard/reports' },
    { icon: CreditCard, label: t('dashboard.billing'), path: '/dashboard/billing' },
  ];

  const isActive = (path: string) =>
    path === '/dashboard' ? location.pathname === path : location.pathname.startsWith(path);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const NavLinks = () => (
    <nav className="space-y-1.5">
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition ${
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}>
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <IndustryThemeRoot industryKey={business?.industry_key}>
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="h-10 w-10 rounded-xl border border-white/10 object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {business?.name?.charAt(0) || 'B'}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-bold text-white">{business?.name || t('navigation.my_business')}</div>
            <div className="text-xs text-sidebar-foreground/55">{t('navigation.owner_workspace')}</div>
          </div>
        </div>

        <div className="scrollbar-subtle flex-1 overflow-y-auto px-3 py-5"><NavLinks /></div>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{profile?.full_name || t('navigation.business_owner')}</div>
              <div className="text-xs text-sidebar-foreground/55">{t('navigation.business_owner')}</div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button variant="ghost" className="justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />{t('dashboard.sign_out')}
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </aside>

      <div className="min-w-0 md:pl-[272px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <div className="min-w-0">
            <div className="truncate font-bold">{business?.name || t('navigation.my_business')}</div>
            <div className="text-xs text-muted-foreground">{t('navigation.owner_workspace')}</div>
          </div>
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="rounded-xl"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-[88vw] max-w-[320px] border-0 bg-sidebar p-0">
              <div className="flex h-20 items-center border-b border-sidebar-border px-5">
                <div><div className="font-bold text-white">{business?.name || t('navigation.my_business')}</div><div className="text-xs text-sidebar-foreground/55">{t('navigation.menu')}</div></div>
              </div>
              <div className="scrollbar-subtle h-[calc(100vh-160px)] overflow-y-auto px-3 py-5"><NavLinks /></div>
              <div className="safe-bottom absolute inset-x-0 bottom-0 border-t border-sidebar-border bg-sidebar p-4">
                <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />{t('dashboard.sign_out')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-7 lg:px-8 xl:px-10">
          <Outlet />
        </main>
      </div>
    </div>
    </IndustryThemeRoot>
  );
}
