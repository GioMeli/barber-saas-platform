import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import OutlookCalendarView from '@/components/calendar/OutlookCalendarView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  addDays,
  format,
  isAfter,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  PlayCircle,
  UserCheck,
  UserX,
  FileText,
  Mail,
  Phone,
  Search,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';

type AvailabilityRow = {
  employee_id: string;
  available_time: string;
};

const EMPTY_BOOKING = {
  customer_id: '',
  employee_id: '',
  service_ids: [] as string[],
  date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  time: '',
  notes: '',
};

const EMPTY_CUSTOMER = {
  full_name: '',
  phone: '',
  email: '',
};

export default function Calendar() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const initialStart = startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [visibleRange, setVisibleRange] = useState({
    start: initialStart,
    end: addDays(initialStart, 7),
  });
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] =
    useState<string>('all');

  const [appointments, setAppointments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employeeServices, setEmployeeServices] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAppt, setNewAppt] = useState(EMPTY_BOOKING);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AvailabilityRow[]>([]);
  const [selectedDateClosure, setSelectedDateClosure] = useState<any | null>(null);

  const [delayOpen, setDelayOpen] = useState(false);
  const [delayPreviewLoading, setDelayPreviewLoading] = useState(false);
  const [delayApplying, setDelayApplying] = useState(false);
  const [delayPreview, setDelayPreview] = useState<any[]>([]);
  const [delayForm, setDelayForm] = useState({
    employee_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    delay_from: format(new Date(), 'HH:mm'),
    delay_minutes: 15,
    reason: '',
  });

  useEffect(() => {
    if (businessId) void fetchReferenceData();
  }, [businessId]);

  useEffect(() => {
    if (businessId) void fetchCalendarRange();
  }, [businessId, visibleRange.start.getTime(), visibleRange.end.getTime()]);

  useEffect(() => {
    if (
      isNewDialogOpen &&
      businessId &&
      newAppt.date &&
      newAppt.service_ids.length > 0
    ) {
      void fetchAvailability();
    } else {
      setAvailableSlots([]);
      setSelectedDateClosure(null);
      setNewAppt((current) => ({ ...current, time: '' }));
    }
  }, [
    isNewDialogOpen,
    businessId,
    newAppt.date,
    newAppt.employee_id,
    newAppt.service_ids,
  ]);

  const fetchReferenceData = async () => {
    if (!businessId) return;

    try {
      const [staffRes, servRes, custRes, employeeServicesRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('services')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .eq('online_booking_enabled', true)
          .order('name'),
        supabase
          .from('customers')
          .select('*')
          .eq('business_id', businessId)
          .order('full_name'),
        supabase.from('employee_services').select('employee_id, service_id'),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (servRes.error) throw servRes.error;
      if (custRes.error) throw custRes.error;
      if (employeeServicesRes.error) throw employeeServicesRes.error;

      setStaff(staffRes.data ?? []);
      setServices(servRes.data ?? []);
      setCustomers(custRes.data ?? []);
      setEmployeeServices(employeeServicesRes.data ?? []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load calendar data');
    }
  };

  const fetchCalendarRange = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [apptsRes, closuresRes, breaksRes] = await Promise.all([
        supabase
          .from('appointments')
          .select(
            '*, customers(full_name, email, phone), employees(id, name, photo_url), appointment_services(id, price, duration, services(id, name))'
          )
          .eq('business_id', businessId)
          .gte('start_time', visibleRange.start.toISOString())
          .lt('start_time', visibleRange.end.toISOString())
          .order('start_time'),
        supabase
          .from('business_closures')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .lte('start_date', format(visibleRange.end, 'yyyy-MM-dd'))
          .gte('end_date', format(visibleRange.start, 'yyyy-MM-dd'))
          .order('start_date'),
        supabase
          .from('breaks')
          .select('id, business_id, employee_id, day_of_week, start_time, end_time, label')
          .eq('business_id', businessId)
          .order('day_of_week')
          .order('start_time'),
      ]);

      if (apptsRes.error) throw apptsRes.error;
      if (closuresRes.error) throw closuresRes.error;
      if (breaksRes.error) throw breaksRes.error;

      setAppointments(apptsRes.data ?? []);
      setClosures(closuresRes.data ?? []);
      setBreaks(breaksRes.data ?? []);
    } catch (error: any) {
      console.error('Error fetching calendar range:', error);
      toast.error(error.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!businessId || newAppt.service_ids.length === 0 || !newAppt.date) return;

    setAvailabilityLoading(true);
    setAvailableSlots([]);
    setSelectedDateClosure(null);
    setNewAppt((current) => ({ ...current, time: '' }));

    try {
      const closureResult = await supabase
        .from('business_closures')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .lte('start_date', newAppt.date)
        .gte('end_date', newAppt.date)
        .maybeSingle();

      if (closureResult.error) throw closureResult.error;

      if (closureResult.data) {
        setSelectedDateClosure(closureResult.data);
        return;
      }

      const { data, error } = await supabase.rpc('get_public_availability', {
        p_business_id: businessId,
        p_employee_id: newAppt.employee_id || null,
        p_date: newAppt.date,
        p_service_ids: newAppt.service_ids,
      });

      if (error) throw error;

      setAvailableSlots(
        (data ?? []).map((row: any) => ({
          employee_id: row.employee_id,
          available_time: String(row.available_time).slice(0, 5),
        }))
      );
    } catch (error: any) {
      console.error('Owner availability error:', error);
      toast.error(error.message || 'Failed to load available times');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const resetBookingForm = () => {
    setNewAppt(EMPTY_BOOKING);
    setCustomerSearch('');
    setShowNewCustomer(false);
    setNewCustomer(EMPTY_CUSTOMER);
    setAvailableSlots([]);
    setSelectedDateClosure(null);
  };

  const openNewAppointment = (date?: string, time?: string) => {
    resetBookingForm();
    setNewAppt((current) => ({
      ...current,
      date: date || current.date,
      time: time || '',
    }));
    setIsNewDialogOpen(true);
  };

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 20);

    return customers
      .filter((customer) =>
        [customer.full_name, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .slice(0, 20);
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === newAppt.customer_id
  );

  const selectedServices = services.filter((service) =>
    newAppt.service_ids.includes(service.id)
  );

  const totalDuration = selectedServices.reduce(
    (total, service) => total + Number(service.duration || 0),
    0
  );

  const totalPrice = selectedServices.reduce(
    (total, service) => total + Number(service.price || 0),
    0
  );

  const eligibleStaff = useMemo(() => {
    if (newAppt.service_ids.length === 0) return staff;

    return staff.filter((member) =>
      newAppt.service_ids.every((serviceId) =>
        employeeServices.some(
          (row) => row.employee_id === member.id && row.service_id === serviceId
        )
      )
    );
  }, [staff, employeeServices, newAppt.service_ids]);

  const uniqueAvailableTimes = useMemo(
    () =>
      Array.from(new Set(availableSlots.map((slot) => slot.available_time))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [availableSlots]
  );

  const selectedAppointmentClosure =
    selectedDateClosure ??
    closures.find(
      (closure) =>
        newAppt.date >= closure.start_date && newAppt.date <= closure.end_date
    );

  const toggleService = (serviceId: string, checked: boolean) => {
    setNewAppt((current) => ({
      ...current,
      service_ids: checked
        ? Array.from(new Set([...current.service_ids, serviceId]))
        : current.service_ids.filter((id) => id !== serviceId),
      employee_id: '',
      time: '',
    }));
  };

  const createNewCustomer = async () => {
    if (!businessId || !newCustomer.full_name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    setCreatingCustomer(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          full_name: newCustomer.full_name.trim(),
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim().toLowerCase() || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      setCustomers((current) =>
        [...current, data].sort((a, b) => a.full_name.localeCompare(b.full_name))
      );

      setNewAppt((current) => ({ ...current, customer_id: data.id }));
      setShowNewCustomer(false);
      setNewCustomer(EMPTY_CUSTOMER);
      toast.success('Customer created');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (
      !businessId ||
      !newAppt.customer_id ||
      newAppt.service_ids.length === 0 ||
      !newAppt.date ||
      !newAppt.time
    ) {
      toast.error('Complete all required booking details');
      return;
    }

    if (selectedAppointmentClosure) {
      toast.error('Appointments cannot be created during a business closure');
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase.rpc('owner_create_appointment', {
        p_business_id: businessId,
        p_customer_id: newAppt.customer_id,
        p_employee_id: newAppt.employee_id || null,
        p_service_ids: newAppt.service_ids,
        p_local_date: newAppt.date,
        p_local_time: newAppt.time,
        p_status: 'confirmed',
        p_notes: newAppt.notes.trim() || null,
      });

      if (error) throw error;

      toast.success(
        `Appointment ${data?.booking_reference ? `#${data.booking_reference} ` : ''}created`
      );

      setIsNewDialogOpen(false);
      resetBookingForm();
      await fetchCalendarRange();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create appointment');
      if (String(error.message || '').toLowerCase().includes('available')) {
        await fetchAvailability();
      }
    } finally {
      setCreating(false);
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status:
      | 'pending'
      | 'confirmed'
      | 'arrived'
      | 'in_progress'
      | 'completed'
      | 'cancelled_by_business'
      | 'no_show'
  ) => {
    if (!businessId) return false;

    try {
      const { error } = await supabase.rpc(
        'owner_update_appointment_status',
        {
          p_business_id: businessId,
          p_appointment_id: appointmentId,
          p_status: status,
        }
      );

      if (error) throw error;

      const messages: Record<string, string> = {
        arrived: 'Customer checked in',
        in_progress: 'Service started',
        completed: 'Appointment marked as completed',
        no_show: 'Appointment marked as no show',
        cancelled_by_business: 'Appointment cancelled',
        confirmed: 'Appointment confirmed',
        pending: 'Appointment moved to pending',
      };

      toast.success(messages[status] || 'Appointment updated');
      setDetailsOpen(false);
      await fetchCalendarRange();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update appointment');
      return false;
    }
  };

  const cancelAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm(
      'Cancel this appointment? The time will become available again.'
    );

    if (!confirmed) return;

    await updateAppointmentStatus(
      appointmentId,
      'cancelled_by_business'
    );
  };

  const handleAppointmentMove = async (
    appointment: any,
    newStart: Date,
    _newEnd: Date | null
  ) => {
    if (!businessId) return false;

    try {
      const { error } = await supabase.rpc(
        'owner_reschedule_appointment',
        {
          p_business_id: businessId,
          p_appointment_id: appointment.id,
          p_employee_id: appointment.employee_id,
          p_local_date: format(newStart, 'yyyy-MM-dd'),
          p_local_time: format(newStart, 'HH:mm:ss'),
        }
      );

      if (error) throw error;

      toast.success(
        `Appointment moved to ${format(
          newStart,
          'EEE, MMM d · HH:mm'
        )}`
      );

      await fetchCalendarRange();
      return true;
    } catch (error: any) {
      toast.error(
        error.message ||
          'The appointment could not be moved. It was restored.'
      );
      return false;
    }
  };

  const handleAppointmentResize = async (
    appointment: any,
    newStart: Date,
    newEnd: Date
  ) => {
    if (!businessId) return false;

    const durationMinutes = Math.round(
      (newEnd.getTime() - newStart.getTime()) / 60_000
    );

    try {
      const { error } = await supabase.rpc(
        'owner_resize_appointment',
        {
          p_business_id: businessId,
          p_appointment_id: appointment.id,
          p_new_duration_minutes: durationMinutes,
          p_reason: 'Adjusted from owner calendar',
        }
      );

      if (error) throw error;

      toast.success(
        `Appointment duration changed to ${durationMinutes} minutes`
      );

      await fetchCalendarRange();
      return true;
    } catch (error: any) {
      toast.error(
        error.message ||
          'The appointment duration could not be changed. It was restored.'
      );
      return false;
    }
  };

  const resetDelayForm = () => {
    setDelayPreview([]);
    setDelayForm({
      employee_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      delay_from: format(new Date(), 'HH:mm'),
      delay_minutes: 15,
      reason: '',
    });
  };

  const openDelayDialog = () => {
    resetDelayForm();
    setDelayOpen(true);
  };

  const previewDelay = async () => {
    if (
      !businessId ||
      !delayForm.employee_id ||
      !delayForm.date ||
      !delayForm.delay_from ||
      !delayForm.delay_minutes
    ) {
      toast.error('Select professional, date, start time and delay');
      return;
    }

    setDelayPreviewLoading(true);
    setDelayPreview([]);

    try {
      const { data, error } = await supabase.rpc(
        'owner_preview_staff_delay',
        {
          p_business_id: businessId,
          p_employee_id: delayForm.employee_id,
          p_local_date: delayForm.date,
          p_delay_from: `${delayForm.delay_from}:00`,
          p_delay_minutes: delayForm.delay_minutes,
        }
      );

      if (error) throw error;

      const rows = data ?? [];
      setDelayPreview(rows);

      if (rows.length === 0) {
        toast.info('No active appointments are affected by this delay');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to preview delay');
    } finally {
      setDelayPreviewLoading(false);
    }
  };

  const applyDelay = async () => {
    if (
      !businessId ||
      !delayForm.employee_id ||
      delayPreview.length === 0
    ) {
      toast.error('Preview the affected appointments first');
      return;
    }

    setDelayApplying(true);

    try {
      const { data, error } = await supabase.rpc(
        'owner_apply_staff_delay',
        {
          p_business_id: businessId,
          p_employee_id: delayForm.employee_id,
          p_local_date: delayForm.date,
          p_delay_from: `${delayForm.delay_from}:00`,
          p_delay_minutes: delayForm.delay_minutes,
          p_reason: delayForm.reason.trim() || null,
        }
      );

      if (error) throw error;

      toast.success(
        `${data?.affected_count ?? delayPreview.length} appointments delayed by ${delayForm.delay_minutes} minutes`
      );

      setDelayOpen(false);
      resetDelayForm();
      await fetchCalendarRange();
    } catch (error: any) {
      toast.error(
        error.message ||
          'The delay could not be applied. No appointments were changed.'
      );
    } finally {
      setDelayApplying(false);
    }
  };


  return (
    <div className="calendar-page-outlook-host">
      <OutlookCalendarView
        appointments={appointments}
        closures={closures}
        breaks={breaks}
        staff={staff}
        selectedEmployeeFilter={selectedEmployeeFilter}
        onEmployeeFilterChange={setSelectedEmployeeFilter}
        loading={loading}
        onNewAppointment={openNewAppointment}
        onAppointmentClick={(appointment) => {
          setSelectedAppointment(appointment);
          setDetailsOpen(true);
        }}
        onRangeChange={(start, end) => setVisibleRange({ start, end })}
        onAppointmentMove={handleAppointmentMove}
        onAppointmentResize={handleAppointmentResize}
        onCreateDelay={openDelayDialog}
      />

      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onCancel={cancelAppointment}
        onStatusChange={updateAppointmentStatus}
      />

      <Dialog
        open={delayOpen}
        onOpenChange={(open) => {
          if (!delayApplying) {
            setDelayOpen(open);
            if (!open) resetDelayForm();
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Create Delay
            </DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Delay the selected professional's active appointments from a
              specific time. Review every affected appointment before applying.
            </p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Professional *</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  value={delayForm.employee_id}
                  onChange={(event) => {
                    setDelayForm({
                      ...delayForm,
                      employee_id: event.target.value,
                    });
                    setDelayPreview([]);
                  }}
                >
                  <option value="">Select professional</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  className="h-11 rounded-xl"
                  value={delayForm.date}
                  onChange={(event) => {
                    setDelayForm({
                      ...delayForm,
                      date: event.target.value,
                    });
                    setDelayPreview([]);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Delay From *</Label>
                <Input
                  type="time"
                  className="h-11 rounded-xl"
                  value={delayForm.delay_from}
                  onChange={(event) => {
                    setDelayForm({
                      ...delayForm,
                      delay_from: event.target.value,
                    });
                    setDelayPreview([]);
                  }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Delay Minutes *</Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    variant={
                      delayForm.delay_minutes === minutes
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl"
                    onClick={() => {
                      setDelayForm({
                        ...delayForm,
                        delay_minutes: minutes,
                      });
                      setDelayPreview([]);
                    }}
                  >
                    {minutes}
                  </Button>
                ))}
              </div>

              <Input
                type="number"
                min={1}
                max={240}
                className="h-11 rounded-xl"
                value={delayForm.delay_minutes}
                onChange={(event) => {
                  setDelayForm({
                    ...delayForm,
                    delay_minutes: Math.max(
                      1,
                      Math.min(240, Number(event.target.value) || 1)
                    ),
                  });
                  setDelayPreview([]);
                }}
                placeholder="Custom delay in minutes"
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                rows={3}
                className="rounded-xl"
                placeholder="Optional internal reason"
                value={delayForm.reason}
                onChange={(event) =>
                  setDelayForm({
                    ...delayForm,
                    reason: event.target.value,
                  })
                }
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={delayPreviewLoading || delayApplying}
              onClick={() => void previewDelay()}
            >
              {delayPreviewLoading
                ? 'Calculating...'
                : 'Preview Affected Appointments'}
            </Button>

            {delayPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Affected Appointments</h3>
                  <Badge variant="secondary">{delayPreview.length}</Badge>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border bg-muted/20 p-2">
                  {delayPreview.map((item) => (
                    <div
                      key={item.appointment_id}
                      className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="font-semibold">{item.customer_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.booking_reference
                            ? `#${item.booking_reference}`
                            : 'No reference'}
                        </div>
                      </div>

                      <div className="text-sm sm:text-right">
                        <div className="font-semibold">
                          {format(parseISO(item.old_start_time), 'HH:mm')}
                          {' → '}
                          {format(parseISO(item.new_start_time), 'HH:mm')}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Ends {format(parseISO(item.new_end_time), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  All displayed appointments move together. If any appointment
                  would overlap another booking, a break, or working hours,
                  nothing will be changed.
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={delayApplying}
              onClick={() => setDelayOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                delayApplying ||
                delayPreviewLoading ||
                delayPreview.length === 0
              }
              onClick={() => void applyDelay()}
            >
              {delayApplying
                ? 'Applying Delay...'
                : `Apply ${delayForm.delay_minutes} Minute Delay`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment dialog */}
      <Dialog
        open={isNewDialogOpen}
        onOpenChange={(open) => {
          if (!creating) {
            setIsNewDialogOpen(open);
            if (!open) resetBookingForm();
          }
        }}
      >
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="border-b px-5 py-5 sm:px-7">
            <DialogTitle className="text-2xl">New Appointment</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Complete the steps below. Only valid staff and available slots are
              shown.
            </p>
          </DialogHeader>

          <div className="space-y-8 px-5 py-6 sm:px-7">
            <section className="space-y-4">
              <StepHeader
                number="1"
                title="Customer"
                description="Search an existing customer or create a new one."
              />

              {!showNewCustomer ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="h-11 rounded-xl pl-9"
                      placeholder="Search by name, email or phone"
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(event.target.value)
                      }
                    />
                  </div>

                  <div className="scrollbar-subtle max-h-56 space-y-2 overflow-y-auto rounded-2xl border bg-muted/20 p-2">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          newAppt.customer_id === customer.id
                            ? 'border-primary bg-primary/8'
                            : 'bg-card hover:border-primary/40'
                        }`}
                        onClick={() =>
                          setNewAppt((current) => ({
                            ...current,
                            customer_id: customer.id,
                          }))
                        }
                      >
                        <div className="font-semibold">{customer.full_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[customer.phone, customer.email]
                            .filter(Boolean)
                            .join(' · ') || 'No contact details'}
                        </div>
                      </button>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No customers found.
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewCustomer(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create New Customer
                  </Button>
                </>
              ) : (
                <div className="space-y-4 rounded-2xl border bg-muted/20 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Full Name *</Label>
                      <Input
                        className="h-11 rounded-xl"
                        value={newCustomer.full_name}
                        onChange={(event) =>
                          setNewCustomer({
                            ...newCustomer,
                            full_name: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        className="h-11 rounded-xl"
                        type="tel"
                        value={newCustomer.phone}
                        onChange={(event) =>
                          setNewCustomer({
                            ...newCustomer,
                            phone: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        className="h-11 rounded-xl"
                        type="email"
                        value={newCustomer.email}
                        onChange={(event) =>
                          setNewCustomer({
                            ...newCustomer,
                            email: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={creatingCustomer}
                      onClick={() => void createNewCustomer()}
                    >
                      {creatingCustomer ? 'Creating...' : 'Save Customer'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowNewCustomer(false)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4 border-t pt-7">
              <StepHeader
                number="2"
                title="Services"
                description="Select one or more compatible services."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => {
                  const checked = newAppt.service_ids.includes(service.id);

                  return (
                    <label
                      key={service.id}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                        checked
                          ? 'border-primary bg-primary/8'
                          : 'bg-card hover:border-primary/40'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleService(service.id, value === true)
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold">{service.name}</div>
                          <div className="font-bold">
                            €{Number(service.price).toFixed(2)}
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {service.duration} minutes
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 border-t pt-7">
              <StepHeader
                number="3"
                title="Professional"
                description="Only staff eligible for all selected services appear."
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    setNewAppt((current) => ({
                      ...current,
                      employee_id: '',
                      time: '',
                    }))
                  }
                  disabled={newAppt.service_ids.length === 0}
                  className={`rounded-2xl border p-4 text-left transition ${
                    newAppt.employee_id === ''
                      ? 'border-primary bg-primary/8'
                      : 'bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 font-semibold">Any Available</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Automatically assign an eligible professional
                  </div>
                </button>

                {eligibleStaff.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      setNewAppt((current) => ({
                        ...current,
                        employee_id: member.id,
                        time: '',
                      }))
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      newAppt.employee_id === member.id
                        ? 'border-primary bg-primary/8'
                        : 'bg-card hover:border-primary/40'
                    }`}
                  >
                    {member.photo_url ? (
                      <img
                        src={member.photo_url}
                        alt={member.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-bold">
                        {member.name?.charAt(0)}
                      </div>
                    )}

                    <div className="mt-3 font-semibold">{member.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Available professional
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4 border-t pt-7">
              <StepHeader
                number="4"
                title="Date & Available Time"
                description="Only real available times are displayed."
              />

              <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    className="h-11 rounded-xl"
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    value={newAppt.date}
                    onChange={(event) =>
                      setNewAppt((current) => ({
                        ...current,
                        date: event.target.value,
                        time: '',
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available Times *</Label>

                  {availabilityLoading ? (
                    <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                      Loading available times...
                    </div>
                  ) : selectedAppointmentClosure ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                      <div className="font-bold text-red-800">Business Closed</div>
                      <p className="mt-2 text-sm text-red-700">
                        {selectedAppointmentClosure.title}. Choose another date.
                      </p>
                    </div>
                  ) : newAppt.service_ids.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Select services first.
                    </div>
                  ) : uniqueAvailableTimes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No available appointments for this selection. Choose
                      another date or professional.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {uniqueAvailableTimes.map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant={
                            newAppt.time === time ? 'default' : 'outline'
                          }
                          className="rounded-xl"
                          onClick={() =>
                            setNewAppt((current) => ({ ...current, time }))
                          }
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t pt-7">
              <StepHeader
                number="5"
                title="Review"
                description="Confirm the booking details before creating the appointment."
              />

              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    rows={5}
                    className="rounded-xl"
                    placeholder="Optional notes for this appointment"
                    value={newAppt.notes}
                    onChange={(event) =>
                      setNewAppt((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="rounded-2xl border bg-muted/25 p-5">
                  <h3 className="font-bold">Booking Summary</h3>

                  <div className="mt-4 space-y-4 text-sm">
                    <SummaryItem
                      label="Customer"
                      value={selectedCustomer?.full_name || 'Not selected'}
                    />
                    <SummaryItem
                      label="Professional"
                      value={
                        staff.find(
                          (member) => member.id === newAppt.employee_id
                        )?.name || 'Any available'
                      }
                    />
                    <SummaryItem
                      label="Services"
                      value={
                        selectedServices
                          .map((service) => service.name)
                          .join(', ') || 'Not selected'
                      }
                    />
                    <SummaryItem
                      label="Date & Time"
                      value={
                        newAppt.time
                          ? `${newAppt.date} · ${newAppt.time}`
                          : 'Not selected'
                      }
                    />
                    <SummaryItem
                      label="Duration"
                      value={`${totalDuration} minutes`}
                    />
                    <SummaryItem
                      label="Total"
                      value={`€${totalPrice.toFixed(2)}`}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="sticky bottom-0 border-t bg-background px-5 py-4 sm:px-7">
            <Button
              variant="outline"
              disabled={creating}
              onClick={() => setIsNewDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={
                creating ||
                !newAppt.customer_id ||
                newAppt.service_ids.length === 0 ||
                !newAppt.time
              }
              onClick={() => void handleCreateAppointment()}
            >
              {creating ? 'Creating...' : 'Create Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  onCancel,
  onStatusChange,
}: {
  appointment: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: (id: string) => void;
  onStatusChange: (
    id: string,
    status:
      | 'pending'
      | 'confirmed'
      | 'arrived'
      | 'in_progress'
      | 'completed'
      | 'cancelled_by_business'
      | 'no_show'
  ) => Promise<boolean>;
}) {
  if (!appointment) return null;

  const start = parseISO(appointment.start_time);
  const end = appointment.end_time
    ? parseISO(appointment.end_time)
    : new Date(
        start.getTime() + Number(appointment.total_duration || 30) * 60_000
      );

  const derivedStatus = getDerivedStatus(appointment);
  const services =
    appointment.appointment_services
      ?.map((row: any) => row.services?.name)
      .filter(Boolean)
      .join(', ') || 'Appointment';

  const isCancelled = [
    'cancelled_by_business',
    'cancelled_by_customer',
  ].includes(appointment.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Appointment details
              </div>
              <DialogTitle className="mt-2 text-2xl">
                {appointment.customers?.full_name || 'Customer'}
              </DialogTitle>
            </div>
            <StatusBadge status={derivedStatus} />
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="rounded-2xl border bg-muted/20 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                icon={<CalendarDays className="h-4 w-4" />}
                label="Date"
                value={format(start, 'EEEE, MMMM d, yyyy')}
              />
              <Detail
                icon={<Clock3 className="h-4 w-4" />}
                label="Time"
                value={`${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`}
              />
              <Detail
                icon={<UserRound className="h-4 w-4" />}
                label="Professional"
                value={appointment.employees?.name || 'Unassigned'}
              />
              <Detail
                icon={<FileText className="h-4 w-4" />}
                label="Services"
                value={services}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ContactDetail
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={appointment.customers?.phone || 'Not provided'}
            />
            <ContactDetail
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={appointment.customers?.email || 'Not provided'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-muted-foreground">Booking reference</div>
              <div className="mt-1 font-semibold">
                {appointment.booking_reference
                  ? `#${appointment.booking_reference}`
                  : '—'}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="mt-1 text-xl font-bold">
                €{Number(appointment.total_price || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {appointment.notes && (
            <div className="rounded-xl border p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {appointment.notes}
              </p>
            </div>
          )}
        </div>

        {!isCancelled && appointment.status !== 'completed' && (
          <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
            {appointment.status !== 'arrived' &&
              appointment.status !== 'in_progress' && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void onStatusChange(appointment.id, 'arrived')
                  }
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Check In
                </Button>
              )}

            {appointment.status !== 'in_progress' && (
              <Button
                variant="outline"
                onClick={() =>
                  void onStatusChange(appointment.id, 'in_progress')
                }
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Service
              </Button>
            )}

            <Button
              onClick={() =>
                void onStatusChange(appointment.id, 'completed')
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark Completed
            </Button>

            <Button
              variant="outline"
              className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-700"
              onClick={() =>
                void onStatusChange(appointment.id, 'no_show')
              }
            >
              <UserX className="mr-2 h-4 w-4" />
              No Show
            </Button>

            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:col-span-2"
              onClick={() => void onCancel(appointment.id)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Appointment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');

  if (status === 'completed') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        Completed
      </Badge>
    );
  }

  if (status === 'cancelled_by_business' || status === 'cancelled_by_customer') {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{label}</Badge>
    );
  }

  if (status === 'no_show') {
    return (
      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
        No show
      </Badge>
    );
  }

  if (status === 'arrived') {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        Checked in
      </Badge>
    );
  }

  if (status === 'in_progress') {
    return (
      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
        In progress
      </Badge>
    );
  }

  return (
    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{label}</Badge>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ContactDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 break-words font-semibold">{value}</div>
      </div>
    </div>
  );
}

function getDerivedStatus(appointment: any) {
  if (
    [
      'completed',
      'cancelled_by_business',
      'cancelled_by_customer',
      'no_show',
      'arrived',
      'in_progress',
    ].includes(appointment.status)
  ) {
    return appointment.status;
  }

  const start = parseISO(appointment.start_time);
  const end = appointment.end_time
    ? parseISO(appointment.end_time)
    : new Date(
        start.getTime() + Number(appointment.total_duration || 30) * 60_000
      );

  return isAfter(new Date(), end)
    ? 'completed'
    : appointment.status || 'confirmed';
}

function StepHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
        {number}
      </div>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="max-w-[180px] text-right font-semibold">{value}</div>
    </div>
  );
}
