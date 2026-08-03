import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, isToday, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useStaffPWA } from '@/hooks/useStaffPWA';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  CheckCircle2,
  Clock3,
  Download,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';

type Workspace = {
  business: any;
  employee: any;
  services: any[];
  appointments: any[];
};

type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'no_show';

const EMPTY_CREATE_FORM = {
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
  const { user, loading: authLoading } = useAuth();

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
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [saving, setSaving] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const pwa = useStaffPWA(workspace?.business || publicBusiness);

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

    const channel = supabase
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
      void supabase.removeChannel(channel);
    };
  }, [workspace?.employee?.id, workspace?.business?.id]);

  const resolveLegacyRoute = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('staff_resolve_portal');
    if (error || !data?.business_slug) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    navigate(`/staff/${data.business_slug}`, { replace: true });
  };

  const loadPublicBusiness = async () => {
    const { data } = await supabase
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

    const { data, error } = await supabase.rpc('staff_get_workspace', {
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
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/staff/${slug}`,
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
    const { error } = await supabase.rpc('staff_update_own_appointment_status', {
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
    const { error } = await supabase.rpc('staff_reschedule_own_appointment', {
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
    const { error } = await supabase.rpc('staff_update_own_appointment_notes', {
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
    const { error } = await supabase.rpc('staff_cancel_own_appointment', {
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

  const createAppointment = async () => {
    if (!createForm.customer_name.trim() || createForm.service_ids.length === 0 || !createForm.date || !createForm.time) {
      toast.error(t('staffPortal.create.required'));
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('staff_create_own_appointment', {
      p_business_slug: slug,
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
      setCreateForm(EMPTY_CREATE_FORM);
      await loadWorkspace(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setWorkspace(null);
  };

  if (loading || authLoading) {
    return <StaffCenteredState business={publicBusiness} text={t('staffPortal.states.loading')} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <PageMeta title={`${publicBusiness?.name || 'Velliqo'} Staff`} description={t('staffPortal.access.description')} />
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Brand business={publicBusiness} />
            <LanguageSwitcher />
          </div>
          <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-xl shadow-slate-200/60">
            <div className="bg-slate-950 px-6 py-8 text-white">
              <ShieldCheck className="h-10 w-10" />
              <h1 className="mt-5 text-2xl font-black">{t('staffPortal.access.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">{t('staffPortal.access.description')}</p>
            </div>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="staff-email">{t('staffPortal.access.email')}</Label>
                <Input id="staff-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 rounded-xl" />
              </div>
              <Button className="h-12 w-full rounded-xl" disabled={linkSending} onClick={() => void sendMagicLink()}>
                <Mail className="mr-2 h-4 w-4" />
                {linkSending ? t('staffPortal.access.sending') : t('staffPortal.access.sendLink')}
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">{t('staffPortal.access.securityNote')}</p>
            </CardContent>
          </Card>
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
    <div className="min-h-screen bg-slate-50">
      <PageMeta title={`${workspace.business.name} Staff`} description={t('staffPortal.hero.description')} />
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <Brand business={workspace.business} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {pwa.canInstall && (
              <Button variant="outline" size="icon" onClick={() => void pwa.install()} aria-label={t('staffPortal.actions.install')}>
                <Download className="h-4 w-4" />
              </Button>
            )}
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
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_38%)]" />
            <div className="relative flex items-center gap-4">
              {workspace.employee.photo_url ? (
                <img src={workspace.employee.photo_url} alt={workspace.employee.name} className="h-16 w-16 rounded-2xl object-cover shadow-sm sm:h-20 sm:w-20" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-black text-primary sm:h-20 sm:w-20">{workspace.employee.name.charAt(0).toUpperCase()}</div>
              )}
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">{format(new Date(), 'EEEE, d MMMM')}</div>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">{t('staffPortal.hero.greeting', { name: workspace.employee.name })}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t('staffPortal.hero.description')}</p>
              </div>
            </div>
            <Button className="relative h-12 rounded-xl px-5" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />{t('staffPortal.create.action')}
            </Button>
          </div>
        </section>

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
