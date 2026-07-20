import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
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
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  UserPlus,
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

  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employeeServices, setEmployeeServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAppt, setNewAppt] = useState(EMPTY_BOOKING);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AvailabilityRow[]>([]);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId, currentDate]);

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
      setNewAppt((current) => ({ ...current, time: '' }));
    }
  }, [
    isNewDialogOpen,
    businessId,
    newAppt.date,
    newAppt.employee_id,
    newAppt.service_ids,
  ]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    const startDate = startOfWeek(currentDate);
    const endDate = addDays(startDate, 7);

    try {
      const [apptsRes, staffRes, servRes, custRes, employeeServicesRes] =
        await Promise.all([
          supabase
            .from('appointments')
            .select(
              '*, customers(full_name, email, phone), employees(name), appointment_services(id, price, duration, services(id, name))'
            )
            .eq('business_id', businessId)
            .gte('start_time', startDate.toISOString())
            .lt('start_time', endDate.toISOString()),
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
          supabase
            .from('employee_services')
            .select('employee_id, service_id'),
        ]);

      if (apptsRes.error) throw apptsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (servRes.error) throw servRes.error;
      if (custRes.error) throw custRes.error;
      if (employeeServicesRes.error) throw employeeServicesRes.error;

      setAppointments(apptsRes.data ?? []);
      setStaff(staffRes.data ?? []);
      setServices(servRes.data ?? []);
      setCustomers(custRes.data ?? []);
      setEmployeeServices(employeeServicesRes.data ?? []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!businessId || newAppt.service_ids.length === 0 || !newAppt.date) return;

    setAvailabilityLoading(true);
    setAvailableSlots([]);
    setNewAppt((current) => ({ ...current, time: '' }));

    try {
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
  };

  const openNewAppointment = () => {
    resetBookingForm();
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
          (row) =>
            row.employee_id === member.id && row.service_id === serviceId
        )
      )
    );
  }, [staff, employeeServices, newAppt.service_ids]);

  const uniqueAvailableTimes = useMemo(
    () =>
      Array.from(
        new Set(availableSlots.map((slot) => slot.available_time))
      ).sort((a, b) => a.localeCompare(b)),
    [availableSlots]
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
        [...current, data].sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        )
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
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create appointment');

      if (
        String(error.message || '')
          .toLowerCase()
          .includes('available')
      ) {
        await fetchAvailability();
      }
    } finally {
      setCreating(false);
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: string
  ) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(
        status === 'cancelled_by_business'
          ? 'Appointment removed and the time is available again'
          : 'Appointment updated'
      );
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update appointment');
    }
  };

  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }).map((_, index) =>
    addDays(weekStart, index)
  );
  const timeSlots = Array.from({ length: 10 }).map((_, index) => {
    const hour = index + 9;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col space-y-6">
      <div className="flex shrink-0 flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, 'MMMM yyyy')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button className="sm:ml-3" onClick={openNewAppointment}>
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      <Card className="flex min-h-[500px] flex-col overflow-hidden">
        <div className="grid shrink-0 grid-cols-8 border-b bg-muted/30">
          <div className="border-r p-3 text-center text-sm font-medium text-muted-foreground">
            Time
          </div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`border-r p-3 text-center last:border-r-0 ${
                isSameDay(day, new Date()) ? 'bg-primary/5' : ''
              }`}
            >
              <div className="text-xs uppercase text-muted-foreground">
                {format(day, 'EEE')}
              </div>
              <div
                className={`text-lg font-semibold ${
                  isSameDay(day, new Date()) ? 'text-primary' : ''
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              Loading...
            </div>
          )}

          <div className="relative grid min-w-max grid-cols-8 md:min-w-full">
            {timeSlots.map((time) => (
              <React.Fragment key={time}>
                <div className="relative -top-3 h-24 border-b border-r p-2 text-right text-xs text-muted-foreground">
                  {time}
                </div>

                {days.map((day) => {
                  const slotAppointments = appointments.filter((appointment) => {
                    const start = parseISO(appointment.start_time);
                    return (
                      isSameDay(start, day) &&
                      format(start, 'HH:00') === time
                    );
                  });

                  return (
                    <div
                      key={`${day.toISOString()}-${time}`}
                      className={`relative h-24 border-b border-r border-dashed p-1 last:border-r-0 ${
                        isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                      }`}
                    >
                      {slotAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className={`absolute left-1 right-1 z-[5] overflow-hidden rounded px-2 py-1 text-xs ${
                            appointment.status === 'confirmed'
                              ? 'bg-primary text-primary-foreground'
                              : appointment.status === 'pending'
                                ? 'border border-amber-500/30 bg-amber-500/20 text-amber-700'
                                : 'bg-muted text-muted-foreground'
                          }`}
                          style={{
                            top: `${
                              (parseISO(appointment.start_time).getMinutes() /
                                60) *
                              100
                            }%`,
                            height: `${Math.max(
                              (appointment.total_duration / 60) * 100,
                              33
                            )}%`,
                          }}
                        >
                          <div className="truncate font-semibold">
                            {appointment.customers?.full_name || 'Customer'}
                          </div>
                          <div className="truncate opacity-90">
                            {appointment.appointment_services
                              ?.map((row: any) => row.services?.name)
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>

      <section className="space-y-4 border-t pt-4">
        <h3 className="text-xl font-bold">Appointments List</h3>

        <Card>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto rounded-md bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Date & Time
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Customer
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Services
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Staff
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {appointments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No appointments found for this week.
                      </td>
                    </tr>
                  ) : (
                    [...appointments]
                      .sort(
                        (a, b) =>
                          new Date(a.start_time).getTime() -
                          new Date(b.start_time).getTime()
                      )
                      .map((appointment) => (
                        <tr
                          key={appointment.id}
                          className="border-b transition-colors hover:bg-muted/30"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-medium">
                            {format(
                              new Date(appointment.start_time),
                              'MMM d, yyyy'
                            )}
                            <br />
                            <span className="font-normal text-muted-foreground">
                              {format(
                                new Date(appointment.start_time),
                                'HH:mm'
                              )}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="font-semibold">
                              {appointment.customers?.full_name || 'Customer'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {appointment.booking_reference
                                ? `#${appointment.booking_reference}`
                                : ''}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="max-w-[240px]">
                              {appointment.appointment_services
                                ?.map((row: any) => row.services?.name)
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {appointment.total_duration} min · €
                              {Number(appointment.total_price).toFixed(2)}
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {appointment.employees?.name || 'Any available'}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge
                              variant={
                                appointment.status === 'confirmed'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="capitalize"
                            >
                              {String(appointment.status).replace(/_/g, ' ')}
                            </Badge>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {![
                              'completed',
                              'cancelled_by_customer',
                              'cancelled_by_business',
                              'no_show',
                            ].includes(appointment.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    'Remove this appointment? The time will become available again.'
                                  );

                                  if (confirmed) {
                                    void updateAppointmentStatus(
                                      appointment.id,
                                      'cancelled_by_business'
                                    );
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={isNewDialogOpen}
        onOpenChange={(open) => {
          if (!creating) {
            setIsNewDialogOpen(open);
            if (!open) resetBookingForm();
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>

          <div className="space-y-8 py-4">
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">1. Customer</h3>
                <p className="text-sm text-muted-foreground">
                  Search an existing customer or create a new one.
                </p>
              </div>

              {!showNewCustomer ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name, email or phone"
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(event.target.value)
                      }
                    />
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className={`w-full rounded-md border p-3 text-left transition-colors ${
                          newAppt.customer_id === customer.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() =>
                          setNewAppt((current) => ({
                            ...current,
                            customer_id: customer.id,
                          }))
                        }
                      >
                        <div className="font-medium">{customer.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[customer.phone, customer.email]
                            .filter(Boolean)
                            .join(' · ') || 'No contact details'}
                        </div>
                      </button>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
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
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Full Name *</Label>
                      <Input
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

                  <div className="flex gap-2">
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

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">2. Services</h3>
                <p className="text-sm text-muted-foreground">
                  Select one or more compatible services.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => {
                  const checked = newAppt.service_ids.includes(service.id);

                  return (
                    <label
                      key={service.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                        checked ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleService(service.id, value === true)
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium">{service.name}</div>
                          <div className="font-semibold">
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

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">3. Professional</h3>
                <p className="text-sm text-muted-foreground">
                  Only eligible staff members are shown.
                </p>
              </div>

              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newAppt.employee_id}
                onChange={(event) =>
                  setNewAppt((current) => ({
                    ...current,
                    employee_id: event.target.value,
                    time: '',
                  }))
                }
                disabled={newAppt.service_ids.length === 0}
              >
                <option value="">Any Available Professional</option>
                {eligibleStaff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">4. Date & Available Time</h3>
                <p className="text-sm text-muted-foreground">
                  Only real available appointment times are displayed.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
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
                  <div className="rounded-lg border p-5 text-center text-sm text-muted-foreground">
                    Loading available times...
                  </div>
                ) : newAppt.service_ids.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Select services first.
                  </div>
                ) : uniqueAvailableTimes.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                    No available appointments for this selection. Choose another
                    date or professional.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {uniqueAvailableTimes.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant={newAppt.time === time ? 'default' : 'outline'}
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
            </section>

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">5. Booking Details</h3>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
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
            </section>

            <section className="rounded-xl border bg-muted/30 p-5">
              <h3 className="font-semibold">Booking Summary</h3>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <SummaryItem
                  label="Customer"
                  value={selectedCustomer?.full_name || 'Not selected'}
                />
                <SummaryItem
                  label="Professional"
                  value={
                    staff.find((member) => member.id === newAppt.employee_id)
                      ?.name || 'Any available'
                  }
                />
                <SummaryItem
                  label="Services"
                  value={
                    selectedServices.map((service) => service.name).join(', ') ||
                    'Not selected'
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
            </section>
          </div>

          <DialogFooter>
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
