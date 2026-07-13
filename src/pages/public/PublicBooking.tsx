import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapPin, Phone, Clock, ChevronLeft } from 'lucide-react';
import { format, addDays, startOfToday } from 'date-fns';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function PublicBooking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const context = useOutletContext<{ business: any }>();
  const business = context?.business;

  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow State
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(startOfToday(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  // Auth state
  const { user } = useAuth();
  
  // Customer Details
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  // Total calculation
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  useEffect(() => {
    if (business) {
      fetchServicesAndStaff();
    }
  }, [business]);

  const fetchServicesAndStaff = async () => {
    try {
      // 2. Get active services & staff
      const [servRes, staffRes] = await Promise.all([
        supabase.from('services').select('*').eq('business_id', business.id).eq('is_active', true).eq('online_booking_enabled', true),
        supabase.from('employees').select('*').eq('business_id', business.id).eq('is_active', true)
      ]);

      setServices(servRes.data || []);
      setStaff(staffRes.data || []);
    } catch (error) {
      console.error('Error loading booking page:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3 && selectedServices.length > 0 && selectedDate) {
      // Fetch available times when date changes
      fetchAvailableTimes();
    }
  }, [step, selectedDate, selectedStaff, selectedServices]);

  const fetchAvailableTimes = async () => {
    if (!business || selectedServices.length === 0) return;
    
    // In a real implementation, we would call the RPC 'check_availability'
    // For this prototype, we'll mock some slots based on the date
    
    // Simulate network delay
    setAvailableSlots([]);
    setTimeout(() => {
      const isWeekend = new Date(selectedDate).getDay() === 0 || new Date(selectedDate).getDay() === 6;
      if (isWeekend) {
        setAvailableSlots(['10:00', '11:00', '13:00', '14:00']);
      } else {
        setAvailableSlots(['09:00', '09:30', '10:00', '11:30', '13:00', '14:30', '15:00', '16:00']);
      }
    }, 500);
  };

  const handleBook = async () => {
    if (!customerDetails.name || !customerDetails.phone) {
      toast.error('Name and phone are required');
      return;
    }

    setIsSubmitting(true);
    try {
      let customerId;
      let userId = user?.id || null;

      // 1. Create or find customer in business scope
      if (customerDetails.email) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', business.id)
          .eq('email', customerDetails.email)
          .single();
        
        if (existing) {
          customerId = existing.id;
        }
      }

      if (!customerId) {
        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert({
            business_id: business.id,
            user_id: userId,
            full_name: customerDetails.name,
            email: customerDetails.email || null,
            phone: customerDetails.phone,
            notes: customerDetails.notes
          })
          .select()
          .single();
          
        if (custError) throw custError;
        customerId = newCust.id;
      }

      // 2. Create Appointment
      const startTimeISO = new Date(`${selectedDate}T${selectedTime}`).toISOString();
      const endTimeISO = new Date(new Date(startTimeISO).getTime() + totalDuration * 60000).toISOString();

      const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .insert({
          business_id: business.id,
          customer_id: customerId,
          employee_id: selectedStaff,
          start_time: startTimeISO,
          end_time: endTimeISO,
          total_duration: totalDuration,
          total_price: totalPrice,
          status: 'pending',
          notes: customerDetails.notes
        })
        .select()
        .single();

      if (apptError) throw apptError;

      // 3. Link Multiple Services
      const appointmentServices = selectedServices.map(s => ({
        appointment_id: appt.id,
        service_id: s.id,
        price: s.price,
        duration: s.duration
      }));

      const { error: linkError } = await supabase.from('appointment_services').insert(appointmentServices);
      if (linkError) throw linkError;

      setBookingSuccess(appt);
      setStep(5);
    } catch (error: any) {
      toast.error(error.message || 'Booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  }

  if (!business) {
    return <div className="min-h-screen flex items-center justify-center">Business not found</div>;
  }

  return (
    <div className="bg-background text-foreground flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Business Header */}
        {step < 5 && (
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">{t('booking.select_service')}</h2>
          </div>
        )}

        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            
            {/* Step 1: Services */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {services.map(service => {
                    const isSelected = selectedServices.some(s => s.id === service.id);
                    return (
                      <div 
                        key={service.id} 
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedServices(selectedServices.filter(s => s.id !== service.id));
                          } else {
                            setSelectedServices([...selectedServices, service]);
                          }
                        }}
                      >
                        <div>
                          <h3 className="font-medium">{service.name}</h3>
                          <p className="text-sm text-muted-foreground">{service.duration} {t('booking.mins')} • {service.description}</p>
                        </div>
                        <div className="font-bold">${service.price.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <div className="pt-4 flex justify-between items-center border-t border-border mt-4">
                    <div className="text-sm">
                      <span className="font-bold">{selectedServices.length}</span> service(s) selected
                      <div className="text-muted-foreground">{totalDuration} mins • ${totalPrice.toFixed(2)}</div>
                    </div>
                    <Button onClick={() => setStep(2)}>Continue</Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Staff */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <h2 className="text-xl font-bold">{t('booking.select_professional')}</h2>
                </div>
                <div className="grid gap-3">
                  <div 
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedStaff === null ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    onClick={() => {
                      setSelectedStaff(null);
                      setStep(3);
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-4">✨</div>
                    <div className="font-medium">{t('booking.any_professional')}</div>
                  </div>
                  {staff.map(member => (
                    <div 
                      key={member.id} 
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedStaff === member.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      onClick={() => {
                        setSelectedStaff(member.id);
                        setStep(3);
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-4">
                        {member.photo_url ? <img src={member.photo_url} className="rounded-full" /> : member.name.charAt(0)}
                      </div>
                      <div className="font-medium">{member.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Date & Time */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4" /></Button>
                  <h2 className="text-xl font-bold">{t('booking.select_date_time')}</h2>
                </div>
                
                <div className="space-y-2">
                  <Label>{t('booking.date')}</Label>
                  <Input 
                    type="date" 
                    min={format(new Date(), 'yyyy-MM-dd')}
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)} 
                    className="w-full px-3"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('booking.available_times')}</Label>
                  {availableSlots.length === 0 ? (
                     <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                       <p>{t('booking.no_appointments')}</p>
                       <p className="text-sm mt-2">{t('booking.choose_another_date')}</p>
                     </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.map(time => (
                        <Button 
                          key={time} 
                          variant={selectedTime === time ? 'default' : 'outline'}
                          className="w-full"
                          onClick={() => {
                            setSelectedTime(time);
                            setStep(4);
                          }}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Details */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setStep(3)}><ChevronLeft className="w-4 h-4" /></Button>
                  <h2 className="text-xl font-bold">{t('booking.your_details')}</h2>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-1 mb-6">
                  <h3 className="font-semibold">{t('booking.summary')}</h3>
                  <div className="space-y-1 my-2">
                    {selectedServices.map(s => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>{s.name} ({s.duration} {t('booking.mins')})</span>
                        <span>${s.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm border-t border-border/50 pt-2 mt-2">{format(new Date(`${selectedDate}T${selectedTime}`), 'EEEE, MMMM d, yyyy')} {t('booking.at')} {selectedTime}</p>
                  <p className="font-medium mt-2 text-lg border-t border-border/50 pt-2">{t('booking.total')}: ${totalPrice.toFixed(2)}</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="c_name">{t('booking.full_name')}</Label>
                      <Input id="c_name" value={customerDetails.name} onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})} className="px-3" required />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="c_phone">{t('booking.phone')}</Label>
                        <Input id="c_phone" type="tel" value={customerDetails.phone} onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})} className="px-3" required />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="c_email">{t('booking.email_optional')}</Label>
                        <Input id="c_email" type="email" value={customerDetails.email} onChange={e => setCustomerDetails({...customerDetails, email: e.target.value})} className="px-3" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="c_notes">{t('booking.notes_optional')}</Label>
                      <Input id="c_notes" value={customerDetails.notes} onChange={e => setCustomerDetails({...customerDetails, notes: e.target.value})} className="px-3" />
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button className="w-full text-lg h-12" onClick={handleBook} disabled={isSubmitting}>
                      {isSubmitting ? t('booking.confirming') : t('booking.confirm_booking')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Success */}
            {step === 5 && bookingSuccess && (
              <div className="text-center space-y-6 py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h2 className="text-2xl font-bold">{t('booking.booking_confirmed')}</h2>
                <p className="text-muted-foreground">{t('booking.success_msg')}</p>
                
                <div className="bg-muted/50 p-6 rounded-lg text-left max-w-sm mx-auto space-y-2">
                   <p><span className="text-muted-foreground">{t('booking.ref')}</span> #{bookingSuccess.id.substring(0,8).toUpperCase()}</p>
                   <p><span className="text-muted-foreground">{t('booking.service')}</span> {selectedServices.map(s => s.name).join(', ')}</p>
                   <p><span className="text-muted-foreground">{t('booking.when')}</span> {format(new Date(bookingSuccess.start_time), 'PPp')}</p>
                   <p><span className="text-muted-foreground">{t('booking.where')}</span> {business.address}</p>
                </div>

                <div className="pt-4">
                  <Button variant="outline" className="w-full max-w-sm" onClick={() => window.location.reload()}>
                    {t('booking.book_another')}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}