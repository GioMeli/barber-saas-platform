import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
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

type PortalTab = 'overview' | 'upcoming' | 'history' | 'profile';

const CANCELLED_STATUSES = [
  'cancelled_by_customer',
  'cancelled_by_business',
];

export default function CustomerPortal() {
  const { business, openCustomerSignIn } =
    useOutletContext<StoreContext>();
  const { user, profile, loading: authLoading } = useAuth();

  const [membership, setMembership] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => new Date());
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (user && business?.id) void fetchCustomerPortal();
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
      });

      const { data: appointmentData, error: appointmentsError } =
        await supabase.rpc('get_my_business_appointments', {
          p_business_id: business.id,
        });

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentData ?? []);
    } catch (error: any) {
      console.error('Customer portal error:', error);
      toast.error(
        error.message || 'Failed to load your customer account.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!membership?.id) return;

    if (!profileForm.display_name.trim()) {
      toast.error('Name is required');
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
        })
        .eq('id', membership.id)
        .eq('business_id', business.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Profile updated');
      await fetchCustomerPortal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
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
      'Not enough data'
    );
  }, [completedAppointments]);

  const favouriteProfessional = useMemo(() => {
    const counts = new Map<string, number>();

    completedAppointments.forEach((appointment) => {
      const name = String(appointment.employee_name || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });

    return (
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'Not enough data'
    );
  }, [completedAppointments]);

  const customerName =
    membership?.display_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    'Customer';

  const memberSince = membership?.created_at
    ? format(new Date(membership.created_at), 'MMM yyyy')
    : 'Recently';

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
              <h1 className="text-3xl font-bold">Customer Account</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Sign in to view upcoming appointments, booking history,
                and your profile at {business.name}.
              </p>
            </div>

            <Button
              className="h-11 w-full rounded-xl"
              onClick={openCustomerSignIn}
            >
              Sign In
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-11 w-full rounded-xl"
            >
              <Link to={`/app/${business.slug}/book`}>
                Book as Guest
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
        eyebrow="Customer account"
        title={
          <>
            Welcome back,{' '}
            <span className="text-primary">{customerName}</span>
          </>
        }
        description={
          nextAppointment
            ? `Your next visit at ${business.name} is already scheduled.`
            : `Manage your bookings and customer profile at ${business.name}.`
        }
        actions={
          <>
            <Button asChild className="h-11 rounded-xl">
              <Link to={`/app/${business.slug}/book`}>
                <CalendarDays className="mr-2 h-4 w-4" />
                New Appointment
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
                  Directions
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
                  Ready for your next visit?
                </div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  Choose a service, professional, and time in a few
                  simple steps.
                </div>
              </div>
            </div>
          </div>
        )}
      </PageHero>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Upcoming"
          value={upcoming.length}
          icon={<CalendarDays className="h-5 w-5" />}
          caption="Scheduled future appointments"
        />
        <MetricCard
          title="Completed Visits"
          value={completedAppointments.length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          caption="Appointments completed at this store"
        />
        <MetricCard
          title="Total Spent"
          value={`€${totalSpent.toFixed(2)}`}
          icon={<WalletCards className="h-5 w-5" />}
          caption="Based on completed appointments"
        />
        <MetricCard
          title="Favourite Service"
          value={favouriteService}
          icon={<Scissors className="h-5 w-5" />}
          compact
        />
        <MetricCard
          title="Favourite Professional"
          value={favouriteProfessional}
          icon={<Users className="h-5 w-5" />}
          compact
        />
        <MetricCard
          title="Member Since"
          value={memberSince}
          icon={<UserCircle className="h-5 w-5" />}
          compact
        />
      </div>

      <section className="mt-10">
        <SectionHeader
          title="Quick actions"
          description="Everything you need, without searching through menus."
        />

        <DashboardGrid className="mt-5 xl:grid-cols-4">
          <ActionCard
            to={`/app/${business.slug}/book`}
            title="Book Appointment"
            description="Choose a service and available time."
            icon={<CalendarDays className="h-5 w-5" />}
          />

          <ActionCard
            to={`/app/${business.slug}/book`}
            title="Book Again"
            description={
              history.length
                ? 'Repeat a previous visit.'
                : 'Make your first booking.'
            }
            icon={<RotateCcw className="h-5 w-5" />}
          />

          <ActionCard
            title="Directions"
            description={
              business.address || 'Store address is not available.'
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
            title="Call Store"
            description={
              business.phone || 'Phone number is not available.'
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
          label="Overview"
          onClick={() => setActiveTab('overview')}
        />
        <PortalTabButton
          active={activeTab === 'upcoming'}
          label="Upcoming"
          count={upcoming.length}
          onClick={() => setActiveTab('upcoming')}
        />
        <PortalTabButton
          active={activeTab === 'history'}
          label="History"
          count={history.length}
          onClick={() => setActiveTab('history')}
        />
        <PortalTabButton
          active={activeTab === 'profile'}
          label="Profile"
          onClick={() => setActiveTab('profile')}
        />
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
            <section>
              <SectionHeader
                title="Recent activity"
                description="Your latest appointments at this store."
                action={
                  history.length > 3 ? (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('history')}
                    >
                      View all
                    </Button>
                  ) : undefined
                }
              />

              <div className="mt-5">
                {history.length === 0 ? (
                  <EmptyState
                    icon={<History className="h-8 w-8" />}
                    title="No visit history yet"
                    description="Completed and cancelled appointments will appear here."
                    action={
                      <Button asChild>
                        <Link to={`/app/${business.slug}/book`}>
                          Book Appointment
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
                title="Your experience"
                description="New customer tools are being prepared."
              />

              <div className="mt-5 space-y-3">
                <ComingSoonCard
                  icon={<Star className="h-5 w-5" />}
                  title="Reviews"
                  description="Rate completed visits and share feedback."
                />
                <ComingSoonCard
                  icon={<Gift className="h-5 w-5" />}
                  title="Rewards"
                  description="Earn points and unlock customer benefits."
                />
                <ComingSoonCard
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Wallet"
                  description="View payments, invoices, deposits, and refunds."
                />
                <ComingSoonCard
                  icon={<Bell className="h-5 w-5" />}
                  title="Notifications"
                  description="Control reminders and appointment updates."
                />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'upcoming' &&
          (upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="No upcoming appointments"
              description="Your next appointments at this store will appear here."
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
              title="No appointment history"
              description="Completed and cancelled appointments will appear here."
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
            <StatBadge>Next appointment</StatBadge>
            <StatBadge tone="success">
              {formatDistanceToNowStrict(startTime, {
                addSuffix: true,
              })}
            </StatBadge>
          </div>

          <div className="mt-4 text-2xl font-bold">
            {format(startTime, 'EEEE, MMMM d')}
          </div>
          <div className="mt-1 text-lg font-semibold text-primary">
            {format(startTime, 'HH:mm')}
          </div>

          <div className="mt-3 text-sm text-muted-foreground">
            {services.map((service: any) => service.name).join(', ') ||
              'Appointment'}
            {appointment.employee_name
              ? ` with ${appointment.employee_name}`
              : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => downloadAppointmentIcs(appointment, business)}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Add to Calendar
          </Button>

          {directionsUrl && (
            <Button asChild variant="outline">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Directions
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
  };
  setProfileForm: React.Dispatch<
    React.SetStateAction<{
      display_name: string;
      phone: string;
      email: string;
    }>
  >;
  savingProfile: boolean;
  saveProfile: () => Promise<void>;
}) {
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
                Customer since{' '}
                {membership?.created_at
                  ? format(
                      new Date(membership.created_at),
                      'MMMM yyyy'
                    )
                  : 'recently'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <SectionHeader
            title="Profile details"
            description="These details are used for bookings and reminders at this store."
          />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Full Name</Label>
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
              <Label>Phone</Label>
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
              <Label>Email</Label>
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
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              disabled={savingProfile}
              onClick={() => void saveProfile()}
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineAppointment({
  appointment,
  business,
}: {
  appointment: any;
  business: any;
}) {
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
                {format(
                  new Date(appointment.start_time),
                  'MMMM d, yyyy · HH:mm'
                )}
              </div>
              <div className="mt-1 font-bold">
                {services.map((service: any) => service.name).join(', ') ||
                  'Appointment'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {appointment.employee_name ||
                  'Any available professional'}{' '}
                · €{Number(appointment.total_price || 0).toFixed(2)}
              </div>
            </div>

            <StatusBadge status={appointment.status} />
          </div>

          <div className="mt-4">
            <Button asChild size="sm" variant="outline">
              <Link to={`/app/${business.slug}/book`}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Book Again
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
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold">{title}</div>
            <StatBadge tone="coming-soon">Coming Soon</StatBadge>
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
                ? 'Upcoming appointment'
                : 'Appointment record'}
            </div>
            <h3 className="mt-2 text-lg font-bold">
              {services.map((service: any) => service.name).join(', ') ||
                'Appointment'}
            </h3>
            <div className="mt-1 text-xs text-muted-foreground">
              Reference #{appointment.booking_reference}
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
            label="Date & Time"
            value={format(
              new Date(appointment.start_time),
              'EEEE, MMMM d, yyyy · HH:mm'
            )}
          />

          <InfoLine
            icon={<Scissors className="h-4 w-4" />}
            label="Professional"
            value={
              appointment.employee_name ||
              'Any available professional'
            }
          />

          {business.address && (
            <InfoLine
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={business.address}
            />
          )}

          <InfoLine
            icon={<CalendarDays className="h-4 w-4" />}
            label="Duration"
            value={`${appointment.total_duration} minutes`}
          />
        </div>

        <div className="flex flex-col gap-4 border-t p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-bold">
              €{Number(appointment.total_price).toFixed(2)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {upcoming && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadAppointmentIcs(appointment, business)
                }
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Calendar
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
                  Directions
                </a>
              </Button>
            )}

            {!upcoming && (
              <Button asChild variant="outline">
                <Link to={`/app/${business.slug}/book`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Book Again
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
      {String(status || 'scheduled').replace(/_/g, ' ')}
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

function downloadAppointmentIcs(appointment: any, business: any) {
  try {
    const start = new Date(appointment.start_time);
    const duration = Number(appointment.total_duration || 30);
    const end = new Date(start.getTime() + duration * 60_000);
    const services = Array.isArray(appointment.services)
      ? appointment.services
          .map((service: any) => service.name)
          .filter(Boolean)
          .join(', ')
      : 'Appointment';

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
      `SUMMARY:${escapeIcs(`${services} at ${business.name}`)}`,
      `DESCRIPTION:${escapeIcs(
        `Booking reference: ${
          appointment.booking_reference || ''
        }`
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
    toast.error('Could not create the calendar file.');
  }
}
