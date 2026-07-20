import React, { useMemo, useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getIndustryConfig } from '@/config/industries';
import { IndustryThemeRoot } from '@/theme';

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const industry = useMemo(
    () => getIndustryConfig(user?.user_metadata?.industry_key),
    [user?.user_metadata?.industry_key]
  );

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [businessData, setBusinessData] = useState({
    name: '', phone: '', address: '', slug: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [services, setServices] = useState(() =>
    industry.defaultServices.map((service) => ({
      name: service.name,
      category: service.category,
      price: String(service.price),
      duration: String(service.duration),
    }))
  );
  const [staff, setStaff] = useState([
    { name: user?.user_metadata?.full_name || 'Owner', email: user?.email || '' },
  ]);

  const handleNext = () => setStep((current) => Math.min(4, current + 1));
  const handlePrev = () => setStep((current) => Math.max(1, current - 1));

  const completeOnboarding = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const slug = (businessData.slug || businessData.name)
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: businessData.name.trim(), slug, phone: businessData.phone.trim() || null,
          address: businessData.address.trim() || null, timezone: businessData.timezone,
          email: user.email, industry_key: industry.key,
        })
        .select().single();
      if (businessError) throw businessError;

      const { error: membershipError } = await supabase.from('business_members').insert({
        business_id: business.id, user_id: user.id, role: 'Owner',
      });
      if (membershipError) throw membershipError;

      const { error: settingsError } = await supabase.from('business_settings').insert({ business_id: business.id });
      if (settingsError) throw settingsError;

      const categoryIds = new Map<string, string>();
      for (const categoryName of [...new Set(services.filter((s) => s.name.trim()).map((s) => s.category.trim() || industry.defaultCategory))]) {
        const { data: category, error } = await supabase
          .from('service_categories')
          .insert({ business_id: business.id, name: categoryName })
          .select('id').single();
        if (error) throw error;
        categoryIds.set(categoryName, category.id);
      }

      const serviceRows = services
        .filter((service) => service.name.trim())
        .map((service) => {
          const categoryName = service.category.trim() || industry.defaultCategory;
          return {
            business_id: business.id,
            category_id: categoryIds.get(categoryName),
            name: service.name.trim(),
            price: Number(service.price) || 0,
            duration: Number.parseInt(service.duration, 10) || 30,
          };
        });
      if (serviceRows.length) {
        const { error } = await supabase.from('services').insert(serviceRows);
        if (error) throw error;
      }

      const employeeRows = staff.filter((member) => member.name.trim()).map((member) => ({
        business_id: business.id,
        name: member.name.trim(),
        email: member.email.trim() || null,
        user_id: member.email.trim().toLowerCase() === user.email?.toLowerCase() ? user.id : null,
      }));
      if (employeeRows.length) {
        const { error } = await supabase.from('employees').insert(employeeRows);
        if (error) throw error;
      }

      toast.success(`${industry.name} created successfully!`);
      window.location.assign('/dashboard');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IndustryThemeRoot industryKey={industry.key}>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
        <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-card md:p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">{industry.icon}</div>
            <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{industry.name} setup</div><h1 className="text-2xl font-bold">Create your business</h1></div>
          </div>

          <div className="mb-8 flex gap-2">{[1,2,3,4].map((item) => <div key={item} className={`h-2 flex-1 rounded-full ${step >= item ? 'bg-primary' : 'bg-muted'}`} />)}</div>

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{t('onboarding.title')}</h2>
              <Field label={t('onboarding.business_name')}><Input value={businessData.name} onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })} /></Field>
              <Field label={t('onboarding.slug')}><Input value={businessData.slug} onChange={(e) => setBusinessData({ ...businessData, slug: e.target.value })} placeholder="my-business" /></Field>
              <Field label={t('onboarding.phone')}><Input value={businessData.phone} onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })} /></Field>
              <Field label={t('onboarding.address')}><Textarea value={businessData.address} onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })} className="min-h-20" /></Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div><h2 className="text-xl font-bold">{t('onboarding.add_services')}</h2><p className="mt-1 text-sm text-muted-foreground">Suggested services are based on {industry.name}. Edit or remove them at any time.</p></div>
              {services.map((service, index) => (
                <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1.4fr_1fr_90px_90px]">
                  <Input aria-label="Service name" value={service.name} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                  <Input aria-label="Category" value={service.category} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, category: e.target.value } : item))} />
                  <Input aria-label="Price" type="number" value={service.price} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} />
                  <Input aria-label="Duration" type="number" value={service.duration} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, duration: e.target.value } : item))} />
                </div>
              ))}
              <Button variant="outline" type="button" onClick={() => setServices((current) => [...current, { name: '', category: industry.defaultCategory, price: '0', duration: '30' }])}>{t('onboarding.add_another_service')}</Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{t('onboarding.add_staff')}</h2>
              {staff.map((member, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder={t('onboarding.name')} value={member.name} onChange={(e) => setStaff((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                  <Input type="email" placeholder={t('onboarding.email_optional')} value={member.email} onChange={(e) => setStaff((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} />
                </div>
              ))}
              <Button variant="outline" type="button" onClick={() => setStaff((current) => [...current, { name: '', email: '' }])}>{t('onboarding.add_staff_member')}</Button>
            </div>
          )}

          {step === 4 && (
            <div className="py-8 text-center"><div className="text-4xl">{industry.icon}</div><h2 className="mt-4 text-2xl font-bold">Your {industry.name} is ready to be created</h2><p className="mx-auto mt-3 max-w-lg text-muted-foreground">We will create the business, suggested services, owner membership and initial team in one setup flow.</p></div>
          )}

          <div className="mt-10 flex justify-between">
            <Button variant="outline" onClick={handlePrev} disabled={step === 1}>{t('onboarding.back')}</Button>
            {step < 4 ? <Button onClick={handleNext} disabled={step === 1 && !businessData.name.trim()}>{t('onboarding.next')}</Button> : <Button onClick={completeOnboarding} disabled={loading}>{loading ? t('onboarding.creating') : t('onboarding.complete')}</Button>}
          </div>
        </div>
      </div>
    </IndustryThemeRoot>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
