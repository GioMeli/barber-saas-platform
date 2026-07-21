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
  CheckCircle2,
  Clock3,
  History,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { IndustryThemeRoot } from '@/theme';
import { getIndustryConfig } from '@/config/industries';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchBusiness = async () => {
    if (!slug) {
      setBusiness(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();

      if (businessError) throw businessError;

      if (!businessData) {
        setBusiness(null);
        return;
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', businessData.id)
        .maybeSingle();

      if (settingsError) {
        console.warn('Public business settings unavailable:', settingsError);
      }

      setBusiness({
        ...businessData,
        business_settings: settingsData ?? null,
      });
    } catch (error: any) {
      console.error('Public business error:', error);
      toast.error(t('storefront.public.errors.loadStore'));
      setBusiness(null);
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
      console.error('Customer store connection error:', error);
      toast.error(t('storefront.public.messages.joinError'));
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
      toast.error(t('storefront.public.validation.credentialsRequired'));
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      toast.error(t('storefront.public.validation.fullNameRequired'));
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        localStorage.setItem('pendingCustomerBusinessId', business.id);

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/${business.slug}/account`,
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

          toast.success(t('storefront.public.messages.accountCreated'));
          setAuthOpen(false);
          navigate(`/app/${business.slug}/account`);
        } else {
          toast.success(t('storefront.public.messages.accountCreatedConfirm'));
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

        toast.success(t('storefront.public.messages.signedIn'));
        setAuthOpen(false);
        navigate(`/app/${business.slug}/account`);
      }
    } catch (error: any) {
      console.error('Customer authentication error:', error);
      toast.error(t('storefront.public.messages.authenticationFailed'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success(t('storefront.public.messages.signedOut'));
    navigate(`/app/${business.slug}`);
  };

  const navItems = [
    { label: t('storefront.public.navigation.store'), to: `/app/${business?.slug ?? slug}` },
    { label: t('storefront.public.navigation.book'), to: `/app/${business?.slug ?? slug}/book` },
    ...(user
      ? [{ label: t('storefront.public.navigation.myAccount'), to: `/app/${business?.slug ?? slug}/account` }]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <div className="mt-4 text-sm text-muted-foreground">{t('storefront.public.loading')}</div>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Scissors className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t('storefront.public.notFound.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('storefront.public.notFound.description')}
          </p>
        </div>
      </div>
    );
  }

  const industry = getIndustryConfig(business.industry_key);

  return (
    <IndustryThemeRoot industryKey={industry.key}>
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            to={`/app/${business.slug}`}
            className="flex min-w-0 items-center gap-3"
          >
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="h-11 w-11 rounded-2xl border object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <span aria-hidden>{industry.icon}</span>
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate font-bold">{business.name}</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">
                {business.city || business.address || t('storefront.public.status.onlineBooking')}
              </div>
            </div>
          </Link>

          <nav className="hidden items-center rounded-full border bg-muted/20 p-1 shadow-sm md:flex">
            {navItems.map((item) => {
              const active =
                location.pathname === item.to ||
                (item.to.endsWith('/account') &&
                  location.pathname.includes('/account'));

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />

            {!user ? (
              <>
                <Button variant="ghost" onClick={() => openAuth('signin')}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {t('storefront.public.auth.signIn')}
                </Button>
                <Button onClick={() => openAuth('signup')}>
                  {t('storefront.public.auth.createAccount')}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link to={`/app/${business.slug}/account`}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    {profile?.full_name || t('storefront.public.navigation.myAccount')}
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('storefront.public.accessibility.signOut')} title={t('storefront.public.accessibility.signOut')} onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="rounded-xl md:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-label={t(mobileMenuOpen ? 'storefront.public.accessibility.closeMenu' : 'storefront.public.accessibility.openMenu')}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t bg-background px-4 py-4 shadow-lg md:hidden">
            <div className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}

              {!user ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" onClick={() => openAuth('signin')}>
                    {t('storefront.public.auth.signIn')}
                  </Button>
                  <Button onClick={() => openAuth('signup')}>
                    {t('storefront.public.auth.createAccount')}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleSignOut}>
                  {t('storefront.public.accessibility.signOut')}
                </Button>
              )}

              <div className="pt-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="min-h-[calc(100vh-72px)]">
        <Outlet
          context={{
            business,
            industry,
            openCustomerSignIn: () => openAuth('signin'),
            openCustomerSignUp: () => openAuth('signup'),
          }}
        />
      </main>

      {!location.pathname.endsWith('/book') && (
        <div className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.05)] backdrop-blur md:hidden">
          <Button asChild className="h-12 w-full rounded-xl shadow-lg">
            <Link to={`/app/${business.slug}/book`}>
              <CalendarDays className="mr-2 h-5 w-5" />
              {t('storefront.public.actions.bookAppointment')}
            </Link>
          </Button>
        </div>
      )}

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-4xl overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          <div className="grid max-h-[94vh] overflow-y-auto lg:grid-cols-[0.9fr_1.1fr]">
            <section className="relative hidden overflow-hidden bg-zinc-950 p-8 text-white lg:block">
              {business.cover_image_url && (
                <img
                  src={business.cover_image_url}
                  alt={business.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-30"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-br from-black/95 via-black/80 to-black/55" />

              <div className="relative flex h-full min-h-[610px] flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    {business.logo_url ? (
                      <img
                        src={business.logo_url}
                        alt={business.name}
                        className="h-12 w-12 rounded-2xl border border-white/15 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <Scissors className="h-6 w-6" />
                      </div>
                    )}

                    <div>
                      <div className="font-bold">{business.name}</div>
                      <div className="text-xs text-white/55">
                        {t('storefront.public.auth.customerAccount')}
                      </div>
                    </div>
                  </div>

                  <h2 className="mt-12 text-3xl font-bold leading-tight">
                    {t('storefront.public.auth.heroTitle')}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/65">
                    {t('storefront.public.auth.heroDescription', { business: business.name })}
                  </p>

                  <div className="mt-8 space-y-4">
                    <CustomerBenefit
                      icon={<Clock3 className="h-5 w-5" />}
                      title={t('storefront.public.auth.benefits.fasterTitle')}
                      text={t('storefront.public.auth.benefits.fasterText')}
                    />
                    <CustomerBenefit
                      icon={<CalendarDays className="h-5 w-5" />}
                      title={t('storefront.public.auth.benefits.upcomingTitle')}
                      text={t('storefront.public.auth.benefits.upcomingText')}
                    />
                    <CustomerBenefit
                      icon={<History className="h-5 w-5" />}
                      title={t('storefront.public.auth.benefits.historyTitle')}
                      text={t('storefront.public.auth.benefits.historyText')}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-xs leading-5 text-white/60 backdrop-blur">
                  <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                  {t('storefront.public.auth.privacyNote')}
                </div>
              </div>
            </section>

            <section className="p-5 sm:p-8 lg:p-10">
              <DialogHeader className="text-left">
                <div className="mb-4 flex items-center gap-3 lg:hidden">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="h-11 w-11 rounded-2xl border object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Scissors className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold">{business.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('storefront.public.auth.customerAccess')}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {authMode === 'signin'
                    ? t('storefront.public.auth.signInEyebrow')
                    : t('storefront.public.auth.signUpEyebrow')}
                </div>

                <DialogTitle className="mt-2 text-3xl">
                  {authMode === 'signin'
                    ? t('storefront.public.auth.welcomeBack', { business: business.name })
                    : t('storefront.public.auth.createBusinessAccount', { business: business.name })}
                </DialogTitle>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {authMode === 'signin'
                    ? t('storefront.public.auth.signInDescription')
                    : t('storefront.public.auth.signUpDescription')}
                </p>
              </DialogHeader>

              <div className="mt-7 grid grid-cols-2 rounded-xl bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    authMode === 'signin'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('storefront.public.auth.signIn')}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    authMode === 'signup'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('storefront.public.auth.createAccount')}
                </button>
              </div>

              <div className="mt-7 space-y-5">
                {authMode === 'signup' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">{t('storefront.public.auth.fullName')}</Label>
                      <Input
                        id="customer_name"
                        autoComplete="name"
                        className="h-12 rounded-xl"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">{t('storefront.public.auth.phone')}</Label>
                      <Input
                        id="customer_phone"
                        type="tel"
                        autoComplete="tel"
                        className="h-12 rounded-xl"
                        placeholder="+357..."
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="customer_email">{t('storefront.public.auth.email')}</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    autoComplete="email"
                    className="h-12 rounded-xl"
                    placeholder="customer@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_password">{t('storefront.public.auth.password')}</Label>
                  <Input
                    id="customer_password"
                    type="password"
                    autoComplete={
                      authMode === 'signin'
                        ? 'current-password'
                        : 'new-password'
                    }
                    className="h-12 rounded-xl"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>

                {authMode === 'signup' && (
                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t('storefront.public.auth.accountLinkNote', { business: business.name })}
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  className="h-12 w-full rounded-xl text-base"
                  disabled={authLoading}
                  onClick={handleAuth}
                >
                  {authLoading
                    ? t('storefront.public.auth.pleaseWait')
                    : authMode === 'signin'
                      ? t('storefront.public.auth.signInAccount')
                      : t('storefront.public.auth.createCustomerAccount')}
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full rounded-xl"
                  onClick={() => setAuthOpen(false)}
                >
                  <Link to={`/app/${business.slug}/book`}>
                    {t('storefront.public.auth.continueGuest')}
                  </Link>
                </Button>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  {t('storefront.public.auth.optionalNote')}
                </p>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </IndustryThemeRoot>
  );
}


function CustomerBenefit({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-white/55">{text}</p>
      </div>
    </div>
  );
}
