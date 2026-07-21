import React, { useMemo, useState } from 'react';
import { Clock3, Euro, Layers3, Sparkles } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getIndustryConfig, isIndustryKey } from '@/config/industries';
import { MODULE_REGISTRY } from '@/config/modules';
import { IndustryThemeRoot } from '@/theme';

const SELECTED_INDUSTRY_STORAGE_KEY = 'velliqo.selectedIndustry';

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const industry = useMemo(() => {
    const metadataIndustry = user?.user_metadata?.industry_key;
    const emailScopedIndustry =
      typeof window !== 'undefined' && user?.email
        ? window.localStorage.getItem(
            `${SELECTED_INDUSTRY_STORAGE_KEY}:${user.email.toLowerCase()}`
          )
        : null;
    const genericStoredIndustry =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(SELECTED_INDUSTRY_STORAGE_KEY)
        : null;

    // Supabase metadata is the permanent source of truth.
    // Email-scoped and generic browser values are recovery fallbacks only.
    return getIndustryConfig(
      isIndustryKey(metadataIndustry)
        ? metadataIndustry
        : isIndustryKey(emailScopedIndustry)
          ? emailScopedIndustry
          : isIndustryKey(genericStoredIndustry)
            ? genericStoredIndustry
            : undefined
    );
  }, [user?.email, user?.user_metadata?.industry_key]);

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
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { industry_key: industry.key },
      });
      if (metadataError) throw metadataError;

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

      window.localStorage.removeItem(SELECTED_INDUSTRY_STORAGE_KEY);
      if (user.email) {
        window.localStorage.removeItem(
          `${SELECTED_INDUSTRY_STORAGE_KEY}:${user.email.toLowerCase()}`
        );
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
            <div className="space-y-5">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
                  <div><h2 className="text-xl font-bold">{t('onboarding.add_services')}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Add each service with its customer price and the exact time required in minutes. Suggested services are based on {industry.name}.</p></div>
                </div>
              </div>
              {services.map((service, index) => (
                <div key={index} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-extrabold">{index + 1}</div><div className="text-sm font-bold">Service details</div></div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Required fields</div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ServiceField label="Service name" hint="What customers will book" icon={<Sparkles className="h-4 w-4" />}><Input aria-label="Service name" placeholder="e.g. Consultation" value={service.name} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="h-11 rounded-xl" /></ServiceField>
                    <ServiceField label="Category" hint="Used to organise your service menu" icon={<Layers3 className="h-4 w-4" />}><Input aria-label="Category" placeholder="e.g. Consultations" value={service.category} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, category: e.target.value } : item))} className="h-11 rounded-xl" /></ServiceField>
                    <ServiceField label="Customer price" hint="Amount charged for this service" icon={<Euro className="h-4 w-4" />}>
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-primary">€</span><Input aria-label="Customer price in euro" type="number" min="0" step="0.01" value={service.price} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} className="h-11 rounded-xl pl-8 pr-16" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">EUR</span></div>
                    </ServiceField>
                    <ServiceField label="Service duration" hint="Time blocked in the calendar" icon={<Clock3 className="h-4 w-4" />}>
                      <div className="relative"><Input aria-label="Service duration in minutes" type="number" min="5" step="5" value={service.duration} onChange={(e) => setServices((current) => current.map((item, i) => i === index ? { ...item, duration: e.target.value } : item))} className="h-11 rounded-xl pr-20" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">minutes</span></div>
                    </ServiceField>
                  </div>
                </div>
              ))}
              <Button variant="outline" type="button" className="h-11 rounded-xl" onClick={() => setServices((current) => [...current, { name: '', category: industry.defaultCategory, price: '0', duration: '30' }])}>{t('onboarding.add_another_service')}</Button>
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
            <div className="py-4 text-center"><div className="text-4xl">{industry.icon}</div><h2 className="mt-4 text-2xl font-bold">Your {industry.name} workspace is ready</h2><p className="mx-auto mt-3 max-w-lg text-muted-foreground">Velliqo will create the business, suggested services, owner membership and initial team in one setup flow.</p><div className="mx-auto mt-6 grid max-w-xl gap-2 text-left sm:grid-cols-2">{industry.defaultModules.map((moduleKey) => { const module = MODULE_REGISTRY[moduleKey]; return <div key={moduleKey} className="rounded-xl border bg-muted/20 p-3"><div className="text-sm font-bold">{module.name}</div><div className="mt-1 text-xs text-muted-foreground">{module.description}</div></div>; })}</div></div>
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

function ServiceField({ label, hint, icon, children }: { label: string; hint: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-2"><div><Label className="flex items-center gap-2 text-sm font-bold"><span className="text-primary">{icon}</span>{label}</Label><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p></div>{children}</div>;
}
