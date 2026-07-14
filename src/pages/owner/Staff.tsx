import React, { useEffect, useMemo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/ui/image-uploader';
import { toast } from 'sonner';
import { Edit, Plus, Trash2 } from 'lucide-react';

type WeeklyScheduleDay = {
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  startTime: string;
  endTime: string;
};

const DEFAULT_SCHEDULE: WeeklyScheduleDay[] = [
  { dayOfWeek: 1, label: 'Monday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, label: 'Tuesday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, label: 'Wednesday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, label: 'Thursday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, label: 'Friday', isClosed: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 6, label: 'Saturday', isClosed: false, startTime: '09:00', endTime: '14:00' },
  { dayOfWeek: 0, label: 'Sunday', isClosed: true, startTime: '09:00', endTime: '17:00' },
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
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] =
    useState<WeeklyScheduleDay[]>(DEFAULT_SCHEDULE);

  useEffect(() => {
    if (businessId) {
      void fetchData();
    }
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const [staffResult, servicesResult] = await Promise.all([
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
      ]);

      if (staffResult.error) throw staffResult.error;
      if (servicesResult.error) throw servicesResult.error;

      setStaff(staffResult.data ?? []);
      setServices(servicesResult.data ?? []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setSelectedServiceIds([]);
    setWeeklySchedule(DEFAULT_SCHEDULE.map((day) => ({ ...day })));
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
      const [serviceAssignments, workingHours] = await Promise.all([
        supabase
          .from('employee_services')
          .select('service_id')
          .eq('employee_id', employee.id),
        supabase
          .from('working_hours')
          .select('day_of_week, start_time, end_time, is_closed')
          .eq('business_id', businessId)
          .eq('employee_id', employee.id),
      ]);

      if (serviceAssignments.error) throw serviceAssignments.error;
      if (workingHours.error) throw workingHours.error;

      setSelectedServiceIds(
        (serviceAssignments.data ?? []).map((row: any) => row.service_id)
      );

      const savedHours = new Map(
        (workingHours.data ?? []).map((row: any) => [row.day_of_week, row])
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
      console.error('Error loading staff details:', error);
      toast.error(error.message || 'Failed to load staff details');
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

  const validateForm = () => {
    if (!businessId) {
      toast.error('Business could not be identified');
      return false;
    }

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return false;
    }

    if (selectedServiceIds.length === 0) {
      toast.error('Select at least one service for this staff member');
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
      toast.error(`Enter valid working hours for ${invalidDay.label}`);
      return false;
    }

    if (
      formData.inactive_start_date &&
      formData.inactive_end_date &&
      formData.inactive_start_date > formData.inactive_end_date
    ) {
      toast.error('Inactive end date must be after the start date');
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

      if (!employeeId) {
        throw new Error('Employee record was not created');
      }

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

      const workingHourRows = weeklySchedule.map((day) => ({
        business_id: businessId,
        employee_id: employeeId,
        day_of_week: day.dayOfWeek,
        start_time: day.startTime,
        end_time: day.endTime,
        is_closed: day.isClosed,
      }));

      const { error: insertHoursError } = await supabase
        .from('working_hours')
        .insert(workingHourRows);

      if (insertHoursError) throw insertHoursError;

      toast.success(
        editingId ? 'Staff member updated successfully' : 'Staff member added successfully'
      );

      setIsDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error: any) {
      console.error('Error saving staff member:', error);
      toast.error(error.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Staff member removed');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove staff member');
    }
  };

  const serviceNamesById = useMemo(
    () => new Map(services.map((service) => [service.id, service.name])),
    [services]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff</h2>
          <p className="text-sm text-muted-foreground">
            Manage staff profiles, services and weekly availability.
          </p>
        </div>

        <Button onClick={() => void handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto rounded-md bg-card">
            <Table className="min-w-[850px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Loading staff...
                    </TableCell>
                  </TableRow>
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No staff members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {member.photo_url ? (
                            <img
                              src={member.photo_url}
                              alt={member.name}
                              className="h-11 w-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted font-semibold">
                              {member.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}

                          <div>
                            <div className="font-medium">{member.name}</div>
                            {member.bio && (
                              <div className="max-w-sm truncate text-xs text-muted-foreground">
                                {member.bio}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>{member.email || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.phone || '-'}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            member.is_active
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleOpenDialog(member)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(member.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Staff Member' : 'Add Staff Member'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8 py-4">
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Add the employee details customers will see.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Photo</Label>
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
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData({ ...formData, name: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData({ ...formData, phone: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData({ ...formData, email: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="bio">Short Biography</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    placeholder="Experience, specialties and a short introduction."
                    value={formData.bio}
                    onChange={(event) =>
                      setFormData({ ...formData, bio: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Active staff can receive new bookings.
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

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">Services Offered *</h3>
                <p className="text-sm text-muted-foreground">
                  Select every service this staff member can perform.
                </p>
              </div>

              {services.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Create at least one active service before adding staff availability.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {services.map((service) => {
                    const checked = selectedServiceIds.includes(service.id);

                    return (
                      <label
                        key={service.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleService(service.id, value === true)
                          }
                        />

                        <div>
                          <div className="font-medium">{service.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {service.duration} min · €{Number(service.price).toFixed(2)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">Weekly Schedule *</h3>
                <p className="text-sm text-muted-foreground">
                  These hours determine the appointment slots customers can book.
                </p>
              </div>

              <div className="space-y-3">
                {weeklySchedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="grid items-center gap-3 rounded-lg border p-4 sm:grid-cols-[130px_90px_1fr_1fr]"
                  >
                    <div className="font-medium">{day.label}</div>

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
                        {day.isClosed ? 'Closed' : 'Open'}
                      </span>
                    </div>

                    <Input
                      type="time"
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

            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="font-semibold">Temporary Inactive Period</h3>
                <p className="text-sm text-muted-foreground">
                  Use this for holidays, leave or another temporary absence.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="inactive_start_date">Start Date</Label>
                  <Input
                    id="inactive_start_date"
                    type="date"
                    value={formData.inactive_start_date}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        inactive_start_date: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="inactive_end_date">End Date</Label>
                  <Input
                    id="inactive_end_date"
                    type="date"
                    value={formData.inactive_end_date}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        inactive_end_date: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={saving || services.length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving...' : 'Save Staff Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
