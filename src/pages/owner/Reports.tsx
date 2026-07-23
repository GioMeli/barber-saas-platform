import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import { useFinanceIntelligence } from '@/hooks/useFinanceIntelligence';
import FinanceOverview from '@/components/finance/FinanceOverview';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  Euro,
  Package,
  Percent,
  PieChart,
  Printer,
  RefreshCw,
  Scissors,
  UserRound,
  UserRoundCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  getHours,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';

type ReportTab =
  | 'executive'
  | 'finance'
  | 'revenue'
  | 'appointments'
  | 'staff'
  | 'services'
  | 'customers'
  | 'products';

type Appointment = any;

const ACTIVE_REVENUE_STATUSES = ['confirmed', 'completed', 'in_progress'];
const CANCELLED_STATUSES = ['cancelled_by_business', 'cancelled_by_customer'];

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-500',
  completed: 'bg-emerald-500',
  in_progress: 'bg-amber-500',
  cancelled_by_business: 'bg-red-500',
  cancelled_by_customer: 'bg-rose-400',
  no_show: 'bg-slate-500',
};

function toInclusiveRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  return { startIso: startDate.toISOString(), endIso: endDate.toISOString() };
}

function previousRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const days = Math.max(differenceInCalendarDays(endDate, startDate) + 1, 1);
  const previousEnd = subDays(startDate, 1);
  const previousStart = subDays(previousEnd, days - 1);
  return {
    start: format(previousStart, 'yyyy-MM-dd'),
    end: format(previousEnd, 'yyyy-MM-dd'),
  };
}

