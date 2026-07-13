import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function CustomerPortal() {
  const { user, profile } = useAuth();
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
      // Find customer records linked to this user
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id);

      if (custError) throw custError;

      if (custData && custData.length > 0) {
        const customerIds = custData.map(c => c.id);
        
        const { data: apptData, error: apptError } = await supabase
          .from('appointments')
          .select('*, businesses(name, address), employees(name), appointment_services(services(name))')
          .in('customer_id', customerIds)
          .order('start_time', { ascending: false });

        if (apptError) throw apptError;
        setAppointments(apptData || []);
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const upcomingAppts = appointments.filter(a => new Date(a.start_time) >= new Date() && a.status !== 'cancelled_by_customer' && a.status !== 'cancelled_by_business');
  const pastAppts = appointments.filter(a => new Date(a.start_time) < new Date() || a.status === 'cancelled_by_customer' || a.status === 'cancelled_by_business');

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card px-4 md:px-8 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">My Bookings</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden sm:inline-block">{profile?.full_name}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Upcoming Appointments
          </h2>
          
          {upcomingAppts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <p>You have no upcoming appointments.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingAppts.map(appt => (
                <Card key={appt.id} className="border-primary/20">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-lg">{appt.businesses?.name}</div>
                      <div className="bg-primary/10 text-primary text-xs px-2 py-1 rounded font-medium capitalize">
                        {appt.status.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="text-sm font-medium">{appt.appointment_services?.[0]?.services?.name}</div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground pt-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {format(new Date(appt.start_time), 'EEEE, MMMM d, yyyy @ h:mm a')}
                      </div>
                      {appt.businesses?.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {appt.businesses?.address}
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-4 flex gap-2">
                      <Button variant="outline" className="w-full text-xs h-8" onClick={() => toast.info('Rescheduling coming soon')}>Reschedule</Button>
                      <Button variant="outline" className="w-full text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => toast.info('Cancellation coming soon')}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 mt-8">Past Appointments</h2>
          {pastAppts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <p>No past appointments.</p>
              </CardContent>
            </Card>
          ) : (
             <div className="space-y-3">
              {pastAppts.map(appt => (
                <Card key={appt.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="font-medium">{appt.appointment_services?.[0]?.services?.name}</div>
                      <div className="text-sm text-muted-foreground">{appt.businesses?.name}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(appt.start_time), 'PPp')}</div>
                    </div>
                    <div className="flex flex-col items-end">
                       <div className={`text-xs font-medium px-2 py-1 rounded ${
                         appt.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                       }`}>
                         {appt.status.replace(/_/g, ' ')}
                       </div>
                       <Button variant="link" className="px-0 mt-1 h-auto text-sm" onClick={() => toast.info('Rebooking coming soon')}>Book Again</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}