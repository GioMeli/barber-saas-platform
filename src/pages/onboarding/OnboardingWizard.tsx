import React, { useMemo, useState } from 'react';
import { Check, Clock3, CreditCard, Euro, Gift, Layers3, ShieldCheck, Sparkles, Users } from 'lucide-react';
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
import {
  BILLING_OFFER_STORAGE_KEY,
  BILLING_PLAN_STORAGE_KEY,
  BILLING_PLANS,
  BILLING_TRIAL_DAYS,
  getBillingPlan,
  isBillingPlanId,
  type BillingPlanId,
} from '@/billing/plans';

const SELECTED_INDUSTRY_STORAGE_KEY = 'velliqo.selectedIndustry';

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const industry = useMemo(() => {
    const metadataIndustry = user?.user_metadata?.industry_key;
    const emailScopedIndustry = typeof window !== 'undefined' && user?.email
      ? window.localStorage.getItem(`${SELECTED_INDUSTRY_STORAGE_KEY}:${user.email.toLowerCase()}`)
      : null;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_INDUSTRY_STORAGE_KEY) : null;
    return getIndustryConfig(isIndustryKey(metadataIndustry) ? metadataIndustry : isIndustryKey(emailScopedIndustry) ? emailScopedIndustry : isIndustryKey(stored) ? stored : undefined);
  }, [user?.email, user?.user_metadata?.industry_key]);

  const initialPlan = useMemo<BillingPlanId>(() => {
    const metadataPlan = user?.user_metadata?.selected_plan;
    const storedPlan = typeof window !== 'undefined' ? window.localStorage.getItem(BILLING_PLAN_STORAGE_KEY) : null;
    return isBillingPlanId(metadataPlan) ? metadataPlan : isBillingPlanId(storedPlan) ? storedPlan : 'pro';
  }, [user?.user_metadata?.selected_plan]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanId>(initialPlan);
  const [offerCode, setOfferCode] = useState(() => typeof window !== 'undefined' ? window.localStorage.getItem(BILLING_OFFER_STORAGE_KEY) || '' : '');
  const [businessData, setBusinessData] = useState({ name: '', phone: '', address: '', slug: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [services, setServices] = useState(() => industry.defaultServices.map((service) => ({ name: service.name, category: service.category, price: String(service.price), duration: String(service.duration) })));
  const [staff, setStaff] = useState([{ name: user?.user_metadata?.full_name || 'Owner', email: user?.email || '' }]);

  const plan = getBillingPlan(selectedPlan);
  const nonOwnerStaffCount = staff.filter((member) => member.name.trim() && member.email.trim().toLowerCase() !== user?.email?.toLowerCase()).length;
  const overStaffLimit = nonOwnerStaffCount > plan.staffLimit;

  React.useEffect(() => { window.localStorage.setItem(BILLING_PLAN_STORAGE_KEY, selectedPlan); }, [selectedPlan]);
  React.useEffect(() => {
    if (offerCode.trim()) window.localStorage.setItem(BILLING_OFFER_STORAGE_KEY, offerCode.trim().toUpperCase());
    else window.localStorage.removeItem(BILLING_OFFER_STORAGE_KEY);
  }, [offerCode]);

  const handleNext = () => {
    if (step === 3 && overStaffLimit) {
      toast.error(t('onboarding.plan_staff_limit_error', { plan: plan.name, count: plan.staffLimit }));
      return;
    }
    setStep((current) => Math.min(5, current + 1));
  };
  const handlePrev = () => setStep((current) => Math.max(1, current - 1));

  const completeOnboarding = async () => {
    if (!user) return;
    if (overStaffLimit) {
      toast.error(t('onboarding.plan_staff_limit_error', { plan: plan.name, count: plan.staffLimit }));
      return;
    }
    setLoading(true);
    let businessId: string | null = null;

    try {
      const { error: metadataError } = await supabase.auth.updateUser({ data: { industry_key: industry.key, selected_plan: selectedPlan } });
      if (metadataError) throw metadataError;

      const slug = (businessData.slug || businessData.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: business, error: businessError } = await supabase.from('businesses').insert({
        name: businessData.name.trim(), slug, phone: businessData.phone.trim() || null,
        address: businessData.address.trim() || null, timezone: businessData.timezone,
        email: user.email, industry_key: industry.key,
      }).select().single();
      if (businessError) throw businessError;
      businessId = business.id;

      const { error: membershipError } = await supabase.from('business_members').insert({ business_id: business.id, user_id: user.id, role: 'Owner' });
      if (membershipError) throw membershipError;

      const { error: settingsError } = await supabase.from('business_settings').insert({ business_id: business.id });
      if (settingsError) throw settingsError;

      // Bootstrap the selected plan before employee inserts so database staff
      // limits are enforced during onboarding as well as later in Owner > Staff.
      const { error: billingBootstrapError } = await (supabase as any).rpc('initialize_business_billing', { p_business_id: business.id, p_plan_id: selectedPlan });
      if (billingBootstrapError) throw billingBootstrapError;

      const categoryIds = new Map<string, string>();
      for (const categoryName of [...new Set(services.filter((item) => item.name.trim()).map((item) => item.category.trim() || industry.defaultCategory))]) {
        const { data: category, error } = await supabase.from('service_categories').insert({ business_id: business.id, name: categoryName }).select('id').single();
        if (error) throw error;
        categoryIds.set(categoryName, category.id);
      }

      const serviceRows = services.filter((service) => service.name.trim()).map((service) => ({
        business_id: business.id, category_id: categoryIds.get(service.category.trim() || industry.defaultCategory),
        name: service.name.trim(), price: Number(service.price) || 0, duration: Number.parseInt(service.duration, 10) || 30,
      }));
      if (serviceRows.length) {
        const { error } = await supabase.from('services').insert(serviceRows);
        if (error) throw error;
      }

      const employeeRows = staff.filter((member) => member.name.trim()).map((member) => ({
        business_id: business.id, name: member.name.trim(), email: member.email.trim() || null,
        user_id: member.email.trim().toLowerCase() === user.email?.toLowerCase() ? user.id : null,
      }));
      if (employeeRows.length) {
        const { error } = await supabase.from('employees').insert(employeeRows);
        if (error) throw error;
      }

      const { data: checkout, error: checkoutError } = await supabase.functions.invoke('create_subscription_checkout', {
        body: {
          businessId: business.id,
          planId: selectedPlan,
          offerCode: offerCode.trim().toUpperCase() || undefined,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
        },
      });

      clearSetupStorage(user.email);
      if (checkoutError || !checkout?.url) {
        // The business is already safely created. Never rerun onboarding and
        // duplicate tenant data; Billing can resume secure Checkout instead.
        toast.error(checkoutError?.message || t('onboarding.checkout_resume'));
        window.location.assign('/dashboard/billing?setup=required');
        return;
      }

      window.location.assign(checkout.url);
    } catch (error: any) {
      console.error('Onboarding failed', error);
      if (businessId) {
        clearSetupStorage(user.email);
        toast.error(t('onboarding.checkout_resume'));
        window.location.assign('/dashboard/billing?setup=required');
        return;
      }
      toast.error(error?.message || t('onboarding.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <IndustryThemeRoot industryKey={industry.key}>
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="fixed right-4 top-4 z-20"><LanguageSwitcher /></div>
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center justify-center py-8">
          <div className="w-full rounded-3xl border bg-card p-6 shadow-card md:p-9">
            <div className="mb-6 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">{industry.icon}</div><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{industry.name} setup</div><h1 className="text-2xl font-bold">{t('onboarding.create_business')}</h1></div></div>
            <div className="mb-8 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((item) => <div key={item} className={`h-2 rounded-full ${step >= item ? 'bg-primary' : 'bg-muted'}`} />)}</div>

            {step === 1 && <BusinessStep t={t} businessData={businessData} setBusinessData={setBusinessData} />}
            {step === 2 && <ServicesStep t={t} industry={industry} services={services} setServices={setServices} />}
            {step === 3 && <StaffStep t={t} staff={staff} setStaff={setStaff} plan={plan} nonOwnerStaffCount={nonOwnerStaffCount} />}
            {step === 4 && (
              <div className="space-y-6">
                <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-primary"><CreditCard className="h-4 w-4" />{t('onboarding.plan_billing')}</div><h2 className="mt-2 text-2xl font-extrabold">{t('onboarding.choose_plan')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('onboarding.choose_plan_description', { days: BILLING_TRIAL_DAYS })}</p></div>
                <div className="grid gap-4 lg:grid-cols-3">{BILLING_PLANS.map((item) => <PlanOption key={item.id} plan={item} selected={selectedPlan === item.id} onSelect={() => setSelectedPlan(item.id)} t={t} />)}</div>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5"><div className="flex items-start gap-3"><Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="flex-1"><div className="font-bold">{t('onboarding.offer_code')}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('onboarding.offer_code_description')}</p><Input className="mt-3 max-w-sm uppercase" value={offerCode} onChange={(event) => setOfferCode(event.target.value.toUpperCase())} placeholder="VELLIQO6" /></div></div></div>
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>{t('onboarding.stripe_security', { days: BILLING_TRIAL_DAYS })}</p></div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-6 py-2"><div className="text-center"><div className="text-4xl">{industry.icon}</div><h2 className="mt-4 text-2xl font-bold">{t('onboarding.ready_title', { industry: industry.name })}</h2><p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t('onboarding.ready_description', { plan: plan.name, days: BILLING_TRIAL_DAYS })}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{industry.defaultModules.map((moduleKey) => { const module = MODULE_REGISTRY[moduleKey]; return <div key={moduleKey} className="rounded-xl border bg-muted/20 p-3"><div className="text-sm font-bold">{module.name}</div><div className="mt-1 text-xs text-muted-foreground">{module.description}</div></div>; })}</div><div className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-4"><div><div className="text-sm font-bold">{plan.name}</div><div className="mt-1 text-xs text-muted-foreground">€{plan.price.toFixed(2)} / month · {BILLING_TRIAL_DAYS} days free</div></div><CreditCard className="h-6 w-6 text-primary" /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{t('onboarding.final_checkout_note')}</p></div></div>
            )}

            <div className="mt-10 flex justify-between gap-3"><Button variant="outline" onClick={handlePrev} disabled={step === 1 || loading}>{t('onboarding.back')}</Button>{step < 5 ? <Button onClick={handleNext} disabled={(step === 1 && !businessData.name.trim()) || loading}>{t('onboarding.next')}</Button> : <Button onClick={completeOnboarding} disabled={loading}>{loading ? t('onboarding.creating') : t('onboarding.activate_trial')}</Button>}</div>
          </div>
        </div>
      </div>
    </IndustryThemeRoot>
  );
}

function BusinessStep({ t, businessData, setBusinessData }: any) { return <div className="space-y-4"><h2 className="text-xl font-bold">{t('onboarding.title')}</h2><Field label={t('onboarding.business_name')}><Input value={businessData.name} onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })} /></Field><Field label={t('onboarding.slug')}><Input value={businessData.slug} onChange={(e) => setBusinessData({ ...businessData, slug: e.target.value })} placeholder="my-business" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={t('onboarding.phone')}><Input value={businessData.phone} onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })} /></Field><Field label={t('onboarding.address')}><Input value={businessData.address} onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })} /></Field></div></div>; }
function ServicesStep({ t, industry, services, setServices }: any) { return <div className="space-y-5"><div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">{t('onboarding.add_services')}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t('onboarding.services_description', { industry: industry.name })}</p></div></div></div>{services.map((service: any, index: number) => <div key={index} className="rounded-2xl border p-4"><div className="grid gap-4 md:grid-cols-2"><ServiceField label={t('onboarding.service_name')} icon={<Sparkles className="h-4 w-4" />}><Input value={service.name} onChange={(e) => setServices((current: any[]) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /></ServiceField><ServiceField label={t('onboarding.category')} icon={<Layers3 className="h-4 w-4" />}><Input value={service.category} onChange={(e) => setServices((current: any[]) => current.map((item, i) => i === index ? { ...item, category: e.target.value } : item))} /></ServiceField><ServiceField label={t('onboarding.price')} icon={<Euro className="h-4 w-4" />}><Input type="number" min="0" step="0.01" value={service.price} onChange={(e) => setServices((current: any[]) => current.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} /></ServiceField><ServiceField label={t('onboarding.duration')} icon={<Clock3 className="h-4 w-4" />}><Input type="number" min="5" step="5" value={service.duration} onChange={(e) => setServices((current: any[]) => current.map((item, i) => i === index ? { ...item, duration: e.target.value } : item))} /></ServiceField></div></div>)}<Button variant="outline" type="button" onClick={() => setServices((current: any[]) => [...current, { name: '', category: industry.defaultCategory, price: '0', duration: '30' }])}>{t('onboarding.add_another_service')}</Button></div>; }
function StaffStep({ t, staff, setStaff, plan, nonOwnerStaffCount }: any) { const atLimit = nonOwnerStaffCount >= plan.staffLimit; return <div className="space-y-4"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{t('onboarding.add_staff')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('onboarding.staff_plan_limit', { plan: plan.name, used: nonOwnerStaffCount, count: plan.staffLimit })}</p></div><Users className="h-6 w-6 text-primary" /></div>{staff.map((member: any, index: number) => <div key={index} className="grid gap-2 sm:grid-cols-2"><Input placeholder={t('onboarding.name')} value={member.name} onChange={(e) => setStaff((current: any[]) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /><Input type="email" placeholder={t('onboarding.email_optional')} value={member.email} onChange={(e) => setStaff((current: any[]) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} /></div>)}<Button variant="outline" type="button" disabled={atLimit} onClick={() => setStaff((current: any[]) => [...current, { name: '', email: '' }])}>{atLimit ? t('onboarding.staff_limit_reached') : t('onboarding.add_staff_member')}</Button></div>; }
function PlanOption({ plan, selected, onSelect, t }: any) { return <button type="button" onClick={onSelect} className={`rounded-2xl border p-5 text-left transition ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/30'}`}><div className="flex items-center justify-between"><span className="font-extrabold">{plan.name}</span>{selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}</div><div className="mt-2 text-2xl font-black">€{plan.price.toFixed(2)}<span className="text-xs font-semibold text-muted-foreground"> / mo</span></div><div className="mt-3 text-xs leading-5 text-muted-foreground">{t('onboarding.plan_summary', { staff: plan.staffLimit, ai: plan.aiRequestsMonthly })}</div></button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function ServiceField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) { return <div className="space-y-2"><Label className="flex items-center gap-2 text-sm font-bold"><span className="text-primary">{icon}</span>{label}</Label>{children}</div>; }
function clearSetupStorage(email?: string | null) { window.localStorage.removeItem(SELECTED_INDUSTRY_STORAGE_KEY); window.localStorage.removeItem(BILLING_PLAN_STORAGE_KEY); window.localStorage.removeItem(BILLING_OFFER_STORAGE_KEY); if (email) window.localStorage.removeItem(`${SELECTED_INDUSTRY_STORAGE_KEY}:${email.toLowerCase()}`); }