export default function Reports() {
  const { activeBusiness } = useAuth();
  const businessId = activeBusiness?.id;
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  const [activeTab, setActiveTab] = useState<ReportTab>('executive');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [previousAppointments, setPreviousAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const {
    data: financeData,
    loading: financeLoading,
    error: financeError,
    refresh: refreshFinance,
  } = useFinanceIntelligence(businessId, dateRange.start, dateRange.end);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId, dateRange.start, dateRange.end]);

  const fetchData = async () => {
    if (!businessId) return;
    setLoading(true);

    try {
      const current = toInclusiveRange(dateRange.start, dateRange.end);
      const previous = previousRange(dateRange.start, dateRange.end);
      const previousIso = toInclusiveRange(previous.start, previous.end);

      const appointmentSelect =
        'id, booking_reference, created_at, start_time, total_price, total_duration, status, employee_id, customer_id, employees(id, name), customers(id, full_name, user_id, created_at), appointment_services(price, duration, services(id, name))';

      const [currentResult, previousResult, customersResult, stockResult] = await Promise.all([
        supabase
          .from('appointments')
          .select(appointmentSelect)
          .eq('business_id', businessId)
          .gte('start_time', current.startIso)
          .lt('start_time', current.endIso)
          .order('start_time'),
        supabase
          .from('appointments')
          .select(appointmentSelect)
          .eq('business_id', businessId)
          .gte('start_time', previousIso.startIso)
          .lt('start_time', previousIso.endIso)
          .order('start_time'),
        supabase
          .from('customers')
          .select('id, full_name, user_id, created_at')
          .eq('business_id', businessId)
          .lt('created_at', current.endIso),
        supabase
          .from('stock_movements')
          .select('quantity, type, created_at, products!inner(id, name, business_id)')
          .eq('products.business_id', businessId)
          .gte('created_at', current.startIso)
          .lt('created_at', current.endIso),
      ]);

      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;
      if (customersResult.error) throw customersResult.error;
      if (stockResult.error) throw stockResult.error;

      setAppointments(currentResult.data ?? []);
      setPreviousAppointments(previousResult.data ?? []);
      setCustomers(customersResult.data ?? []);
      setStockMovements(stockResult.data ?? []);
    } catch (error: any) {
      console.error('Reports error:', error);
      toast.error(error.message || t('reports.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo(
    () => buildAnalytics(appointments, customers, stockMovements, dateRange, {
      unassigned: t('reports.generic.unassigned'),
      customer: t('reports.generic.customer'),
    }),
    [appointments, customers, stockMovements, dateRange, i18n.resolvedLanguage]
  );
  const previousAnalytics = useMemo(
    () => buildAnalytics(previousAppointments, customers, [], previousRange(dateRange.start, dateRange.end), {
      unassigned: t('reports.generic.unassigned'),
      customer: t('reports.generic.customer'),
    }),
    [previousAppointments, customers, dateRange, i18n.resolvedLanguage]
  );

  const comparisons = useMemo(
    () => ({
      revenue: percentageChange(analytics.totalRevenue, previousAnalytics.totalRevenue),
      appointments: percentageChange(analytics.totalAppointments, previousAnalytics.totalAppointments),
      averageTicket: percentageChange(analytics.averageTicket, previousAnalytics.averageTicket),
      completion: analytics.completionRate - previousAnalytics.completionRate,
    }),
    [analytics, previousAnalytics]
  );

  const applyPreset = (preset: 'week' | 'month' | 'previous_month' | '90_days') => {
    const now = new Date();
    if (preset === 'week') {
      setDateRange({
        start: format(startOfWeek(now), 'yyyy-MM-dd'),
        end: format(endOfWeek(now), 'yyyy-MM-dd'),
      });
      return;
    }
    if (preset === '90_days') {
      setDateRange({
        start: format(subDays(now, 89), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd'),
      });
      return;
    }
    const target = preset === 'previous_month' ? subMonths(now, 1) : now;
    setDateRange({
      start: format(startOfMonth(target), 'yyyy-MM-dd'),
      end: format(endOfMonth(target), 'yyyy-MM-dd'),
    });
  };

  const exportCSV = () => {
    const periodStart = formatLocalizedDate(dateRange.start, locale);
    const periodEnd = formatLocalizedDate(dateRange.end, locale);
    const rows: Array<Array<string | number>> = [
      [t('reports.csv.reportTitle')],
      [t('reports.csv.business'), activeBusiness?.name ?? ''],
      [t('reports.csv.period'), t('reports.csv.periodRange', { start: periodStart, end: periodEnd })],
      [],
      [t('reports.csv.executiveMetric'), t('reports.csv.value'), t('reports.csv.previousPeriodChange')],
      [t('reports.metrics.revenue'), analytics.totalRevenue.toFixed(2), `${comparisons.revenue.toFixed(1)}%`],
      [t('reports.metrics.appointments'), analytics.totalAppointments, `${comparisons.appointments.toFixed(1)}%`],
      [t('reports.csv.averageTicket'), analytics.averageTicket.toFixed(2), `${comparisons.averageTicket.toFixed(1)}%`],
      [t('reports.metrics.completionRate'), `${analytics.completionRate.toFixed(1)}%`, `${comparisons.completion.toFixed(1)} ${t('reports.units.percentagePoints')}`],
      [t('reports.csv.cancellationRate'), `${analytics.cancellationRate.toFixed(1)}%`, ''],
      [t('reports.csv.noShowRate'), `${analytics.noShowRate.toFixed(1)}%`, ''],
      [t('reports.csv.returningCustomerRate'), `${analytics.returningCustomerRate.toFixed(1)}%`, ''],
      ...(financeData ? [
        [],
        [t('reports.tabs.finance')],
        [t('finance.metrics.collectedRevenue'), financeData.summary.collectedRevenue.toFixed(2)],
        [t('finance.metrics.netSales'), financeData.summary.netSales.toFixed(2)],
        [t('finance.metrics.grossProfit'), financeData.summary.grossProfit.toFixed(2)],
        [t('finance.metrics.paidExpenses'), financeData.summary.paidExpenses.toFixed(2)],
        [t('finance.metrics.operatingProfit'), financeData.summary.operatingProfit.toFixed(2)],
        [t('finance.metrics.taxCollected'), financeData.summary.taxCollected.toFixed(2)],
        [t('finance.metrics.grossMargin'), `${financeData.summary.grossMargin.toFixed(2)}%`],
      ] : []),
      [],
      [t('reports.tables.professional'), t('reports.tables.appointments'), t('reports.tables.completed'), t('reports.tables.revenue'), t('reports.csv.bookedMinutes'), t('reports.tables.averageTicket')],
      ...analytics.staff.map((row: any) => [
        row.name, row.appointments, row.completed, row.revenue.toFixed(2), row.minutes, row.averageTicket.toFixed(2),
      ]),
      [],
      [t('reports.tables.service'), t('reports.tables.bookings'), t('reports.tables.revenue'), t('reports.csv.minutes'), t('reports.tables.averageValue')],
      ...analytics.services.map((row: any) => [
        row.name, row.bookings, row.revenue.toFixed(2), row.minutes, row.averageValue.toFixed(2),
      ]),
      [],
      [t('reports.tables.customer'), t('reports.tables.visits'), t('reports.csv.spend'), t('reports.csv.registered'), t('reports.csv.returning')],
      ...analytics.customerValue.map((row: any) => [
        row.name,
        row.visits,
        row.spend.toFixed(2),
        row.registered ? t('reports.common.yes') : t('reports.common.no'),
        row.returning ? t('reports.common.yes') : t('reports.common.no'),
      ]),
    ];

    const content = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `velliqo-report-${dateRange.start}-${dateRange.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const tabs: Array<{ id: ReportTab; label: string; icon: React.ReactNode }> = [
    { id: 'executive', label: t('reports.tabs.executive'), icon: <PieChart className="h-4 w-4" /> },
    { id: 'finance', label: t('reports.tabs.finance'), icon: <WalletCards className="h-4 w-4" /> },
    { id: 'revenue', label: t('reports.tabs.revenue'), icon: <Euro className="h-4 w-4" /> },
    { id: 'appointments', label: t('reports.tabs.appointments'), icon: <CalendarDays className="h-4 w-4" /> },
    { id: 'staff', label: t('reports.tabs.staff'), icon: <UserRound className="h-4 w-4" /> },
    { id: 'services', label: t('reports.tabs.services'), icon: <Scissors className="h-4 w-4" /> },
    { id: 'customers', label: t('reports.tabs.customers'), icon: <Users className="h-4 w-4" /> },
    { id: 'products', label: t('reports.tabs.products'), icon: <Package className="h-4 w-4" /> },
  ];

  return (
    <div className="app-page pb-12 print:max-w-none">
      <header className="app-page-header print:hidden">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('reports.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('reports.title')}</h1>
          <p className="app-page-description">
            {t('reports.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { void fetchData(); void refreshFinance(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />{t('reports.actions.refresh')}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />{t('reports.actions.print')}
          </Button>
          <Button onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />{t('reports.actions.exportCsv')}
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden rounded-3xl border-primary/10 shadow-card print:hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400" />
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <DateField label={t('reports.filters.startDate')} value={dateRange.start} onChange={(start) => setDateRange((current) => ({ ...current, start }))} />
            <DateField label={t('reports.filters.endDate')} value={dateRange.end} onChange={(end) => setDateRange((current) => ({ ...current, end }))} />
            <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1 xl:justify-end">
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('week')}>{t('reports.filters.thisWeek')}</Button>
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('month')}>{t('reports.filters.thisMonth')}</Button>
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('previous_month')}>{t('reports.filters.previousMonth')}</Button>
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('90_days')}>{t('reports.filters.last90Days')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-3xl border bg-card p-16 text-center shadow-card">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">{t('reports.states.loading')}</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title={t('reports.metrics.revenue')}
              value={formatCurrency(analytics.totalRevenue, locale)}
              detail={t('reports.metrics.averageTicketDetail', { value: formatCurrency(analytics.averageTicket, locale) })}
              comparison={comparisons.revenue}
              icon={<Euro className="h-5 w-5" />}
            />
            <MetricCard
              title={t('reports.metrics.appointments')}
              value={analytics.totalAppointments}
              detail={t('reports.metrics.completedCount', { count: analytics.completed })}
              comparison={comparisons.appointments}
              icon={<CalendarDays className="h-5 w-5" />}
            />
            <MetricCard
              title={t('reports.metrics.completionRate')}
              value={`${analytics.completionRate.toFixed(1)}%`}
              detail={t('reports.metrics.cancellationNoShowDetail', {
                cancellation: analytics.cancellationRate.toFixed(1),
                noShow: analytics.noShowRate.toFixed(1),
              })}
              comparison={comparisons.completion}
              suffix={` ${t('reports.units.percentagePoints')}`}
              icon={<Percent className="h-5 w-5" />}
            />
            <MetricCard
              title={t('reports.metrics.returningCustomers')}
              value={`${analytics.returningCustomerRate.toFixed(1)}%`}
              detail={t('reports.metrics.returningCount', { count: analytics.returningCustomers })}
              icon={<UserRoundCheck className="h-5 w-5" />}
            />
          </section>

          <div className="scrollbar-subtle sticky top-16 z-20 -mx-1 flex gap-2 overflow-x-auto rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur print:hidden md:top-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'executive' && <ExecutiveView analytics={analytics} />}
          {activeTab === 'finance' && (
            financeLoading ? (
              <div className="rounded-3xl border bg-card p-16 text-center shadow-card">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">{t('finance.states.loading')}</p>
              </div>
            ) : financeData ? (
              <FinanceOverview data={financeData} compact />
            ) : (
              <Card className="rounded-3xl border-destructive/20 bg-destructive/5">
                <CardContent className="p-6">
                  <h3 className="font-bold text-destructive">{t('finance.states.unavailableTitle')}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{financeError || t('finance.states.migrationRequired')}</p>
                </CardContent>
              </Card>
            )
          )}
          {activeTab === 'revenue' && <RevenueView analytics={analytics} />}
          {activeTab === 'appointments' && <AppointmentsView analytics={analytics} />}
          {activeTab === 'staff' && <StaffView analytics={analytics} />}
          {activeTab === 'services' && <ServicesView analytics={analytics} />}
          {activeTab === 'customers' && <CustomersView analytics={analytics} />}
          {activeTab === 'products' && <ProductsView analytics={analytics} />}
        </>
      )}
    </div>
  );
}

function buildAnalytics(
  appointments: Appointment[],
  customers: any[],
  stockMovements: any[],
  range: { start: string; end: string },
  labels: { unassigned: string; customer: string }
) {
  const revenueAppointments = appointments.filter((appointment) => ACTIVE_REVENUE_STATUSES.includes(appointment.status));
  const totalRevenue = revenueAppointments.reduce((sum, appointment) => sum + Number(appointment.total_price || 0), 0);
  const totalAppointments = appointments.length;
  const completed = appointments.filter((appointment) => appointment.status === 'completed').length;
  const cancelled = appointments.filter((appointment) => CANCELLED_STATUSES.includes(appointment.status)).length;
  const noShows = appointments.filter((appointment) => appointment.status === 'no_show').length;
  const averageTicket = revenueAppointments.length ? totalRevenue / revenueAppointments.length : 0;

  const statusMap = new Map<string, number>();
  const staffMap = new Map<string, any>();
  const serviceMap = new Map<string, any>();
  const customerMap = new Map<string, any>();
  const dailyMap = new Map<string, any>();
  const weekdayMap = new Map<number, any>();
  const hourMap = new Map<number, any>();

  appointments.forEach((appointment) => {
    statusMap.set(appointment.status, (statusMap.get(appointment.status) ?? 0) + 1);
    const revenue = ACTIVE_REVENUE_STATUSES.includes(appointment.status) ? Number(appointment.total_price || 0) : 0;
    const minutes = Number(appointment.total_duration || 0);
    const date = new Date(appointment.start_time);
    const dateKey = format(date, 'yyyy-MM-dd');
    const weekday = getDay(date);
    const hour = getHours(date);

    const daily = dailyMap.get(dateKey) ?? { date: dateKey, appointments: 0, revenue: 0 };
    daily.appointments += 1;
    daily.revenue += revenue;
    dailyMap.set(dateKey, daily);

    const weekdayRow = weekdayMap.get(weekday) ?? { day: weekday, appointments: 0, revenue: 0 };
    weekdayRow.appointments += 1;
    weekdayRow.revenue += revenue;
    weekdayMap.set(weekday, weekdayRow);

    const hourRow = hourMap.get(hour) ?? { hour, appointments: 0, revenue: 0 };
    hourRow.appointments += 1;
    hourRow.revenue += revenue;
    hourMap.set(hour, hourRow);

    const staffId = appointment.employee_id || 'unassigned';
    const staff = staffMap.get(staffId) ?? {
      id: staffId,
      name: appointment.employees?.name || labels.unassigned,
      appointments: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
      minutes: 0,
    };
    staff.appointments += 1;
    staff.revenue += revenue;
    staff.minutes += minutes;
    if (appointment.status === 'completed') staff.completed += 1;
    if (CANCELLED_STATUSES.includes(appointment.status)) staff.cancelled += 1;
    staffMap.set(staffId, staff);

    if (appointment.customer_id) {
      const customer = customerMap.get(appointment.customer_id) ?? {
        id: appointment.customer_id,
        name: appointment.customers?.full_name || labels.customer,
        registered: Boolean(appointment.customers?.user_id),
        visits: 0,
        spend: 0,
        firstVisit: appointment.start_time,
        lastVisit: appointment.start_time,
      };
      customer.visits += 1;
      customer.spend += revenue;
      if (new Date(appointment.start_time) < new Date(customer.firstVisit)) customer.firstVisit = appointment.start_time;
      if (new Date(appointment.start_time) > new Date(customer.lastVisit)) customer.lastVisit = appointment.start_time;
      customerMap.set(appointment.customer_id, customer);
    }

    appointment.appointment_services?.forEach((row: any) => {
      const service = row.services;
      if (!service) return;
      const item = serviceMap.get(service.id) ?? {
        id: service.id,
        name: service.name,
        bookings: 0,
        revenue: 0,
        minutes: 0,
      };
      item.bookings += 1;
      item.revenue += ACTIVE_REVENUE_STATUSES.includes(appointment.status) ? Number(row.price || 0) : 0;
      item.minutes += Number(row.duration || 0);
      serviceMap.set(service.id, item);
    });
  });

  const customerValue = [...customerMap.values()].map((row) => ({
    ...row,
    returning: row.visits > 1,
    averageSpend: row.visits ? row.spend / row.visits : 0,
  })).sort((a, b) => b.spend - a.spend);

  const returningCustomers = customerValue.filter((row) => row.returning).length;
  const uniqueCustomers = customerValue.length;
  const returningCustomerRate = uniqueCustomers ? (returningCustomers / uniqueCustomers) * 100 : 0;

  const startIso = new Date(`${range.start}T00:00:00`);
  const endIso = new Date(`${range.end}T23:59:59`);
  const newCustomers = customers.filter((customer) => {
    const created = new Date(customer.created_at);
    return created >= startIso && created <= endIso;
  });

  const productsMap = new Map<string, any>();
  let productsSold = 0;
  stockMovements.filter((movement) => movement.type === 'out').forEach((movement) => {
    const quantity = Math.abs(Number(movement.quantity || 0));
    productsSold += quantity;
    const product = movement.products;
    const item = productsMap.get(product.id) ?? { id: product.id, name: product.name, quantity: 0 };
    item.quantity += quantity;
    productsMap.set(product.id, item);
  });

  const staff = [...staffMap.values()].map((row) => ({
    ...row,
    averageTicket: row.appointments ? row.revenue / row.appointments : 0,
    completionRate: row.appointments ? (row.completed / row.appointments) * 100 : 0,
    bookedHours: row.minutes / 60,
  })).sort((a, b) => b.revenue - a.revenue);

  const services = [...serviceMap.values()].map((row) => ({
    ...row,
    averageValue: row.bookings ? row.revenue / row.bookings : 0,
    bookedHours: row.minutes / 60,
  })).sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    totalAppointments,
    completed,
    cancelled,
    noShows,
    averageTicket,
    completionRate: totalAppointments ? (completed / totalAppointments) * 100 : 0,
    cancellationRate: totalAppointments ? (cancelled / totalAppointments) * 100 : 0,
    noShowRate: totalAppointments ? (noShows / totalAppointments) * 100 : 0,
    bookedHours: appointments.reduce((sum, appointment) => sum + Number(appointment.total_duration || 0), 0) / 60,
    revenuePerBookedHour: appointments.length
      ? totalRevenue / Math.max(appointments.reduce((sum, appointment) => sum + Number(appointment.total_duration || 0), 0) / 60, 1)
      : 0,
    uniqueCustomers,
    returningCustomers,
    returningCustomerRate,
    newCustomers: newCustomers.length,
    registeredNewCustomers: newCustomers.filter((customer) => Boolean(customer.user_id)).length,
    guestNewCustomers: newCustomers.filter((customer) => !customer.user_id).length,
    productsSold,
    statuses: [...statusMap.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    weekdays: [...weekdayMap.values()].sort((a, b) => a.day - b.day),
    hours: [...hourMap.values()].sort((a, b) => a.hour - b.hour),
    staff,
    services,
    customerValue,
    products: [...productsMap.values()].sort((a, b) => b.quantity - a.quantity),
  };
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function ExecutiveView({ analytics }: { analytics: any }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const weekdayLabels = getWeekdayLabels(t);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title={t('reports.executive.trendTitle')}
          description={t('reports.executive.trendDescription')}
        >
          <DailyChart data={analytics.daily} />
        </ChartCard>
        <Card className="rounded-3xl shadow-card">
          <CardHeader>
            <CardTitle>{t('reports.executive.operationalHealth')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <HealthLine label={t('reports.executive.completion')} value={analytics.completionRate} tone="emerald" />
            <HealthLine label={t('reports.executive.cancellation')} value={analytics.cancellationRate} tone="rose" />
            <HealthLine label={t('reports.executive.noShow')} value={analytics.noShowRate} tone="slate" />
            <SummaryLine
              label={t('reports.executive.revenuePerBookedHour')}
              value={formatCurrency(analytics.revenuePerBookedHour, locale)}
            />
            <SummaryLine
              label={t('reports.executive.bookedHours')}
              value={t('reports.units.hoursValue', { value: analytics.bookedHours.toFixed(1) })}
            />
            <SummaryLine label={t('reports.executive.uniqueCustomers')} value={analytics.uniqueCustomers} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={t('reports.executive.demandByWeekday')}
          description={t('reports.executive.demandByWeekdayDescription')}
        >
          <HorizontalBars
            data={analytics.weekdays.map((row: any) => ({
              label: weekdayLabels[row.day],
              value: row.appointments,
              detail: t('reports.counts.bookings', { count: row.appointments }),
            }))}
          />
        </ChartCard>
        <ChartCard
          title={t('reports.executive.peakBookingHours')}
          description={t('reports.executive.peakBookingHoursDescription')}
        >
          <HorizontalBars
            data={analytics.hours.map((row: any) => ({
              label: `${String(row.hour).padStart(2, '0')}:00`,
              value: row.appointments,
              detail: formatCurrency(row.revenue, locale, 0),
            }))}
          />
        </ChartCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <RankedTable
          title={t('reports.executive.topServices')}
          icon={<Scissors className="h-5 w-5" />}
          columns={[
            t('reports.tables.service'),
            t('reports.tables.bookings'),
            t('reports.tables.revenue'),
            t('reports.tables.averageValue'),
          ]}
          rows={analytics.services.slice(0, 6).map((row: any) => [
            row.name,
            row.bookings,
            formatCurrency(row.revenue, locale),
            formatCurrency(row.averageValue, locale),
          ])}
        />
        <RankedTable
          title={t('reports.executive.topProfessionals')}
          icon={<UserRound className="h-5 w-5" />}
          columns={[
            t('reports.tables.professional'),
            t('reports.tables.appointments'),
            t('reports.tables.completion'),
            t('reports.tables.revenue'),
          ]}
          rows={analytics.staff.slice(0, 6).map((row: any) => [
            row.name,
            row.appointments,
            `${row.completionRate.toFixed(0)}%`,
            formatCurrency(row.revenue, locale),
          ])}
        />
      </section>
    </div>
  );
}

function RevenueView({ analytics }: { analytics: any }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CompactMetric label={t('reports.revenue.grossScheduledRevenue')} value={formatCurrency(analytics.totalRevenue, locale)} />
        <CompactMetric label={t('reports.revenue.averageAppointmentValue')} value={formatCurrency(analytics.averageTicket, locale)} />
        <CompactMetric label={t('reports.revenue.revenuePerBookedHour')} value={formatCurrency(analytics.revenuePerBookedHour, locale)} />
        <CompactMetric label={t('reports.revenue.revenueGeneratingServices')} value={analytics.services.length} />
      </section>
      <ChartCard title={t('reports.revenue.timelineTitle')} description={t('reports.revenue.timelineDescription')}>
        <DailyChart data={analytics.daily} />
      </ChartCard>
      <section className="grid gap-6 lg:grid-cols-2">
        <RankedTable
          title={t('reports.revenue.byProfessional')}
          icon={<UserRound className="h-5 w-5" />}
          columns={[
            t('reports.tables.professional'),
            t('reports.tables.revenue'),
            t('reports.tables.averageTicket'),
            t('reports.tables.bookedHours'),
          ]}
          rows={analytics.staff.map((row: any) => [
            row.name,
            formatCurrency(row.revenue, locale),
            formatCurrency(row.averageTicket, locale),
            row.bookedHours.toFixed(1),
          ])}
        />
        <RankedTable
          title={t('reports.revenue.byService')}
          icon={<Scissors className="h-5 w-5" />}
          columns={[
            t('reports.tables.service'),
            t('reports.tables.revenue'),
            t('reports.tables.bookings'),
            t('reports.tables.averageValue'),
          ]}
          rows={analytics.services.map((row: any) => [
            row.name,
            formatCurrency(row.revenue, locale),
            row.bookings,
            formatCurrency(row.averageValue, locale),
          ])}
        />
      </section>
    </div>
  );
}

function AppointmentsView({ analytics }: { analytics: any }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const weekdayLabels = getWeekdayLabels(t);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CompactMetric label={t('reports.appointments.total')} value={analytics.totalAppointments} />
        <CompactMetric label={t('reports.appointments.completed')} value={analytics.completed} />
        <CompactMetric label={t('reports.appointments.cancelled')} value={analytics.cancelled} />
        <CompactMetric label={t('reports.appointments.noShows')} value={analytics.noShows} />
        <CompactMetric
          label={t('reports.appointments.bookedHours')}
          value={t('reports.units.hoursValue', { value: analytics.bookedHours.toFixed(1) })}
        />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl shadow-card">
          <CardHeader><CardTitle>{t('reports.appointments.statusTitle')}</CardTitle></CardHeader>
          <CardContent><StatusDistribution statuses={analytics.statuses} /></CardContent>
        </Card>
        <ChartCard title={t('reports.appointments.demandByWeekday')} description={t('reports.appointments.demandByWeekdayDescription')}>
          <HorizontalBars
            data={analytics.weekdays.map((row: any) => ({
              label: weekdayLabels[row.day],
              value: row.appointments,
              detail: formatCurrency(row.revenue, locale, 0),
            }))}
          />
        </ChartCard>
      </section>
      <ChartCard title={t('reports.appointments.peakHours')} description={t('reports.appointments.peakHoursDescription')}>
        <HorizontalBars
          data={analytics.hours.map((row: any) => ({
            label: `${String(row.hour).padStart(2, '0')}:00`,
            value: row.appointments,
            detail: t('reports.counts.bookings', { count: row.appointments }),
          }))}
        />
      </ChartCard>
    </div>
  );
}

function StaffView({ analytics }: { analytics: any }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  return (
    <RankedTable
      title={t('reports.staff.performanceTitle')}
      icon={<UserRound className="h-5 w-5" />}
      columns={[
        t('reports.tables.professional'),
        t('reports.tables.appointments'),
        t('reports.tables.completed'),
        t('reports.tables.completion'),
        t('reports.tables.bookedHours'),
        t('reports.tables.averageTicket'),
        t('reports.tables.revenue'),
      ]}
      rows={analytics.staff.map((row: any) => [
        row.name,
        row.appointments,
        row.completed,
        `${row.completionRate.toFixed(1)}%`,
        row.bookedHours.toFixed(1),
        formatCurrency(row.averageTicket, locale),
        formatCurrency(row.revenue, locale),
      ])}
    />
  );
}

function ServicesView({ analytics }: { analytics: any }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  return (
    <RankedTable
      title={t('reports.services.intelligenceTitle')}
      icon={<Scissors className="h-5 w-5" />}
      columns={[
        t('reports.tables.service'),
        t('reports.tables.bookings'),
        t('reports.tables.bookedHours'),
        t('reports.tables.revenue'),
        t('reports.tables.averageValue'),
      ]}
      rows={analytics.services.map((row: any) => [
        row.name,
        row.bookings,
        row.bookedHours.toFixed(1),
        formatCurrency(row.revenue, locale),
        formatCurrency(row.averageValue, locale),
      ])}
    />
  );
}

function CustomersView({ analytics }: { analytics: any }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CompactMetric label={t('reports.customers.unique')} value={analytics.uniqueCustomers} />
        <CompactMetric label={t('reports.customers.returning')} value={analytics.returningCustomers} />
        <CompactMetric label={t('reports.customers.returningRate')} value={`${analytics.returningCustomerRate.toFixed(1)}%`} />
        <CompactMetric label={t('reports.customers.newThisPeriod')} value={analytics.newCustomers} />
      </section>
      <RankedTable
        title={t('reports.customers.valueTitle')}
        icon={<Users className="h-5 w-5" />}
        columns={[
          t('reports.tables.customer'),
          t('reports.customers.account'),
          t('reports.tables.visits'),
          t('reports.tables.returning'),
          t('reports.customers.totalSpend'),
          t('reports.customers.averageSpend'),
        ]}
        rows={analytics.customerValue.map((row: any) => [
          row.name,
          row.registered ? t('reports.customers.registered') : t('reports.customers.guest'),
          row.visits,
          row.returning ? t('reports.common.yes') : t('reports.common.no'),
          formatCurrency(row.spend, locale),
          formatCurrency(row.averageSpend, locale),
        ])}
      />
    </div>
  );
}

function ProductsView({ analytics }: { analytics: any }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <CompactMetric label={t('reports.products.unitsSold')} value={analytics.productsSold} />
        <CompactMetric label={t('reports.products.productsWithMovement')} value={analytics.products.length} />
      </section>
      <RankedTable
        title={t('reports.products.movementTitle')}
        icon={<Package className="h-5 w-5" />}
        columns={[t('reports.tables.product'), t('reports.products.unitsSoldColumn')]}
        rows={analytics.products.map((row: any) => [row.name, row.quantity])}
        emptyText={t('reports.states.noOutgoingStock')}
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input type="date" className="h-11 rounded-xl border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function MetricCard({ title, value, detail, comparison, suffix = '%', icon }: any) {
  const { t } = useTranslation();
  const positive = typeof comparison === 'number' && comparison >= 0;
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-card">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-3 text-3xl font-extrabold tracking-tight">{value}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
          {typeof comparison === 'number' && (
            <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {t('reports.comparison.vsPreviousPeriod', {
                value: `${Math.abs(comparison).toFixed(1)}${suffix}`,
              })}
            </div>
          )}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">{icon}</div>
      </div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className="mt-3 text-2xl font-extrabold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-3xl shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DailyChart({ data }: { data: any[] }) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];

  if (!data.length) return <EmptyText text={t('reports.states.noPerformanceData')} />;
  const visible = data.slice(-31);
  const max = Math.max(...visible.map((row) => row.revenue), 1);
  return (
    <div className="scrollbar-subtle overflow-x-auto">
      <div className="flex h-72 min-w-[680px] items-end gap-2 border-b pb-8">
        {visible.map((row) => {
          const height = Math.max((row.revenue / max) * 100, row.revenue > 0 ? 7 : 2);
          const dateLabel = formatLocalizedDate(row.date, locale);
          return (
            <div
              key={row.date}
              className="group flex min-w-[28px] flex-1 flex-col items-center justify-end"
              title={t('reports.chart.dailyTooltip', {
                date: dateLabel,
                revenue: formatCurrency(row.revenue, locale),
                count: row.appointments,
              })}
            >
              <div className="mb-2 hidden rounded-lg bg-slate-950 px-2 py-1 text-[10px] text-white group-hover:block">
                {formatCurrency(row.revenue, locale, 0)}
              </div>
              <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-primary to-violet-300 transition hover:brightness-95" style={{ height: `${height}%` }} />
              <div className="absolute mt-[270px] text-[9px] text-muted-foreground">
                {new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(new Date(`${row.date}T00:00:00`))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorizontalBars({ data }: { data: Array<{ label: string; value: number; detail?: string }> }) {
  const { t } = useTranslation();
  if (!data.length) return <EmptyText text={t('reports.states.noData')} />;
  const max = Math.max(...data.map((row) => row.value), 1);
  return (
    <div className="space-y-4">
      {data.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">{row.label}</span>
            <span className="text-xs text-muted-foreground">{row.detail ?? row.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400" style={{ width: `${Math.max((row.value / max) * 100, row.value ? 5 : 0)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HealthLine({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' | 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
  };
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm"><span>{label}</span><strong>{value.toFixed(1)}%</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${Math.min(value, 100)}%` }} /></div>
    </div>
  );
}

function StatusDistribution({ statuses }: { statuses: any[] }) {
  const { t } = useTranslation();
  if (!statuses.length) return <EmptyText text={t('reports.states.noStatusData')} />;
  const max = Math.max(...statuses.map((row) => row.count), 1);
  return (
    <div className="space-y-5">
      {statuses.map((row) => (
        <div key={row.status}>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">{t(`reports.statuses.${row.status}`, { defaultValue: row.status.replace(/_/g, ' ') })}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${STATUS_COLORS[row.status] ?? 'bg-primary'}`} style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankedTable({ title, icon, columns, rows, emptyText }: any) {
  const { t } = useTranslation();
  const resolvedEmptyText = emptyText ?? t('reports.states.noDataAvailable');

  return (
    <Card className="overflow-hidden rounded-3xl shadow-card">
      <CardHeader><CardTitle className="flex items-center gap-2"><span className="text-primary">{icon}</span>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!rows.length ? <div className="p-8"><EmptyText text={resolvedEmptyText} /></div> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{columns.map((column: string) => <th key={column} className="px-5 py-3 font-semibold">{column}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row: any[], index: number) => (
                    <tr key={index} className="hover:bg-muted/25">
                      {row.map((value, cellIndex) => <td key={cellIndex} className={`px-5 py-4 ${cellIndex === 0 ? 'font-semibold' : ''}`}>{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y md:hidden">
              {rows.map((row: any[], rowIndex: number) => (
                <div key={rowIndex} className="space-y-3 p-4">
                  <div className="font-bold">{row[0]}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {columns.slice(1).map((column: string, index: number) => (
                      <div key={column} className="rounded-xl bg-muted/35 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{column}</div>
                        <div className="mt-1 text-sm font-bold">{row[index + 1]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryLine({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"><span className="text-sm text-muted-foreground">{label}</span><span className="font-bold">{value}</span></div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function formatCurrency(value: number, locale: string, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function formatLocalizedDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function getWeekdayLabels(t: TFunction) {
  return [
    t('reports.weekdays.sunday'),
    t('reports.weekdays.monday'),
    t('reports.weekdays.tuesday'),
    t('reports.weekdays.wednesday'),
    t('reports.weekdays.thursday'),
    t('reports.weekdays.friday'),
    t('reports.weekdays.saturday'),
  ];
}
