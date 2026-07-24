import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  History,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RotateCcw,
  Scissors,
  Sparkles,
  Star,
  UserCircle,
  Users,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import {
  ActionCard,
  DashboardGrid,
  EmptyState,
  LoadingSkeleton,
  MetricCard,
  PageContainer,
  PageHero,
  SectionHeader,
  StatBadge,
} from '@/components/app';

type StoreContext = {
  business: any;
  openCustomerSignIn: () => void;
};

type PortalTab = 'overview' | 'upcoming' | 'history' | 'notifications' | 'profile';

const CANCELLED_STATUSES = [
  'cancelled_by_customer',
  'cancelled_by_business',
];

export default function CustomerPortal() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const { business, openCustomerSignIn } =
    useOutletContext<StoreContext>();
  const { user, profile, loading: authLoading } = useAuth();

  const [membership, setMembership] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => new Date());
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    phone: '',
    email: '',
    birth_date: '',
    marketing_consent: false,
    email_notifications_enabled: true,
    sms_notifications_enabled: true,
  });

  useEffect(() => {
    if (user && business?.id) void fetchCustomerPortal();
  }, [user?.id, business?.id]);

  useEffect(() => {
    if (!user?.id || !business?.id) return;

    const channel = supabase
      .channel(`customer-notifications-${user.id}-${business.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadCustomerNotifications(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, business?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setCountdownNow(new Date()),
      60_000
    );

    return () => window.clearInterval(intervalId);
  }, []);

  const fetchCustomerPortal = async () => {
    setLoading(true);

    try {
      const { data: membershipData, error: membershipError } =
        await supabase
          .from('customer_business_profiles')
          .select('*')
          .eq('business_id', business.id)
          .eq('user_id', user?.id)
          .maybeSingle();

      if (membershipError) throw membershipError;

      let resolvedMembership = membershipData;

      if (!resolvedMembership) {
        const { error: joinError } = await supabase.rpc(
          'join_business_as_customer',
          {
            p_business_id: business.id,
            p_phone: null,
          }
        );

        if (joinError) throw joinError;

        const { data: refreshedMembership, error: refreshedError } =
          await supabase
            .from('customer_business_profiles')
            .select('*')
            .eq('business_id', business.id)
            .eq('user_id', user?.id)
            .single();

        if (refreshedError) throw refreshedError;
        resolvedMembership = refreshedMembership;
      }

      setMembership(resolvedMembership);
      setProfileForm({
        display_name:
          resolvedMembership?.display_name ||
          profile?.full_name ||
          user?.user_metadata?.full_name ||
          '',
        phone: resolvedMembership?.phone || '',
        email: resolvedMembership?.email || user?.email || '',
        birth_date: resolvedMembership?.birth_date || '',
        marketing_consent: resolvedMembership?.marketing_consent === true,
        email_notifications_enabled: resolvedMembership?.email_notifications_enabled !== false,
        sms_notifications_enabled: resolvedMembership?.sms_notifications_enabled !== false,
      });

      const { data: appointmentData, error: appointmentsError } =
        await supabase.rpc('get_my_business_appointments', {
          p_business_id: business.id,
        });

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentData ?? []);
      await loadCustomerNotifications();
    } catch (error: any) {
      console.error('Customer portal error:', error);
      toast.error(
        error.message || t('customerPortal.messages.loadFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerNotifications = async () => {
    if (!user?.id || !business?.id) return;

    const { data, error } = await supabase
      .from('customer_notifications')
      .select('*')
      .eq('business_id', business.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Customer notifications error:', error);
      return;
    }

    setNotifications(data || []);
  };

  const markNotificationRead = async (notification: any) => {
    if (notification.is_read) return;

    const { error } = await supabase
      .from('customer_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notification.id)
      .eq('user_id', user?.id);

    if (!error) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    }
  };

  const saveProfile = async () => {
    if (!membership?.id) return;

    if (!profileForm.display_name.trim()) {
      toast.error(t('customerPortal.validation.nameRequired'));
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from('customer_business_profiles')
        .update({
          display_name: profileForm.display_name.trim(),
          phone: profileForm.phone.trim() || null,
          email: profileForm.email.trim().toLowerCase() || null,
          birth_date: profileForm.birth_date || null,
          marketing_consent: profileForm.marketing_consent,
          email_notifications_enabled: profileForm.email_notifications_enabled,
          sms_notifications_enabled: profileForm.sms_notifications_enabled,
          marketing_consent_updated_at: new Date().toISOString(),
          email_unsubscribed_at: profileForm.email_notifications_enabled ? null : new Date().toISOString(),
          sms_unsubscribed_at: profileForm.sms_notifications_enabled ? null : new Date().toISOString(),
        })
        .eq('id', membership.id)
        .eq('business_id', business.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success(t('customerPortal.messages.profileUpdated'));
      await fetchCustomerPortal();
    } catch (error: any) {
      toast.error(error.message || t('customerPortal.messages.profileUpdateFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const upcoming = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            new Date(appointment.start_time) >= countdownNow &&
            !CANCELLED_STATUSES.includes(appointment.status)
        )
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() -
            new Date(b.start_time).getTime()
        ),
    [appointments, countdownNow]
  );

  const history = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            new Date(appointment.start_time) < countdownNow ||
            CANCELLED_STATUSES.includes(appointment.status)
        )
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() -
            new Date(a.start_time).getTime()
        ),
    [appointments, countdownNow]
  );

  const completedAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status === 'completed' ||
          (new Date(appointment.start_time) < countdownNow &&
            !CANCELLED_STATUSES.includes(appointment.status))
      ),
    [appointments, countdownNow]
  );

  const nextAppointment = upcoming[0] ?? null;

  const totalSpent = useMemo(
    () =>
      completedAppointments.reduce(
        (sum, appointment) =>
          sum + Number(appointment.total_price || 0),
        0
      ),
    [completedAppointments]
  );

  const favouriteService = useMemo(() => {
    const counts = new Map<string, number>();

    completedAppointments.forEach((appointment) => {
      const services = Array.isArray(appointment.services)
        ? appointment.services
        : [];

      services.forEach((service: any) => {
        const name = String(service?.name || '').trim();
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
      });
    });

    return (
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      t('customerPortal.common.notEnoughData')
    );
  }, [completedAppointments, t]);

  const favouriteProfessional = useMemo(() => {
    const counts = new Map<string, number>();

    completedAppointments.forEach((appointment) => {
      const name = String(appointment.employee_name || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });

    return (
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      t('customerPortal.common.notEnoughData')
    );
  }, [completedAppointments, t]);

  const customerName =
    membership?.display_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    t('customerPortal.common.customer');

  const memberSince = membership?.created_at
    ? formatPortalDate(membership.created_at, locale, { month: 'short', year: 'numeric' })
    : t('customerPortal.common.recently');

  const phoneHref = business?.phone
    ? `tel:${String(business.phone).replace(/\s+/g, '')}`
    : null;

  const directionsUrl = business?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        business.address
      )}`
    : null;

  if (authLoading) return <LoadingSkeleton />;

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-xl items-center px-4 py-10">
        <Card className="w-full rounded-3xl shadow-card">
          <CardContent className="space-y-6 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <UserCircle className="h-8 w-8" />
            </div>

            <div>
              <h1 className="text-3xl font-bold">{t('customerPortal.auth.title')}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t('customerPortal.auth.description', { business: business.name })}
              </p>
            </div>

            <Button
              className="h-11 w-full rounded-xl"
              onClick={openCustomerSignIn}
            >
              {t('customerPortal.auth.signIn')}
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-11 w-full rounded-xl"
            >
              <Link to={`/app/${business.slug}/book`}>
                {t('customerPortal.auth.bookAsGuest')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <PageContainer>
      <PageHero
        eyebrow={t('customerPortal.hero.eyebrow')}
        title={
          <>
            {t('customerPortal.hero.welcomeBack')}{' '}
            <span className="text-primary">{customerName}</span>
          </>
        }
        description={
          nextAppointment
            ? t('customerPortal.hero.nextVisitScheduled', { business: business.name })
            : t('customerPortal.hero.manageDescription', { business: business.name })
        }
        actions={
          <>
            <Button asChild className="h-11 rounded-xl">
              <Link to={`/app/${business.slug}/book`}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {t('customerPortal.actions.newAppointment')}
              </Link>
            </Button>

            {directionsUrl && (
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl bg-card/70"
              >
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  {t('customerPortal.actions.directions')}
                </a>
              </Button>
            )}
          </>
        }
      >
        {nextAppointment ? (
          <NextAppointmentPanel
            appointment={nextAppointment}
            business={business}
          />
        ) : (
          <div className="rounded-2xl border bg-card/75 p-5 backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">
                  {t('customerPortal.hero.readyTitle')}
                </div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('customerPortal.hero.readyDescription')}
                </div>
              </div>
            </div>
          </div>
        )}
      </PageHero>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title={t('customerPortal.metrics.upcoming.title')}
          value={upcoming.length}
          icon={<CalendarDays className="h-5 w-5" />}
          caption={t('customerPortal.metrics.upcoming.caption')}
        />
        <MetricCard
          title={t('customerPortal.metrics.completed.title')}
          value={completedAppointments.length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          caption={t('customerPortal.metrics.completed.caption')}
        />
        <MetricCard
          title={t('customerPortal.metrics.totalSpent.title')}
          value={formatPortalCurrency(totalSpent, locale)}
          icon={<WalletCards className="h-5 w-5" />}
          caption={t('customerPortal.metrics.totalSpent.caption')}
        />
        <MetricCard
          title={t('customerPortal.metrics.favouriteService')}
          value={favouriteService}
          icon={<Scissors className="h-5 w-5" />}
          compact
        />
        <MetricCard
          title={t('customerPortal.metrics.favouriteProfessional')}
          value={favouriteProfessional}
          icon={<Users className="h-5 w-5" />}
          compact
        />
        <MetricCard
          title={t('customerPortal.metrics.memberSince')}
          value={memberSince}
          icon={<UserCircle className="h-5 w-5" />}
          compact
        />
      </div>

      <section className="mt-10">
        <SectionHeader
          title={t('customerPortal.quickActions.title')}
          description={t('customerPortal.quickActions.description')}
        />

        <DashboardGrid className="mt-5 xl:grid-cols-4">
          <ActionCard
            to={`/app/${business.slug}/book`}
            title={t('customerPortal.actions.bookAppointment')}
            description={t('customerPortal.quickActions.bookDescription')}
            icon={<CalendarDays className="h-5 w-5" />}
          />

          <ActionCard
            to={`/app/${business.slug}/book`}
            title={t('customerPortal.actions.bookAgain')}
            description={
              history.length
                ? t('customerPortal.quickActions.repeatVisit')
                : t('customerPortal.quickActions.firstBooking')
            }
            icon={<RotateCcw className="h-5 w-5" />}
          />

          <ActionCard
            title={t('customerPortal.actions.directions')}
            description={
              business.address || t('customerPortal.quickActions.addressUnavailable')
            }
            icon={<MapPin className="h-5 w-5" />}
            disabled={!directionsUrl}
            onClick={() => {
              if (directionsUrl) {
                window.open(
                  directionsUrl,
                  '_blank',
                  'noopener,noreferrer'
                );
              }
            }}
          />

          <ActionCard
            title={t('customerPortal.actions.callStore')}
            description={
              business.phone || t('customerPortal.quickActions.phoneUnavailable')
            }
            icon={<Phone className="h-5 w-5" />}
            disabled={!phoneHref}
            onClick={() => {
              if (phoneHref) window.location.href = phoneHref;
            }}
          />
        </DashboardGrid>
      </section>

      <div className="scrollbar-subtle mt-10 flex gap-2 overflow-x-auto pb-1">
        <PortalTabButton
          active={activeTab === 'overview'}
          label={t('customerPortal.tabs.overview')}
          onClick={() => setActiveTab('overview')}
        />
        <PortalTabButton
          active={activeTab === 'upcoming'}
          label={t('customerPortal.tabs.upcoming')}
          count={upcoming.length}
          onClick={() => setActiveTab('upcoming')}
        />
        <PortalTabButton
          active={activeTab === 'history'}
          label={t('customerPortal.tabs.history')}
          count={history.length}
          onClick={() => setActiveTab('history')}
        />
        <PortalTabButton
          active={activeTab === 'notifications'}
          label={t('customerPortal.tabs.notifications')}
          count={notifications.filter((item) => !item.is_read).length}
          onClick={() => setActiveTab('notifications')}
        />
        <PortalTabButton
          active={activeTab === 'profile'}
          label={t('customerPortal.tabs.profile')}
          onClick={() => setActiveTab('profile')}
        />
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
            <section>
              <SectionHeader
                title={t('customerPortal.activity.title')}
                description={t('customerPortal.activity.description')}
                action={
                  history.length > 3 ? (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('history')}
                    >
                      {t('customerPortal.actions.viewAll')}
                    </Button>
                  ) : undefined
                }
              />

              <div className="mt-5">
                {history.length === 0 ? (
                  <EmptyState
                    icon={<History className="h-8 w-8" />}
                    title={t('customerPortal.empty.noVisitHistoryTitle')}
                    description={t('customerPortal.empty.historyDescription')}
                    action={
                      <Button asChild>
                        <Link to={`/app/${business.slug}/book`}>
                          {t('customerPortal.actions.bookAppointment')}
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <div className="relative space-y-4 before:absolute before:bottom-8 before:left-[25px] before:top-8 before:w-px before:bg-border">
                    {history.slice(0, 3).map((appointment) => (
                      <TimelineAppointment
                        key={appointment.appointment_id}
                        appointment={appointment}
                        business={business}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionHeader
                title={t('customerPortal.experience.title')}
                description={t('customerPortal.experience.description')}
              />

              <div className="mt-5 space-y-3">
                <ComingSoonCard
                  icon={<Star className="h-5 w-5" />}
                  title={t('customerPortal.experience.reviews.title')}
                  description={t('customerPortal.experience.reviews.description')}
                />
                <ComingSoonCard
                  icon={<Gift className="h-5 w-5" />}
                  title={t('customerPortal.experience.rewards.title')}
                  description={t('customerPortal.experience.rewards.description')}
                />
                <ComingSoonCard
                  icon={<CreditCard className="h-5 w-5" />}
                  title={t('customerPortal.experience.wallet.title')}
                  description={t('customerPortal.experience.wallet.description')}
                />
                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  className="flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{t('customerPortal.experience.notifications.title')}</div>
                      {notifications.some((item) => !item.is_read) && (
                        <StatBadge>{notifications.filter((item) => !item.is_read).length}</StatBadge>
                      )}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">{t('customerPortal.experience.notifications.description')}</div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'upcoming' &&
          (upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title={t('customerPortal.empty.noUpcomingTitle')}
              description={t('customerPortal.empty.noUpcomingDescription')}
              action={
                <Button asChild>
                  <Link to={`/app/${business.slug}/book`}>
                    Book Appointment
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.appointment_id}
                  appointment={appointment}
                  business={business}
                  upcoming
                />
              ))}
            </div>
          ))}

        {activeTab === 'history' &&
          (history.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" />}
              title={t('customerPortal.empty.noHistoryTitle')}
              description={t('customerPortal.empty.historyDescription')}
              action={
                <Button asChild>
                  <Link to={`/app/${business.slug}/book`}>
                    Book Appointment
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {history.map((appointment) => (
                <AppointmentCard
                  key={appointment.appointment_id}
                  appointment={appointment}
                  business={business}
                />
              ))}
            </div>
          ))}

        {activeTab === 'notifications' && (
          <CustomerNotificationsPanel
            notifications={notifications}
            markRead={markNotificationRead}
            locale={locale}
          />
        )}

        {activeTab === 'profile' && (
          <ProfilePanel
            customerName={customerName}
            membership={membership}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            savingProfile={savingProfile}
            saveProfile={saveProfile}
          />
        )}
      </div>
    </PageContainer>
  );
}

function NextAppointmentPanel({
  appointment,
  business,
}: {
  appointment: any;
  business: any;
}) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const services = Array.isArray(appointment.services)
    ? appointment.services
    : [];
  const startTime = new Date(appointment.start_time);
  const directionsUrl = business?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        business.address
      )}`
    : null;

  return (
    <div className="rounded-2xl border bg-card/80 p-5 backdrop-blur sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge>{t('customerPortal.appointment.next')}</StatBadge>
            <StatBadge tone="success">
              {formatPortalRelativeTime(startTime, locale)}
            </StatBadge>
          </div>

          <div className="mt-4 text-2xl font-bold">
            {formatPortalDate(startTime, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="mt-1 text-lg font-semibold text-primary">
            {formatPortalTime(startTime, locale)}
          </div>

          <div className="mt-3 text-sm text-muted-foreground">
            {services.map((service: any) => service.name).join(', ') ||
              t('customerPortal.appointment.fallback')}
            {appointment.employee_name
              ? t('customerPortal.appointment.withProfessional', { name: appointment.employee_name })
              : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => downloadAppointmentIcs(appointment, business, t)}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            {t('customerPortal.actions.addToCalendar')}
          </Button>

          {directionsUrl && (
            <Button asChild variant="outline">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="mr-2 h-4 w-4" />
                {t('customerPortal.actions.directions')}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({
  customerName,
  membership,
  profileForm,
  setProfileForm,
  savingProfile,
  saveProfile,
}: {
  customerName: string;
  membership: any;
  profileForm: {
    display_name: string;
    phone: string;
    email: string;
    birth_date: string;
    marketing_consent: boolean;
    email_notifications_enabled: boolean;
    sms_notifications_enabled: boolean;
  };
  setProfileForm: React.Dispatch<
    React.SetStateAction<{
      display_name: string;
      phone: string;
      email: string;
      birth_date: string;
      marketing_consent: boolean;
      email_notifications_enabled: boolean;
      sms_notifications_enabled: boolean;
    }>
  >;
  savingProfile: boolean;
  saveProfile: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const initials = customerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Card className="overflow-hidden rounded-3xl shadow-card">
      <CardContent className="p-0">
        <div className="border-b bg-gradient-to-r from-primary/15 via-muted/40 to-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
              {initials || 'CU'}
            </div>

            <div>
              <h2 className="text-2xl font-bold">{customerName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('customerPortal.profile.customerSince')}{' '}
                {membership?.created_at
                  ? formatPortalDate(membership.created_at, locale, { month: 'long', year: 'numeric' })
                  : t('customerPortal.common.recentlyLower')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <SectionHeader
            title={t('customerPortal.profile.title')}
            description={t('customerPortal.profile.description')}
          />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('customerPortal.profile.fullName')}</Label>
              <div className="relative">
                <UserCircle className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl pl-10"
                  value={profileForm.display_name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('customerPortal.profile.phone')}</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  className="h-11 rounded-xl pl-10"
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('customerPortal.profile.email')}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  className="h-11 rounded-xl pl-10"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t('customerPortal.profile.birthDate')}</Label>
              <Input
                type="date"
                className="h-11 rounded-xl"
                value={profileForm.birth_date}
                onChange={(event) => setProfileForm((current) => ({ ...current, birth_date: event.target.value }))}
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold">{t('customerPortal.preferences.title')}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('customerPortal.preferences.description')}</p>
              </div>
              <Switch
                checked={profileForm.marketing_consent}
                onCheckedChange={(checked) => setProfileForm((current) => ({ ...current, marketing_consent: checked }))}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PreferenceToggle
                title={t('customerPortal.preferences.email')}
                description={t('customerPortal.preferences.emailDescription')}
                checked={profileForm.email_notifications_enabled}
                disabled={!profileForm.marketing_consent}
                onChange={(checked) => setProfileForm((current) => ({ ...current, email_notifications_enabled: checked }))}
              />
              <PreferenceToggle
                title={t('customerPortal.preferences.sms')}
                description={t('customerPortal.preferences.smsDescription')}
                checked={profileForm.sms_notifications_enabled}
                disabled={!profileForm.marketing_consent}
                onChange={(checked) => setProfileForm((current) => ({ ...current, sms_notifications_enabled: checked }))}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              disabled={savingProfile}
              onClick={() => void saveProfile()}
            >
              {savingProfile ? t('common.saving') : t('customerPortal.profile.save')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerNotificationsPanel({
  notifications,
  markRead,
  locale,
}: {
  notifications: any[];
  markRead: (notification: any) => Promise<void>;
  locale: string;
}) {
  const { t } = useTranslation();

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-8 w-8" />}
        title={t('customerPortal.notifications.emptyTitle')}
        description={t('customerPortal.notifications.emptyDescription')}
      />
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl shadow-card">
      <CardContent className="p-0">
        <div className="border-b p-5 sm:p-6">
          <SectionHeader
            title={t('customerPortal.notifications.title')}
            description={t('customerPortal.notifications.description')}
          />
        </div>
        <div className="divide-y">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void markRead(notification)}
              className={`flex w-full gap-4 p-5 text-left transition hover:bg-muted/30 ${notification.is_read ? 'bg-card' : 'bg-primary/[0.04]'}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold">{notification.title || t('customerPortal.notifications.message')}</div>
                  {!notification.is_read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.created_at))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PreferenceToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/30 p-4">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function TimelineAppointment({
  appointment,
  business,
}: {
  appointment: any;
  business: any;
}) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const services = Array.isArray(appointment.services)
    ? appointment.services
    : [];

  return (
    <div className="relative z-10 flex gap-4">
      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm">
        <Scissors className="h-5 w-5" />
      </div>

      <Card className="min-w-0 flex-1 rounded-2xl shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatPortalDateTime(appointment.start_time, locale)}
              </div>
              <div className="mt-1 font-bold">
                {services.map((service: any) => service.name).join(', ') ||
                  t('customerPortal.appointment.fallback')}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {appointment.employee_name ||
                  t('customerPortal.appointment.anyProfessional')}{' '}
                · {formatPortalCurrency(Number(appointment.total_price || 0), locale)}
              </div>
            </div>

            <StatusBadge status={appointment.status} />
          </div>

          <div className="mt-4">
            <Button asChild size="sm" variant="outline">
              <Link to={`/app/${business.slug}/book`}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('customerPortal.actions.bookAgain')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold">{title}</div>
            <StatBadge tone="coming-soon">{t('customerPortal.common.comingSoon')}</StatBadge>
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment,
  business,
  upcoming = false,
}: {
  appointment: any;
  business: any;
  upcoming?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const services = Array.isArray(appointment.services)
    ? appointment.services
    : [];
  const directionsUrl = business?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        business.address
      )}`
    : null;

  return (
    <Card
      className={`overflow-hidden rounded-3xl shadow-card ${
        upcoming ? 'border-primary/25' : ''
      }`}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4 border-b bg-muted/20 p-5 sm:p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              {upcoming
                ? t('customerPortal.appointment.upcoming')
                : t('customerPortal.appointment.record')}
            </div>
            <h3 className="mt-2 text-lg font-bold">
              {services.map((service: any) => service.name).join(', ') ||
                t('customerPortal.appointment.fallback')}
            </h3>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('customerPortal.appointment.reference', { reference: appointment.booking_reference })}
            </div>
          </div>

          <StatusBadge status={appointment.status} />
        </div>

        {services.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b px-5 py-4 sm:px-6">
            {services.map((service: any, index: number) => (
              <StatBadge key={`${service.name}-${index}`}>
                {service.name}
              </StatBadge>
            ))}
          </div>
        )}

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <InfoLine
            icon={<Clock className="h-4 w-4" />}
            label={t('customerPortal.appointment.dateTime')}
            value={formatPortalDateTime(appointment.start_time, locale, true)}
          />

          <InfoLine
            icon={<Scissors className="h-4 w-4" />}
            label={t('customerPortal.appointment.professional')}
            value={
              appointment.employee_name ||
              t('customerPortal.appointment.anyProfessional')
            }
          />

          {business.address && (
            <InfoLine
              icon={<MapPin className="h-4 w-4" />}
              label={t('customerPortal.appointment.location')}
              value={business.address}
            />
          )}

          <InfoLine
            icon={<CalendarDays className="h-4 w-4" />}
            label={t('customerPortal.appointment.duration')}
            value={t('customerPortal.appointment.durationMinutes', { count: appointment.total_duration })}
          />
        </div>

        <div className="flex flex-col gap-4 border-t p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="text-xs text-muted-foreground">{t('customerPortal.appointment.total')}</div>
            <div className="text-xl font-bold">
              {formatPortalCurrency(Number(appointment.total_price), locale)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {upcoming && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadAppointmentIcs(appointment, business, t)
                }
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {t('customerPortal.actions.calendar')}
              </Button>
            )}

            {upcoming && directionsUrl && (
              <Button asChild variant="outline">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  {t('customerPortal.actions.directions')}
                </a>
              </Button>
            )}

            {!upcoming && (
              <Button asChild variant="outline">
                <Link to={`/app/${business.slug}/book`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('customerPortal.actions.bookAgain')}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-primary">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const normalized = String(status || '').toLowerCase();

  const tone =
    normalized === 'completed'
      ? 'success'
      : CANCELLED_STATUSES.includes(normalized)
      ? 'danger'
      : normalized === 'confirmed'
      ? 'default'
      : 'muted';

  return (
    <StatBadge tone={tone}>
      {t(`customerPortal.status.${normalized || 'scheduled'}`, { defaultValue: t('customerPortal.status.scheduled') })}
    </StatBadge>
  );
}

function PortalTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:border-primary/40'
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] ${
            active ? 'bg-black/10' : 'bg-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function formatPortalDate(value: string | Date, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

function formatPortalTime(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatPortalDateTime(value: string | Date, locale: string, includeWeekday = false) {
  return new Intl.DateTimeFormat(locale, {
    ...(includeWeekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPortalCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}

function formatPortalRelativeTime(value: Date, locale: string) {
  const differenceMs = value.getTime() - Date.now();
  const absolute = Math.abs(differenceMs);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (absolute >= 86_400_000) return formatter.format(Math.round(differenceMs / 86_400_000), 'day');
  if (absolute >= 3_600_000) return formatter.format(Math.round(differenceMs / 3_600_000), 'hour');
  return formatter.format(Math.round(differenceMs / 60_000), 'minute');
}

function downloadAppointmentIcs(appointment: any, business: any, t: (key: string, options?: any) => string) {
  try {
    const start = new Date(appointment.start_time);
    const duration = Number(appointment.total_duration || 30);
    const end = new Date(start.getTime() + duration * 60_000);
    const services = Array.isArray(appointment.services)
      ? appointment.services
          .map((service: any) => service.name)
          .filter(Boolean)
          .join(', ')
      : t('customerPortal.appointment.fallback');

    const formatIcsDate = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');

    const escapeIcs = (value: unknown) =>
      String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barber SaaS//Customer Appointment//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${escapeIcs(
        appointment.appointment_id ||
          appointment.booking_reference
      )}@barber-saas`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcs(t('customerPortal.calendar.summary', { services, business: business.name }))}`,
      `DESCRIPTION:${escapeIcs(
        t('customerPortal.calendar.reference', { reference: appointment.booking_reference || '' })
      )}`,
      `LOCATION:${escapeIcs(business.address || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `appointment-${
      appointment.booking_reference || 'booking'
    }.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Calendar export error:', error);
    toast.error(t('customerPortal.messages.calendarExportFailed'));
  }
}
