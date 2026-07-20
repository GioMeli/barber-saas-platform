import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  Euro,
  Package,
  Scissors,
  Target,
  TrendingUp,
  UserRound,
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
  subDays,
  subMonths,
} from 'date-fns';

type ReportTab = 'overview' | 'staff' | 'services' | 'customers' | 'products';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-500',
  completed: 'bg-emerald-500',
  in_progress: 'bg-amber-500',
  cancelled_by_business: 'bg-red-500',
  cancelled_by_customer: 'bg-rose-400',
  no_show: 'bg-slate-500',
};

export default function Reports() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const [appointments, setAppointments] = useState<any[]>([]);
  const [newCustomers, setNewCustomers] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [previousWeekdayAppointments, setPreviousWeekdayAppointments] =
    useState<any[]>([]);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId, dateRange.start, dateRange.end]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const startIso = new Date(`${dateRange.start}T00:00:00`).toISOString();
      const endDate = new Date(`${dateRange.end}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const endIso = endDate.toISOString();

      const today = new Date();
      const previousSameWeekday = subDays(today, 7);

      const todayStartIso = startOfDay(today).toISOString();
      const todayEndIso = endOfDay(today).toISOString();
      const previousStartIso =
        startOfDay(previousSameWeekday).toISOString();
      const previousEndIso =
        endOfDay(previousSameWeekday).toISOString();

      const [
        appointmentsResult,
        customersResult,
        stockResult,
        todayResult,
        previousWeekdayResult,
      ] = await Promise.all([
          supabase
            .from('appointments')
            .select(
              'id, booking_reference, start_time, total_price, total_duration, status, employee_id, customer_id, employees(id, name), customers(id, full_name, user_id), appointment_services(price, duration, services(id, name))'
            )
            .eq('business_id', businessId)
            .gte('start_time', startIso)
            .lt('start_time', endIso)
            .order('start_time'),
          supabase
            .from('customers')
            .select('id, full_name, user_id, created_at')
            .eq('business_id', businessId)
            .gte('created_at', startIso)
            .lt('created_at', endIso),
          supabase
            .from('stock_movements')
            .select(
              'quantity, type, created_at, products!inner(id, name, business_id)'
            )
            .eq('products.business_id', businessId)
            .gte('created_at', startIso)
            .lt('created_at', endIso),

          supabase
            .from('appointments')
            .select('id, start_time, total_price, status')
            .eq('business_id', businessId)
            .gte('start_time', todayStartIso)
            .lte('start_time', todayEndIso),

          supabase
            .from('appointments')
            .select('id, start_time, total_price, status')
            .eq('business_id', businessId)
            .gte('start_time', previousStartIso)
            .lte('start_time', previousEndIso),
        ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (stockResult.error) throw stockResult.error;
      if (todayResult.error) throw todayResult.error;
      if (previousWeekdayResult.error) throw previousWeekdayResult.error;

      setAppointments(appointmentsResult.data ?? []);
      setNewCustomers(customersResult.data ?? []);
      setStockMovements(stockResult.data ?? []);
      setTodayAppointments(todayResult.data ?? []);
      setPreviousWeekdayAppointments(previousWeekdayResult.data ?? []);
    } catch (error: any) {
      console.error('Reports error:', error);
      toast.error(error.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo(() => {
    const revenueAppointments = appointments.filter((appointment) =>
      ['confirmed', 'completed', 'in_progress'].includes(appointment.status)
    );

    const totalRevenue = revenueAppointments.reduce(
      (total, appointment) => total + Number(appointment.total_price || 0),
      0
    );

    const completed = appointments.filter(
      (appointment) => appointment.status === 'completed'
    ).length;

    const cancelled = appointments.filter((appointment) =>
      ['cancelled_by_business', 'cancelled_by_customer'].includes(
        appointment.status
      )
    ).length;

    const noShows = appointments.filter(
      (appointment) => appointment.status === 'no_show'
    ).length;

    const averageTicket = revenueAppointments.length
      ? totalRevenue / revenueAppointments.length
      : 0;

    const completionRate = appointments.length
      ? (completed / appointments.length) * 100
      : 0;

    const cancellationRate = appointments.length
      ? (cancelled / appointments.length) * 100
      : 0;

    const registeredCustomers = newCustomers.filter((customer) =>
      Boolean(customer.user_id)
    ).length;

    const staffMap = new Map<string, any>();
    const servicesMap = new Map<string, any>();
    const customerMap = new Map<string, any>();
    const statusMap = new Map<string, number>();

    appointments.forEach((appointment) => {
      statusMap.set(
        appointment.status,
        (statusMap.get(appointment.status) ?? 0) + 1
      );

      const staffId = appointment.employee_id || 'unassigned';
      const staffName = appointment.employees?.name || 'Unassigned';
      const currentStaff = staffMap.get(staffId) ?? {
        id: staffId,
        name: staffName,
        appointments: 0,
        revenue: 0,
        minutes: 0,
        completed: 0,
      };

      currentStaff.appointments += 1;
      currentStaff.revenue += Number(appointment.total_price || 0);
      currentStaff.minutes += Number(appointment.total_duration || 0);
      if (appointment.status === 'completed') currentStaff.completed += 1;
      staffMap.set(staffId, currentStaff);

      if (appointment.customer_id) {
        const currentCustomer = customerMap.get(appointment.customer_id) ?? {
          id: appointment.customer_id,
          name: appointment.customers?.full_name || 'Customer',
          visits: 0,
          spend: 0,
          registered: Boolean(appointment.customers?.user_id),
        };

        currentCustomer.visits += 1;
        currentCustomer.spend += Number(appointment.total_price || 0);
        customerMap.set(appointment.customer_id, currentCustomer);
      }

      appointment.appointment_services?.forEach((row: any) => {
        const service = row.services;
        if (!service) return;

        const currentService = servicesMap.get(service.id) ?? {
          id: service.id,
          name: service.name,
          bookings: 0,
          revenue: 0,
          minutes: 0,
        };

        currentService.bookings += 1;
        currentService.revenue += Number(row.price || 0);
        currentService.minutes += Number(row.duration || 0);
        servicesMap.set(service.id, currentService);
      });
    });

    const productsMap = new Map<string, any>();
    let productsSold = 0;

    stockMovements
      .filter((movement) => movement.type === 'out')
      .forEach((movement) => {
        const quantity = Math.abs(Number(movement.quantity || 0));
        productsSold += quantity;

        const product = movement.products;
        const current = productsMap.get(product.id) ?? {
          id: product.id,
          name: product.name,
          quantity: 0,
        };

        current.quantity += quantity;
        productsMap.set(product.id, current);
      });

    const dailyMap = new Map<
      string,
      { date: string; appointments: number; revenue: number }
    >();

    appointments.forEach((appointment) => {
      const key = format(new Date(appointment.start_time), 'yyyy-MM-dd');
      const current = dailyMap.get(key) ?? {
        date: key,
        appointments: 0,
        revenue: 0,
      };

      current.appointments += 1;

      if (
        ['confirmed', 'completed', 'in_progress'].includes(
          appointment.status
        )
      ) {
        current.revenue += Number(appointment.total_price || 0);
      }

      dailyMap.set(key, current);
    });

    return {
      totalRevenue,
      averageTicket,
      completed,
      cancelled,
      noShows,
      completionRate,
      cancellationRate,
      registeredCustomers,
      guestCustomers: newCustomers.length - registeredCustomers,
      productsSold,
      staff: [...staffMap.values()].sort((a, b) => b.revenue - a.revenue),
      services: [...servicesMap.values()].sort(
        (a, b) => b.bookings - a.bookings
      ),
      customers: [...customerMap.values()].sort((a, b) => b.spend - a.spend),
      products: [...productsMap.values()].sort(
        (a, b) => b.quantity - a.quantity
      ),
      statuses: [...statusMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      daily: [...dailyMap.values()].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    };
  }, [appointments, newCustomers, stockMovements]);

  const sameWeekdayComparison = useMemo(() => {
    const includedStatuses = ['confirmed', 'completed', 'in_progress'];

    const todayRevenue = todayAppointments
      .filter((appointment) =>
        includedStatuses.includes(appointment.status)
      )
      .reduce(
        (sum, appointment) =>
          sum + Number(appointment.total_price || 0),
        0
      );

    const previousRevenue = previousWeekdayAppointments
      .filter((appointment) =>
        includedStatuses.includes(appointment.status)
      )
      .reduce(
        (sum, appointment) =>
          sum + Number(appointment.total_price || 0),
        0
      );

    const remaining = Math.max(previousRevenue - todayRevenue, 0);
    const progress =
      previousRevenue > 0
        ? Math.min((todayRevenue / previousRevenue) * 100, 100)
        : todayRevenue > 0
          ? 100
          : 0;

    const difference = todayRevenue - previousRevenue;

    return {
      todayRevenue,
      previousRevenue,
      remaining,
      progress,
      difference,
      exceeded: todayRevenue >= previousRevenue && previousRevenue > 0,
      previousDate: format(subDays(new Date(), 7), 'EEE, dd MMM'),
    };
  }, [todayAppointments, previousWeekdayAppointments]);

  const applyPreset = (preset: 'week' | 'month' | 'previous_month') => {
    const now = new Date();

    if (preset === 'week') {
      setDateRange({
        start: format(startOfWeek(now), 'yyyy-MM-dd'),
        end: format(endOfWeek(now), 'yyyy-MM-dd'),
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
    const rows = [
      ['Business Report', `${dateRange.start} to ${dateRange.end}`],
      [],
      ['Metric', 'Value'],
      ['Revenue', analytics.totalRevenue.toFixed(2)],
      ['Appointments', appointments.length],
      ['Completed', analytics.completed],
      ['Cancelled', analytics.cancelled],
      ['No Shows', analytics.noShows],
      ['Average Ticket', analytics.averageTicket.toFixed(2)],
      ['New Registered Customers', analytics.registeredCustomers],
      ['New Guest Contacts', analytics.guestCustomers],
      ['Products Sold', analytics.productsSold],
      [],
      ['Staff', 'Appointments', 'Revenue', 'Booked Minutes'],
      ...analytics.staff.map((row) => [
        row.name,
        row.appointments,
        row.revenue.toFixed(2),
        row.minutes,
      ]),
      [],
      ['Service', 'Bookings', 'Revenue'],
      ...analytics.services.map((row) => [
        row.name,
        row.bookings,
        row.revenue.toFixed(2),
      ]),
    ];

    const content = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([content], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `business-report-${dateRange.start}-${dateRange.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => window.print();

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'staff', label: 'Staff' },
    { id: 'services', label: 'Services' },
    { id: 'customers', label: 'Customers' },
    { id: 'products', label: 'Products' },
  ];

  return (
    <div className="app-page pb-10 print:max-w-none">
      <header className="app-page-header print:hidden">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Business intelligence
          </div>
          <h1 className="app-page-title">Reports</h1>
          <p className="app-page-description">
            Analyze revenue, appointments, staff, services, customers and
            products for any reporting period.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={printReport}>
            Print
          </Button>
          <Button onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      <Card className="rounded-2xl shadow-card print:hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Start date</label>
              <input
                type="date"
                className="h-11 rounded-xl border bg-background px-3 text-sm"
                value={dateRange.start}
                onChange={(event) =>
                  setDateRange({ ...dateRange, start: event.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">End date</label>
              <input
                type="date"
                className="h-11 rounded-xl border bg-background px-3 text-sm"
                value={dateRange.end}
                onChange={(event) =>
                  setDateRange({ ...dateRange, end: event.target.value })
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => applyPreset('week')}>
                This Week
              </Button>
              <Button variant="outline" onClick={() => applyPreset('month')}>
                This Month
              </Button>
              <Button
                variant="outline"
                onClick={() => applyPreset('previous_month')}
              >
                Previous Month
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground shadow-card">
          Loading professional reports...
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Revenue"
              value={`€${analytics.totalRevenue.toFixed(2)}`}
              detail={`Average ticket €${analytics.averageTicket.toFixed(2)}`}
              icon={<Euro className="h-5 w-5" />}
            />
            <MetricCard
              title="Appointments"
              value={appointments.length}
              detail={`${analytics.completed} completed`}
              icon={<CalendarDays className="h-5 w-5" />}
            />
            <MetricCard
              title="Completion Rate"
              value={`${analytics.completionRate.toFixed(1)}%`}
              detail={`${analytics.cancellationRate.toFixed(1)}% cancellation rate`}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <MetricCard
              title="New Customers"
              value={newCustomers.length}
              detail={`${analytics.registeredCustomers} registered · ${analytics.guestCustomers} guests`}
              icon={<Users className="h-5 w-5" />}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SameWeekdayGoalCard data={sameWeekdayComparison} />

            <Card className="overflow-hidden rounded-2xl shadow-card">
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Revenue trend</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Daily revenue and appointment volume for the selected period.
                    </p>
                  </div>

                  <Badge variant="secondary">
                    {dateRange.start} – {dateRange.end}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <DailyPerformanceChart data={analytics.daily} />
              </CardContent>
            </Card>
          </section>

          <div className="scrollbar-subtle flex gap-2 overflow-x-auto py-1 print:hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:border-primary/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <OverviewReport analytics={analytics} appointments={appointments} />
          )}

          {activeTab === 'staff' && (
            <RankedTable
              title="Staff Performance"
              icon={<UserRound className="h-5 w-5" />}
              columns={[
                'Professional',
                'Appointments',
                'Completed',
                'Booked Hours',
                'Utilization',
                'Revenue',
              ]}
              rows={analytics.staff.map((row) => [
                row.name,
                row.appointments,
                row.completed,
                (row.minutes / 60).toFixed(1),
                `${Math.min((row.minutes / (8 * 60)) * 100, 100).toFixed(0)}%`,
                `€${row.revenue.toFixed(2)}`,
              ])}
            />
          )}

          {activeTab === 'services' && (
            <RankedTable
              title="Service Performance"
              icon={<Scissors className="h-5 w-5" />}
              columns={['Service', 'Bookings', 'Booked Hours', 'Revenue', 'Avg. Value']}
              rows={analytics.services.map((row) => [
                row.name,
                row.bookings,
                (row.minutes / 60).toFixed(1),
                `€${row.revenue.toFixed(2)}`,
                `€${(row.revenue / row.bookings).toFixed(2)}`,
              ])}
            />
          )}

          {activeTab === 'customers' && (
            <RankedTable
              title="Customer Value"
              icon={<Users className="h-5 w-5" />}
              columns={['Customer', 'Type', 'Visits', 'Total Spend', 'Avg. Spend']}
              rows={analytics.customers.map((row) => [
                row.name,
                row.registered ? 'Registered' : 'Guest',
                row.visits,
                `€${row.spend.toFixed(2)}`,
                `€${(row.spend / row.visits).toFixed(2)}`,
              ])}
            />
          )}

          {activeTab === 'products' && (
            <RankedTable
              title="Product Movement"
              icon={<Package className="h-5 w-5" />}
              columns={['Product', 'Units Sold']}
              rows={analytics.products.map((row) => [
                row.name,
                row.quantity,
              ])}
              emptyText="No product sales were recorded in this period."
            />
          )}
        </>
      )}
    </div>
  );
}

