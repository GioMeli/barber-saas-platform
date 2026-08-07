import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  Infinity as InfinityIcon,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  BILLING_PLANS,
  BILLING_TRIAL_DAYS,
  type BillingPlan,
  type BillingPlanId,
  formatPlanCurrency,
} from '@/billing/plans';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';

type BillingSummary = {
  subscription?: Record<string, any>;
  plan?: Record<string, any>;
  usage?: { staff?: number; ai_requests?: number; ai_tokens?: number; email?: number; sms?: number };
  access_allowed?: boolean;
  billing_required?: boolean;
};

const ACTIVE_STATUSES = new Set(['trialing', 'active', 'past_due']);

export default function Billing() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = React.useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [checkoutPlan, setCheckoutPlan] = React.useState<BillingPlanId | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [offerCode, setOfferCode] = React.useState('');

  const subscription = summary?.subscription || {};
  const currentPlan = summary?.plan || {};
  const usage = summary?.usage || {};
  const status = String(subscription.status || 'incomplete');
  const hasStripeSubscription = Boolean(subscription.stripe_subscription_id);
  const canUsePortal = Boolean(subscription.stripe_customer_id);
  const fixedTermSubscription = subscription.billing_mode === 'fixed_term';

  const fetchData = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [summaryResult, invoiceResult] = await Promise.all([
        (supabase as any).rpc('get_business_billing_summary', { p_business_id: businessId }),
        (supabase as any).from('billing_invoices').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(24),
      ]);
      if (summaryResult.error) throw summaryResult.error;
      if (invoiceResult.error) throw invoiceResult.error;
      setSummary(summaryResult.data || {});
      setInvoices(invoiceResult.data || []);
    } catch (error: any) {
      console.error('Billing load failed', error);
      toast.error(error?.message || t('billing.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [businessId, t]);

  React.useEffect(() => { void fetchData(); }, [fetchData]);

  React.useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success(t('billing.messages.checkoutCompleted'));
      setSearchParams({});
      window.setTimeout(() => void fetchData(), 900);
    } else if (searchParams.get('canceled') === 'true') {
      toast.info(t('billing.messages.checkoutCancelled'));
      setSearchParams({});
    }
  }, [fetchData, searchParams, setSearchParams, t]);

  const trial = React.useMemo(() => {
    const end = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    if (!end || status !== 'trialing') return null;
    const remainingMs = Math.max(end.getTime() - Date.now(), 0);
    const daysRemaining = Math.ceil(remainingMs / 86_400_000);
    const progress = Math.min(100, Math.max(0, ((BILLING_TRIAL_DAYS - daysRemaining) / BILLING_TRIAL_DAYS) * 100));
    return { end, daysRemaining, progress };
  }, [status, subscription.trial_ends_at]);

  const startCheckout = async (planId: BillingPlanId) => {
    if (!businessId) return;
    setCheckoutPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create_subscription_checkout', {
        body: {
          businessId,
          planId,
          offerCode: offerCode.trim() || undefined,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(t('billing.messages.checkoutUrlMissing'));
      window.location.assign(data.url);
    } catch (error: any) {
      toast.error(error?.message || t('billing.messages.checkoutFailed'));
      setCheckoutPlan(null);
    }
  };

  const openPortal = async () => {
    if (!businessId) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create_billing_portal_session', {
        body: { businessId, returnUrl: `${window.location.origin}/dashboard/billing` },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(t('billing.messages.portalUrlMissing'));
      window.location.assign(data.url);
    } catch (error: any) {
      toast.error(error?.message || t('billing.messages.portalUnavailable'));
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <div className="app-page"><div className="rounded-3xl border bg-card p-16 text-center text-muted-foreground shadow-card">{t('billing.states.loading')}</div></div>;
  }

  return (
    <div className="app-page space-y-7 pb-10">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">{t('billing.eyebrow')}</div>
          <h1 className="app-page-title">{t('billing.title')}</h1>
          <p className="app-page-description">{t('billing.description', { days: BILLING_TRIAL_DAYS })}</p>
        </div>
        {canUsePortal && (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void openPortal()} disabled={portalLoading}>
            <ExternalLink className="mr-2 h-4 w-4" />{portalLoading ? t('billing.actions.opening') : t('billing.actions.manageBilling')}
          </Button>
        )}
      </header>

      <StatusPanel
        status={status}
        planName={currentPlan.name || subscription.plan_id || '—'}
        trial={trial}
        subscription={subscription}
        locale={locale}
        t={t}
      />

      <section className="grid gap-4 lg:grid-cols-4">
        <UsageCard icon={<Users className="h-5 w-5" />} label={t('billing.usage.staff')} used={Number(usage.staff || 0)} limit={Number(currentPlan.staff_limit || 0)} />
        <UsageCard icon={<WandSparkles className="h-5 w-5" />} label={t('billing.usage.aiRequests')} used={Number(usage.ai_requests || 0)} limit={Number(currentPlan.ai_requests_monthly || 0)} />
        <UsageCard icon={<FileText className="h-5 w-5" />} label={t('billing.usage.emails')} used={Number(usage.email || 0)} limit={Number(currentPlan.email_monthly || 0)} />
        <UsageCard icon={<Zap className="h-5 w-5" />} label={t('billing.usage.sms')} used={Number(usage.sms || 0)} limit={Number(currentPlan.sms_monthly || 0)} />
      </section>

      {(!hasStripeSubscription || !ACTIVE_STATUSES.has(status)) && (
        <Card className="overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-r from-primary/10 via-card to-violet-500/5 shadow-card">
          <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold"><Gift className="h-5 w-5 text-primary" />{t('billing.offer.title')}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('billing.offer.description')}</p>
            </div>
            <div className="flex gap-2">
              <Input value={offerCode} onChange={(event) => setOfferCode(event.target.value.toUpperCase())} placeholder={t('billing.offer.placeholder')} className="h-11 uppercase" />
            </div>
          </CardContent>
        </Card>
      )}

      <section data-tour="billing-plan" className="grid gap-5 xl:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            locale={locale}
            current={subscription.plan_id === plan.id && ACTIVE_STATUSES.has(status)}
            checkoutLoading={checkoutPlan === plan.id}
            anyCheckoutLoading={Boolean(checkoutPlan)}
            hasActiveSubscription={hasStripeSubscription && ACTIVE_STATUSES.has(status)}
            fixedTermSubscription={fixedTermSubscription}
            onCheckout={() => void startCheckout(plan.id)}
            onPortal={() => void openPortal()}
            t={t}
          />
        ))}
      </section>

      <Card className="rounded-3xl shadow-card">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />{t('billing.invoices.title')}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{t('billing.invoices.description')}</p></div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('billing.invoices.empty')}</div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{invoice.invoice_number || invoice.stripe_invoice_id}</span><Badge variant="outline">{invoice.status}</Badge></div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(invoice.created_at))}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="font-extrabold">{formatMinorCurrency(invoice.amount_due, invoice.currency, locale)}</div>
                    {invoice.hosted_invoice_url && <Button asChild size="sm" variant="outline"><a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer">{t('billing.invoices.open')}<ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPanel({ status, planName, trial, subscription, locale, t }: any) {
  const fixedTerm = subscription.billing_mode === 'fixed_term';
  const end = subscription.fixed_term_ends_at ? new Date(subscription.fixed_term_ends_at) : null;
  const graceEnd = subscription.grace_until ? new Date(subscription.grace_until) : null;
  const graceActive = Boolean(graceEnd && graceEnd.getTime() > Date.now());
  return (
    <Card className="overflow-hidden rounded-3xl border-primary/15 shadow-card">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="capitalize">{status.replaceAll('_', ' ')}</Badge>
            <Badge variant="outline">{planName}</Badge>
            {fixedTerm && <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"><Clock3 className="mr-1 h-3.5 w-3.5" />{t('billing.fixedTerm.badge')}</Badge>}
          </div>
          {trial ? (
            <div className="mt-5 max-w-2xl">
              <div className="flex items-end justify-between gap-3"><div><div className="text-2xl font-extrabold">{t('billing.trial.daysRemaining', { days: trial.daysRemaining })}</div><div className="mt-1 text-sm text-muted-foreground">{t('billing.trial.chargesOn', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(trial.end) })}</div></div><span className="text-sm font-bold text-primary">{Math.round(trial.progress)}%</span></div>
              <Progress value={trial.progress} className="mt-4 h-2" />
            </div>
          ) : status === 'past_due' ? (
            <div className="mt-4"><div className="text-xl font-extrabold text-amber-700">{t('billing.paymentIssue.title')}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{graceActive && graceEnd ? t('billing.paymentIssue.graceUntil', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(graceEnd) }) : t('billing.paymentIssue.graceExpired')}</p><p className="mt-2 text-xs font-semibold text-amber-700">{t('billing.paymentIssue.action')}</p></div>
          ) : fixedTerm ? (
            <div className="mt-4"><div className="text-xl font-extrabold">{t('billing.fixedTerm.title')}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{end ? t('billing.fixedTerm.endsOn', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(end) }) : t('billing.fixedTerm.noRenew')}</p></div>
          ) : (
            <div className="mt-4"><div className="text-xl font-extrabold">{t('billing.autoRenew.title')}</div><p className="mt-1 text-sm text-muted-foreground">{t('billing.autoRenew.description')}</p></div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-muted/40 px-5 py-4"><CreditCard className="mx-auto h-5 w-5 text-primary" /><div className="mt-2 text-xs font-bold">{subscription.payment_method_collected ? t('billing.payment.saved') : t('billing.payment.required')}</div></div>
          <div className="rounded-2xl bg-muted/40 px-5 py-4"><ShieldCheck className="mx-auto h-5 w-5 text-primary" /><div className="mt-2 text-xs font-bold">{t('billing.payment.secure')}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageCard({ icon, label, used, limit }: { icon: React.ReactNode; label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div className="text-sm font-extrabold">{used.toLocaleString()} / {limit.toLocaleString()}</div></div><div className="mt-4 text-sm font-semibold text-muted-foreground">{label}</div><Progress value={percent} className="mt-3 h-1.5" /></CardContent></Card>;
}

function PlanCard({ plan, locale, current, checkoutLoading, anyCheckoutLoading, hasActiveSubscription, fixedTermSubscription, onCheckout, onPortal, t }: { plan: BillingPlan; locale: string; current: boolean; checkoutLoading: boolean; anyCheckoutLoading: boolean; hasActiveSubscription: boolean; fixedTermSubscription: boolean; onCheckout: () => void; onPortal: () => void; t: any }) {
  const benefits = [
    t('billing.planFeatures.staff', { count: plan.staffLimit }),
    plan.staffAppInstall ? t('billing.planFeatures.staffApps') : t('billing.planFeatures.browserStaff'),
    t('billing.planFeatures.ai', { count: plan.aiRequestsMonthly.toLocaleString() }),
    t('billing.planFeatures.email', { count: plan.emailMonthly.toLocaleString() }),
    t('billing.planFeatures.sms', { count: plan.smsMonthly.toLocaleString() }),
    plan.advancedReports ? t('billing.planFeatures.advancedReports') : t('billing.planFeatures.coreReports'),
  ];
  return (
    <Card className={`relative overflow-hidden rounded-3xl transition ${plan.highlighted ? 'border-primary/40 shadow-xl shadow-primary/10' : 'shadow-card'} ${current ? 'ring-2 ring-primary' : ''}`}>
      {plan.highlighted && <div className="bg-primary px-4 py-2 text-center text-xs font-extrabold uppercase tracking-[0.14em] text-primary-foreground">{t('billing.plan.mostPopular')}</div>}
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xl font-extrabold">{plan.name}</div><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p></div>{current && <BadgeCheck className="h-6 w-6 text-primary" />}</div>
        <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight">{formatPlanCurrency(plan.price, locale)}</span><span className="pb-1 text-sm font-semibold text-muted-foreground">{t('billing.plan.perMonth')}</span></div>
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700"><Sparkles className="h-4 w-4" />{t('billing.plan.trialIncluded', { days: BILLING_TRIAL_DAYS })}</div>
        <Separator className="my-5" />
        <div className="space-y-3">{benefits.map((item) => <div key={item} className="flex items-start gap-2.5 text-sm"><div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-3 w-3" /></div><span>{item}</span></div>)}</div>
        <Button className="mt-6 h-11 w-full rounded-xl" variant={current ? 'outline' : plan.highlighted ? 'default' : 'secondary'} disabled={anyCheckoutLoading || (fixedTermSubscription && hasActiveSubscription && !current)} onClick={hasActiveSubscription ? onPortal : onCheckout}>
          {current ? t('billing.actions.currentPlan') : fixedTermSubscription && hasActiveSubscription ? t('billing.actions.fixedTermLocked') : hasActiveSubscription ? t('billing.actions.changePlan') : checkoutLoading ? t('billing.actions.openingCheckout') : t('billing.actions.startTrial')} {!current && !checkoutLoading && !(fixedTermSubscription && hasActiveSubscription) && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatMinorCurrency(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: String(currency || 'EUR').toUpperCase() }).format(Number(value || 0) / 100);
}
