import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Scissors, 
  Settings, 
  LogOut,
  Menu,
  Package,
  BarChart3,
  CreditCard
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const { t } = useTranslation();

  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard.home'), path: '/dashboard' },
    { icon: CalendarDays, label: t('dashboard.calendar'), path: '/dashboard/calendar' },
    { icon: Users, label: t('dashboard.customers'), path: '/dashboard/customers' },
    { icon: Users, label: t('dashboard.staff'), path: '/dashboard/staff' },
    { icon: Scissors, label: t('dashboard.services'), path: '/dashboard/services' },
    { icon: Package, label: t('dashboard.products'), path: '/dashboard/products' },
    { icon: BarChart3, label: t('dashboard.reports'), path: '/dashboard/reports' },
    { icon: CreditCard, label: t('dashboard.billing'), path: '/dashboard/billing' },
    { icon: Settings, label: t('dashboard.settings'), path: '/dashboard/settings' },
  ];

  const NavLinks = () => (
    <div className="flex flex-col gap-1 w-full">
      {navItems.map((item) => (
        <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}>
          <Button 
            variant={location.pathname === item.path ? 'secondary' : 'ghost'} 
            className={`w-full justify-start ${location.pathname === item.path ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <h1 className="font-bold text-lg truncate">{business?.name || 'My Business'}</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <NavLinks />
        </div>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">Owner</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('dashboard.sign_out')}
          </Button>
          <div className="mt-4 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
          <h1 className="font-bold text-lg truncate flex-1">{business?.name || 'My Business'}</h1>
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 ml-2">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col bg-card">
               <div className="h-16 flex items-center px-6 border-b border-border">
                <h2 className="font-bold text-lg">Menu</h2>
              </div>
              <div className="flex-1 overflow-y-auto py-4 px-3">
                <NavLinks />
              </div>
              <div className="p-4 border-t border-border space-y-4">
                 <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
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

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}