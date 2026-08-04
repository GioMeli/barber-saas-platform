import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, isToday, parseISO } from 'date-fns';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffPWA } from '@/hooks/useStaffPWA';
import { staffSupabase } from '@/db/staffSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PageMeta from '@/components/common/PageMeta';
import { toast } from 'sonner';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  CheckCircle2,
  Clock3,
  Download,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  XCircle,
} from 'lucide-react';

type Workspace = {
  business: any;
  employee: any;
  services: any[];
  appointments: any[];
  customers: any[];
};

type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'no_show';

const EMPTY_CREATE_FORM = {
  customer_id: '',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  service_ids: [] as string[],
  date: format(new Date(), 'yyyy-MM-dd'),
  time: format(new Date(Date.now() + 60 * 60 * 1000), 'HH:mm'),
  notes: '',
};

const STATUS_KEYS: Record<string, string> = {
  pending: 'staffPortal.status.pending',
  confirmed: 'staffPortal.status.confirmed',
  arrived: 'staffPortal.status.arrived',
  in_progress: 'staffPortal.status.inProgress',
  completed: 'staffPortal.status.completed',
  no_show: 'staffPortal.status.noShow',
  cancelled_by_business: 'staffPortal.status.cancelled',
  cancelled_by_customer: 'staffPortal.status.cancelled',
  rescheduled: 'staffPortal.status.rescheduled',
};

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'arrived', 'in_progress']);

