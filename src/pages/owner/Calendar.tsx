import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export default function Calendar() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Appointment State
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({
    customer_id: '',
    employee_id: '',
    service_ids: [] as string[],
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00'
  });

  // Edit Appointment State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, currentDate]);

  const fetchData = async () => {
    setLoading(true);
    const startDate = startOfWeek(currentDate);
    const endDate = addDays(startDate, 7);

    try {
      const [apptsRes, staffRes, servRes, custRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, customers(full_name), employees(name), appointment_services(services(name))')
          .eq('business_id', businessId)
          .gte('start_time', startDate.toISOString())
          .lt('start_time', endDate.toISOString()),
        supabase.from('employees').select('*').eq('business_id', businessId).eq('is_active', true),
        supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
        supabase.from('customers').select('*').eq('business_id', businessId).order('full_name')
      ]);

      setAppointments(apptsRes.data || []);
      setStaff(staffRes.data || []);
      setServices(servRes.data || []);
      setCustomers(custRes.data || []);
      
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(new Date());

  const handleCreateAppointment = async () => {
    if (!newAppt.customer_id || newAppt.service_ids.length === 0 || !newAppt.date || !newAppt.time) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const selectedServices = services.filter(s => newAppt.service_ids.includes(s.id));
      if (selectedServices.length === 0) throw new Error('Services not found');

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
      const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

      // Check availability using RPC
      const startTimeISO = new Date(`${newAppt.date}T${newAppt.time}`).toISOString();
      const endTimeISO = new Date(new Date(startTimeISO).getTime() + totalDuration * 60000).toISOString();
      
      const { data: appt, error } = await supabase.from('appointments').insert({
        business_id: businessId,
        customer_id: newAppt.customer_id,
        employee_id: newAppt.employee_id || null,
        start_time: startTimeISO,
        end_time: endTimeISO,
        total_duration: totalDuration,
        total_price: totalPrice,
        status: 'confirmed'
      }).select().single();

      if (error) throw error;

      const appointmentServices = selectedServices.map(s => ({
        appointment_id: appt.id,
        service_id: s.id,
        price: s.price,
        duration: s.duration
      }));

      await supabase.from('appointment_services').insert(appointmentServices);

      toast.success('Appointment created');
      setIsNewDialogOpen(false);
      setNewAppt({
        customer_id: '',
        employee_id: '',
        service_ids: [],
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '10:00'
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create appointment');
    }
  };

  const handleDecline = async (app: any) => {
    if (!confirm('Are you sure you want to decline this appointment? The customer will be informed immediately.')) return;
    try {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled_by_business' }).eq('id', app.id);
      if (error) throw error;
      toast.success('Appointment declined. Customer has been informed.');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to decline appointment');
    }
  };

  const handleEditSave = async () => {
    if (!editingAppt) return;
    try {
      const startTimeISO = new Date(`${editingAppt.date}T${editingAppt.time}`).toISOString();
      
      const { error } = await supabase.from('appointments').update({
        start_time: startTimeISO,
        employee_id: editingAppt.employee_id || null,
        status: editingAppt.status
      }).eq('id', editingAppt.id);

      if (error) throw error;
      toast.success('Appointment updated');
      setIsEditDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update appointment');
    }
  };

  // Generate week days
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  // Generate time slots (9 AM to 6 PM)
  const timeSlots = Array.from({ length: 10 }).map((_, i) => {
    const hour = i + 9;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
          <p className="text-muted-foreground text-sm">{format(weekStart, 'MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={handleToday}>Today</Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
          <Button className="ml-4" onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Appointment
          </Button>
        </div>
      </div>

      <Card className="flex flex-col overflow-hidden min-h-[500px]">
        <div className="grid grid-cols-8 border-b border-border bg-muted/30 shrink-0">
          <div className="p-3 text-center border-r border-border font-medium text-sm text-muted-foreground">Time</div>
          {days.map((day, i) => (
            <div key={i} className={`p-3 text-center border-r border-border last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-primary/5' : ''}`}>
              <div className="text-xs text-muted-foreground uppercase">{format(day, 'EEE')}</div>
              <div className={`text-lg font-semibold ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0 relative">
          {loading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">Loading...</div>}
          
          <div className="grid grid-cols-8 relative min-w-max md:min-w-full">
            {timeSlots.map((time, i) => (
              <React.Fragment key={time}>
                <div className="p-2 text-right text-xs text-muted-foreground border-r border-b border-border h-24 relative -top-3">
                  {time}
                </div>
                {days.map((day, j) => {
                  // Find appointments for this slot
                  const slotAppts = appointments.filter(a => {
                    const start = parseISO(a.start_time);
                    return isSameDay(start, day) && format(start, 'HH:00') === time;
                  });

                  return (
                    <div key={`${i}-${j}`} className={`border-b border-r border-border border-dashed last:border-r-0 p-1 relative h-24 ${isSameDay(day, new Date()) ? 'bg-primary/5' : ''}`}>
                      {slotAppts.map(appt => (
                        <div 
                          key={appt.id} 
                          className={`absolute left-1 right-1 rounded px-2 py-1 text-xs overflow-hidden ${
                            appt.status === 'confirmed' ? 'bg-primary text-primary-foreground' :
                            appt.status === 'pending' ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30' :
                            'bg-muted text-muted-foreground'
                          }`}
                          style={{
                            top: `${(parseISO(appt.start_time).getMinutes() / 60) * 100}%`,
                            height: `${(appt.total_duration / 60) * 100}%`,
                            minHeight: '2rem',
                            zIndex: 5
                          }}
                        >
                          <div className="font-semibold truncate">{appt.customers?.full_name}</div>
                          <div className="truncate opacity-90">{appt.appointment_services?.[0]?.services?.name}</div>
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

      {/* Appointments List */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-xl font-bold">Appointments List</h3>
        <Card>
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto bg-card rounded-md">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Time</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Service</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Staff</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground whitespace-nowrap">No appointments found for this week.</td>
                    </tr>
                  ) : (
                    appointments.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map(app => (
                      <tr key={app.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {format(new Date(app.start_time), 'MMM d, yyyy')}<br />
                          <span className="text-muted-foreground font-normal">{format(new Date(app.start_time), 'HH:mm')}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold">{app.customers?.full_name || 'Guest'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="line-clamp-1 max-w-[200px]">
                            {app.appointment_services?.map((s: any) => s.services?.name).join(', ')}
                          </div>
                          <div className="text-xs text-muted-foreground">{app.total_duration} mins</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{app.employees?.name || 'Any'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            app.status === 'confirmed' ? 'bg-primary/20 text-primary' :
                            app.status === 'cancelled_by_business' ? 'bg-destructive/20 text-destructive' :
                            app.status === 'cancelled_by_customer' ? 'bg-destructive/20 text-destructive' :
                            'bg-secondary text-secondary-foreground'
                          }`}>
                            {app.status === 'cancelled_by_business' ? 'Cancelled by Business' : 
                             app.status === 'cancelled_by_customer' ? 'Cancelled by Customer' : 
                             app.status.charAt(0).toUpperCase() + app.status.slice(1).replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingAppt({
                              id: app.id,
                              customer_name: app.customers?.full_name,
                              employee_id: app.employee_id || '',
                              date: format(new Date(app.start_time), 'yyyy-MM-dd'),
                              time: format(new Date(app.start_time), 'HH:mm'),
                              status: app.status
                            });
                            setIsEditDialogOpen(true);
                          }}>
                            Edit
                          </Button>
                          {app.status !== 'cancelled_by_business' && app.status !== 'cancelled_by_customer' && app.status !== 'completed' && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDecline(app)}>
                              Decline
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
      </div>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Appointment: {editingAppt?.customer_name}</DialogTitle>
          </DialogHeader>
          {editingAppt && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_staff">Staff Member</Label>
                <select 
                  id="edit_staff" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingAppt.employee_id}
                  onChange={(e) => setEditingAppt({...editingAppt, employee_id: e.target.value})}
                >
                  <option value="">Any Available</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_date">Date *</Label>
                  <Input id="edit_date" type="date" value={editingAppt.date} onChange={(e) => setEditingAppt({...editingAppt, date: e.target.value})} className="px-3" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_time">Time *</Label>
                  <Input id="edit_time" type="time" value={editingAppt.time} onChange={(e) => setEditingAppt({...editingAppt, time: e.target.value})} className="px-3" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_status">Status</Label>
                <select 
                  id="edit_status" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingAppt.status}
                  onChange={(e) => setEditingAppt({...editingAppt, status: e.target.value})}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="arrived">Arrived</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled_by_customer">Cancelled by Customer</option>
                  <option value="cancelled_by_business">Cancelled by Business</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px] w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer *</Label>
              <select 
                id="customer" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newAppt.customer_id}
                onChange={(e) => setNewAppt({...newAppt, customer_id: e.target.value})}
              >
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Services * (Hold Ctrl/Cmd to select multiple)</Label>
              <select 
                multiple
                className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newAppt.service_ids}
                onChange={(e) => {
                  const options = e.target.options;
                  const selected = [];
                  for (let i = 0; i < options.length; i++) {
                    if (options[i].selected) {
                      selected.push(options[i].value);
                    }
                  }
                  setNewAppt({...newAppt, service_ids: selected});
                }}
              >
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}m - ${s.price})</option>)}
              </select>
            </div>

             <div className="grid gap-2">
              <Label htmlFor="staff">Staff Member (Optional)</Label>
              <select 
                id="staff" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newAppt.employee_id}
                onChange={(e) => setNewAppt({...newAppt, employee_id: e.target.value})}
              >
                <option value="">Any Available</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={newAppt.date} onChange={(e) => setNewAppt({...newAppt, date: e.target.value})} className="px-3" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time">Time *</Label>
                <Input id="time" type="time" value={newAppt.time} onChange={(e) => setNewAppt({...newAppt, time: e.target.value})} className="px-3" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAppointment}>Create Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}