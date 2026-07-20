import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  LogOut,
  Menu,
  Package,
  BarChart3,
  CreditCard,
  Megaphone,
  Images,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export default function OwnerDashboardLayout() {
  const { businessMemberships, profile } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const business = businessMemberships[0]?.businesses;
  const { t } = useTranslation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard.home'), path: '/dashboard' },
    { icon: CalendarDays, label: t('dashboard.calendar'), path: '/dashboard/calendar' },
    { icon: Users, label: t('dashboard.customers'), path: '/dashboard/customers' },
    { icon: Users, label: t('dashboard.staff'), path: '/dashboard/staff' },
    { icon: Scissors, label: t('dashboard.services'), path: '/dashboard/services' },
    { icon: Package, label: t('dashboard.products'), path: '/dashboard/products' },
    { icon: Megaphone, label: 'Posts', path: '/dashboard/posts' },
    { icon: Images, label: 'Gallery', path: '/dashboard/gallery' },
    { icon: Store, label: 'Storefront', path: '/dashboard/storefront' },
    { icon: BarChart3, label: t('dashboard.reports'), path: '/dashboard/reports' },
    { icon: CreditCard, label: t('dashboard.billing'), path: '/dashboard/billing' },
  ];

  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === path
      : location.pathname.startsWith(path);

  const NavLinks = () => (
    <div className="flex w-full flex-col gap-1">
      {navItems.map((item) => (
        <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
          <Button
            variant={isActive(item.path) ? 'secondary' : 'ghost'}
            className={`w-full justify-start ${
              isActive(item.path)
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <h1 className="truncate text-lg font-bold">
            {business?.name || 'My Business'}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks />
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">Owner</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('dashboard.sign_out')}
          </Button>

          <div className="mt-4 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <h1 className="flex-1 truncate text-lg font-bold">
            {business?.name || 'My Business'}
          </h1>

          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-2 shrink-0">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="flex w-72 flex-col bg-card p-0">
              <div className="flex h-16 items-center border-b border-border px-6">
                <h2 className="text-lg font-bold">Menu</h2>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <NavLinks />
              </div>

              <div className="space-y-4 border-t border-border p-4">
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('dashboard.sign_out')}
                </Button>

                <div className="flex justify-center">
                  <LanguageSwitcher />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