export default function EmployeeDashboard() {
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useStaffAuth();

  const [slug, setSlug] = useState(routeSlug || '');
  const [publicBusiness, setPublicBusiness] = useState<any>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [email, setEmail] = useState('');
  const [linkSending, setLinkSending] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [saving, setSaving] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const pwa = useStaffPWA(workspace?.business || publicBusiness, workspace?.employee);

  useEffect(() => {
    if (routeSlug) {
      setSlug(routeSlug);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    void resolveLegacyRoute();
  }, [routeSlug, user?.id]);

  useEffect(() => {
    if (!slug) return;
    void loadPublicBusiness();
  }, [slug]);

  useEffect(() => {
    if (authLoading || !slug) return;
    if (!user) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    void loadWorkspace();
  }, [authLoading, user?.id, slug]);

  useEffect(() => {
    if (searchParams.get('action') === 'new' && workspace) {
      setCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [workspace, searchParams]);

  useEffect(() => {
    if (!workspace?.employee?.id || !workspace?.business?.id) return;

    const channel = staffSupabase
      .channel(`staff-workspace-${workspace.business.id}-${workspace.employee.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `employee_id=eq.${workspace.employee.id}`,
        },
        () => void loadWorkspace(true)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'employees',
          filter: `id=eq.${workspace.employee.id}`,
        },
        () => void loadWorkspace(true)
      )
      .subscribe();

    const heartbeat = window.setInterval(() => void loadWorkspace(true), 60_000);
    const validateOnFocus = () => void loadWorkspace(true);
    window.addEventListener('focus', validateOnFocus);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('focus', validateOnFocus);
      void staffSupabase.removeChannel(channel);
    };
  }, [workspace?.employee?.id, workspace?.business?.id]);

  const resolveLegacyRoute = async () => {
    setLoading(true);
    const { data, error } = await staffSupabase.rpc('staff_resolve_portal');
    if (error || !data?.business_slug) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    navigate(`/staff/${data.business_slug}`, { replace: true });
  };

  const loadPublicBusiness = async () => {
    const { data } = await staffSupabase
      .from('businesses')
      .select('id,slug,name,logo_url,address,phone,email,status')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    setPublicBusiness(data ?? null);
  };

  const loadWorkspace = async (silent = false) => {
    if (!slug || !user) return;
    if (silent) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await staffSupabase.rpc('staff_get_workspace', {
      p_business_slug: slug,
    });

    if (error || !data) {
      console.error('Staff workspace load failed', error);
      setWorkspace(null);
      setAccessDenied(true);
      if (!silent) toast.error(t('staffPortal.messages.loadFailed'));
    } else {
      setWorkspace(data as Workspace);
      setAccessDenied(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const appointments = workspace?.appointments ?? [];
  const customers = workspace?.customers ?? [];
  const selectedCustomer = customers.find((customer) => customer.id === createForm.customer_id) ?? null;
  const todayAppointments = useMemo(
    () => appointments.filter((appointment) => isToday(parseISO(appointment.start_time))),
    [appointments]
  );
  const nextAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) =>
          new Date(appointment.start_time).getTime() > Date.now() &&
          ACTIVE_STATUSES.has(appointment.status)
      ) ?? null,
    [appointments]
  );

  const stats = useMemo(() => ({
    today: todayAppointments.length,
    completed: todayAppointments.filter((item) => item.status === 'completed').length,
    remaining: todayAppointments.filter((item) => ACTIVE_STATUSES.has(item.status)).length,
    minutes: todayAppointments.reduce((sum, item) => sum + Number(item.total_duration || 0), 0),
  }), [todayAppointments]);

  const events = useMemo(
    () =>
      appointments.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.customer?.full_name || t('staffPortal.appointment.walkIn')} · ${serviceNames(appointment)}`,
        start: appointment.start_time,
        end: appointment.end_time,
        classNames: [`staff-event-${appointment.status}`],
        extendedProps: { appointment },
      })),
    [appointments, t]
  );

  const sendMagicLink = async () => {
    if (!email.trim()) {
      toast.error(t('staffPortal.access.emailRequired'));
      return;
    }
    setLinkSending(true);
    const { error } = await staffSupabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/staff/${slug}${searchParams.get('employee') ? `?employee=${encodeURIComponent(searchParams.get('employee') || '')}` : ''}`,
      },
    });
    setLinkSending(false);
    if (error) toast.error(error.message || t('staffPortal.access.linkFailed'));
    else toast.success(t('staffPortal.access.linkSent'));
  };

  const openAppointment = (appointment: any) => {
    setSelectedAppointment(appointment);
    setRescheduleDate(format(parseISO(appointment.start_time), 'yyyy-MM-dd'));
    setRescheduleTime(format(parseISO(appointment.start_time), 'HH:mm'));
    setAppointmentNotes(appointment.notes || '');
    setDetailsOpen(true);
  };

  const updateStatus = async (status: AppointmentStatus) => {
    if (!selectedAppointment) return;
    setSaving(true);
    const { error } = await staffSupabase.rpc('staff_update_own_appointment_status', {
      p_business_slug: slug,
      p_appointment_id: selectedAppointment.id,
      p_status: status,
    });
    setSaving(false);
    if (error) toast.error(error.message || t('staffPortal.messages.statusFailed'));
    else {
      toast.success(t('staffPortal.messages.statusUpdated'));
      await loadWorkspace(true);
      setDetailsOpen(false);
    }
  };

  const rescheduleAppointment = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) return;
    setSaving(true);
    const { error } = await staffSupabase.rpc('staff_reschedule_own_appointment', {
      p_business_slug: slug,
      p_appointment_id: selectedAppointment.id,
      p_local_date: rescheduleDate,
      p_local_time: rescheduleTime,
    });
    setSaving(false);
    if (error) toast.error(error.message || t('staffPortal.messages.rescheduleFailed'));
    else {
      toast.success(t('staffPortal.messages.rescheduled'));
      await loadWorkspace(true);
      setDetailsOpen(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedAppointment) return;
    setSaving(true);
    const { error } = await staffSupabase.rpc('staff_update_own_appointment_notes', {
      p_business_slug: slug,
      p_appointment_id: selectedAppointment.id,
      p_notes: appointmentNotes,
    });
    setSaving(false);
    if (error) toast.error(error.message || t('staffPortal.messages.notesFailed'));
    else {
      toast.success(t('staffPortal.messages.notesSaved'));
      await loadWorkspace(true);
    }
  };

  const cancelAppointment = async () => {
    if (!selectedAppointment || !window.confirm(t('staffPortal.appointment.confirmCancel'))) return;
    setSaving(true);
    const { error } = await staffSupabase.rpc('staff_cancel_own_appointment', {
      p_business_slug: slug,
      p_appointment_id: selectedAppointment.id,
      p_reason: appointmentNotes || null,
    });
    setSaving(false);
    if (error) toast.error(error.message || t('staffPortal.messages.cancelFailed'));
    else {
      toast.success(t('staffPortal.messages.cancelled'));
      await loadWorkspace(true);
      setDetailsOpen(false);
    }
  };

  const selectCustomer = (customer: any) => {
    setCreateForm((current) => ({
      ...current,
      customer_id: customer.id,
      customer_name: customer.full_name || '',
      customer_email: customer.email || '',
      customer_phone: customer.phone || '',
    }));
    setCustomerPickerOpen(false);
  };

  const useNewCustomer = () => {
    setCreateForm((current) => ({
      ...current,
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
    }));
    setCustomerPickerOpen(false);
  };

  const createAppointment = async () => {
    if (!createForm.customer_name.trim() || createForm.service_ids.length === 0 || !createForm.date || !createForm.time) {
      toast.error(t('staffPortal.create.required'));
      return;
    }
    setSaving(true);
    const { error } = await staffSupabase.rpc('staff_create_own_appointment_v2', {
      p_business_slug: slug,
      p_customer_id: createForm.customer_id || null,
      p_customer_name: createForm.customer_name.trim(),
      p_customer_email: createForm.customer_email.trim() || null,
      p_customer_phone: createForm.customer_phone.trim() || null,
      p_service_ids: createForm.service_ids,
      p_local_date: createForm.date,
      p_local_time: createForm.time,
      p_notes: createForm.notes.trim() || null,
    });
    setSaving(false);
    if (error) toast.error(error.message || t('staffPortal.messages.createFailed'));
    else {
      toast.success(t('staffPortal.messages.created'));
      setCreateOpen(false);
      setCreateForm({ ...EMPTY_CREATE_FORM, service_ids: [] });
      await loadWorkspace(true);
    }
  };

  const handleSignOut = async () => {
    await staffSupabase.auth.signOut();
    setWorkspace(null);
  };

  if (loading || authLoading) {
    return <StaffCenteredState business={publicBusiness} text={t('staffPortal.states.loading')} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f5f3ff_100%)] px-4 py-6 sm:py-10">
        <PageMeta title={`${publicBusiness?.name || 'Velliqo'} Staff`} description={t('staffPortal.access.description')} />
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <Brand business={publicBusiness} />
            <LanguageSwitcher />
          </div>
          <div className="grid overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-2xl shadow-primary/10 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative hidden min-h-[620px] overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
              <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/35 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="relative">
                <Badge className="rounded-full border-white/15 bg-white/10 px-4 py-2 text-white hover:bg-white/10">
                  <Sparkles className="mr-2 h-4 w-4" />{t('staffPortal.access.premiumBadge')}
                </Badge>
                <h1 className="mt-8 max-w-xl text-4xl font-black leading-tight xl:text-5xl">{t('staffPortal.access.premiumTitle')}</h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">{t('staffPortal.access.premiumDescription')}</p>
              </div>
              <div className="relative grid gap-4 sm:grid-cols-2">
                <PremiumFeature icon={<CalendarDays className="h-5 w-5" />} title={t('staffPortal.access.features.schedule')} description={t('staffPortal.access.features.scheduleDescription')} />
                <PremiumFeature icon={<RefreshCw className="h-5 w-5" />} title={t('staffPortal.access.features.sync')} description={t('staffPortal.access.features.syncDescription')} />
                <PremiumFeature icon={<ShieldCheck className="h-5 w-5" />} title={t('staffPortal.access.features.secure')} description={t('staffPortal.access.features.secureDescription')} />
                <PremiumFeature icon={<Download className="h-5 w-5" />} title={t('staffPortal.access.features.install')} description={t('staffPortal.access.features.installDescription')} />
              </div>
            </div>
            <div className="flex min-h-[620px] items-center p-5 sm:p-10 lg:p-12">
              <Card className="w-full overflow-hidden rounded-3xl border-slate-200/80 bg-white shadow-xl shadow-slate-200/60">
                <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary/90 px-6 py-8 text-white sm:px-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><ShieldCheck className="h-7 w-7" /></div>
                  <h2 className="mt-6 text-2xl font-black sm:text-3xl">{t('staffPortal.access.title')}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{t('staffPortal.access.description')}</p>
                </div>
                <CardContent className="space-y-5 p-6 sm:p-8">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                    <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><strong>{t('staffPortal.access.oneTimeTitle')}</strong><div className="mt-1 text-emerald-800">{t('staffPortal.access.oneTimeDescription')}</div></div></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-email">{t('staffPortal.access.email')}</Label>
                    <Input id="staff-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 rounded-xl" />
                  </div>
                  <Button className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20" disabled={linkSending} onClick={() => void sendMagicLink()}>
                    <Mail className="mr-2 h-4 w-4" />{linkSending ? t('staffPortal.access.sending') : t('staffPortal.access.sendLink')}
                  </Button>
                  <p className="text-center text-xs leading-5 text-muted-foreground">{t('staffPortal.access.securityNote')}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace || accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex items-center justify-between"><Brand business={publicBusiness} /><LanguageSwitcher /></div>
          <Card className="rounded-3xl text-center shadow-card">
            <CardContent className="p-8">
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="mt-5 text-2xl font-black">{t('staffPortal.states.accessRevokedTitle')}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('staffPortal.states.accessRevokedDescription')}</p>
              <Button variant="outline" className="mt-6" onClick={() => void handleSignOut()}>{t('staffPortal.actions.signOut')}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%,#f5f3ff_100%)]">
      <PageMeta title={`${workspace.business.name} Staff`} description={t('staffPortal.hero.description')} />
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <Brand business={workspace.business} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {pwa.isInstalled ? (
              <Badge variant="secondary" className="hidden rounded-full px-3 py-1.5 sm:inline-flex"><Check className="mr-1.5 h-3.5 w-3.5" />{t('staffPortal.install.installed')}</Badge>
            ) : pwa.canInstall ? (
              <Button variant="outline" size="icon" onClick={() => void pwa.install()} aria-label={t('staffPortal.actions.install')}><Download className="h-4 w-4" /></Button>
            ) : null}
            <Button variant="outline" size="icon" disabled={refreshing} onClick={() => void loadWorkspace(true)} aria-label={t('staffPortal.actions.refresh')}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void handleSignOut()} aria-label={t('staffPortal.actions.signOut')}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.42),transparent_42%)]" />
            <div className="relative flex items-center gap-4">
              {workspace.employee.photo_url ? (
                <img src={workspace.employee.photo_url} alt={workspace.employee.name} className="h-16 w-16 rounded-2xl object-cover shadow-sm sm:h-20 sm:w-20" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-2xl font-black text-white shadow-lg shadow-primary/25 sm:h-20 sm:w-20">{workspace.employee.name.charAt(0).toUpperCase()}</div>
              )}
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">{format(new Date(), 'EEEE, d MMMM')}</div>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">{t('staffPortal.hero.greeting', { name: workspace.employee.name })}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t('staffPortal.hero.description')}</p>
              </div>
            </div>
            <Button className="relative h-12 rounded-xl px-5" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />{t('staffPortal.create.action')}
            </Button>
          </div>
        </section>

        {!pwa.isInstalled && (
          <section className="overflow-hidden rounded-3xl border border-primary/15 bg-white shadow-xl shadow-primary/5">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Smartphone className="h-6 w-6" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{t('staffPortal.install.title')}</h2><Badge variant="secondary" className="rounded-full">{workspace.employee.name}</Badge></div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t('staffPortal.install.description')}</p>
                  {pwa.needsManualIOSInstall && <p className="mt-2 text-xs font-semibold text-primary">{t('staffPortal.install.iosInstructions')}</p>}
                  {!pwa.canInstall && !pwa.needsManualIOSInstall && <p className="mt-2 text-xs text-muted-foreground">{t('staffPortal.install.browserInstructions')}</p>}
                </div>
              </div>
              {pwa.canInstall && <Button className="h-11 rounded-xl px-5" onClick={() => void pwa.install()}><Download className="mr-2 h-4 w-4" />{t('staffPortal.install.action')}</Button>}
            </div>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<CalendarDays className="h-5 w-5" />} label={t('staffPortal.stats.today')} value={stats.today} />
          <Metric icon={<CheckCircle2 className="h-5 w-5" />} label={t('staffPortal.stats.completed')} value={stats.completed} />
          <Metric icon={<Sparkles className="h-5 w-5" />} label={t('staffPortal.stats.remaining')} value={stats.remaining} />
          <Metric icon={<Clock3 className="h-5 w-5" />} label={t('staffPortal.stats.bookedTime')} value={formatMinutes(stats.minutes, t)} />
        </section>

        {nextAppointment && (
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:flex sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-primary">{t('staffPortal.next.title')}</div>
              <div className="mt-1 font-bold">{formatAppointmentTime(nextAppointment, i18n.language)} · {nextAppointment.customer?.full_name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{serviceNames(nextAppointment)}</div>
            </div>
            <Button variant="outline" className="mt-3 sm:mt-0" onClick={() => openAppointment(nextAppointment)}>{t('staffPortal.appointment.open')}</Button>
          </section>
        )}

        <section className="rounded-3xl border bg-white p-3 shadow-sm sm:p-5">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={window.matchMedia('(max-width: 767px)').matches ? 'listWeek' : 'timeGridWeek'}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,listWeek' }}
            buttonText={{ today: t('staffPortal.calendar.today'), day: t('staffPortal.calendar.day'), week: t('staffPortal.calendar.week'), list: t('staffPortal.calendar.list') }}
            allDaySlot={false}
            nowIndicator
            editable={false}
            selectable
            selectMirror
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            events={events}
            eventClick={(info) => openAppointment(info.event.extendedProps.appointment)}
            dateClick={(info) => {
              setCreateForm((current) => ({ ...current, date: format(info.date, 'yyyy-MM-dd'), time: format(info.date, 'HH:mm') }));
              setCreateOpen(true);
            }}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ContactCard icon={<MapPin className="h-5 w-5" />} title={t('staffPortal.business.location')} value={workspace.business.address} href={workspace.business.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(workspace.business.address)}` : undefined} />
          <ContactCard icon={<Phone className="h-5 w-5" />} title={t('staffPortal.business.phone')} value={workspace.business.phone} href={workspace.business.phone ? `tel:${workspace.business.phone}` : undefined} />
          <ContactCard icon={<Mail className="h-5 w-5" />} title={t('staffPortal.business.email')} value={workspace.business.email} href={workspace.business.email ? `mailto:${workspace.business.email}` : undefined} />
        </section>
      </main>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedAppointment && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAppointment.customer?.full_name || t('staffPortal.appointment.walkIn')}</SheetTitle>
                <SheetDescription>{formatAppointmentTime(selectedAppointment, i18n.language)} · {serviceNames(selectedAppointment)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge>{t(STATUS_KEYS[selectedAppointment.status] || 'staffPortal.status.pending')}</Badge>
                  <Badge variant="outline">{t('staffPortal.appointment.duration', { minutes: selectedAppointment.total_duration })}</Badge>
                  {selectedAppointment.booking_reference && <Badge variant="secondary">#{selectedAppointment.booking_reference}</Badge>}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ContactCard icon={<Phone className="h-4 w-4" />} title={t('staffPortal.appointment.customerPhone')} value={selectedAppointment.customer?.phone} href={selectedAppointment.customer?.phone ? `tel:${selectedAppointment.customer.phone}` : undefined} compact />
                  <ContactCard icon={<Mail className="h-4 w-4" />} title={t('staffPortal.appointment.customerEmail')} value={selectedAppointment.customer?.email} href={selectedAppointment.customer?.email ? `mailto:${selectedAppointment.customer.email}` : undefined} compact />
                </div>

                <div className="space-y-3">
                  <Label>{t('staffPortal.appointment.updateStatus')}</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(['confirmed', 'arrived', 'in_progress', 'completed', 'no_show'] as AppointmentStatus[]).map((status) => (
                      <Button key={status} variant={selectedAppointment.status === status ? 'default' : 'outline'} disabled={saving} onClick={() => void updateStatus(status)}>{t(STATUS_KEYS[status])}</Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border p-4">
                  <Label>{t('staffPortal.appointment.reschedule')}</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
                    <Input type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} />
                  </div>
                  <Button variant="outline" disabled={saving} onClick={() => void rescheduleAppointment()}>{t('staffPortal.appointment.applyReschedule')}</Button>
                </div>

                <div className="space-y-3">
                  <Label>{t('staffPortal.appointment.notes')}</Label>
                  <Textarea rows={5} value={appointmentNotes} onChange={(event) => setAppointmentNotes(event.target.value)} />
                  <Button variant="outline" disabled={saving} onClick={() => void saveNotes()}>{t('staffPortal.appointment.saveNotes')}</Button>
                </div>

                <Button variant="destructive" className="w-full" disabled={saving} onClick={() => void cancelAppointment()}>{t('staffPortal.appointment.cancel')}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t('staffPortal.create.title')}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.05] to-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4"><div><Label>{t('staffPortal.create.customerPickerLabel')}</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('staffPortal.create.customerPickerDescription')}</p></div><Badge variant="secondary" className="rounded-full">{t('staffPortal.create.customerCount', { count: customers.length })}</Badge></div>
              <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={customerPickerOpen} className="mt-4 h-auto min-h-12 w-full justify-between rounded-xl bg-white px-4 py-3 text-left font-normal">
                    {selectedCustomer ? <span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{selectedCustomer.full_name?.charAt(0)?.toUpperCase() || '?'}</span><span className="min-w-0"><span className="block truncate font-bold text-foreground">{selectedCustomer.full_name}</span><span className="block truncate text-xs text-muted-foreground">{selectedCustomer.phone || selectedCustomer.email || t('staffPortal.create.noContact')}</span></span></span> : <span className="flex items-center gap-2 text-muted-foreground"><Search className="h-4 w-4" />{t('staffPortal.create.customerPickerPlaceholder')}</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(92vw,520px)] rounded-2xl p-0 shadow-2xl">
                  <Command><CommandInput placeholder={t('staffPortal.create.customerSearchPlaceholder')} /><CommandList className="max-h-72"><CommandEmpty>{t('staffPortal.create.customerEmpty')}</CommandEmpty><CommandGroup>
                    <CommandItem value={t('staffPortal.create.newCustomer')} onSelect={useNewCustomer} className="m-1 rounded-xl py-3"><span className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Plus className="h-4 w-4" /></span><span><span className="block font-bold">{t('staffPortal.create.newCustomer')}</span><span className="block text-xs text-muted-foreground">{t('staffPortal.create.newCustomerDescription')}</span></span></CommandItem>
                    {customers.map((customer) => <CommandItem key={customer.id} value={`${customer.full_name} ${customer.email || ''} ${customer.phone || ''}`} onSelect={() => selectCustomer(customer)} className="m-1 rounded-xl py-3"><span className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{customer.full_name?.charAt(0)?.toUpperCase() || '?'}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{customer.full_name}</span><span className="block truncate text-xs text-muted-foreground">{customer.phone || customer.email || t('staffPortal.create.noContact')}</span></span><Check className={`h-4 w-4 ${createForm.customer_id === customer.id ? 'opacity-100' : 'opacity-0'}`} /></CommandItem>)}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('staffPortal.create.customerName')}><Input value={createForm.customer_name} onChange={(event) => setCreateForm({ ...createForm, customer_name: event.target.value })} /></Field>
              <Field label={t('staffPortal.create.customerPhone')}><Input type="tel" value={createForm.customer_phone} onChange={(event) => setCreateForm({ ...createForm, customer_phone: event.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label={t('staffPortal.create.customerEmail')}><Input type="email" value={createForm.customer_email} onChange={(event) => setCreateForm({ ...createForm, customer_email: event.target.value })} /></Field></div>
            </div>

            <div className="space-y-2">
              <Label>{t('staffPortal.create.services')}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {workspace.services.map((service) => {
                  const checked = createForm.service_ids.includes(service.id);
                  return (
                    <label key={service.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${checked ? 'border-primary bg-primary/5' : ''}`}>
                      <Checkbox checked={checked} onCheckedChange={(value) => setCreateForm((current) => ({ ...current, service_ids: value === true ? [...current.service_ids, service.id] : current.service_ids.filter((id) => id !== service.id) }))} />
                      <div><div className="font-semibold">{service.name}</div><div className="text-xs text-muted-foreground">{service.duration} min</div></div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('staffPortal.create.date')}><Input type="date" value={createForm.date} onChange={(event) => setCreateForm({ ...createForm, date: event.target.value })} /></Field>
              <Field label={t('staffPortal.create.time')}><Input type="time" value={createForm.time} onChange={(event) => setCreateForm({ ...createForm, time: event.target.value })} /></Field>
            </div>
            <Field label={t('staffPortal.create.notes')}><Textarea rows={4} value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={saving} onClick={() => void createAppointment()}>{saving ? t('staffPortal.create.saving') : t('staffPortal.create.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function PremiumFeature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-violet-200">{icon}</div><div className="mt-3 font-bold">{title}</div><p className="mt-1 text-xs leading-5 text-slate-400">{description}</p></div>;
}

function Brand({ business }: { business: any }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {business?.logo_url ? <img src={business.logo_url} alt={business.name} className="h-10 w-10 rounded-xl object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-black text-white">{String(business?.name || 'V').charAt(0)}</div>}
      <div className="min-w-0"><div className="truncate font-black">{business?.name || 'Velliqo'}</div><div className="text-xs text-muted-foreground">Staff App</div></div>
    </div>
  );
}

function StaffCenteredState({ business, text }: { business: any; text: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><Brand business={business} /><div className="mt-6 text-sm text-muted-foreground">{text}</div></div></div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="text-xl font-black">{value}</div></div></div></div>;
}

function ContactCard({ icon, title, value, href, compact = false }: { icon: React.ReactNode; title: string; value?: string | null; href?: string; compact?: boolean }) {
  const content = <div className={`rounded-2xl border bg-white ${compact ? 'p-3' : 'p-4'} shadow-sm`}><div className="flex gap-3"><div className="mt-0.5 text-primary">{icon}</div><div className="min-w-0"><div className="text-xs font-semibold text-muted-foreground">{title}</div><div className="mt-1 break-words text-sm font-bold">{value || '—'}</div></div></div></div>;
  return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{content}</a> : content;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function serviceNames(appointment: any) {
  return (appointment.services ?? []).map((service: any) => service.name).filter(Boolean).join(', ') || 'Appointment';
}

function formatAppointmentTime(appointment: any, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(parseISO(appointment.start_time));
}

function formatMinutes(minutes: number, t: (key: string, options?: any) => string) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t('staffPortal.stats.minutes', { count: rest });
  if (!rest) return t('staffPortal.stats.hours', { count: hours });
  return t('staffPortal.stats.hoursMinutes', { hours, minutes: rest });
}
