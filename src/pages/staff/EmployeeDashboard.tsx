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
import { useIsMobile } from '@/hooks/use-mobile';
import { staffSupabase } from '@/db/staffSupabase';
import { StaffInstallDialog } from '@/components/staff/StaffInstallDialog';
import { StaffProfileSheet } from '@/components/staff/StaffProfileSheet';
import { StaffTrainingDialog } from '@/components/training/StaffTrainingDialog';
import { getTrustedDeviceCredentials, registerTrustedDevice, revokeTrustedDevice, trustedDeviceSignIn } from '@/staff/trustedDevice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
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
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
  CheckCircle2,
  Clock3,
  Download,
  List,
  LogOut,
  KeyRound,
  MoreHorizontal,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  GraduationCap,
  UserRound,
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
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useStaffAuth();
  const calendarRef = React.useRef<FullCalendar | null>(null);
  const calendarSectionRef = React.useRef<HTMLElement | null>(null);

  const [slug, setSlug] = useState(routeSlug || '');
  const [publicBusiness, setPublicBusiness] = useState<any>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [email, setEmail] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [emailSigningIn, setEmailSigningIn] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResendSeconds, setOtpResendSeconds] = useState(0);
  const [trustedSigningIn, setTrustedSigningIn] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [calendarTitle, setCalendarTitle] = useState('');
  const [calendarView, setCalendarView] = useState('timeGridWeek');
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [saving, setSaving] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const employeeParam = searchParams.get('employee')?.replace(/[^a-z0-9-]/gi, '').slice(0, 120) || '';
  const pwaEmployee = workspace?.employee || (employeeParam ? { id: employeeParam, name: t('staffPortal.access.staffFallbackName') } : null);
  const pwa = useStaffPWA(workspace?.business || publicBusiness, pwaEmployee);
  const trustedDeviceAvailable = Boolean(employeeParam && getTrustedDeviceCredentials(employeeParam));

  useEffect(() => {
    if (otpResendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setOtpResendSeconds((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [otpResendSeconds]);

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
    if (!workspace || !calendarRef.current) return;
    const api = calendarRef.current.getApi();
    const preferredView = isMobile ? 'listWeek' : 'timeGridWeek';
    if (api.view.type !== preferredView) api.changeView(preferredView);
  }, [isMobile, workspace?.employee?.id]);

  useEffect(() => {
    if (!workspace?.employee?.id || !workspace?.business?.slug) return;
    void registerTrustedDevice({
      businessSlug: workspace.business.slug,
      employeeId: workspace.employee.id,
      employeeName: workspace.employee.name,
    }).catch((error) => console.error('Unable to register trusted staff device', error));
  }, [workspace?.employee?.id, workspace?.business?.slug]);

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
      .select('id,slug,name,logo_url,cover_image_url,description,address,phone,email,status')
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

  const requestEmailOtp = async (normalizedEmail = email.trim().toLowerCase()) => {
    if (!normalizedEmail) {
      toast.error(t('staffPortal.access.emailRequired'));
      return false;
    }

    setOtpSending(true);
    const { error } = await staffSupabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
      },
    });
    setOtpSending(false);

    if (error) {
      toast.error(error.message || t('staffPortal.access.linkFailed'));
      return false;
    }

    setOtpEmail(normalizedEmail);
    setOtpCode('');
    setOtpRequested(true);
    setOtpResendSeconds(60);
    toast.success(t('staffPortal.access.otpSent'));
    return true;
  };

  const verifyEmailOtp = async (code = otpCode) => {
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (!otpEmail || normalizedCode.length !== 6 || !employeeParam) {
      toast.error(t('staffPortal.access.otpInvalid'));
      return;
    }

    setOtpVerifying(true);
    try {
      const { data: verification, error: verifyError } = await staffSupabase.auth.verifyOtp({
        email: otpEmail,
        token: normalizedCode,
        type: 'email',
      });

      if (
        verifyError ||
        !verification.user ||
        String(verification.user.email || '').trim().toLowerCase() !== otpEmail
      ) {
        throw verifyError ?? new Error('STAFF_OTP_VERIFICATION_FAILED');
      }

      // Re-check business/employee authorization after the OTP creates a session.
      // This prevents access if the owner disabled the employee between request and verification.
      const { data: access, error: accessError } = await staffSupabase.functions.invoke('staff-email-auth', {
        body: {
          business_slug: slug,
          employee_id: employeeParam,
          email: otpEmail,
        },
      });

      if (accessError || access?.error || !access?.authenticated) {
        await staffSupabase.auth.signOut({ scope: 'local' });
        throw new Error(access?.error || accessError?.message || 'STAFF_EMAIL_NOT_APPROVED');
      }

      setEmail(otpEmail);
      setOtpRequested(false);
      setOtpCode('');
      toast.success(t('staffPortal.access.signedIn'));
    } catch (error) {
      console.error('Staff email OTP verification failed', error);
      toast.error(t('staffPortal.access.otpInvalid'));
    } finally {
      setOtpVerifying(false);
    }
  };

  const useDifferentEmail = () => {
    setOtpRequested(false);
    setOtpEmail('');
    setOtpCode('');
    setOtpResendSeconds(0);
  };

  const signInOnTrustedDevice = async (normalizedEmail = email.trim().toLowerCase()) => {
    if (!normalizedEmail) {
      toast.error(t('staffPortal.access.emailRequired'));
      return false;
    }
    if (!employeeParam || !getTrustedDeviceCredentials(employeeParam)) {
      return false;
    }
    setTrustedSigningIn(true);
    try {
      await trustedDeviceSignIn({ businessSlug: slug, employeeId: employeeParam, email: normalizedEmail });
      toast.success(t('staffPortal.access.signedIn'));
      return true;
    } catch (error: any) {
      console.error('Trusted staff sign-in failed', error);
      return false;
    } finally {
      setTrustedSigningIn(false);
    }
  };

  const continueWithEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error(t('staffPortal.access.emailRequired'));
      return;
    }
    if (!employeeParam) {
      toast.error(t('staffPortal.access.invalidLink'));
      return;
    }

    setEmailSigningIn(true);
    try {
      const { data: access, error: accessError } = await staffSupabase.functions.invoke('staff-email-auth', {
        body: {
          business_slug: slug,
          employee_id: employeeParam,
          email: normalizedEmail,
        },
      });

      if (accessError || access?.error) {
        throw new Error(access?.error || accessError?.message || 'STAFF_EMAIL_NOT_APPROVED');
      }

      // A currently authenticated Supabase session is the strongest proof that
      // the person using this browser owns the approved staff account.
      if (access?.authenticated) {
        await loadWorkspace();
        toast.success(t('staffPortal.access.signedIn'));
        return;
      }

      // After one successful email verification, a local device credential may
      // establish the staff session without another authorization email.
      if (trustedDeviceAvailable && await signInOnTrustedDevice(normalizedEmail)) return;

      // Every untrusted phone, tablet or computer may authenticate independently.
      // The approved staff mailbox receives a short-lived one-time code; after
      // verification this device receives its own Supabase session and may then
      // be registered as trusted without invalidating any other device.
      await requestEmailOtp(normalizedEmail);
    } catch (error: any) {
      console.error('Staff email sign-in failed', error);
      toast.error(t('staffPortal.access.emailNotApproved'));
    } finally {
      setEmailSigningIn(false);
    }
  };

  const calendarNavigate = (direction: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (direction === 'prev') api.prev();
    if (direction === 'next') api.next();
    if (direction === 'today') api.today();
  };

  const changeCalendarView = (view: 'timeGridDay' | 'timeGridWeek' | 'listWeek') => {
    calendarRef.current?.getApi().changeView(view);
  };

  const scrollToSchedule = () => {
    calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    await staffSupabase.auth.signOut({ scope: 'local' });
    setWorkspace(null);
    toast.success(t('staffPortal.access.signedOutTrusted'));
  };

  const forgetThisDevice = async () => {
    if (!workspace?.employee?.id || !workspace?.business?.slug) return;
    try {
      await revokeTrustedDevice({ businessSlug: workspace.business.slug, employeeId: workspace.employee.id });
    } catch (error) {
      console.error('Unable to revoke trusted device', error);
    } finally {
      await staffSupabase.auth.signOut({ scope: 'local' });
      setWorkspace(null);
      setProfileOpen(false);
      toast.success(t('staffPortal.profile.deviceForgotten'));
    }
  };

  if (loading || authLoading) {
    return <StaffCenteredState business={publicBusiness} text={t('staffPortal.states.loading')} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen overflow-hidden bg-slate-950">
        <PageMeta title={`${publicBusiness?.name || 'Velliqo'} Staff`} description={t('staffPortal.access.description')} />
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(124,58,237,0.34),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(217,70,239,0.18),transparent_24%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#111827_100%)]" />
          {publicBusiness?.cover_image_url && <img src={publicBusiness.cover_image_url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10] mix-blend-luminosity" />}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />

          <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-5 sm:px-6 lg:px-8">
            <header className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-xl sm:px-5">
              <Brand business={publicBusiness} inverted />
              <div className="flex items-center gap-2">
                {pwaEmployee && !pwa.isInstalled && (
                  <Button variant="ghost" className="hidden border border-white/10 bg-white/[0.06] text-white hover:bg-white/10 hover:text-white sm:inline-flex" onClick={() => setInstallOpen(true)}>
                    <Download className="mr-2 h-4 w-4" />{t('staffPortal.install.action')}
                  </Button>
                )}
                <div className="rounded-xl bg-white"><LanguageSwitcher compact /></div>
              </div>
            </header>

            <main className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:py-12">
              <section className="hidden lg:block">
                <Badge className="rounded-full border-violet-300/20 bg-violet-400/10 px-4 py-2 text-violet-100 hover:bg-violet-400/10">
                  <Sparkles className="mr-2 h-4 w-4" />{t('staffPortal.access.premiumBadge')}
                </Badge>
                <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[1.04] tracking-tight text-white xl:text-6xl">{t('staffPortal.access.landingTitle')}</h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{t('staffPortal.access.landingDescription')}</p>

                <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-2">
                  <PremiumFeature icon={<CalendarDays className="h-5 w-5" />} title={t('staffPortal.access.features.schedule')} description={t('staffPortal.access.features.scheduleDescription')} />
                  <PremiumFeature icon={<RefreshCw className="h-5 w-5" />} title={t('staffPortal.access.features.sync')} description={t('staffPortal.access.features.syncDescription')} />
                  <PremiumFeature icon={<ShieldCheck className="h-5 w-5" />} title={t('staffPortal.access.features.secure')} description={t('staffPortal.access.features.secureDescription')} />
                  <PremiumFeature icon={<Smartphone className="h-5 w-5" />} title={t('staffPortal.access.features.install')} description={t('staffPortal.access.features.installDescription')} />
                </div>

                <div className="mt-8 flex max-w-2xl items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
                  {publicBusiness?.logo_url ? <img src={publicBusiness.logo_url} alt={publicBusiness.name} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/15" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white">{String(publicBusiness?.name || 'V').charAt(0)}</div>}
                  <div className="min-w-0">
                    <div className="truncate text-lg font-black text-white">{publicBusiness?.name || 'Velliqo'}</div>
                    <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{publicBusiness?.description || t('staffPortal.access.businessFallbackDescription')}</div>
                  </div>
                </div>
              </section>

              <section className="mx-auto w-full max-w-xl">
                <div className="mb-5 text-center lg:hidden">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-2xl">
                    {publicBusiness?.logo_url ? <img src={publicBusiness.logo_url} alt={publicBusiness.name} className="h-full w-full object-cover" /> : <ShieldCheck className="h-8 w-8 text-white" />}
                  </div>
                  <h1 className="mt-4 text-3xl font-black text-white">{t('staffPortal.access.mobileTitle')}</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t('staffPortal.access.mobileDescription')}</p>
                </div>

                <Card className="overflow-hidden rounded-[30px] border-white/70 bg-white shadow-2xl shadow-black/30">
                  <div className="border-b bg-gradient-to-br from-white via-white to-violet-50 px-6 py-7 sm:px-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">{t('staffPortal.access.personalWorkspace')}</Badge>
                        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{otpRequested ? t('staffPortal.access.otpTitle') : t('staffPortal.access.signInTitle')}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{otpRequested ? t('staffPortal.access.otpDescription', { email: otpEmail }) : trustedDeviceAvailable ? t('staffPortal.access.trustedReady') : t('staffPortal.access.verifyFirst')}</p>
                      </div>
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${otpRequested ? 'bg-violet-100 text-violet-700' : trustedDeviceAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                        {otpRequested ? <KeyRound className="h-6 w-6" /> : trustedDeviceAvailable ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                      </div>
                    </div>
                  </div>

                  <CardContent className="space-y-5 p-6 sm:p-8">
                    {!otpRequested ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="staff-email">{t('staffPortal.access.email')}</Label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                            <Input id="staff-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 rounded-xl pl-11" onKeyDown={(event) => { if (event.key === 'Enter') void continueWithEmail(); }} />
                          </div>
                        </div>

                        <Button className="h-12 w-full rounded-xl text-base font-black shadow-lg shadow-primary/20" disabled={emailSigningIn || trustedSigningIn || otpSending} onClick={() => void continueWithEmail()}>
                          <ShieldCheck className="mr-2 h-4 w-4" />{emailSigningIn || trustedSigningIn || otpSending ? t('staffPortal.access.signingIn') : t('staffPortal.access.signInEmail')}
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
                          <div className="font-black">{otpEmail}</div>
                          <div className="mt-1 text-xs leading-5 text-violet-700">{t('staffPortal.access.otpCodeLabel')}</div>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="staff-email-otp">{t('staffPortal.access.otpCodeLabel')}</Label>
                          <InputOTP
                            id="staff-email-otp"
                            maxLength={6}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={otpCode}
                            onChange={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))}
                            onComplete={(value) => void verifyEmailOtp(value)}
                            containerClassName="justify-center"
                          >
                            <InputOTPGroup className="gap-2">
                              {Array.from({ length: 6 }, (_, index) => (
                                <InputOTPSlot key={index} index={index} className="h-12 w-10 rounded-xl border sm:w-12" />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>

                        <Button className="h-12 w-full rounded-xl text-base font-black shadow-lg shadow-primary/20" disabled={otpVerifying || otpCode.length !== 6} onClick={() => void verifyEmailOtp()}>
                          <KeyRound className="mr-2 h-4 w-4" />{otpVerifying ? t('staffPortal.access.otpVerifying') : t('staffPortal.access.otpVerify')}
                        </Button>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Button type="button" variant="ghost" className="justify-start px-0 text-sm" onClick={useDifferentEmail}>
                            {t('staffPortal.access.otpDifferentEmail')}
                          </Button>
                          <Button type="button" variant="ghost" className="justify-start px-0 text-sm sm:justify-end" disabled={otpSending || otpResendSeconds > 0} onClick={() => void requestEmailOtp(otpEmail)}>
                            {otpResendSeconds > 0 ? t('staffPortal.access.otpResendIn', { seconds: otpResendSeconds }) : t('staffPortal.access.otpResend')}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                      <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><strong>{t('staffPortal.access.multiDeviceTitle')}</strong><div className="mt-1 text-emerald-800">{t('staffPortal.access.multiDeviceDescription')}</div></div></div>
                    </div>

                    {pwaEmployee && !pwa.isInstalled && (
                      <button type="button" onClick={() => setInstallOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left transition hover:bg-violet-100">
                        <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><Download className="h-5 w-5" /></span><span><span className="block text-sm font-black text-violet-950">{t('staffPortal.install.loginCardTitle')}</span><span className="block text-xs text-violet-700">{t('staffPortal.install.loginCardDescription')}</span></span></span>
                        <span className="text-violet-700">→</span>
                      </button>
                    )}
                  </CardContent>
                </Card>
              </section>
            </main>

            <div className="pb-2 text-center text-xs text-slate-500">{t('staffPortal.access.securityNote')}</div>
          </div>
        </div>

        {pwaEmployee && publicBusiness && (
          <StaffInstallDialog
            open={installOpen}
            onOpenChange={setInstallOpen}
            businessName={publicBusiness.name}
            employeeName={pwaEmployee.name}
            canPromptInstall={pwa.canInstall}
            isInstalled={pwa.isInstalled}
            needsManualIOSInstall={pwa.needsManualIOSInstall}
            onInstall={pwa.install}
          />
        )}
      </div>
    );
  }

  if (!workspace || accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex items-center justify-between gap-3"><Brand business={publicBusiness} /><LanguageSwitcher compact /></div>
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
      <a href="#staff-main" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-xl transition focus:translate-y-0">
        {t('staffPortal.accessibility.skipToWorkspace')}
      </a>
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-2 px-3 sm:px-6">
          <div className="min-w-0 max-w-[58vw] sm:max-w-none"><Brand business={workspace.business} /></div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher compact />
            <div className="hidden items-center gap-2 md:flex">
              {pwa.isInstalled ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1.5"><Check className="mr-1.5 h-3.5 w-3.5" />{t('staffPortal.install.installed')}</Badge>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setInstallOpen(true)}><Download className="mr-2 h-4 w-4" />{t('staffPortal.actions.install')}</Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setTrainingOpen(true)} aria-label={t('training.certification.staffTrainingTitle')}>
                <GraduationCap className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setProfileOpen(true)} aria-label={t('staffPortal.profile.open')}>
                <UserRound className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={refreshing} onClick={() => void loadWorkspace(true)} aria-label={t('staffPortal.actions.refresh')}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void handleSignOut()} aria-label={t('staffPortal.actions.signOut')}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main id="staff-main" className="mx-auto max-w-[1500px] scroll-mt-20 space-y-5 p-3 pb-28 sm:space-y-6 sm:p-6 sm:pb-8 lg:p-8">
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
            <Button className="relative h-12 w-full rounded-xl px-5 sm:w-auto" onClick={() => setCreateOpen(true)}>
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
              <Button className="h-11 rounded-xl px-5" onClick={() => setInstallOpen(true)}><Download className="mr-2 h-4 w-4" />{t('staffPortal.install.action')}</Button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric icon={<CalendarDays className="h-5 w-5" />} label={t('staffPortal.stats.today')} value={stats.today} />
          <Metric icon={<CheckCircle2 className="h-5 w-5" />} label={t('staffPortal.stats.completed')} value={stats.completed} />
          <Metric icon={<Sparkles className="h-5 w-5" />} label={t('staffPortal.stats.remaining')} value={stats.remaining} />
          <Metric icon={<Clock3 className="h-5 w-5" />} label={t('staffPortal.stats.bookedTime')} value={formatMinutes(stats.minutes, t)} />
        </section>

        <section className="overflow-hidden rounded-3xl border border-violet-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_55%,#ede9fe_100%)] shadow-sm">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-white shadow-lg shadow-violet-200"><GraduationCap className="h-6 w-6" /></div>
              <div>
                <div className="text-xs font-black uppercase tracking-[.16em] text-violet-700">{t('training.certification.staffEyebrow')}</div>
                <h2 className="mt-1 text-xl font-black text-slate-950">{t('training.certification.staffTrainingTitle')}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t('training.certification.staffTrainingCardDescription')}</p>
              </div>
            </div>
            <Button className="min-h-11 rounded-xl bg-violet-700 px-5 hover:bg-violet-800" onClick={() => setTrainingOpen(true)}><GraduationCap className="mr-2 h-4 w-4" />{t('training.certification.openTraining')}</Button>
          </div>
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

        <section ref={calendarSectionRef} id="staff-schedule" className="scroll-mt-20 overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50/80 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-primary">
                  <CalendarRange className="h-4 w-4" />{t('staffPortal.calendar.scheduleTitle')}
                </div>
                <h2 className="mt-1 break-words text-xl font-black sm:text-2xl">{calendarTitle || t('staffPortal.calendar.scheduleTitle')}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t('staffPortal.calendar.scheduleDescription')}</p>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between xl:justify-end">
                <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:flex">
                  <Button variant="outline" size="icon" className="rounded-xl" onClick={() => calendarNavigate('prev')} aria-label={t('staffPortal.calendar.previous')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="min-w-0 rounded-xl" onClick={() => calendarNavigate('today')}>{t('staffPortal.calendar.today')}</Button>
                  <Button variant="outline" size="icon" className="rounded-xl" onClick={() => calendarNavigate('next')} aria-label={t('staffPortal.calendar.next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 rounded-xl border bg-white p-1" role="tablist" aria-label={t('staffPortal.calendar.viewLabel')}>
                  <CalendarViewButton active={calendarView === 'timeGridDay'} icon={<CalendarDays className="h-4 w-4" />} label={t('staffPortal.calendar.day')} onClick={() => changeCalendarView('timeGridDay')} />
                  <CalendarViewButton active={calendarView === 'timeGridWeek'} icon={<CalendarRange className="h-4 w-4" />} label={t('staffPortal.calendar.week')} onClick={() => changeCalendarView('timeGridWeek')} />
                  <CalendarViewButton active={calendarView === 'listWeek'} icon={<List className="h-4 w-4" />} label={t('staffPortal.calendar.list')} onClick={() => changeCalendarView('listWeek')} />
                </div>
              </div>
            </div>
          </div>

          <div className="staff-calendar-shell p-2 sm:p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
              headerToolbar={false}
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
              datesSet={(info) => { setCalendarTitle(info.view.title); setCalendarView(info.view.type); }}
              eventClick={(info) => openAppointment(info.event.extendedProps.appointment)}
              dateClick={(info) => {
                setCreateForm((current) => ({ ...current, date: format(info.date, 'yyyy-MM-dd'), time: format(info.date, 'HH:mm') }));
                setCreateOpen(true);
              }}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ContactCard icon={<MapPin className="h-5 w-5" />} title={t('staffPortal.business.location')} value={workspace.business.address} href={workspace.business.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(workspace.business.address)}` : undefined} />
          <ContactCard icon={<Phone className="h-5 w-5" />} title={t('staffPortal.business.phone')} value={workspace.business.phone} href={workspace.business.phone ? `tel:${workspace.business.phone}` : undefined} />
          <ContactCard icon={<Mail className="h-5 w-5" />} title={t('staffPortal.business.email')} value={workspace.business.email} href={workspace.business.email ? `mailto:${workspace.business.email}` : undefined} />
        </section>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-12px_34px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden" aria-label={t('staffPortal.mobileNav.label')}>
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          <StaffMobileNavButton icon={<CalendarDays className="h-5 w-5" />} label={t('staffPortal.mobileNav.schedule')} onClick={scrollToSchedule} />
          <StaffMobileNavButton primary icon={<Plus className="h-5 w-5" />} label={t('staffPortal.mobileNav.newAppointment')} onClick={() => setCreateOpen(true)} />
          <StaffMobileNavButton icon={<GraduationCap className="h-5 w-5" />} label={t('training.certification.mobileTraining')} onClick={() => setTrainingOpen(true)} />
          <StaffMobileNavButton icon={<UserRound className="h-5 w-5" />} label={t('staffPortal.mobileNav.profile')} onClick={() => setProfileOpen(true)} />
          <StaffMobileNavButton icon={<MoreHorizontal className="h-5 w-5" />} label={t('staffPortal.mobileNav.more')} onClick={() => setMobileActionsOpen(true)} />
        </div>
      </nav>

      <Sheet open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
        <SheetContent side="bottom" className="safe-bottom max-h-[88dvh] rounded-t-[28px] p-0">
          <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-slate-200" aria-hidden="true" />
          <SheetHeader className="px-5 pb-4 pt-5 pr-14 text-left">
            <SheetTitle>{t('staffPortal.mobileNav.moreTitle')}</SheetTitle>
            <SheetDescription>{t('staffPortal.mobileNav.moreDescription')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 border-t px-5 py-5">
            {!pwa.isInstalled && (
              <Button variant="outline" className="min-h-12 w-full justify-start rounded-xl" onClick={() => { setMobileActionsOpen(false); setInstallOpen(true); }}>
                <Download className="mr-3 h-5 w-5" />{t('staffPortal.actions.install')}
              </Button>
            )}
            <Button variant="outline" className="min-h-12 w-full justify-start rounded-xl" onClick={() => { setMobileActionsOpen(false); setTrainingOpen(true); }}>
              <GraduationCap className="mr-3 h-5 w-5" />{t('training.certification.openTraining')}
            </Button>
            <Button variant="outline" className="min-h-12 w-full justify-start rounded-xl" disabled={refreshing} onClick={() => { setMobileActionsOpen(false); void loadWorkspace(true); }}>
              <RefreshCw className={`mr-3 h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />{t('staffPortal.actions.refresh')}
            </Button>
            {workspace.business.phone && (
              <Button asChild variant="outline" className="min-h-12 w-full justify-start rounded-xl">
                <a href={`tel:${workspace.business.phone}`}><Phone className="mr-3 h-5 w-5" />{t('staffPortal.actions.callBusiness')}</a>
              </Button>
            )}
            {workspace.business.address && (
              <Button asChild variant="outline" className="min-h-12 w-full justify-start rounded-xl">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(workspace.business.address)}`} target="_blank" rel="noreferrer"><MapPin className="mr-3 h-5 w-5" />{t('staffPortal.actions.directions')}</a>
              </Button>
            )}
            <Button variant="destructive" className="min-h-12 w-full justify-start rounded-xl" onClick={() => { setMobileActionsOpen(false); void handleSignOut(); }}>
              <LogOut className="mr-3 h-5 w-5" />{t('staffPortal.actions.signOut')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'safe-bottom max-h-[92dvh] w-full rounded-t-[28px] overflow-y-auto p-5' : 'w-full overflow-y-auto sm:max-w-xl'}>
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
        <DialogContent className="grid max-h-[94dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b bg-white p-5 pr-16 sm:p-6"><DialogTitle>{t('staffPortal.create.title')}</DialogTitle></DialogHeader>
          <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
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
          <DialogFooter className="safe-bottom border-t bg-white p-4 sm:px-6">
            <Button variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button className="min-h-11" disabled={saving} onClick={() => void createAppointment()}>{saving ? t('staffPortal.create.saving') : t('staffPortal.create.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        businessName={workspace.business.name}
        employeeName={workspace.employee.name}
        canPromptInstall={pwa.canInstall}
        isInstalled={pwa.isInstalled}
        needsManualIOSInstall={pwa.needsManualIOSInstall}
        onInstall={pwa.install}
      />

      <StaffTrainingDialog
        open={trainingOpen}
        onOpenChange={setTrainingOpen}
        business={workspace.business}
        employee={workspace.employee}
        userId={user?.id}
      />

      <StaffProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        business={workspace.business}
        employee={workspace.employee}
        onSaved={() => loadWorkspace(true)}
        onForgetDevice={forgetThisDevice}
      />
    </div>
  );
}


function PremiumFeature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-violet-200">{icon}</div><div className="mt-3 font-bold">{title}</div><p className="mt-1 text-xs leading-5 text-slate-400">{description}</p></div>;
}

function CalendarViewButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition sm:text-sm ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
    >
      {icon}<span>{label}</span>
    </button>
  );
}

function StaffMobileNavButton({ icon, label, onClick, primary = false }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold leading-tight transition active:scale-[0.98] ${primary ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
    >
      {icon}<span className="max-w-full truncate">{label}</span>
    </button>
  );
}

function Brand({ business, inverted = false }: { business: any; inverted?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {business?.logo_url ? <img src={business.logo_url} alt={business.name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-black/5" /> : <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-white ${inverted ? 'bg-white/10 ring-1 ring-white/10' : 'bg-slate-950'}`}>{String(business?.name || 'V').charAt(0)}</div>}
      <div className="min-w-0"><div className={`truncate font-black ${inverted ? 'text-white' : ''}`}>{business?.name || 'Velliqo'}</div><div className={`text-xs ${inverted ? 'text-slate-400' : 'text-muted-foreground'}`}>Staff App</div></div>
    </div>
  );
}

function StaffCenteredState({ business, text }: { business: any; text: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><Brand business={business} /><div className="mt-6 text-sm text-muted-foreground">{text}</div></div></div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="min-w-0 rounded-2xl border bg-white p-3 shadow-sm sm:p-4"><div className="flex min-w-0 items-center gap-2.5 sm:gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">{icon}</div><div className="min-w-0"><div className="line-clamp-2 text-[11px] font-semibold leading-4 text-muted-foreground sm:text-xs">{label}</div><div className="truncate text-lg font-black sm:text-xl">{value}</div></div></div></div>;
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
