import React, { useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  Clock,
  History,
  MapPin,
  Scissors,
  UserCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type StoreContext = {
  business: any;
  openCustomerSignIn: () => void;
};

export default function CustomerPortal() {
  const { business, openCustomerSignIn } = useOutletContext<StoreContext>();
  const { user, profile, loading: authLoading } = useAuth();

  const [membership, setMembership] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && business?.id) void fetchCustomerPortal();
  }, [user?.id, business?.id]);

  const fetchCustomerPortal = async () => {
    setLoading(true);

    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from('customer_business_profiles')
        .select('*')
        .eq('business_id', business.id)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membershipData) {
        const { error: joinError } = await supabase.rpc(
          'join_business_as_customer',
          {
            p_business_id: business.id,
            p_phone: null,
          }
        );

        if (joinError) throw joinError;

        const { data: refreshedMembership, error: refreshedError } =
          await supabase
            .from('customer_business_profiles')
            .select('*')
            .eq('business_id', business.id)
            .eq('user_id', user?.id)
            .single();

        if (refreshedError) throw refreshedError;
        setMembership(refreshedMembership);
      } else {
        setMembership(membershipData);
      }

      const { data: appointmentData, error: appointmentsError } =
        await supabase.rpc('get_my_business_appointments', {
          p_business_id: business.id,
        });

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentData ?? []);
    } catch (error: any) {
      console.error('Customer portal error:', error);
      toast.error(error.message || 'Failed to load your appointments.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
        <Card className="w-full">
          <CardContent className="space-y-5 p-8 text-center">
            <UserCircle className="mx-auto h-14 w-14 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Customer Account</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to see your appointments and history for {business.name}.
              </p>
            </div>
            <Button className="w-full" onClick={openCustomerSignIn}>
              Sign In
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to={`/app/${business.slug}/book`}>Book as Guest</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        Loading your account...
      </div>
    );
  }

  const now = new Date();
  const upcoming = appointments.filter(
    (appointment) =>
      new Date(appointment.start_time) >= now &&
      !['cancelled_by_customer', 'cancelled_by_business'].includes(
        appointment.status
      )
  );
  const history = appointments.filter(
    (appointment) =>
      new Date(appointment.start_time) < now ||
      ['cancelled_by_customer', 'cancelled_by_business'].includes(
        appointment.status
      )
  );

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 pb-24">
      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm text-muted-foreground">Customer account</div>
            <h1 className="mt-1 text-2xl font-bold">
              Welcome, {membership?.display_name || profile?.full_name || 'Customer'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your appointments and history at {business.name}.
            </p>
          </div>

          <Button asChild>
            <Link to={`/app/${business.slug}/book`}>
              <CalendarDays className="mr-2 h-4 w-4" />
              New Appointment
            </Link>
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Upcoming Appointments</h2>
        </div>

        {upcoming.length === 0 ? (
          <EmptyAppointmentState
            icon={<CalendarDays className="h-9 w-9" />}
            text="You have no upcoming appointments at this store."
            businessSlug={business.slug}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((appointment) => (
              <AppointmentCard
                key={appointment.appointment_id}
                appointment={appointment}
                business={business}
                upcoming
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Appointment History</h2>
        </div>

        {history.length === 0 ? (
          <EmptyAppointmentState
            icon={<History className="h-9 w-9" />}
            text="Your appointment history will appear here."
            businessSlug={business.slug}
          />
        ) : (
          <div className="space-y-3">
            {history.map((appointment) => (
              <AppointmentCard
                key={appointment.appointment_id}
                appointment={appointment}
                business={business}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({
  appointment,
  business,
  upcoming = false,
}: {
  appointment: any;
  business: any;
  upcoming?: boolean;
}) {
  const services = Array.isArray(appointment.services)
    ? appointment.services
    : [];

  return (
    <Card className={upcoming ? 'border-primary/20' : undefined}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              {services.map((service: any) => service.name).join(', ') ||
                'Appointment'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Reference #{appointment.booking_reference}
            </div>
          </div>
          <Badge variant={upcoming ? 'default' : 'secondary'} className="capitalize">
            {String(appointment.status).replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy · HH:mm')}
          </div>

          {appointment.employee_name && (
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              {appointment.employee_name}
            </div>
          )}

          {business.address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {business.address}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <div className="text-xs text-muted-foreground">
              {appointment.total_duration} minutes
            </div>
            <div className="font-bold">
              €{Number(appointment.total_price).toFixed(2)}
            </div>
          </div>

          {!upcoming && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/${business.slug}/book`}>Book Again</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyAppointmentState({
  icon,
  text,
  businessSlug,
}: {
  icon: React.ReactNode;
  text: string;
  businessSlug: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center p-8 text-center">
        <div className="text-muted-foreground">{icon}</div>
        <p className="mt-3 text-sm text-muted-foreground">{text}</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to={`/app/${businessSlug}/book`}>Book Appointment</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
