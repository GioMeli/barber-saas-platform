import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  MapPin,
  Scissors,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { addDays, format, isSameDay, parseISO, startOfToday } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';

type StoreContext = {
  business: any;
};

const STEPS = [
  { id: 1, labelKey: 'publicBooking.steps.services' },
  { id: 2, labelKey: 'publicBooking.steps.professional' },
  { id: 3, labelKey: 'publicBooking.steps.dateTime' },
  { id: 4, labelKey: 'publicBooking.steps.details' },
] as const;

export default function PublicBooking() {
  const { business } = useOutletContext<StoreContext>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const currency = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
    [locale]
  );

  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    format(startOfToday(), 'yyyy-MM-dd')
  );
  const [dateWindowStart, setDateWindowStart] = useState(startOfToday());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    notes: '',
  });
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  useEffect(() => {
    if (business?.id) void fetchServicesAndStaff();
  }, [business?.id]);

  useEffect(() => {
    if (services.length === 0 && staff.length === 0) return;

    const requestedServiceId = searchParams.get('service');
    const requestedStaffId = searchParams.get('staff');

    if (requestedServiceId) {
      const requestedService = services.find(
        (service) => service.id === requestedServiceId
      );

      if (
        requestedService &&
        !selectedServices.some((service) => service.id === requestedService.id)
      ) {
        setSelectedServices([requestedService]);
      }
    }

    if (
      requestedStaffId &&
      staff.some((member) => member.id === requestedStaffId)
    ) {
      setSelectedStaff(requestedStaffId);
    }
  }, [services, staff, searchParams]);

  useEffect(() => {
    if (!user || !business?.id) return;

    const loadCustomerProfile = async () => {
      setCustomerProfileLoading(true);

      try {
        const { data, error } = await supabase
          .from('customer_business_profiles')
          .select('display_name, email, phone')
          .eq('business_id', business.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        setCustomerDetails((current) => ({
          ...current,
          name:
            data?.display_name ||
            user.user_metadata?.full_name ||
            current.name,
          email: data?.email || user.email || current.email,
          phone: data?.phone || current.phone,
        }));
      } catch (error) {
        console.error('Unable to load customer profile:', error);

        setCustomerDetails((current) => ({
          ...current,
          name: user.user_metadata?.full_name || current.name,
          email: user.email || current.email,
        }));
      } finally {
        setCustomerProfileLoading(false);
      }
    };

    void loadCustomerProfile();
  }, [user?.id, business?.id]);

  useEffect(() => {
    if (step === 3 && selectedServices.length > 0 && selectedDate) {
      void fetchAvailableTimes();
    }
  }, [step, selectedDate, selectedStaff, selectedServices]);

  const fetchServicesAndStaff = async () => {
    setLoading(true);

    try {
      const [servicesResult, staffResult, closuresResult] = await Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .eq('online_booking_enabled', true)
          .order('name'),
        supabase
          .from('employees')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('business_closures')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString().slice(0, 10))
          .order('start_date'),
      ]);

      if (servicesResult.error) throw servicesResult.error;
      if (staffResult.error) throw staffResult.error;
      if (closuresResult.error) throw closuresResult.error;

      setServices(servicesResult.data ?? []);
      setStaff(staffResult.data ?? []);
      setClosures(closuresResult.data ?? []);
    } catch (error: any) {
      console.error('Booking page error:', error);
      toast.error(t('publicBooking.messages.loadOptionsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTimes = async () => {
    if (!business || selectedServices.length === 0 || !selectedDate) return;

    setAvailabilityLoading(true);
    setAvailableSlots([]);
    setSelectedTime(null);

    try {
      const { data, error } = await supabase.rpc('get_public_availability', {
        p_business_id: business.id,
        p_employee_id: selectedStaff,
        p_date: selectedDate,
        p_service_ids: selectedServices.map((service) => service.id),
      });

      if (error) throw error;

      const times = Array.from(
        new Set<string>(
          (data ?? []).map((slot: any) =>
            String(slot.available_time).slice(0, 5)
          )
        )
      ).sort((a, b) => a.localeCompare(b));

      setAvailableSlots(times);
    } catch (error: any) {
      console.error('Availability loading error:', error);
      toast.error(t('publicBooking.messages.loadTimesFailed'));
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const totalDuration = selectedServices.reduce(
    (total, service) => total + Number(service.duration || 0),
    0
  );

  const totalPrice = selectedServices.reduce(
    (total, service) => total + Number(service.price || 0),
    0
  );

  const visibleDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(dateWindowStart, index)),
    [dateWindowStart]
  );

  const estimatedEndTime = useMemo(() => {
    if (!selectedTime || totalDuration <= 0) return null;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + totalDuration, 0, 0);

    return format(date, 'HH:mm');
  }, [selectedTime, totalDuration]);

  const selectedProfessional = staff.find(
    (member) => member.id === selectedStaff
  );


  const selectedClosure = closures.find(
    (closure) =>
      selectedDate >= closure.start_date && selectedDate <= closure.end_date
  );

  const groupedSlots = useMemo(() => {
    const morning = availableSlots.filter((time) => Number(time.slice(0, 2)) < 12);
    const afternoon = availableSlots.filter((time) => {
      const hour = Number(time.slice(0, 2));
      return hour >= 12 && hour < 17;
    });
    const evening = availableSlots.filter(
      (time) => Number(time.slice(0, 2)) >= 17
    );

    return [
      { label: t('publicBooking.timeGroups.morning'), slots: morning },
      { label: t('publicBooking.timeGroups.afternoon'), slots: afternoon },
      { label: t('publicBooking.timeGroups.evening'), slots: evening },
    ].filter((group) => group.slots.length > 0);
  }, [availableSlots, t]);

  const toggleService = (service: any) => {
    const selected = selectedServices.some((item) => item.id === service.id);

    setSelectedServices((current) =>
      selected
        ? current.filter((item) => item.id !== service.id)
        : [...current, service]
    );

    setSelectedStaff(null);
    setSelectedTime(null);
  };

  const handleBook = async () => {
    if (!customerDetails.name.trim() || !customerDetails.phone.trim()) {
      toast.error(t('publicBooking.validation.namePhoneRequired'));
      return;
    }

    if (!selectedDate || !selectedTime || selectedServices.length === 0) {
      toast.error(t('publicBooking.validation.completeSteps'));
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('secure_create_booking', {
        p_business_id: business.id,
        p_employee_id: selectedStaff,
        p_service_ids: selectedServices.map((service) => service.id),
        p_local_date: selectedDate,
        p_local_time: selectedTime,
        p_customer_name: customerDetails.name.trim(),
        p_customer_email: customerDetails.email.trim() || null,
        p_customer_phone: customerDetails.phone.trim(),
        p_notes: customerDetails.notes.trim() || null,
      });

      if (error) throw error;

      setBookingSuccess(data);
      setStep(5);
    } catch (error: any) {
      const rawMessage = String(error?.message || '');
      const slotUnavailable =
        rawMessage.toLowerCase().includes('no longer available') ||
        rawMessage.toLowerCase().includes('just been reserved');
      console.error('Booking creation error:', error);
      toast.error(
        slotUnavailable
          ? t('publicBooking.messages.slotUnavailable')
          : t('publicBooking.messages.bookingFailed')
      );

      if (slotUnavailable) {
        setStep(3);
        await fetchAvailableTimes();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const directionsUrl = useMemo(() => {
    if (business.latitude && business.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`;
    }

    const address = [
      business.address_line_1,
      business.address_line_2,
      business.city,
      business.district,
      business.postal_code,
      business.country,
      business.address,
    ]
      .filter(Boolean)
      .join(', ');

    return address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      : null;
  }, [business]);

  const downloadCalendarFile = () => {
    if (!bookingSuccess?.start_time) return;

    const start = new Date(bookingSuccess.start_time);
    const end = new Date(start.getTime() + totalDuration * 60_000);
    const toIcsDate = (value: Date) =>
      value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barber SaaS//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${bookingSuccess.booking_reference}@barber-saas`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${t('publicBooking.calendar.summary', { services: selectedServices.map((service) => service.name).join(', '), business: business.name })}`,
      `DESCRIPTION:${t('publicBooking.calendar.description', { reference: bookingSuccess.booking_reference })}`, 
      business.address ? `LOCATION:${String(business.address).replace(/,/g, '\\,')}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${business.slug || t('publicBooking.calendar.fileName')}-${selectedDate}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">{t('publicBooking.states.loadingOptions')}</div>
      </div>
    );
  }

  if (step === 5 && bookingSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card className="overflow-hidden rounded-3xl border-emerald-200 shadow-card">
          <CardContent className="p-7 text-center sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h1 className="mt-6 text-3xl font-bold">{t('publicBooking.confirmation.title')}</h1>
            <p className="mt-3 text-muted-foreground">
              {t('publicBooking.confirmation.description', { business: business.name })}
            </p>

            <div className="mx-auto mt-8 max-w-xl rounded-2xl border bg-muted/25 p-5 text-left">
              <SummaryRow label={t('publicBooking.summary.reference')} value={`#${bookingSuccess.booking_reference}`} />
              <SummaryRow
                label={t('publicBooking.summary.services')}
                value={selectedServices.map((service) => service.name).join(', ')}
              />
              <SummaryRow
                label={t('publicBooking.summary.professional')}
                value={selectedProfessional?.name || t('publicBooking.professionals.anyAvailableProfessional')}
              />
              <SummaryRow
                label={t('publicBooking.summary.when')}
                value={new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(bookingSuccess.start_time))}
              />
              <SummaryRow
                label={t('publicBooking.summary.total')}
                value={currency.format(totalPrice)}
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Button onClick={downloadCalendarFile}>
                <Download className="mr-2 h-4 w-4" />
                {t('publicBooking.confirmation.addToCalendar')}
              </Button>

              {directionsUrl && (
                <Button asChild variant="outline">
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('publicBooking.confirmation.getDirections')}
                  </a>
                </Button>
              )}

              {user && (
                <Button asChild variant="outline">
                  <Link to={`/app/${business.slug}/account`}>
                    {t('publicBooking.confirmation.viewAppointments')}
                  </Link>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                {t('publicBooking.confirmation.bookAnother')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 sm:py-10 md:pb-12">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t('publicBooking.header.eyebrow')}
        </div>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {t('publicBooking.header.title', { business: business.name })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t('publicBooking.header.description')}
        </p>
      </div>

      <div className="scrollbar-subtle mb-8 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((item) => {
          const active = step === item.id;
          const completed = step > item.id;

          return (
            <div
              key={item.id}
              className={`flex min-w-[150px] items-center gap-3 rounded-2xl border px-4 py-3 ${
                active
                  ? 'border-primary bg-primary/10'
                  : completed
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'bg-card'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  completed
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {completed ? <Check className="h-4 w-4" /> : item.id}
              </div>
              <span className="text-sm font-semibold">{t(item.labelKey)}</span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden rounded-3xl shadow-card">
          <CardContent className="p-5 sm:p-7">
            {step === 1 && (
              <section className="space-y-5">
                <StepTitle
                  icon={<Scissors className="h-5 w-5" />}
                  title={t('publicBooking.services.title')}
                  description={t('publicBooking.services.description')}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  {services.map((service) => {
                    const selected = selectedServices.some(
                      (item) => item.id === service.id
                    );

                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`overflow-hidden rounded-2xl border text-left transition ${
                          selected
                            ? 'border-primary bg-primary/8 shadow-sm'
                            : 'bg-card hover:border-primary/40'
                        }`}
                      >
                        {service.image_url && (
                          <img
                            src={service.image_url}
                            alt={service.name}
                            className="h-36 w-full object-cover"
                          />
                        )}

                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold">{service.name}</h3>
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" />
                                {t('publicBooking.durationMinutes', { count: service.duration })}
                              </div>
                            </div>

                            <div className="text-lg font-bold">
                              {currency.format(Number(service.price))}
                            </div>
                          </div>

                          {service.description && (
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {service.description}
                            </p>
                          )}

                          <div className="mt-4 flex items-center justify-between">
                            <Badge variant={selected ? 'default' : 'secondary'}>
                              {selected ? t('publicBooking.services.selected') : t('publicBooking.services.select')}
                            </Badge>
                            {selected && <Check className="h-5 w-5 text-primary" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end border-t pt-5">
                  <Button
                    disabled={selectedServices.length === 0}
                    onClick={() => setStep(2)}
                  >
                    {t('publicBooking.services.continue')}
                  </Button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-5">
                <StepBack onClick={() => setStep(1)} />
                <StepTitle
                  icon={<UserRound className="h-5 w-5" />}
                  title={t('publicBooking.professionals.title')}
                  description={t('publicBooking.professionals.description')}
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(null);
                      setStep(3);
                    }}
                    className={`rounded-2xl border p-5 text-left transition ${
                      selectedStaff === null
                        ? 'border-primary bg-primary/8'
                        : 'hover:border-primary/40'
                    }`}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 font-bold">{t('publicBooking.professionals.anyAvailable')}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t('publicBooking.professionals.anyAvailableDescription')}
                    </p>
                  </button>

                  {staff.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaff(member.id);
                        setStep(3);
                      }}
                      className={`rounded-2xl border p-5 text-left transition ${
                        selectedStaff === member.id
                          ? 'border-primary bg-primary/8'
                          : 'hover:border-primary/40'
                      }`}
                    >
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-bold">
                          {member.name.charAt(0)}
                        </div>
                      )}

                      <h3 className="mt-4 font-bold">{member.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {member.bio || t('publicBooking.professionals.defaultBio')}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <StepBack onClick={() => setStep(2)} />
                <StepTitle
                  icon={<CalendarDays className="h-5 w-5" />}
                  title={t('publicBooking.dateTime.title')}
                  description={t('publicBooking.dateTime.description')}
                />

                <div className="rounded-2xl border bg-muted/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{t('publicBooking.dateTime.selectDate')}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('publicBooking.dateTime.browseAvailability')}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-xl"
                        disabled={isSameDay(dateWindowStart, startOfToday())}
                        onClick={() =>
                          setDateWindowStart((current) =>
                            addDays(current, -7) < startOfToday()
                              ? startOfToday()
                              : addDays(current, -7)
                          )
                        }
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-xl"
                        onClick={() =>
                          setDateWindowStart((current) => addDays(current, 7))
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="scrollbar-subtle mt-4 flex gap-2 overflow-x-auto pb-1">
                    {visibleDates.map((date) => {
                      const value = format(date, 'yyyy-MM-dd');
                      const active = selectedDate === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedDate(value)}
                          className={`min-w-[82px] rounded-2xl border px-3 py-3 text-center transition ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className={`text-xs ${active ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                            {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
                          </div>
                          <div className="mt-1 text-lg font-bold">
                            {format(date, 'd')}
                          </div>
                          <div className={`mt-1 text-xs ${active ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                            {new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 max-w-xs space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {t('publicBooking.dateTime.specificDate')}
                    </Label>
                    <Input
                      type="date"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="h-10 rounded-xl"
                      value={selectedDate}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        setSelectedDate(nextDate);
                        setDateWindowStart(parseISO(nextDate));
                      }}
                    />
                  </div>
                </div>

                {availabilityLoading ? (
                  <div className="rounded-2xl border p-10 text-center text-sm text-muted-foreground">
                    {t('publicBooking.states.loadingTimes')}
                  </div>
                ) : selectedClosure ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold">{t('publicBooking.closure.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t('publicBooking.closure.description', { business: business.name, reason: selectedClosure.title })}
                      {selectedClosure.description ? ` ${selectedClosure.description}` : ''}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {t('publicBooking.closure.range', { range: formatClosureRange(selectedClosure.start_date, selectedClosure.end_date, locale) })}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">{t('publicBooking.closure.chooseAnother')}</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
                    <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
                    <h3 className="mt-4 font-bold">{t('publicBooking.states.noAppointments')}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('publicBooking.states.noAppointmentsDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedSlots.map((group) => (
                      <div key={group.label}>
                        <div className="mb-3 text-sm font-semibold">
                          {group.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                          {group.slots.map((time) => (
                            <Button
                              key={time}
                              type="button"
                              variant={selectedTime === time ? 'default' : 'outline'}
                              className="h-11 rounded-xl"
                              onClick={() => setSelectedTime(time)}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!availabilityLoading &&
                  !selectedClosure &&
                  availableSlots.length > 0 && (
                    <div className="flex justify-end border-t pt-5">
                      <Button
                        disabled={!selectedTime}
                        onClick={() => setStep(4)}
                      >
                        {t('publicBooking.dateTime.continue')}
                      </Button>
                    </div>
                  )}
              </section>
            )}

            {step === 4 && (
              <section className="space-y-6">
                <StepBack onClick={() => setStep(3)} />
                <StepTitle
                  icon={<UserRound className="h-5 w-5" />}
                  title={t('publicBooking.details.title')}
                  description={
                    user
                      ? t('publicBooking.details.savedDescription')
                      : t('publicBooking.details.guestDescription')
                  }
                />

                {user ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl border bg-muted/25 p-5">
                      {customerProfileLoading ? (
                        <p className="text-sm text-muted-foreground">
                          {t('publicBooking.states.loadingDetails')}
                        </p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Detail label={t('publicBooking.details.name')} value={customerDetails.name || t('publicBooking.states.notProvided')} />
                          <Detail label={t('publicBooking.details.phone')} value={customerDetails.phone || t('publicBooking.states.notProvided')} />
                          <Detail label={t('publicBooking.details.email')} value={customerDetails.email || t('publicBooking.states.notProvided')} />
                        </div>
                      )}
                    </div>

                    {!customerDetails.phone && (
                      <div className="space-y-2">
                        <Label>{t('publicBooking.details.phoneRequired')}</Label>
                        <Input
                          type="tel"
                          className="h-11 rounded-xl"
                          value={customerDetails.phone}
                          onChange={(event) =>
                            setCustomerDetails({
                              ...customerDetails,
                              phone: event.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t('publicBooking.details.fullNameRequired')}</Label>
                      <Input
                        className="h-11 rounded-xl"
                        value={customerDetails.name}
                        onChange={(event) =>
                          setCustomerDetails({
                            ...customerDetails,
                            name: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('publicBooking.details.phoneRequiredShort')}</Label>
                      <Input
                        type="tel"
                        className="h-11 rounded-xl"
                        value={customerDetails.phone}
                        onChange={(event) =>
                          setCustomerDetails({
                            ...customerDetails,
                            phone: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('publicBooking.details.email')}</Label>
                      <Input
                        type="email"
                        className="h-11 rounded-xl"
                        value={customerDetails.email}
                        onChange={(event) =>
                          setCustomerDetails({
                            ...customerDetails,
                            email: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('publicBooking.details.notes')}</Label>
                  <Textarea
                    rows={4}
                    className="rounded-xl"
                    placeholder={t('publicBooking.details.notesPlaceholder')}
                    value={customerDetails.notes}
                    onChange={(event) =>
                      setCustomerDetails({
                        ...customerDetails,
                        notes: event.target.value,
                      })
                    }
                  />
                </div>

                <Button
                  className="h-12 w-full rounded-xl text-base"
                  disabled={isSubmitting || customerProfileLoading}
                  onClick={() => void handleBook()}
                >
                  {isSubmitting ? t('publicBooking.actions.confirming') : t('publicBooking.actions.confirm')}
                </Button>
              </section>
            )}
          </CardContent>
        </Card>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-5 sm:p-6">
              <div className="text-sm font-semibold text-muted-foreground">
                {t('publicBooking.summary.title')}
              </div>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label={t('publicBooking.summary.services')}
                  value={
                    selectedServices.length
                      ? selectedServices.map((service) => service.name).join(', ')
                      : t('publicBooking.states.notSelected')
                  }
                />
                <SummaryRow
                  label={t('publicBooking.summary.professional')}
                  value={selectedProfessional?.name || t('publicBooking.professionals.anyAvailable')}
                />
                <SummaryRow
                  label={t('publicBooking.summary.date')}
                  value={selectedDate ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${selectedDate}T00:00:00`)) : t('publicBooking.states.notSelected')}
                />
                <SummaryRow
                  label={t('publicBooking.summary.time')}
                  value={selectedTime || t('publicBooking.states.notSelected')}
                />
                <SummaryRow
                  label={t('publicBooking.summary.estimatedFinish')}
                  value={estimatedEndTime || t('publicBooking.states.notAvailable')}
                />
                <SummaryRow
                  label={t('publicBooking.summary.duration')}
                  value={t('publicBooking.durationMinutes', { count: totalDuration })}
                />
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-5">
                <span className="font-semibold">{t('publicBooking.summary.total')}</span>
                <span className="text-2xl font-bold">
                  {currency.format(totalPrice)}
                </span>
              </div>

              {business.address && (
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{business.address}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-xs text-muted-foreground">
              {selectedServices.length
                ? selectedServices.map((service) => service.name).join(', ')
                : t('publicBooking.mobile.selectServices')}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-bold">{currency.format(totalPrice)}</span>
              <span className="text-xs text-muted-foreground">
                {t('common.minutesShort', { count: totalDuration })}
              </span>
            </div>
          </div>

          {step < 4 ? (
            <Badge variant="secondary" className="shrink-0">
              {t('publicBooking.mobile.step', { step, total: 4 })}
            </Badge>
          ) : (
            <Badge className="shrink-0">{t('publicBooking.mobile.ready')}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function StepTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-primary">{icon}</div>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function StepBack({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <Button variant="ghost" className="-ml-3" onClick={onClick}>
      <ChevronLeft className="mr-2 h-4 w-4" />
      {t('common.back')}
    </Button>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[190px] text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function formatClosureRange(start: string, end: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const startText = formatter.format(new Date(`${start}T00:00:00`));
  const endText = formatter.format(new Date(`${end}T00:00:00`));
  return start === end ? startText : `${startText} – ${endText}`;
}
