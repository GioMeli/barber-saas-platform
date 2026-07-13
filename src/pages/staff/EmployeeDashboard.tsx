import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Clock, MapPin } from 'lucide-react';
import { format, isToday } from 'date-fns';

export default function EmployeeDashboard() {
  const { user, profile } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Find employee record
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*, businesses(name, address)')
        .eq('user_id', user?.id)
        .single();

      if (empError) throw empError;
      setEmployee(empData);

      if (empData) {
        // Get today's appointments
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const { data: apptData, error: apptError } = await supabase
          .from('appointments')
          .select('*, customers(full_name, phone), appointment_services(services(name))')
          .eq('employee_id', empData.id)
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString())
          .order('start_time', { ascending: true });

        if (apptError) throw apptError;
        setAppointments(apptData || []);
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
      fetchData(); // Refresh list
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!employee) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full text-center p-8">
        <h2 className="text-xl font-bold mb-2">No Staff Profile Found</h2>
        <p className="text-muted-foreground mb-6">Your account is not linked to any active staff profile.</p>
        <Button onClick={handleLogout} variant="outline">Sign Out</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card px-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">{employee.businesses?.name}</h1>
          <p className="text-xs text-muted-foreground">Staff Portal</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {employee.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold">Hi, {employee.name}</h2>
            <p className="text-muted-foreground">Here is your schedule for today.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Today's Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {appointments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No appointments scheduled for today.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {appointments.map(appt => (
                  <div key={appt.id} className="p-4 flex flex-col sm:flex-row gap-4 justify-between hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(appt.start_time), 'h:mm a')} 
                        <span className="text-muted-foreground text-sm font-normal">({appt.total_duration}m)</span>
                      </div>
                      <div className="font-bold text-lg">{appt.customers?.full_name}</div>
                      <div className="text-sm text-muted-foreground">{appt.appointment_services?.[0]?.services?.name}</div>
                      {appt.customers?.phone && <div className="text-sm">{appt.customers?.phone}</div>}
                    </div>
                    
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={appt.status}
                        onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="arrived">Arrived</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="no_show">No Show</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}