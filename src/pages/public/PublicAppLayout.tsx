import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  CalendarDays,
  LogIn,
  LogOut,
  Menu,
  Scissors,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AuthMode = 'signin' | 'signup';

export default function PublicAppLayout() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (slug) void fetchBusiness();
  }, [slug]);

  useEffect(() => {
    const pendingBusinessId = localStorage.getItem('pendingCustomerBusinessId');

    if (user && business?.id && pendingBusinessId === business.id) {
      void joinCurrentBusiness(phone || null);
    }
  }, [user, business?.id]);

  const fetchBusiness = async () => {
    if (!slug) {
      setBusiness(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // First load only the public business record.
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();

      if (businessError) {
        console.error('Public business query failed:', businessError);
        throw businessError;
      }

      if (!businessData) {
        setBusiness(null);
        toast.error('Business not found');
        return;
      }

      // Business settings are supplementary and must not block the storefront.
      const { data: settingsData, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', businessData.id)
        .maybeSingle();

      if (settingsError) {
        console.warn('Public business settings could not be loaded:', settingsError);
      }

      setBusiness({
        ...businessData,
        business_settings: settingsData ?? null,
      });
    } catch (error: any) {
      console.error('Error fetching public business:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });

      setBusiness(null);
      toast.error(error?.message || 'Unable to load this business');
    } finally {
      setLoading(false);
    }
  };

  const joinCurrentBusiness = async (customerPhone: string | null) => {
    if (!business?.id) return false;

    const { error } = await supabase.rpc('join_business_as_customer', {
      p_business_id: business.id,
      p_phone: customerPhone,
    });

    if (error) {
      console.error('Customer membership error:', error);
      toast.error(error.message || 'Could not connect your account to this store.');
      return false;
    }

    localStorage.removeItem('pendingCustomerBusinessId');
    return true;
  };

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
    setMobileMenuOpen(false);
  };

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      toast.error('Email and password are required.');
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        localStorage.setItem('pendingCustomerBusinessId', business.id);

        const redirectTo = `${window.location.origin}/app/${business.slug}/account`;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: name.trim(),
              role: 'Registered Customer',
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          const joined = await joinCurrentBusiness(phone.trim() || null);
          if (!joined) return;

          toast.success('Your customer account has been created.');
          setAuthOpen(false);
          navigate(`/app/${business.slug}/account`);
        } else {
          toast.success(
            'Account created. Check your email to confirm it, then return to this store.'
          );
          setAuthOpen(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        const joined = await joinCurrentBusiness(phone.trim() || null);
        if (!joined) return;

        toast.success('Signed in successfully.');
        setAuthOpen(false);
        navigate(`/app/${business.slug}/account`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out.');
    navigate(`/app/${business.slug}`);
  };

  const navItems = [
    { label: 'Store', to: `/app/${business?.slug ?? slug}` },
    { label: 'Book', to: `/app/${business?.slug ?? slug}/book` },
    ...(user
      ? [{ label: 'My Account', to: `/app/${business?.slug ?? slug}/account` }]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading store...
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Business not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            to={`/app/${business.slug}`}
            className="flex min-w-0 items-center gap-3"
          >
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="h-10 w-10 rounded-full border object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Scissors className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate font-bold">{business.name}</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">
                {business.city || business.address || 'Online booking'}
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active =
                location.pathname === item.to ||
                (item.to.endsWith('/account') &&
                  location.pathname.includes('/account'));

              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? 'secondary' : 'ghost'}
                >
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />

            {!user ? (
              <>
                <Button variant="ghost" onClick={() => openAuth('signin')}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
                <Button onClick={() => openAuth('signup')}>
                  Create Account
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link to={`/app/${business.slug}/account`}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    {profile?.full_name || 'My Account'}
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t bg-background px-4 py-4 md:hidden">
            <div className="space-y-2">
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              ))}

              {!user ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" onClick={() => openAuth('signin')}>
                    Sign In
                  </Button>
                  <Button onClick={() => openAuth('signup')}>
                    Create Account
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              )}

              <div className="pt-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet
          context={{
            business,
            openCustomerSignIn: () => openAuth('signin'),
            openCustomerSignUp: () => openAuth('signup'),
          }}
        />
      </main>

      <div className="fixed bottom-4 left-4 right-4 z-30 md:hidden">
        <Button asChild className="h-12 w-full shadow-lg">
          <Link to={`/app/${business.slug}/book`}>
            <CalendarDays className="mr-2 h-5 w-5" />
            Book Appointment
          </Link>
        </Button>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {authMode === 'signin'
                ? `Sign in to ${business.name}`
                : `Create an account for ${business.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {authMode === 'signup' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Full Name</Label>
                  <Input
                    id="customer_name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    type="tel"
                    placeholder="+357..."
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="customer_email">Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_password">Password</Label>
              <Input
                id="customer_password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={authLoading}
              onClick={handleAuth}
            >
              {authLoading
                ? 'Please wait...'
                : authMode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() =>
                setAuthMode((current) =>
                  current === 'signin' ? 'signup' : 'signin'
                )
              }
            >
              {authMode === 'signin'
                ? 'Create a customer account'
                : 'Already have an account? Sign in'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              An account is optional. You can always book as a guest.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
