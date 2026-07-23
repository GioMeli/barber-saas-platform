import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { isToday } from 'date-fns';

type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'no_show';

const ACTIVE_STATUSES = new Set([
  'pending',
  'confirmed',
  'arrived',
  'in_progress',
]);

export default function EmployeeDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) void fetchData();
  }, [user]);

  const fetchData = async (silent = false) => {
    if (!user) return;

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*, businesses(name, address, logo_url, phone, email)')
        .eq('user_id', user.id)
        .single();

      if (employeeError) throw employeeError;
      setEmployee(employeeData);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);

      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select(
          '*, customers(full_name, phone, email), appointment_services(services(name))'
        )
        .eq('employee_id', employeeData.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });

      if (appointmentError) throw appointmentError;
      setAppointments(appointmentData ?? []);
    } catch (error: any) {
      console.error('Error fetching employee data:', error);
      toast.error(error.message || t('staffPortal.messages.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const todayAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          isToday(new Date(appointment.start_time)) &&
          !['cancelled_by_business', 'cancelled_by_customer', 'rescheduled'].includes(
            appointment.status
          )
      ),
    [appointments]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          !isToday(new Date(appointment.start_time)) &&
          ACTIVE_STATUSES.has(appointment.status)
      ),
    [appointments]
  );

  const stats = useMemo(() => {
    const completed = todayAppointments.filter(
      (appointment) => appointment.status === 'completed'
    ).length;
    const remaining = todayAppointments.filter((appointment) =>
      ACTIVE_STATUSES.has(appointment.status)
    ).length;
    const minutes = todayAppointments.reduce(
      (sum, appointment) => sum + Number(appointment.total_duration || 0),
      0
    );

    return {
      total: todayAppointments.length,
      completed,
      remaining,
      minutes,
    };
  }, [todayAppointments]);

  const nextAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) =>
          new Date(appointment.start_time).getTime() > Date.now() &&
          ACTIVE_STATUSES.has(appointment.status)
      ) ?? null,
    [appointments]
  );

  const handleStatusChange = async (
    id: string,
    newStatus: AppointmentStatus
  ) => {
    setUpdatingId(id);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('employee_id', employee.id);

      if (error) throw error;

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === id
            ? { ...appointment, status: newStatus }
            : appointment
        )
      );
      toast.success(t('staffPortal.messages.statusUpdated'));
    } catch (error: any) {
      toast.error(error.message || t('staffPortal.messages.statusFailed'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <div className="text-sm text-muted-foreground">
          {t('staffPortal.states.loading')}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md rounded-3xl text-center shadow-card">
          <CardContent className="p-8">
            <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">
              {t('staffPortal.states.noProfileTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('staffPortal.states.noProfileDescription')}
            </p>
            <Button onClick={handleLogout} variant="outline" className="mt-6">
              {t('staffPortal.actions.signOut')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {employee.businesses?.logo_url ? (
              <img
                src={employee.businesses.logo_url}
                alt={employee.businesses?.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 font-bold text-primary">
                {String(employee.businesses?.name || 'V').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate font-bold">
                {employee.businesses?.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t('staffPortal.header.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={refreshing}
              onClick={() => void fetchData(true)}
              aria-label={t('staffPortal.actions.refresh')}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label={t('staffPortal.actions.signOut')}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-3xl border bg-card shadow-card">
          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_38%)]" />
            <div className="relative flex items-center gap-4">
              {employee.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt={employee.name}
                  className="h-16 w-16 rounded-2xl object-cover shadow-sm sm:h-20 sm:w-20"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-bold text-primary sm:h-20 sm:w-20">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {formatToday(i18n.language)}
                </div>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  {t('staffPortal.hero.greeting', { name: employee.name })}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('staffPortal.hero.description')}
                </p>
              </div>
            </div>

            <div className="relative flex flex-wrap gap-2">
              {employee.businesses?.phone && (
                <Button asChild variant="outline">
                  <a href={`tel:${employee.businesses.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    {t('staffPortal.actions.callBusiness')}
                  </a>
                </Button>
              )}
              {employee.businesses?.address && (
                <Button asChild variant="outline">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      employee.businesses.address
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    {t('staffPortal.actions.directions')}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('staffPortal.stats.today')}
            value={String(stats.total)}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <MetricCard
            label={t('staffPortal.stats.completed')}
            value={String(stats.completed)}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <MetricCard
            label={t('staffPortal.stats.remaining')}
            value={String(stats.remaining)}
            icon={<Clock3 className="h-5 w-5" />}
          />
          <MetricCard
            label={t('staffPortal.stats.bookedTime')}
            value={formatDuration(stats.minutes, t)}
            icon={<Sparkles className="h-5 w-5" />}
          />
        </section>

        {nextAppointment && (
          <Card className="overflow-hidden rounded-2xl border-primary/25 bg-primary/5 shadow-card">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {t('staffPortal.next.title')}
                </div>
                <div className="mt-2 text-lg font-bold">
                  {nextAppointment.customers?.full_name}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatAppointmentTime(nextAppointment.start_time, i18n.language)} ·{' '}
                  {serviceNames(nextAppointment)}
                </div>
              </div>
              <StatusBadge status={nextAppointment.status} />
            </CardContent>
          </Card>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Card className="overflow-hidden rounded-2xl shadow-card">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                {t('staffPortal.today.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {todayAppointments.length === 0 ? (
                <EmptySchedule
                  title={t('staffPortal.today.emptyTitle')}
                  description={t('staffPortal.today.emptyDescription')}
                />
              ) : (
                <div className="divide-y">
                  {todayAppointments.map((appointment) => (
                    <AppointmentRow
                      key={appointment.id}
                      appointment={appointment}
                      locale={i18n.language}
                      updating={updatingId === appointment.id}
                      onStatusChange={(status) =>
                        void handleStatusChange(appointment.id, status)
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl shadow-card">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-primary" />
                {t('staffPortal.upcoming.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingAppointments.length === 0 ? (
                <EmptySchedule
                  title={t('staffPortal.upcoming.emptyTitle')}
                  description={t('staffPortal.upcoming.emptyDescription')}
                />
              ) : (
                <div className="divide-y">
                  {upcomingAppointments.slice(0, 8).map((appointment) => (
                    <div key={appointment.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {formatAppointmentDate(
                              appointment.start_time,
                              i18n.language
                            )}
                          </div>
                          <div className="mt-1 truncate font-semibold">
                            {appointment.customers?.full_name}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {serviceNames(appointment)}
                          </div>
                        </div>
                        <StatusBadge status={appointment.status} compact />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function AppointmentRow({
  appointment,
  locale,
  updating,
  onStatusChange,
}: {
  appointment: any;
  locale: string;
  updating: boolean;
  onStatusChange: (status: AppointmentStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 p-4 transition hover:bg-muted/25 sm:grid-cols-[120px_minmax(0,1fr)_180px] sm:items-center sm:p-5">
      <div>
        <div className="text-lg font-bold">
          {formatTime(appointment.start_time, locale)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t('staffPortal.appointment.duration', {
            minutes: appointment.total_duration,
          })}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate font-bold">
            {appointment.customers?.full_name ||
              t('staffPortal.appointment.walkIn')}
          </div>
          <StatusBadge status={appointment.status} compact />
        </div>
        <div className="mt-1 truncate text-sm text-muted-foreground">
          {serviceNames(appointment)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {appointment.customers?.phone && (
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${appointment.customers.phone}`}>
                <Phone className="mr-2 h-3.5 w-3.5" />
                {t('staffPortal.actions.callClient')}
              </a>
            </Button>
          )}
          {appointment.customers?.email && (
            <Button asChild variant="outline" size="sm">
              <a href={`mailto:${appointment.customers.email}`}>
                <Mail className="mr-2 h-3.5 w-3.5" />
                {t('staffPortal.actions.emailClient')}
              </a>
            </Button>
          )}
        </div>
      </div>

      <select
        className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
        value={appointment.status}
        disabled={updating}
        onChange={(event) =>
          onStatusChange(event.target.value as AppointmentStatus)
        }
        aria-label={t('staffPortal.appointment.updateStatus')}
      >
        <option value="pending">{t('staffPortal.status.pending')}</option>
        <option value="confirmed">{t('staffPortal.status.confirmed')}</option>
        <option value="arrived">{t('staffPortal.status.arrived')}</option>
        <option value="in_progress">{t('staffPortal.status.inProgress')}</option>
        <option value="completed">{t('staffPortal.status.completed')}</option>
        <option value="no_show">{t('staffPortal.status.noShow')}</option>
      </select>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-3 text-3xl font-bold">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const key = statusKey(status);

  const className =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
      : status === 'in_progress'
        ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
        : status === 'arrived'
          ? 'bg-violet-100 text-violet-800 hover:bg-violet-100'
          : status === 'no_show'
            ? 'bg-red-100 text-red-800 hover:bg-red-100'
            : 'bg-amber-100 text-amber-800 hover:bg-amber-100';

  return (
    <Badge className={`${className} ${compact ? 'text-[10px]' : ''}`}>
      {t(`staffPortal.status.${key}`)}
    </Badge>
  );
}

function EmptySchedule({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-10 text-center">
      <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/50" />
      <div className="mt-4 font-bold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function serviceNames(appointment: any) {
  const names = (appointment.appointment_services ?? [])
    .map((item: any) => item.services?.name)
    .filter(Boolean);
  return names.join(', ') || '—';
}

function statusKey(status: string) {
  const keys: Record<string, string> = {
    pending: 'pending',
    confirmed: 'confirmed',
    arrived: 'arrived',
    in_progress: 'inProgress',
    completed: 'completed',
    no_show: 'noShow',
  };
  return keys[status] || 'pending';
}

function formatToday(locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatAppointmentDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatAppointmentTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDuration(minutes: number, t: (key: string, options?: any) => string) {
  if (minutes < 60) {
    return t('staffPortal.stats.minutes', { count: minutes });
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0
    ? t('staffPortal.stats.hoursMinutes', { hours, minutes: rest })
    : t('staffPortal.stats.hours', { count: hours });
}
