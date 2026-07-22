import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Copy,
  Euro,
  ExternalLink,
  Scissors,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import DailyStaffSchedule from '@/components/dashboard/DailyStaffSchedule';
import { BusinessHealth, TodaysAlerts } from '@/components/dashboard/OwnerDashboardInsights';

export default function OwnerHome() {
  const { businessMemberships } = useAuth();
  const business = businessMemberships[0]?.businesses;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  const [stats, setStats] = useState({
    todayAppointments: 0,
    todayRevenue: 0,
    weekAppointments: 0,
    newCustomers: 0,
    activeServices: 0,
    cancelledThisMonth: 0,
  });

  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [staffBreaks, setStaffBreaks] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) void fetchDashboardData();
  }, [business?.id]);

  const fetchDashboardData = async () => {
    if (!business?.id) return;

    setLoading(true);

    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const weekStart = startOfWeek(now).toISOString();
    const weekEnd = endOfWeek(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    try {
      const [
        todayResult,
        weekResult,
        customersResult,
        servicesResult,
        staffResult,
        cancelledResult,
        closuresResult,
        breaksResult,
        notificationsResult,
      ] = await Promise.all([
        supabase
          .from('appointments')
          .select(
            '*, customers(full_name), employees(id, name, photo_url), appointment_services(services(name))'
          )
          .eq('business_id', business.id)
          .gte('start_time', todayStart)
          .lte('start_time', todayEnd)
          .order('start_time'),

        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .gte('start_time', weekStart)
          .lte('start_time', weekEnd)
          .not(
            'status',
            'in',
            '("cancelled_by_business","cancelled_by_customer")'
          ),

        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),

        supabase
          .from('services')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .eq('is_active', true),

        supabase
          .from('employees')
          .select('id, name, photo_url')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .gte('start_time', monthStart)
          .lte('start_time', monthEnd)
          .in('status', [
            'cancelled_by_business',
            'cancelled_by_customer',
          ]),

        supabase
          .from('business_closures')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .gte('end_date', format(now, 'yyyy-MM-dd'))
          .order('start_date')
          .limit(3),

        supabase
          .from('breaks')
          .select(
            'id, business_id, employee_id, day_of_week, start_time, end_time, label'
          )
          .eq('business_id', business.id)
          .eq('day_of_week', now.getDay())
          .order('start_time'),

        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .eq('is_read', false)
          .in('type', ['new_appointment', 'new_customer']),
      ]);

      if (todayResult.error) throw todayResult.error;
      if (weekResult.error) throw weekResult.error;
      if (customersResult.error) throw customersResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (staffResult.error) throw staffResult.error;
      if (cancelledResult.error) throw cancelledResult.error;
      if (closuresResult.error) throw closuresResult.error;
      if (breaksResult.error) throw breaksResult.error;
      if (notificationsResult.error) throw notificationsResult.error;

      const appointments = todayResult.data ?? [];
      const activeAppointments = appointments.filter(
        (item) =>
          ![
            'cancelled_by_business',
            'cancelled_by_customer',
          ].includes(item.status)
      );

      setTodaySchedule(appointments);
      setStaff(staffResult.data ?? []);
      setClosures(closuresResult.data ?? []);
      setStaffBreaks(breaksResult.data ?? []);
      setUnreadNotifications(notificationsResult.count ?? 0);

      setStats({
        todayAppointments: activeAppointments.length,
        todayRevenue: activeAppointments.reduce(
          (sum, item) => sum + Number(item.total_price || 0),
          0
        ),
        weekAppointments: weekResult.count ?? 0,
        newCustomers: customersResult.count ?? 0,
        activeServices: servicesResult.count ?? 0,
        cancelledThisMonth: cancelledResult.count ?? 0,
      });
    } catch (error: any) {
      console.error('Dashboard loading error:', error);
      toast.error(error.message || t('dashboard_home.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const activeClosure = closures.find(
    (closure) =>
      closure.start_date <= todayKey &&
      closure.end_date >= todayKey
  );

  const upcomingClosure = closures.find(
    (closure) => closure.start_date > todayKey
  );

  const nextClosure = activeClosure || upcomingClosure;

  const publicUrl = business?.slug
    ? `${window.location.origin}/app/${business.slug}`
    : '';

  const copyStoreLink = async () => {
    if (!publicUrl) return;

    await navigator.clipboard.writeText(publicUrl);
    toast.success(t('dashboard_home.store_link_copied'));
  };

  if (!business) return null;

  return (
    <div className="app-page lg:-mt-4 lg:!space-y-4">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
          </div>

          <h1 className="app-page-title">
            {t('dashboard_home.greeting', { business: business.name })}
          </h1>

          <p className="app-page-description">
            {t('dashboard_home.description')}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button
            variant="outline"
            onClick={() => void copyStoreLink()}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t('dashboard_home.store_link')}
          </Button>

          <Button asChild>
            <Link to="/dashboard/calendar">
              <CalendarDays className="mr-2 h-4 w-4" />
              {t('dashboard_home.new_appointment')}
            </Link>
          </Button>
        </div>
      </header>

      {/* Keep the schedule full-width so businesses with larger teams can see more staff columns. */}
      <section className="grid min-w-0 gap-4">
        <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl shadow-card xl:h-[625px]">
          <CardHeader className="border-b px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="section-heading">
                  {t('dashboard_home.schedule.title')}
                </CardTitle>

                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard_home.schedule.description')}
                </p>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/calendar">
                  {t('dashboard_home.schedule.open_calendar')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 p-0">
            <DailyStaffSchedule
              appointments={todaySchedule}
              staff={staff}
              availabilityBlocks={staffBreaks}
              loading={loading}
              startHour={6}
              endHour={22}
              onAppointmentClick={() =>
                navigate('/dashboard/calendar')
              }
            />
          </CardContent>
        </Card>

        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t('dashboard_home.metrics.today_appointments')}
            value={
              loading
                ? '—'
                : String(stats.todayAppointments)
            }
            detail={t('dashboard_home.metrics.scheduled_this_week', { count: stats.weekAppointments })}
            icon={<CalendarDays className="h-5 w-5" />}
          />

          <MetricCard
            title={t('dashboard_home.metrics.expected_revenue')}
            value={
              loading
                ? '—'
                : `€${stats.todayRevenue.toFixed(2)}`
            }
            detail={t('dashboard_home.metrics.active_bookings_revenue')}
            icon={<Euro className="h-5 w-5" />}
          />

          <MetricCard
            title={t('dashboard_home.metrics.new_customers')}
            value={
              loading ? '—' : String(stats.newCustomers)
            }
            detail={t('dashboard_home.metrics.added_this_month')}
            icon={<UserPlus className="h-5 w-5" />}
          />

          <MetricCard
            title={t('dashboard_home.metrics.active_services')}
            value={
              loading ? '—' : String(stats.activeServices)
            }
            detail={t('dashboard_home.metrics.cancellations_this_month', { count: stats.cancelledThisMonth })}
            icon={<Scissors className="h-5 w-5" />}
          />
        </aside>
      </section>

      <TodaysAlerts
        unreadNotifications={unreadNotifications}
        activeAppointments={todaySchedule}
        staff={staff}
        staffBreaks={staffBreaks}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="section-heading">
              {t('dashboard_home.pulse.title')}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <PulseRow
              icon={<TrendingUp className="h-4 w-4" />}
              label={t('dashboard_home.pulse.average_booking_value')}
              value={
                stats.todayAppointments
                  ? `€${(
                      stats.todayRevenue /
                      stats.todayAppointments
                    ).toFixed(2)}`
                  : '€0.00'
              }
            />

            <PulseRow
              icon={<Users className="h-4 w-4" />}
              label={t('dashboard_home.pulse.active_professionals')}
              value={String(staff.length)}
            />

            <PulseRow
              icon={<CalendarDays className="h-4 w-4" />}
              label={t('dashboard_home.pulse.weekly_appointments')}
              value={String(stats.weekAppointments)}
            />
          </CardContent>
        </Card>

        <Card
          className={`rounded-2xl shadow-card ${
            activeClosure
              ? 'border-red-200 bg-red-50/40'
              : ''
          }`}
        >
          <CardHeader>
            <CardTitle className="section-heading">
              {t('dashboard_home.status.title')}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {nextClosure ? (
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    activeClosure
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>

                <div>
                  <div className="font-bold">
                    {activeClosure
                      ? t('dashboard_home.status.closed_now')
                      : t('dashboard_home.status.upcoming_closure')}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    {nextClosure.title}
                  </div>

                  <div className="mt-2 text-xs font-semibold">
                    {formatClosureRange(
                      nextClosure.start_date,
                      nextClosure.end_date,
                      locale
                    )}
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    <Link to="/dashboard/business">
                      {t('dashboard_home.status.manage_closures')}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <div>
                  <div className="font-bold">{t('dashboard_home.status.open')}</div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('dashboard_home.status.no_closures')}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <BusinessHealth
          activeAppointments={todaySchedule}
          staff={staff}
        />
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-sky-50 to-slate-100 p-5 shadow-[0_10px_30px_rgba(59,130,246,0.10)] transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_16px_38px_rgba(59,130,246,0.16)]">
      {/* Διακοσμητικό φόντο */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-200/30 blur-2xl transition group-hover:bg-blue-300/40" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">
            {title}
          </div>

          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-800">
            {value}
          </div>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-white/80 text-blue-600 shadow-sm backdrop-blur transition group-hover:bg-blue-600 group-hover:text-white">
          {icon}
        </div>
      </div>

      <div className="relative mt-5 border-t border-blue-200/60 pt-3 text-xs leading-5 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function PulseRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>

        <span className="truncate text-sm text-muted-foreground">
          {label}
        </span>
      </div>

      <span className="font-bold">{value}</span>
    </div>
  );
}

function formatClosureRange(start: string, end: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const startText = formatter.format(
    new Date(`${start}T00:00:00`)
  );

  const endText = formatter.format(
    new Date(`${end}T00:00:00`)
  );

  return start === end
    ? startText
    : `${startText} – ${endText}`;
}
