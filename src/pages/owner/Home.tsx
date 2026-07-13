import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, DollarSign, ArrowUpRight, Scissors, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export default function OwnerHome() {
  const { businessMemberships } = useAuth();
  const business = businessMemberships[0]?.businesses;
  
  const [stats, setStats] = useState({
    todayAppts: 0,
    pendingAppts: 0,
    expectedRevenue: 0,
    newCustomers: 0,
    activeServices: 0
  });
  
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) {
      fetchDashboardData();
    }
  }, [business?.id]);

  const fetchDashboardData = async () => {
    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      // Today's appointments
      const { data: todayAppts } = await supabase
        .from('appointments')
        .select('*, customers(full_name), appointment_services(services(name))')
        .eq('business_id', business.id)
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .neq('status', 'cancelled_by_business')
        .neq('status', 'cancelled_by_customer')
        .order('start_time', { ascending: true });

      // New customers this month
      const { count: newCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      // Active services
      const { count: activeServices } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('is_active', true);

      const appointments = todayAppts || [];
      const pendingCount = appointments.filter(a => a.status === 'pending').length;
      const expectedRev = appointments.reduce((sum, a) => sum + (a.total_price || 0), 0);

      setStats({
        todayAppts: appointments.length,
        pendingAppts: pendingCount,
        expectedRevenue: expectedRev,
        newCustomers: newCustomers || 0,
        activeServices: activeServices || 0
      });
      
      setTodaySchedule(appointments);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!business) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening at {business.name}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/book/${business.slug}`} target="_blank">
              View Booking Page
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/calendar">+ New Appointment</Link>
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.todayAppts}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.pendingAppts} pending confirmation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : `$${stats.expectedRevenue.toFixed(2)}`}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on today's bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.newCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Services</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.activeServices}</div>
            <p className="text-xs text-muted-foreground mt-1">Available for booking</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Appointments List */}
        <Card className="col-span-1 lg:col-span-2 h-full flex flex-col">
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : todaySchedule.length > 0 ? `You have ${todaySchedule.length} appointment${todaySchedule.length > 1 ? 's' : ''} today.` : 'You have no appointments scheduled for today.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading schedule...</div>
            ) : todaySchedule.length > 0 ? (
              <div className="space-y-4">
                {todaySchedule.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex flex-col items-center justify-center text-primary font-bold shrink-0 border border-primary/20">
                        <span className="text-sm leading-none">{format(new Date(app.start_time), 'HH:mm')}</span>
                      </div>
                      <div>
                        <div className="font-bold text-base">{app.customers?.full_name || 'Guest'}</div>
                        <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {app.appointment_services?.map((s: any) => s.services?.name).join(', ')} • {app.total_duration} mins
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        app.status === 'confirmed' ? 'bg-primary/20 text-primary' :
                        app.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {app.status}
                      </span>
                      <div className="text-sm font-semibold">${app.total_price?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted mb-4" />
                <h3 className="text-lg font-medium">No appointments today</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                  Share your booking link with customers or add a new appointment manually.
                </p>
                <div className="mt-6 flex gap-4">
                  <Button asChild>
                    <Link to="/dashboard/calendar">Book Appointment</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions / Status */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" className="w-full justify-between group" asChild>
                <Link to="/dashboard/services">
                  <span>Manage Services</span>
                  <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-between group" asChild>
                <Link to="/dashboard/staff">
                  <span>Manage Staff Schedule</span>
                  <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </Button>
               <Button variant="ghost" className="w-full justify-between group" asChild>
                <Link to="/dashboard/settings">
                  <span>Business Settings</span>
                  <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                Trial Active
              </CardTitle>
              <CardDescription>You are on day 1 of your 14-day Premium trial.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="default" className="w-full" asChild>
                <Link to="/dashboard/billing">View Plans</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}