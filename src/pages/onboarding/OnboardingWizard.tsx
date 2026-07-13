import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [businessData, setBusinessData] = useState({
    name: '',
    phone: '',
    address: '',
    slug: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [services, setServices] = useState([{ name: 'Standard Haircut', price: '25', duration: '30' }]);
  const [staff, setStaff] = useState([{ name: user?.user_metadata?.full_name || 'Owner', email: user?.email || '' }]);

  const handleNext = () => setStep(s => Math.min(7, s + 1));
  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const completeOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // 1. Create Business
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          name: businessData.name,
          slug: businessData.slug || businessData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          phone: businessData.phone,
          address: businessData.address,
          timezone: businessData.timezone,
          email: user.email
        })
        .select()
        .single();

      if (bizError) throw bizError;

      // 2. Add Owner as Member
      await supabase.from('business_members').insert({
        business_id: business.id,
        user_id: user.id,
        role: 'Owner'
      });

      // 3. Add Settings
      await supabase.from('business_settings').insert({
        business_id: business.id
      });

      // 4. Default Category
      const { data: category } = await supabase.from('service_categories').insert({
        business_id: business.id,
        name: 'Haircuts'
      }).select().single();

      // 5. Add Services
      if (category) {
        for (const s of services) {
          if (s.name) {
            await supabase.from('services').insert({
              business_id: business.id,
              category_id: category.id,
              name: s.name,
              price: parseFloat(s.price),
              duration: parseInt(s.duration)
            });
          }
        }
      }

      // 6. Add Staff (Employees table)
      for (const s of staff) {
        if (s.name) {
          await supabase.from('employees').insert({
            business_id: business.id,
            name: s.name,
            email: s.email,
            user_id: s.email === user.email ? user.id : null // link if it's the owner
          });
        }
      }
      
      // Default working hours will be added later or assumed

      toast.success('Business created successfully!');
      // Force reload to update auth context businessMemberships
      window.location.href = '/dashboard';
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('onboarding.title')}</h2>
            <div className="space-y-2">
              <Label>{t('onboarding.business_name')}</Label>
              <Input value={businessData.name} onChange={e => setBusinessData({...businessData, name: e.target.value})} className="px-3" />
            </div>
            <div className="space-y-2">
              <Label>{t('onboarding.slug')}</Label>
              <Input value={businessData.slug} onChange={e => setBusinessData({...businessData, slug: e.target.value})} placeholder="my-barbershop" className="px-3" />
            </div>
             <div className="space-y-2">
              <Label>{t('onboarding.phone')}</Label>
              <Input value={businessData.phone} onChange={e => setBusinessData({...businessData, phone: e.target.value})} className="px-3" />
            </div>
             <div className="space-y-2">
              <Label>{t('onboarding.address')}</Label>
              <Textarea value={businessData.address} onChange={e => setBusinessData({...businessData, address: e.target.value})} className="px-3 min-h-[80px]" />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('onboarding.add_services')}</h2>
            {services.map((s, i) => (
              <div key={i} className="flex gap-2 items-end flex-wrap">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label>{t('onboarding.service_name')}</Label>
                  <Input value={s.name} onChange={e => {
                    const newS = [...services];
                    newS[i].name = e.target.value;
                    setServices(newS);
                  }} className="px-3" />
                </div>
                <div className="space-y-1 w-24">
                  <Label>{t('onboarding.price')}</Label>
                  <Input type="number" value={s.price} onChange={e => {
                    const newS = [...services];
                    newS[i].price = e.target.value;
                    setServices(newS);
                  }} className="px-3" />
                </div>
                 <div className="space-y-1 w-24">
                  <Label>{t('onboarding.mins')}</Label>
                  <Input type="number" value={s.duration} onChange={e => {
                    const newS = [...services];
                    newS[i].duration = e.target.value;
                    setServices(newS);
                  }} className="px-3" />
                </div>
              </div>
            ))}
            <Button variant="outline" type="button" onClick={() => setServices([...services, {name:'', price:'0', duration:'30'}])}>
              {t('onboarding.add_another_service')}
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('onboarding.add_staff')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.staff_desc')}</p>
            {staff.map((s, i) => (
              <div key={i} className="flex gap-2 items-end flex-wrap">
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label>{t('onboarding.name')}</Label>
                  <Input value={s.name} onChange={e => {
                    const newS = [...staff];
                    newS[i].name = e.target.value;
                    setStaff(newS);
                  }} className="px-3" />
                </div>
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label>{t('onboarding.email_optional')}</Label>
                  <Input type="email" value={s.email} onChange={e => {
                    const newS = [...staff];
                    newS[i].email = e.target.value;
                    setStaff(newS);
                  }} className="px-3" />
                </div>
              </div>
            ))}
            <Button variant="outline" type="button" onClick={() => setStaff([...staff, {name:'', email:''}])}>
              {t('onboarding.add_staff_member')}
            </Button>
          </div>
        );
      case 4:
         return (
          <div className="space-y-4 text-center py-8">
            <h2 className="text-2xl font-bold">{t('onboarding.almost_ready')}</h2>
            <p className="text-muted-foreground">{t('onboarding.ready_desc1')}</p>
            <p className="text-muted-foreground">{t('onboarding.ready_desc2')}</p>
          </div>
        )
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-2xl bg-card p-6 md:p-10 rounded-xl border border-border shadow-sm">
        
        {/* Progress Bar */}
        <div className="mb-8 flex gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {renderStep()}

        <div className="mt-12 flex justify-between">
          <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
            {t('onboarding.back')}
          </Button>
          
          {step < 4 ? (
            <Button onClick={handleNext} disabled={step === 1 && !businessData.name}>
              {t('onboarding.next')}
            </Button>
          ) : (
            <Button onClick={completeOnboarding} disabled={loading}>
              {loading ? t('onboarding.creating') : t('onboarding.complete')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}