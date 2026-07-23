import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/ui/image-uploader';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Clock3,
  Edit,
  Mail,
  Phone,
  Plus,
  Scissors,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';


type StaffStatusFilter = 'all' | 'active' | 'inactive';
type StaffSort = 'name' | 'bookings' | 'revenue' | 'services';

type StaffPerformance = {
  bookings: number;
  completed: number;
  revenue: number;
  upcoming: number;
};

type WeeklyScheduleDay = {
  dayOfWeek: number;
  labelKey: string;
  isClosed: boolean;
  startTime: string;
  endTime: string;
};

type WeeklyBreak = {
  clientId: string;
  dayOfWeek: number;
  label: string;
  startTime: string;
  endTime: string;
};

const DEFAULT_SCHEDULE: WeeklyScheduleDay[] = [
  { dayOfWeek: 1, labelKey: 'staff.days.monday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, labelKey: 'staff.days.tuesday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, labelKey: 'staff.days.wednesday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, labelKey: 'staff.days.thursday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, labelKey: 'staff.days.friday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 6, labelKey: 'staff.days.saturday', isClosed: false, startTime: '09:00', endTime: '14:00' },
  { dayOfWeek: 0, labelKey: 'staff.days.sunday', isClosed: true, startTime: '09:00', endTime: '17:00' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  photo_url: '',
  bio: '',
  is_active: true,
  inactive_start_date: '',
  inactive_end_date: '',
};

export default function Staff() {
  const { t } = useTranslation();
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [employeeServices, setEmployeeServices] = useState<any[]>([]);
  const [workingHours, setWorkingHours] = useState<any[]>([]);
  const [staffBreaks, setStaffBreaks] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>('all');
  const [sortBy, setSortBy] = useState<StaffSort>('name');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] =
    useState<WeeklyScheduleDay[]>(DEFAULT_SCHEDULE);
  const [weeklyBreaks, setWeeklyBreaks] = useState<WeeklyBreak[]>([]);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [
        staffResult,
        servicesResult,
        employeeServicesResult,
        hoursResult,
        breaksResult,
        appointmentsResult,
      ] = await Promise.all([
          supabase
            .from('employees')
            .select('*')
            .eq('business_id', businessId)
            .order('name'),
          supabase
            .from('services')
            .select('id, name, duration, price, is_active')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('employee_services')
            .select('employee_id, service_id'),
          supabase
            .from('working_hours')
            .select('employee_id, day_of_week, start_time, end_time, is_closed')
            .eq('business_id', businessId),
          supabase
            .from('breaks')
            .select('id, employee_id, day_of_week, start_time, end_time, label')
            .eq('business_id', businessId)
            .order('day_of_week')
            .order('start_time'),
          supabase
            .from('appointments')
            .select('employee_id, total_price, status, start_time')
            .eq('business_id', businessId)
            .gte('start_time', monthStartIso())
            .lt('start_time', nextMonthStartIso()),
        ]);

      if (staffResult.error) throw staffResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (employeeServicesResult.error) throw employeeServicesResult.error;
      if (hoursResult.error) throw hoursResult.error;
      if (breaksResult.error) throw breaksResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      setStaff(staffResult.data ?? []);
      setServices(servicesResult.data ?? []);
      setEmployeeServices(employeeServicesResult.data ?? []);
      setWorkingHours(hoursResult.data ?? []);
      setStaffBreaks(breaksResult.data ?? []);
      setAppointments(appointmentsResult.data ?? []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error(t('staff.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setSelectedServiceIds([]);
    setWeeklySchedule(DEFAULT_SCHEDULE.map((day) => ({ ...day })));
    setWeeklyBreaks([]);
  };

  const handleOpenDialog = async (employee?: any) => {
    resetForm();

    if (!employee) {
      setIsDialogOpen(true);
      return;
    }

    setEditingId(employee.id);
    setFormData({
      name: employee.name ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      photo_url: employee.photo_url ?? '',
      bio: employee.bio ?? '',
      is_active: employee.is_active ?? true,
      inactive_start_date: employee.inactive_start_date ?? '',
      inactive_end_date: employee.inactive_end_date ?? '',
    });

    try {
      const [serviceAssignments, savedWorkingHours, savedBreaks] =
        await Promise.all([
        supabase
          .from('employee_services')
          .select('service_id')
          .eq('employee_id', employee.id),
        supabase
          .from('working_hours')
          .select('day_of_week, start_time, end_time, is_closed')
          .eq('business_id', businessId)
          .eq('employee_id', employee.id),
        supabase
          .from('breaks')
          .select('id, day_of_week, start_time, end_time, label')
          .eq('business_id', businessId)
          .eq('employee_id', employee.id)
          .order('day_of_week')
          .order('start_time'),
      ]);

      if (serviceAssignments.error) throw serviceAssignments.error;
      if (savedWorkingHours.error) throw savedWorkingHours.error;
      if (savedBreaks.error) throw savedBreaks.error;

      setSelectedServiceIds(
        (serviceAssignments.data ?? []).map((row: any) => row.service_id)
      );

      const savedHours = new Map(
        (savedWorkingHours.data ?? []).map((row: any) => [
          row.day_of_week,
          row,
        ])
      );

      setWeeklyBreaks(
        (savedBreaks.data ?? []).map((item: any) => ({
          clientId: item.id,
          dayOfWeek: Number(item.day_of_week),
          label: item.label || t('staff.breaks.defaultLabel'),
          startTime: String(item.start_time).slice(0, 5),
          endTime: String(item.end_time).slice(0, 5),
        }))
      );

      setWeeklySchedule(
        DEFAULT_SCHEDULE.map((defaultDay) => {
          const saved = savedHours.get(defaultDay.dayOfWeek);
          if (!saved) return { ...defaultDay };

          return {
            ...defaultDay,
            isClosed: Boolean(saved.is_closed),
            startTime: String(saved.start_time).slice(0, 5),
            endTime: String(saved.end_time).slice(0, 5),
          };
        })
      );
    } catch (error: any) {
      toast.error(error.message || t('staff.messages.detailsLoadFailed'));
      return;
    }

    setIsDialogOpen(true);
  };

  const toggleService = (serviceId: string, checked: boolean) => {
    setSelectedServiceIds((current) =>
      checked
        ? Array.from(new Set([...current, serviceId]))
        : current.filter((id) => id !== serviceId)
    );
  };

  const updateScheduleDay = (
    dayOfWeek: number,
    changes: Partial<WeeklyScheduleDay>
  ) => {
    setWeeklySchedule((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day
      )
    );
  };

  const addBreak = () => {
    const firstOpenDay =
      weeklySchedule.find((day) => !day.isClosed) ?? weeklySchedule[0];

    setWeeklyBreaks((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        dayOfWeek: firstOpenDay.dayOfWeek,
        label: t('staff.breaks.defaultLabel'),
        startTime: '13:00',
        endTime: '13:30',
      },
    ]);
  };

  const updateBreak = (
    clientId: string,
    changes: Partial<WeeklyBreak>
  ) => {
    setWeeklyBreaks((current) =>
      current.map((item) =>
        item.clientId === clientId ? { ...item, ...changes } : item
      )
    );
  };

  const removeBreak = (clientId: string) => {
    setWeeklyBreaks((current) =>
      current.filter((item) => item.clientId !== clientId)
    );
  };

  const validateForm = () => {
    if (!businessId) return false;

    if (!formData.name.trim()) {
      toast.error(t('staff.validation.nameRequired'));
      return false;
    }

    if (selectedServiceIds.length === 0) {
      toast.error(t('staff.validation.serviceRequired'));
      return false;
    }

    const invalidDay = weeklySchedule.find(
      (day) =>
        !day.isClosed &&
        (!day.startTime ||
          !day.endTime ||
          day.startTime >= day.endTime)
    );

    if (invalidDay) {
      toast.error(t('staff.validation.invalidWorkingHours', { day: t(invalidDay.labelKey) }));
      return false;
    }

    for (const item of weeklyBreaks) {
      const day = weeklySchedule.find(
        (scheduleDay) => scheduleDay.dayOfWeek === item.dayOfWeek
      );

      if (!day || day.isClosed) {
        toast.error(t('staff.validation.breakOnClosedDay'));
        return false;
      }

      if (
        !item.startTime ||
        !item.endTime ||
        item.startTime >= item.endTime
      ) {
        toast.error(t('staff.validation.invalidBreakTime', { day: t(day.labelKey) }));
        return false;
      }

      if (
        item.startTime < day.startTime ||
        item.endTime > day.endTime
      ) {
        toast.error(
          t('staff.validation.breakOutsideHours', { day: t(day.labelKey), start: day.startTime, end: day.endTime })
        );
        return false;
      }

      const overlaps = weeklyBreaks.some(
        (other) =>
          other.clientId !== item.clientId &&
          other.dayOfWeek === item.dayOfWeek &&
          item.startTime < other.endTime &&
          item.endTime > other.startTime
      );

      if (overlaps) {
        toast.error(t('staff.validation.breaksOverlap', { day: t(day.labelKey) }));
        return false;
      }
    }

    if (
      formData.inactive_start_date &&
      formData.inactive_end_date &&
      formData.inactive_start_date > formData.inactive_end_date
    ) {
      toast.error(t('staff.validation.inactiveDateOrder'));
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !businessId) return;

    setSaving(true);

    try {
      const employeePayload = {
        business_id: businessId,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        photo_url: formData.photo_url || null,
        bio: formData.bio.trim() || null,
        is_active: formData.is_active,
        inactive_start_date: formData.inactive_start_date || null,
        inactive_end_date: formData.inactive_end_date || null,
      };

      let employeeId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('employees')
          .update(employeePayload)
          .eq('id', editingId)
          .eq('business_id', businessId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert(employeePayload)
          .select('id')
          .single();

        if (error) throw error;
        employeeId = data.id;
      }

      if (!employeeId) throw new Error(t('staff.messages.recordNotCreated'));

      const { error: deleteServicesError } = await supabase
        .from('employee_services')
        .delete()
        .eq('employee_id', employeeId);

      if (deleteServicesError) throw deleteServicesError;

      const { error: insertServicesError } = await supabase
        .from('employee_services')
        .insert(
          selectedServiceIds.map((serviceId) => ({
            employee_id: employeeId,
            service_id: serviceId,
          }))
        );

      if (insertServicesError) throw insertServicesError;

      const { error: deleteHoursError } = await supabase
        .from('working_hours')
        .delete()
        .eq('business_id', businessId)
        .eq('employee_id', employeeId);

      if (deleteHoursError) throw deleteHoursError;

      const { error: insertHoursError } = await supabase
        .from('working_hours')
        .insert(
          weeklySchedule.map((day) => ({
            business_id: businessId,
            employee_id: employeeId,
            day_of_week: day.dayOfWeek,
            start_time: day.startTime,
            end_time: day.endTime,
            is_closed: day.isClosed,
          }))
        );

      if (insertHoursError) throw insertHoursError;

      const { error: deleteBreaksError } = await supabase
        .from('breaks')
        .delete()
        .eq('business_id', businessId)
        .eq('employee_id', employeeId);

      if (deleteBreaksError) throw deleteBreaksError;

      if (weeklyBreaks.length > 0) {
        const { error: insertBreaksError } = await supabase
          .from('breaks')
          .insert(
            weeklyBreaks.map((item) => ({
              business_id: businessId,
              employee_id: employeeId,
              day_of_week: item.dayOfWeek,
              start_time: item.startTime,
              end_time: item.endTime,
              label: item.label.trim() || t('staff.breaks.defaultLabel'),
            }))
          );

        if (insertBreaksError) throw insertBreaksError;
      }

      toast.success(
        editingId ? t('staff.messages.updated') : t('staff.messages.added')
      );

      setIsDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('staff.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member: any) => {
    const confirmed = window.confirm(
      t('staff.confirmRemove', { name: member.name })
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', member.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(t('staff.messages.removed'));
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('staff.messages.removeFailed'));
    }
  };

  const activeCount = staff.filter((member) => member.is_active).length;
  const inactiveCount = staff.length - activeCount;

  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services]
  );

  const getMemberServices = (employeeId: string) =>
    employeeServices
      .filter((row) => row.employee_id === employeeId)
      .map((row) => serviceMap.get(row.service_id))
      .filter(Boolean);

  const getMemberBreakSummary = (employeeId: string) => {
    const memberBreaks = staffBreaks.filter(
      (item) => item.employee_id === employeeId
    );

    if (memberBreaks.length === 0) return t('staff.breaks.noneScheduled');

    return t('staff.breaks.recurringCount', { count: memberBreaks.length });
  };

  const getMemberScheduleSummary = (employeeId: string) => {
    const memberHours = workingHours.filter(
      (row) => row.employee_id === employeeId && !row.is_closed
    );

    if (memberHours.length === 0) return t('staff.schedule.noneConfigured');

    const days = memberHours.length;
    const earliest = [...memberHours]
      .map((row) => String(row.start_time).slice(0, 5))
      .sort()[0];
    const latest = [...memberHours]
      .map((row) => String(row.end_time).slice(0, 5))
      .sort()
      .slice(-1)[0];

    return t('staff.schedule.workingDaysSummary', { count: days, earliest, latest });
  };


  const performanceByStaff = useMemo(() => {
    const now = Date.now();
    const result: Record<string, StaffPerformance> = {};

    for (const member of staff) {
      result[member.id] = {
        bookings: 0,
        completed: 0,
        revenue: 0,
        upcoming: 0,
      };
    }

    for (const appointment of appointments) {
      const employeeId = appointment.employee_id;
      if (!employeeId || !result[employeeId]) continue;

      if (
        !['cancelled_by_business', 'cancelled_by_customer', 'no_show'].includes(
          appointment.status
        )
      ) {
        result[employeeId].bookings += 1;
      }

      if (appointment.status === 'completed') {
        result[employeeId].completed += 1;
        result[employeeId].revenue += Number(appointment.total_price || 0);
      }

      if (
        new Date(appointment.start_time).getTime() > now &&
        !['cancelled_by_business', 'cancelled_by_customer', 'no_show'].includes(
          appointment.status
        )
      ) {
        result[employeeId].upcoming += 1;
      }
    }

    return result;
  }, [appointments, staff]);

  const teamTotals = useMemo(() => {
    const values = Object.values(performanceByStaff);
    const coveredServices = new Set(employeeServices.map((row) => row.service_id));

    return {
      bookings: values.reduce((sum, item) => sum + item.bookings, 0),
      completed: values.reduce((sum, item) => sum + item.completed, 0),
      revenue: values.reduce((sum, item) => sum + item.revenue, 0),
      coveredServices: coveredServices.size,
    };
  }, [employeeServices, performanceByStaff]);

  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const next = staff.filter((member) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && member.is_active) ||
        (statusFilter === 'inactive' && !member.is_active);

      if (!matchesStatus) return false;
      if (!query) return true;

      return [member.name, member.email, member.phone, member.bio]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    return [...next].sort((a, b) => {
      if (sortBy === 'bookings') {
        return (
          (performanceByStaff[b.id]?.bookings || 0) -
          (performanceByStaff[a.id]?.bookings || 0)
        );
      }

      if (sortBy === 'revenue') {
        return (
          (performanceByStaff[b.id]?.revenue || 0) -
          (performanceByStaff[a.id]?.revenue || 0)
        );
      }

      if (sortBy === 'services') {
        return getMemberServices(b.id).length - getMemberServices(a.id).length;
      }

      return String(a.name).localeCompare(String(b.name));
    });
  }, [performanceByStaff, searchQuery, sortBy, staff, statusFilter]);

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('staff.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('staff.title')}</h1>
          <p className="app-page-description">
            {t('staff.description')}
          </p>
        </div>

        <Button onClick={() => void handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('staff.actions.add')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title={t('staff.workspace.summary.activeTeam')}
          value={activeCount}
          description={t('staff.workspace.summary.activeTeamDescription', {
            total: staff.length,
            inactive: inactiveCount,
          })}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('staff.workspace.summary.monthBookings')}
          value={teamTotals.bookings}
          description={t('staff.workspace.summary.monthBookingsDescription')}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('staff.workspace.summary.completed')}
          value={teamTotals.completed}
          description={t('staff.workspace.summary.completedDescription', {
            revenue: formatCurrency(teamTotals.revenue),
          })}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('staff.workspace.summary.serviceCoverage')}
          value={teamTotals.coveredServices}
          description={t('staff.workspace.summary.serviceCoverageDescription', {
            total: services.length,
          })}
          icon={<Scissors className="h-5 w-5" />}
        />
      </section>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_190px]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl pl-9"
                placeholder={t('staff.workspace.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <select
              className="h-11 rounded-xl border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StaffStatusFilter)
              }
              aria-label={t('staff.workspace.filters.status')}
            >
              <option value="all">{t('staff.workspace.filters.all')}</option>
              <option value="active">{t('staff.status.active')}</option>
              <option value="inactive">{t('staff.status.inactive')}</option>
            </select>

            <select
              className="h-11 rounded-xl border bg-background px-3 text-sm"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as StaffSort)}
              aria-label={t('staff.workspace.sort.label')}
            >
              <option value="name">{t('staff.workspace.sort.name')}</option>
              <option value="bookings">{t('staff.workspace.sort.bookings')}</option>
              <option value="revenue">{t('staff.workspace.sort.revenue')}</option>
              <option value="services">{t('staff.workspace.sort.services')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">
          {t('staff.loading')}
        </div>
      ) : staff.length === 0 ? (
        <Card className="rounded-2xl shadow-card">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
            <Users className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-bold">{t('staff.empty.title')}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {t('staff.empty.description')}
            </p>
            <Button className="mt-5" onClick={() => void handleOpenDialog()}>
              {t('staff.actions.add')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {filteredStaff.length === 0 ? (
            <Card className="rounded-2xl shadow-card">
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                {t('staff.workspace.emptyFiltered')}
              </CardContent>
            </Card>
          ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredStaff.map((member) => {
            const memberServices = getMemberServices(member.id);
            const performance = performanceByStaff[member.id] ?? { bookings: 0, completed: 0, revenue: 0, upcoming: 0 };

            return (
              <Card
                key={member.id}
                className="overflow-hidden rounded-2xl shadow-card transition hover:-translate-y-0.5 hover:shadow-hover"
              >
                <CardContent className="p-0">
                  <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />

                  <div className="-mt-10 px-5 pb-5">
                    <div className="flex items-end justify-between">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="h-20 w-20 rounded-2xl border-4 border-card object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-primary/15 text-2xl font-bold text-primary shadow-sm">
                          {member.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}

                      <Badge
                        variant={member.is_active ? 'default' : 'secondary'}
                      >
                        {member.is_active ? t('staff.status.active') : t('staff.status.inactive')}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-lg font-bold">{member.name}</h3>
                      {member.bio && (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {member.bio}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <ContactLine
                        icon={<Mail className="h-4 w-4" />}
                        value={member.email || t('staff.contact.noEmail')}
                      />
                      <ContactLine
                        icon={<Phone className="h-4 w-4" />}
                        value={member.phone || t('staff.contact.noPhone')}
                      />
                      <ContactLine
                        icon={<CalendarClock className="h-4 w-4" />}
                        value={getMemberScheduleSummary(member.id)}
                      />
                      <ContactLine
                        icon={<Clock3 className="h-4 w-4" />}
                        value={getMemberBreakSummary(member.id)}
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-3 text-center">
                      <StaffMetric
                        label={t('staff.workspace.metrics.bookings')}
                        value={String(performance.bookings)}
                      />
                      <StaffMetric
                        label={t('staff.workspace.metrics.completed')}
                        value={String(performance.completed)}
                      />
                      <StaffMetric
                        label={t('staff.workspace.metrics.revenue')}
                        value={formatCurrency(performance.revenue)}
                      />
                    </div>

                    {performance.upcoming > 0 && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
                        <CalendarClock className="h-4 w-4" />
                        {t('staff.workspace.metrics.upcoming', {
                          count: performance.upcoming,
                        })}
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Scissors className="h-3.5 w-3.5" />
                        {t('staff.services.label')}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {memberServices.length === 0 ? (
                          <Badge variant="secondary">{t('staff.services.noneAssigned')}</Badge>
                        ) : (
                          memberServices.slice(0, 4).map((service: any) => (
                            <Badge key={service.id} variant="outline">
                              {service.name}
                            </Badge>
                          ))
                        )}

                        {memberServices.length > 4 && (
                          <Badge variant="secondary">
                            {t('staff.services.more', { count: memberServices.length - 4 })}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleOpenDialog(member)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(member)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('staff.actions.remove')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
          )}
        </>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="border-b px-5 py-5 sm:px-7">
            <DialogTitle className="text-2xl">
              {editingId ? t('staff.dialog.editTitle') : t('staff.dialog.addTitle')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t('staff.dialog.description')}
            </p>
          </DialogHeader>

          <div className="space-y-8 px-5 py-6 sm:px-7">
            <section className="space-y-4">
              <SectionTitle
                title={t('staff.profile.title')}
                description={t('staff.profile.description')}
              />

              <div className="space-y-2">
                <Label>{t('staff.fields.photo')}</Label>
                <ImageUploader
                  value={formData.photo_url}
                  onChange={(photoUrl) =>
                    setFormData((current) => ({
                      ...current,
                      photo_url: photoUrl,
                    }))
                  }
                  folder={`staff/${businessId ?? 'unknown'}/${editingId ?? 'new'}`}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('staff.fields.fullNameRequired')}>
                  <Input
                    className="h-11 rounded-xl"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData({ ...formData, name: event.target.value })
                    }
                  />
                </Field>

                <Field label={t('staff.fields.phone')}>
                  <Input
                    className="h-11 rounded-xl"
                    type="tel"
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData({ ...formData, phone: event.target.value })
                    }
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label={t('staff.fields.email')}>
                    <Input
                      className="h-11 rounded-xl"
                      type="email"
                      value={formData.email}
                      onChange={(event) =>
                        setFormData({ ...formData, email: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label={t('staff.fields.biography')}>
                    <Textarea
                      rows={4}
                      className="rounded-xl"
                      value={formData.bio}
                      onChange={(event) =>
                        setFormData({ ...formData, bio: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border p-4">
                <div>
                  <Label>{t('staff.status.label')}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('staff.status.description')}
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            </section>

            <section className="space-y-4 border-t pt-7">
              <SectionTitle
                title={t('staff.services.title')}
                description={t('staff.services.description')}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => {
                  const checked = selectedServiceIds.includes(service.id);

                  return (
                    <label
                      key={service.id}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                        checked
                          ? 'border-primary bg-primary/8'
                          : 'hover:border-primary/40'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleService(service.id, value === true)
                        }
                      />

                      <div>
                        <div className="font-semibold">{service.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {service.duration} {t('common.minutesShort')} · €
                          {Number(service.price).toFixed(2)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 border-t pt-7">
              <SectionTitle
                title={t('staff.schedule.title')}
                description={t('staff.schedule.description')}
              />

              <div className="space-y-3">
                {weeklySchedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[130px_110px_1fr_1fr] sm:items-center"
                  >
                    <div className="font-semibold">{t(day.labelKey)}</div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!day.isClosed}
                        onCheckedChange={(open) =>
                          updateScheduleDay(day.dayOfWeek, {
                            isClosed: !open,
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {day.isClosed ? t('staff.schedule.closed') : t('staff.schedule.open')}
                      </span>
                    </div>

                    <Input
                      type="time"
                      className="h-11 rounded-xl"
                      value={day.startTime}
                      disabled={day.isClosed}
                      onChange={(event) =>
                        updateScheduleDay(day.dayOfWeek, {
                          startTime: event.target.value,
                        })
                      }
                    />

                    <Input
                      type="time"
                      className="h-11 rounded-xl"
                      value={day.endTime}
                      disabled={day.isClosed}
                      onChange={(event) =>
                        updateScheduleDay(day.dayOfWeek, {
                          endTime: event.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 border-t pt-7">
              <SectionTitle
                title={t('staff.inactive.title')}
                description={t('staff.inactive.description')}
              />

              <section className="space-y-4 border-t pt-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle
                    title={t('staff.breaks.title')}
                    description={t('staff.breaks.description')}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addBreak}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('staff.breaks.add')}
                  </Button>
                </div>

                {weeklyBreaks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-muted/15 p-6 text-center">
                    <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />

                    <div className="mt-3 font-semibold">
                      {t('staff.breaks.noneScheduled')}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('staff.breaks.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {weeklyBreaks.map((item) => (
                      <div
                        key={item.clientId}
                        className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[150px_1fr_1fr_1fr_auto] sm:items-end"
                      >
                        <Field label={t('staff.fields.day')}>
                          <select
                            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                            value={item.dayOfWeek}
                            onChange={(event) =>
                              updateBreak(item.clientId, {
                                dayOfWeek: Number(event.target.value),
                              })
                            }
                          >
                            {DEFAULT_SCHEDULE.map((day) => (
                              <option
                                key={day.dayOfWeek}
                                value={day.dayOfWeek}
                                disabled={
                                  weeklySchedule.find(
                                    (savedDay) =>
                                      savedDay.dayOfWeek === day.dayOfWeek
                                  )?.isClosed
                                }
                              >
                                {t(day.labelKey)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label={t('staff.fields.start')}>
                          <Input
                            type="time"
                            className="h-11 rounded-xl"
                            value={item.startTime}
                            onChange={(event) =>
                              updateBreak(item.clientId, {
                                startTime: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label={t('staff.fields.end')}>
                          <Input
                            type="time"
                            className="h-11 rounded-xl"
                            value={item.endTime}
                            onChange={(event) =>
                              updateBreak(item.clientId, {
                                endTime: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label={t('staff.fields.label')}>
                          <Input
                            className="h-11 rounded-xl"
                            value={item.label}
                            placeholder={t('staff.breaks.placeholder')}
                            onChange={(event) =>
                              updateBreak(item.clientId, {
                                label: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive hover:text-destructive"
                          onClick={() => removeBreak(item.clientId)}
                          aria-label={t('staff.breaks.removeAria')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('staff.fields.startDate')}>
                  <Input
                    className="h-11 rounded-xl"
                    type="date"
                    value={formData.inactive_start_date}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        inactive_start_date: event.target.value,
                      })
                    }
                  />
                </Field>

                <Field label={t('staff.fields.endDate')}>
                  <Input
                    className="h-11 rounded-xl"
                    type="date"
                    value={formData.inactive_end_date}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        inactive_end_date: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          </div>

          <DialogFooter className="sticky bottom-0 border-t bg-background px-5 py-4 sm:px-7">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>

            <Button
              disabled={saving || services.length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? t('staff.actions.saving') : t('staff.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          <div className="mt-3 text-3xl font-bold">{value}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {description}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}


function StaffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-bold">{value}</div>
      <div className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function nextMonthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function ContactLine({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