function OverviewReport({
  analytics,
  appointments,
}: {
  analytics: any;
  appointments: any[];
}) {
  const maxStatus = Math.max(
    ...analytics.statuses.map((item: any) => item.count),
    1
  );

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Appointment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {analytics.statuses.length === 0 ? (
            <EmptyText text="No appointment data in this period." />
          ) : (
            analytics.statuses.map((item: any) => (
              <div key={item.status}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium capitalize">
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  <span className="font-bold">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      STATUS_COLORS[item.status] || 'bg-primary'
                    }`}
                    style={{ width: `${(item.count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle>Operational Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SummaryLine label="Completed appointments" value={analytics.completed} />
          <SummaryLine label="Cancelled appointments" value={analytics.cancelled} />
          <SummaryLine label="No-shows" value={analytics.noShows} />
          <SummaryLine label="Products sold" value={analytics.productsSold} />
          <SummaryLine
            label="Booked hours"
            value={`${(
              appointments.reduce(
                (sum, appointment) =>
                  sum + Number(appointment.total_duration || 0),
                0
              ) / 60
            ).toFixed(1)} h`}
          />
        </CardContent>
      </Card>

      <RankedTable
        title="Top Services"
        icon={<Scissors className="h-5 w-5" />}
        columns={['Service', 'Bookings', 'Revenue']}
        rows={analytics.services.slice(0, 5).map((row: any) => [
          row.name,
          row.bookings,
          `€${row.revenue.toFixed(2)}`,
        ])}
      />

      <RankedTable
        title="Top Professionals"
        icon={<UserRound className="h-5 w-5" />}
        columns={['Professional', 'Appointments', 'Revenue']}
        rows={analytics.staff.slice(0, 5).map((row: any) => [
          row.name,
          row.appointments,
          `€${row.revenue.toFixed(2)}`,
        ])}
      />
    </section>
  );
}


function SameWeekdayGoalCard({ data }: { data: any }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference -
    (Math.max(0, Math.min(data.progress, 100)) / 100) * circumference;

  return (
    <Card className="overflow-hidden rounded-2xl border-blue-200/70 bg-gradient-to-br from-blue-50 via-card to-slate-50 shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Today’s revenue goal</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Compared with the same weekday last week.
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Target className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center xl:grid-cols-1">
        <div className="relative mx-auto h-36 w-36">
          <svg
            viewBox="0 0 128 128"
            className="-rotate-90 h-full w-full"
            aria-label={`${data.progress.toFixed(0)} percent of last week's same-day revenue`}
          >
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-200"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-blue-600 transition-all duration-500"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-extrabold">
              {data.progress.toFixed(0)}%
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              reached
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <ComparisonLine
            label="Today"
            value={`€${data.todayRevenue.toFixed(2)}`}
          />
          <ComparisonLine
            label={`Last ${data.previousDate}`}
            value={`€${data.previousRevenue.toFixed(2)}`}
          />

          <div
            className={`rounded-xl border p-3 ${
              data.exceeded
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            {data.previousRevenue === 0 ? (
              <div className="text-sm font-semibold">
                No comparable revenue was recorded last week.
              </div>
            ) : data.exceeded ? (
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ArrowUpRight className="h-4 w-4" />
                Goal exceeded by €{Math.abs(data.difference).toFixed(2)}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ArrowDownRight className="h-4 w-4" />
                €{data.remaining.toFixed(2)} needed to match last week
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function DailyPerformanceChart({
  data,
}: {
  data: Array<{
    date: string;
    appointments: number;
    revenue: number;
  }>;
}) {
  if (data.length === 0) {
    return <EmptyText text="No daily performance data for this period." />;
  }

  const visibleData = data.slice(-14);
  const maxRevenue = Math.max(
    ...visibleData.map((item) => item.revenue),
    1
  );

  return (
    <div>
      <div className="flex h-64 items-end gap-2 overflow-x-auto pb-2">
        {visibleData.map((item) => {
          const height = Math.max(
            (item.revenue / maxRevenue) * 100,
            item.revenue > 0 ? 8 : 2
          );

          return (
            <div
              key={item.date}
              className="group flex min-w-[42px] flex-1 flex-col items-center justify-end"
              title={`${format(
                new Date(`${item.date}T00:00:00`),
                'dd MMM'
              )} · €${item.revenue.toFixed(2)} · ${
                item.appointments
              } appointments`}
            >
              <div className="mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                €{item.revenue.toFixed(2)}
              </div>

              <div
                className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-blue-600 to-sky-300 transition hover:brightness-95"
                style={{ height: `${height}%` }}
              />

              <div className="mt-2 text-[10px] font-medium text-muted-foreground">
                {format(new Date(`${item.date}T00:00:00`), 'dd')}
              </div>

              <div className="text-[9px] text-muted-foreground/75">
                {item.appointments} apt
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>Last {visibleData.length} reporting days</span>
        <span>Hover bars for revenue</span>
      </div>
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
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-5 shadow-card transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100/60 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          <div className="mt-3 text-3xl font-bold">{value}</div>
          <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function RankedTable({
  title,
  icon,
  columns,
  rows,
  emptyText = 'No data available for this period.',
}: {
  title: string;
  icon: React.ReactNode;
  columns: string[];
  rows: Array<Array<string | number>>;
  emptyText?: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-8">
            <EmptyText text={emptyText} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-5 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-muted/25">
                    {row.map((value, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={`px-5 py-4 ${
                          cellIndex === 0 ? 'font-semibold' : ''
                        }`}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
