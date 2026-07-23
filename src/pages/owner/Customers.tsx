import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowRight,
  BookOpenText,
  CalendarCheck2,
  CircleDollarSign,
  Crown,
  Edit,
  History,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

type CustomerFilter =
  | 'all'
  | 'registered'
  | 'guest'
  | 'active'
  | 'at_risk'
  | 'vip'
  | 'new';
type CustomerSort = 'recent' | 'name' | 'last_visit' | 'visits' | 'spend';
type MainTab = 'customers' | 'records' | 'history';

type CustomerMetrics = {
  visits: number;
  spend: number;
  recordCount: number;
  cancellations: number;
  noShows: number;
  upcomingCount: number;
  lastVisit: string | null;
  nextVisit: string | null;
  isActive: boolean;
  isAtRisk: boolean;
  isVip: boolean;
  isNew: boolean;
};

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  notes: '',
};

const CANCELLED_STATUSES = new Set([
  'cancelled_by_business',
  'cancelled_by_customer',
]);

export default function Customers() {
  const { t, i18n } = useTranslation();
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [customers, setCustomers] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CustomerFilter>('all');
  const [sortBy, setSortBy] = useState<CustomerSort>('recent');
  const [activeTab, setActiveTab] = useState<MainTab>('customers');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [customersResult, recordsResult, appointmentsResult] =
        await Promise.all([
          supabase
            .from('customers')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false }),
          supabase
            .from('customer_records')
            .select('customer_id')
            .eq('business_id', businessId),
          supabase
            .from('appointments')
            .select('customer_id, total_price, status, start_time')
            .eq('business_id', businessId),
        ]);

      if (customersResult.error) throw customersResult.error;
      if (recordsResult.error) throw recordsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      setCustomers(customersResult.data ?? []);
      setRecords(recordsResult.data ?? []);
      setAppointments(appointmentsResult.data ?? []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error(t('customers.toasts.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const metricsByCustomer = useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    const result: Record<string, CustomerMetrics> = {};

    for (const customer of customers) {
      result[customer.id] = {
        visits: 0,
        spend: 0,
        recordCount: 0,
        cancellations: 0,
        noShows: 0,
        upcomingCount: 0,
        lastVisit: null,
        nextVisit: null,
        isActive: false,
        isAtRisk: false,
        isVip: false,
        isNew: now - new Date(customer.created_at).getTime() <= 30 * day,
      };
    }

    for (const record of records) {
      if (!record.customer_id || !result[record.customer_id]) continue;
      result[record.customer_id].recordCount += 1;
    }

    for (const appointment of appointments) {
      const customerId = appointment.customer_id;
      if (!customerId || !result[customerId]) continue;

      const metrics = result[customerId];
      const timestamp = new Date(appointment.start_time).getTime();
      const isFuture = timestamp > now;
      const isCancelled = CANCELLED_STATUSES.has(appointment.status);

      if (isCancelled) metrics.cancellations += 1;
      if (appointment.status === 'no_show') metrics.noShows += 1;

      if (isFuture && !isCancelled && appointment.status !== 'no_show') {
        metrics.upcomingCount += 1;
        if (
          !metrics.nextVisit ||
          timestamp < new Date(metrics.nextVisit).getTime()
        ) {
          metrics.nextVisit = appointment.start_time;
        }
      }

      if (appointment.status === 'completed') {
        metrics.visits += 1;
        metrics.spend += Number(appointment.total_price || 0);
        if (
          !metrics.lastVisit ||
          timestamp > new Date(metrics.lastVisit).getTime()
        ) {
          metrics.lastVisit = appointment.start_time;
        }
      }
    }

    for (const customer of customers) {
      const metrics = result[customer.id];
      const lastVisitAge = metrics.lastVisit
        ? (now - new Date(metrics.lastVisit).getTime()) / day
        : Number.POSITIVE_INFINITY;

      metrics.isVip = metrics.visits >= 6 || metrics.spend >= 300;
      metrics.isActive =
        metrics.upcomingCount > 0 ||
        (Boolean(metrics.lastVisit) && lastVisitAge <= 60);
      metrics.isAtRisk =
        metrics.upcomingCount === 0 &&
        Boolean(metrics.lastVisit) &&
        lastVisitAge > 60 &&
        lastVisitAge <= 150;
    }

    return result;
  }, [appointments, customers, records]);

  const registeredCount = useMemo(
    () => customers.filter((customer) => Boolean(customer.user_id)).length,
    [customers]
  );
  const guestCount = customers.length - registeredCount;

  const crmSummary = useMemo(() => {
    const values = Object.values(metricsByCustomer);

    return {
      active: values.filter((item) => item.isActive).length,
      atRisk: values.filter((item) => item.isAtRisk).length,
      vip: values.filter((item) => item.isVip).length,
      revenue: values.reduce((sum, item) => sum + item.spend, 0),
    };
  }, [metricsByCustomer]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const next = customers.filter((customer) => {
      const metrics = metricsByCustomer[customer.id];
      const isRegistered = Boolean(customer.user_id);

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'registered' && isRegistered) ||
        (activeFilter === 'guest' && !isRegistered) ||
        (activeFilter === 'active' && metrics?.isActive) ||
        (activeFilter === 'at_risk' && metrics?.isAtRisk) ||
        (activeFilter === 'vip' && metrics?.isVip) ||
        (activeFilter === 'new' && metrics?.isNew);

      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      return [customer.full_name, customer.email, customer.phone, customer.notes]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch)
        );
    });

    return [...next].sort((a, b) => {
      const aMetrics = metricsByCustomer[a.id];
      const bMetrics = metricsByCustomer[b.id];

      if (sortBy === 'name') {
        return String(a.full_name).localeCompare(String(b.full_name));
      }

      if (sortBy === 'last_visit') {
        return dateValue(bMetrics?.lastVisit) - dateValue(aMetrics?.lastVisit);
      }

      if (sortBy === 'visits') {
        return (bMetrics?.visits || 0) - (aMetrics?.visits || 0);
      }

      if (sortBy === 'spend') {
        return (bMetrics?.spend || 0) - (aMetrics?.spend || 0);
      }

      return dateValue(b.created_at) - dateValue(a.created_at);
    });
  }, [activeFilter, customers, metricsByCustomer, searchQuery, sortBy]);

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingId(customer.id);
      setFormData({
        full_name: customer.full_name ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        notes: customer.notes ?? '',
      });
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }

    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !formData.full_name.trim()) {
      toast.error(t('customers.validation.nameRequired'));
      return;
    }

    setSaving(true);

    try {
      const payload = {
        business_id: businessId,
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase() || null,
        phone: formData.phone.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingId)
          .eq('business_id', businessId);

        if (error) throw error;
        toast.success(t('customers.toasts.updated'));
      } else {
        const { error } = await supabase.from('customers').insert(payload);

        if (error) throw error;
        toast.success(t('customers.toasts.added'));
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('customers.toasts.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: any) => {
    const isRegistered = Boolean(customer.user_id);
    const confirmed = window.confirm(
      isRegistered
        ? t('customers.confirmRemoveRegistered')
        : t('customers.confirmRemoveGuest')
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(t('customers.toasts.removed'));
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('customers.toasts.removeBlocked'));
    }
  };

  return (
    <div className="app-page pb-10">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('customers.crm.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('customers.title')}</h1>
          <p className="app-page-description">
            {t('customers.crm.description')}
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('customers.actions.add')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title={t('customers.crm.summary.total')}
          value={String(customers.length)}
          description={t('customers.crm.summary.totalDescription', {
            registered: registeredCount,
            guests: guestCount,
          })}
          icon={<Users className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('customers.crm.summary.active')}
          value={String(crmSummary.active)}
          description={t('customers.crm.summary.activeDescription')}
          icon={<CalendarCheck2 className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('customers.crm.summary.atRisk')}
          value={String(crmSummary.atRisk)}
          description={t('customers.crm.summary.atRiskDescription')}
          icon={<Sparkles className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('customers.crm.summary.vip')}
          value={String(crmSummary.vip)}
          description={t('customers.crm.summary.vipDescription')}
          icon={<Crown className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('customers.crm.summary.revenue')}
          value={formatCurrency(crmSummary.revenue, i18n.language)}
          description={t('customers.crm.summary.revenueDescription')}
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
      </section>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1">
              <SegmentButton
                active={activeFilter === 'all'}
                label={t('customers.crm.segments.all')}
                count={customers.length}
                onClick={() => setActiveFilter('all')}
              />
              <SegmentButton
                active={activeFilter === 'active'}
                label={t('customers.crm.segments.active')}
                count={crmSummary.active}
                onClick={() => setActiveFilter('active')}
              />
              <SegmentButton
                active={activeFilter === 'at_risk'}
                label={t('customers.crm.segments.atRisk')}
                count={crmSummary.atRisk}
                onClick={() => setActiveFilter('at_risk')}
              />
              <SegmentButton
                active={activeFilter === 'vip'}
                label={t('customers.crm.segments.vip')}
                count={crmSummary.vip}
                onClick={() => setActiveFilter('vip')}
              />
              <SegmentButton
                active={activeFilter === 'new'}
                label={t('customers.crm.segments.new')}
                count={
                  Object.values(metricsByCustomer).filter((item) => item.isNew)
                    .length
                }
                onClick={() => setActiveFilter('new')}
              />
              <SegmentButton
                active={activeFilter === 'registered'}
                label={t('customers.filters.registered')}
                count={registeredCount}
                onClick={() => setActiveFilter('registered')}
              />
              <SegmentButton
                active={activeFilter === 'guest'}
                label={t('customers.filters.guests')}
                count={guestCount}
                onClick={() => setActiveFilter('guest')}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_180px] xl:w-[520px]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl pl-9"
                  placeholder={t('customers.crm.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <select
                className="h-11 rounded-xl border bg-background px-3 text-sm"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as CustomerSort)
                }
                aria-label={t('customers.crm.sort.label')}
              >
                <option value="recent">{t('customers.crm.sort.recent')}</option>
                <option value="name">{t('customers.crm.sort.name')}</option>
                <option value="last_visit">
                  {t('customers.crm.sort.lastVisit')}
                </option>
                <option value="visits">{t('customers.crm.sort.visits')}</option>
                <option value="spend">{t('customers.crm.sort.spend')}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-card">
        <MainTabButton
          active={activeTab === 'customers'}
          label={t('customers.tabs.customers')}
          icon={<Users className="h-4 w-4" />}
          onClick={() => setActiveTab('customers')}
        />
        <MainTabButton
          active={activeTab === 'records'}
          label={t('customers.tabs.records')}
          icon={<BookOpenText className="h-4 w-4" />}
          onClick={() => setActiveTab('records')}
        />
        <MainTabButton
          active={activeTab === 'history'}
          label={t('customers.tabs.history')}
          icon={<History className="h-4 w-4" />}
          onClick={() => setActiveTab('history')}
        />
      </div>

      {activeTab !== 'customers' ? (
        <Card className="overflow-hidden rounded-2xl shadow-card">
          <div className="border-b px-4 py-4 sm:px-6">
            <h2 className="text-lg font-bold">
              {activeTab === 'records'
                ? t('customers.tabs.records')
                : t('customers.tabs.history')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === 'records'
                ? t('customers.recordsDescription')
                : t('customers.historyDescription')}
            </p>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <StateMessage text={t('customers.states.loading')} />
            ) : filteredCustomers.length === 0 ? (
              <StateMessage text={t('customers.crm.states.noMatches')} />
            ) : (
              <div className="divide-y">
                {filteredCustomers.map((customer) => {
                  const metrics = metricsByCustomer[customer.id];

                  return (
                    <Link
                      key={customer.id}
                      to={`/dashboard/customers/${customer.id}?tab=${activeTab}`}
                      className="flex items-center gap-4 px-5 py-4 transition hover:bg-muted/35"
                    >
                      <CustomerAvatar name={customer.full_name} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-semibold">
                            {customer.full_name}
                          </div>
                          <CustomerTypeBadge
                            registered={Boolean(customer.user_id)}
                          />
                          <HealthBadge metrics={metrics} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {customer.email ||
                            customer.phone ||
                            t('customers.noContactDetails')}
                        </div>
                      </div>

                      <div className="hidden text-right sm:block">
                        <div className="text-2xl font-bold">
                          {activeTab === 'records'
                            ? metrics?.recordCount || 0
                            : metrics?.visits || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activeTab === 'records'
                            ? t('customers.counts.records')
                            : `${t('customers.counts.visits')} · ${formatCurrency(
                                metrics?.spend || 0,
                                i18n.language
                              )}`}
                        </div>
                      </div>

                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl shadow-card">
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/35">
                    <TableHead>{t('customers.table.customer')}</TableHead>
                    <TableHead>{t('customers.crm.table.relationship')}</TableHead>
                    <TableHead>{t('customers.table.contact')}</TableHead>
                    <TableHead>{t('customers.crm.table.lastVisit')}</TableHead>
                    <TableHead>{t('customers.crm.table.visits')}</TableHead>
                    <TableHead>{t('customers.crm.table.lifetimeValue')}</TableHead>
                    <TableHead>{t('customers.crm.table.records')}</TableHead>
                    <TableHead className="text-right">
                      {t('customers.table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-32 text-center text-muted-foreground"
                      >
                        {t('customers.states.loading')}
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-40 text-center text-muted-foreground"
                      >
                        {t('customers.crm.states.noMatches')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const metrics = metricsByCustomer[customer.id];

                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <Link
                              to={`/dashboard/customers/${customer.id}`}
                              className="flex items-center gap-3 rounded-xl transition hover:text-primary"
                            >
                              <CustomerAvatar name={customer.full_name} />
                              <div className="min-w-0">
                                <div className="font-semibold">
                                  {customer.full_name}
                                </div>
                                <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                                  {customer.notes ||
                                    t('customers.crm.noProfileNotes')}
                                </div>
                              </div>
                            </Link>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col items-start gap-2">
                              <CustomerTypeBadge
                                registered={Boolean(customer.user_id)}
                              />
                              <HealthBadge metrics={metrics} />
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1.5 text-sm">
                              <ContactLine
                                icon={<Mail className="h-3.5 w-3.5" />}
                                value={customer.email || t('customers.noEmail')}
                              />
                              <ContactLine
                                icon={<Phone className="h-3.5 w-3.5" />}
                                value={customer.phone || t('customers.noPhone')}
                              />
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-sm font-medium">
                              {metrics?.lastVisit
                                ? formatCustomerDate(
                                    metrics.lastVisit,
                                    i18n.language
                                  )
                                : t('customers.crm.neverVisited')}
                            </div>
                            {metrics?.nextVisit && (
                              <div className="mt-1 text-xs text-primary">
                                {t('customers.crm.nextVisit', {
                                  date: formatCustomerDateTime(
                                    metrics.nextVisit,
                                    i18n.language
                                  ),
                                })}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold">
                              {metrics?.visits || 0}
                            </div>
                            {(metrics?.noShows || 0) > 0 && (
                              <div className="mt-1 text-xs text-amber-700">
                                {t('customers.crm.noShows', {
                                  count: metrics.noShows,
                                })}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="font-semibold">
                            {formatCurrency(metrics?.spend || 0, i18n.language)}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline">
                              {metrics?.recordCount || 0}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {customer.phone && (
                                <Button asChild variant="ghost" size="icon">
                                  <a
                                    href={`tel:${customer.phone}`}
                                    title={t('customers.crm.actions.call')}
                                  >
                                    <Phone className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {customer.email && (
                                <Button asChild variant="ghost" size="icon">
                                  <a
                                    href={`mailto:${customer.email}`}
                                    title={t('customers.crm.actions.email')}
                                  >
                                    <Mail className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              <Button asChild variant="ghost" size="icon">
                                <Link
                                  to={`/dashboard/customers/${customer.id}`}
                                  title={t('customers.crm.actions.openProfile')}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t('customers.actions.edit')}
                                onClick={() => handleOpenDialog(customer)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t('customers.actions.remove')}
                                onClick={() => void handleDelete(customer)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y lg:hidden">
              {loading ? (
                <StateMessage text={t('customers.states.loading')} />
              ) : filteredCustomers.length === 0 ? (
                <StateMessage text={t('customers.crm.states.noMatches')} />
              ) : (
                filteredCustomers.map((customer) => {
                  const metrics = metricsByCustomer[customer.id];

                  return (
                    <div key={customer.id} className="space-y-4 p-5">
                      <div className="flex items-start gap-3">
                        <CustomerAvatar name={customer.full_name} />

                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/dashboard/customers/${customer.id}`}
                            className="truncate font-semibold transition hover:text-primary"
                          >
                            {customer.full_name}
                          </Link>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <CustomerTypeBadge
                              registered={Boolean(customer.user_id)}
                            />
                            <HealthBadge metrics={metrics} />
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(customer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-3 text-center">
                        <MobileMetric
                          label={t('customers.crm.table.visits')}
                          value={String(metrics?.visits || 0)}
                        />
                        <MobileMetric
                          label={t('customers.crm.table.lifetimeValue')}
                          value={formatCurrency(
                            metrics?.spend || 0,
                            i18n.language
                          )}
                        />
                        <MobileMetric
                          label={t('customers.crm.table.records')}
                          value={String(metrics?.recordCount || 0)}
                        />
                      </div>

                      <div className="space-y-2 text-sm">
                        <ContactLine
                          icon={<Mail className="h-4 w-4" />}
                          value={customer.email || t('customers.noEmail')}
                        />
                        <ContactLine
                          icon={<Phone className="h-4 w-4" />}
                          value={customer.phone || t('customers.noPhone')}
                        />
                        <div className="text-xs text-muted-foreground">
                          {metrics?.lastVisit
                            ? t('customers.crm.lastVisitMobile', {
                                date: formatCustomerDate(
                                  metrics.lastVisit,
                                  i18n.language
                                ),
                              })
                            : t('customers.crm.neverVisited')}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t pt-4">
                        <Button asChild size="sm" className="flex-1">
                          <Link to={`/dashboard/customers/${customer.id}`}>
                            {t('customers.crm.actions.openProfile')}
                          </Link>
                        </Button>
                        {customer.phone && (
                          <Button asChild variant="outline" size="sm">
                            <a href={`tel:${customer.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {customer.email && (
                          <Button asChild variant="outline" size="sm">
                            <a href={`mailto:${customer.email}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(customer)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t('customers.dialog.editTitle')
                : t('customers.dialog.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">
                {t('customers.form.fullName')} *
              </Label>
              <Input
                id="full_name"
                className="h-11 rounded-xl"
                value={formData.full_name}
                onChange={(event) =>
                  setFormData({ ...formData, full_name: event.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">{t('customers.form.email')}</Label>
              <Input
                id="email"
                type="email"
                className="h-11 rounded-xl"
                value={formData.email}
                onChange={(event) =>
                  setFormData({ ...formData, email: event.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">{t('customers.form.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                className="h-11 rounded-xl"
                value={formData.phone}
                onChange={(event) =>
                  setFormData({ ...formData, phone: event.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">{t('customers.form.notes')}</Label>
              <Textarea
                id="notes"
                rows={4}
                className="rounded-xl"
                value={formData.notes}
                onChange={(event) =>
                  setFormData({ ...formData, notes: event.target.value })
                }
              />
            </div>

            {!editingId && (
              <div className="rounded-xl border border-dashed bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
                {t('customers.form.manualCustomerNote')}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? t('common.saving') : t('customers.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MainTabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          <div className="mt-3 truncate text-3xl font-bold">{value}</div>
          <div className="mt-2 text-xs leading-5 text-muted-foreground">
            {description}
          </div>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
          active ? 'bg-black/10' : 'bg-muted'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials = String(name || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
      {initials || 'C'}
    </div>
  );
}

function CustomerTypeBadge({ registered }: { registered: boolean }) {
  const { t } = useTranslation();
  return registered ? (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
      {t('customers.types.registered')}
    </Badge>
  ) : (
    <Badge variant="secondary">{t('customers.types.guest')}</Badge>
  );
}

function HealthBadge({ metrics }: { metrics?: CustomerMetrics }) {
  const { t } = useTranslation();

  if (metrics?.isVip) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        {t('customers.crm.health.vip')}
      </Badge>
    );
  }

  if (metrics?.isAtRisk) {
    return (
      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
        {t('customers.crm.health.atRisk')}
      </Badge>
    );
  }

  if (metrics?.isActive) {
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        {t('customers.crm.health.active')}
      </Badge>
    );
  }

  if (metrics?.isNew) {
    return <Badge variant="outline">{t('customers.crm.health.new')}</Badge>;
  }

  return <Badge variant="secondary">{t('customers.crm.health.dormant')}</Badge>;
}

function ContactLine({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-bold">{value}</div>
      <div className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function StateMessage({ text }: { text: string }) {
  return <div className="p-12 text-center text-sm text-muted-foreground">{text}</div>;
}

function formatCustomerDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCustomerDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
