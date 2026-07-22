import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Infinity as InfinityIcon,
  LockKeyhole,
  ReceiptText,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

const PROFESSIONAL_PRICE = 24.99;
const TRIAL_DAYS = 14;

const PROFESSIONAL_FEATURES = [
  'appointments',
  'staff',
  'services',
  'crm',
  'customerRecords',
  'storefront',
  'customerBooking',
  'reports',
  'inventory',
  'content',
  'closures',
  'notifications',
  'stripe',
] as const;

export default function Billing() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;
  const business = businessMemberships[0]?.businesses;
  const [searchParams, setSearchParams] = useSearchParams();

  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  useEffect(() => {
    const checkoutSucceeded = searchParams.get('success') === 'true';
    const checkoutCancelled = searchParams.get('canceled') === 'true';

    if (checkoutSucceeded) {
      toast.success(
        t('billing.messages.checkoutCompleted')
      );
      setSearchParams({});
      if (businessId) {
        window.setTimeout(() => void fetchData(), 1200);
      }
    }

    if (checkoutCancelled) {
      toast.info(t('billing.messages.checkoutCancelled'));
      setSearchParams({});
    }
  }, [businessId, searchParams, setSearchParams]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [subscriptionResult, invoicesResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle(),

        (supabase as any)
          .from('billing_invoices')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
      ]);

      if (subscriptionResult.error) throw subscriptionResult.error;

      setSubscription(subscriptionResult.data ?? null);

      if (invoicesResult.error) {
        console.warn(
          'Billing invoice history is not available yet:',
          invoicesResult.error
        );
        setInvoices([]);
      } else {
        setInvoices(invoicesResult.data ?? []);
      }
    } catch (error: any) {
      console.error('Billing load error:', error);
      toast.error(error.message || t('billing.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const status = subscription?.status || 'trialing';
  const isTrial = status === 'trialing';
  const isActive = ['active', 'trialing'].includes(status);
  const isProfessional =
    subscription?.plan_id === 'professional' ||
    Boolean(subscription?.stripe_subscription_id);

  const trialInfo = useMemo(() => {
    if (!isTrial) {
      return {
        daysRemaining: 0,
        progress: 100,
        trialEnd: null as Date | null,
      };
    }

    const trialEnd = subscription?.trial_ends_at
      ? new Date(subscription.trial_ends_at)
      : null;

    if (!trialEnd) {
      return {
        daysRemaining: TRIAL_DAYS,
        progress: 0,
        trialEnd: null,
      };
    }

    const now = new Date();
    const millisecondsRemaining = Math.max(
      trialEnd.getTime() - now.getTime(),
      0
    );

    const daysRemaining = Math.ceil(
      millisecondsRemaining / (1000 * 60 * 60 * 24)
    );

    const daysUsed = Math.max(TRIAL_DAYS - daysRemaining, 0);
    const progress = Math.min((daysUsed / TRIAL_DAYS) * 100, 100);

    return {
      daysRemaining,
      progress,
      trialEnd,
    };
  }, [isTrial, subscription?.trial_ends_at]);

  const handleSubscribe = async () => {
    if (!businessId) return;

    setCheckoutLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'create_subscription_checkout',
        {
          body: {
            businessId,
            planId: 'professional',
            trialDays: TRIAL_DAYS,
            successUrl: `${window.location.origin}/dashboard/billing?success=true`,
            cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
          },
        }
      );

      if (error) throw error;
      if (!data?.url) throw new Error(t('billing.messages.checkoutUrlMissing'));

      window.location.assign(data.url);
    } catch (error: any) {
      toast.error(error.message || t('billing.messages.checkoutFailed'));
      setCheckoutLoading(false);
    }
  };

  const openBillingPortal = async () => {
    if (!businessId) return;

    setPortalLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'create_billing_portal_session',
        {
          body: {
            businessId,
            returnUrl: `${window.location.origin}/dashboard/billing`,
          },
        }
      );

      if (error) throw error;
      if (!data?.url) throw new Error(t('billing.messages.portalUrlMissing'));

      window.location.assign(data.url);
    } catch (error: any) {
      toast.error(
        error.message ||
          t('billing.messages.portalUnavailable')
      );
      setPortalLoading(false);
    }
  };

  return (
    <div className="app-page pb-10">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('billing.eyebrow')}
          </div>

          <h1 className="app-page-title">{t('billing.title')}</h1>

          <p className="app-page-description">
            {t('billing.description', { days: TRIAL_DAYS })}
          </p>
        </div>

        {subscription?.stripe_customer_id && (
          <Button
            variant="outline"
            disabled={portalLoading}
            onClick={() => void openBillingPortal()}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {portalLoading ? t('billing.actions.opening') : t('billing.actions.manageBilling')}
          </Button>
        )}
      </header>

      {loading ? (
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground shadow-card">
          {t('billing.states.loading')}
        </div>
      ) : (
        <>
          {isTrial && (
            <TrialWelcomeBanner
              businessName={business?.name || t('billing.common.yourBusiness')}
              daysRemaining={trialInfo.daysRemaining}
              progress={trialInfo.progress}
              trialEnd={trialInfo.trialEnd}
            />
          )}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <Card className="relative overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card shadow-card">
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

              <CardContent className="relative p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isTrial
                          ? t('billing.plan.freeTrialAllFeatures')
                          : isProfessional
                            ? t('billing.plan.professional')
                            : t(`billing.subscriptionStatus.${status || 'trialing'}`, { defaultValue: status })}
                      </Badge>

                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {t('billing.plan.mostPopular')}
                      </Badge>
                    </div>

                    <div className="mt-5 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                        <Sparkles className="h-6 w-6" />
                      </div>

                      <div>
                        <h2 className="text-3xl font-bold">
                          {t('billing.plan.professional')}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('billing.plan.description')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-7 flex flex-wrap items-end gap-3">
                      <div className="text-5xl font-extrabold tracking-tight">
                        {formatBillingCurrency(PROFESSIONAL_PRICE, locale)}
                      </div>

                      <div className="pb-1 text-sm font-medium text-muted-foreground">
                        {t('billing.plan.perMonth')}
                        <div className="text-xs">
                          {t('billing.plan.cancelThroughStripe')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-primary/20 bg-background/80 text-primary shadow-sm backdrop-blur">
                    <Rocket className="h-9 w-9" />
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border bg-background/70 p-5 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <InfinityIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-bold">{t('billing.plan.unlimitedTitle')}</h3>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {PROFESSIONAL_FEATURES.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{t(`billing.features.${feature}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {!subscription?.stripe_subscription_id ? (
                    <Button
                      size="lg"
                      className="h-12 px-6"
                      disabled={checkoutLoading}
                      onClick={() => void handleSubscribe()}
                    >
                      {checkoutLoading ? (
                        t('billing.actions.openingCheckout')
                      ) : (
                        <>
                          {t('billing.actions.continueProfessional')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-12 px-6"
                      disabled={portalLoading}
                      onClick={() => void openBillingPortal()}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {t('billing.actions.manageSubscription')}
                    </Button>
                  )}

                  <div className="text-sm text-muted-foreground">
                    {isTrial
                      ? t('billing.plan.trialDaysRemaining', { count: trialInfo.daysRemaining })
                      : t('billing.plan.active')}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-2xl shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    {t('billing.currentAccess.title')}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <BillingLine
                    label={t('billing.currentAccess.plan')}
                    value={
                      isTrial
                        ? t('billing.plan.freeTrial', { days: TRIAL_DAYS })
                        : t('billing.plan.professional')
                    }
                  />
                  <BillingLine
                    label={t('billing.currentAccess.status')}
                    value={t(`billing.subscriptionStatus.${status || 'trialing'}`, { defaultValue: status })}
                  />
                  <BillingLine
                    label={t('billing.currentAccess.featureAccess')}
                    value={t('billing.currentAccess.allFeatures')}
                  />
                  <BillingLine
                    label={t('billing.currentAccess.usageLimits')}
                    value={t('billing.currentAccess.unlimited')}
                  />
                  <BillingLine
                    label={t('billing.currentAccess.monthlyPrice')}
                    value={formatBillingCurrency(PROFESSIONAL_PRICE, locale)}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {t('billing.security.title')}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                  <SecurityLine
                    icon={<LockKeyhole className="h-4 w-4" />}
                    text={t('billing.security.cardDetails')}
                  />
                  <SecurityLine
                    icon={<CreditCard className="h-4 w-4" />}
                    text={t('billing.security.paymentMethod')}
                  />
                  <SecurityLine
                    icon={<CalendarDays className="h-4 w-4" />}
                    text={t('billing.security.cancelAnytime')}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-card">
                <CardHeader>
                  <CardTitle>{t('billing.statusCard.title')}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <BillingLine
                    label={t('billing.statusCard.billingCycle')}
                    value={t('billing.statusCard.monthly')}
                  />
                  <BillingLine
                    label={
                      isTrial
                        ? t('billing.statusCard.trialEnds')
                        : t('billing.statusCard.nextBillingDate')
                    }
                    value={
                      isTrial && subscription?.trial_ends_at
                        ? formatBillingDate(subscription.trial_ends_at, locale)
                        : subscription?.current_period_end
                          ? formatBillingDate(subscription.current_period_end, locale)
                          : t('common.notAvailable')
                    }
                  />
                  <BillingLine
                    label={t('billing.statusCard.paymentProvider')}
                    value="Stripe"
                  />
                  <BillingLine
                    label={t('billing.statusCard.autoRenewal')}
                    value={
                      subscription?.cancel_at_period_end
                        ? t('billing.statusCard.endsThisPeriod')
                        : t('billing.statusCard.enabled')
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="section-heading">{t('billing.history.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('billing.history.description')}
              </p>
            </div>

            <Card className="overflow-hidden rounded-2xl shadow-card">
              <CardContent className="p-0">
                {invoices.length === 0 ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center p-10 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                      <ReceiptText className="h-8 w-8 text-muted-foreground" />
                    </div>

                    <h3 className="mt-4 font-bold">
                      {t('billing.history.emptyTitle')}
                    </h3>

                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {t('billing.history.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3">{t('billing.history.invoice')}</th>
                            <th className="px-5 py-3">{t('billing.history.date')}</th>
                            <th className="px-5 py-3">{t('billing.history.amount')}</th>
                            <th className="px-5 py-3">{t('billing.history.status')}</th>
                            <th className="px-5 py-3 text-right">
                              {t('billing.history.documents')}
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {invoices.map((invoice) => (
                            <tr
                              key={invoice.id}
                              className="hover:bg-muted/25"
                            >
                              <td className="px-5 py-4 font-semibold">
                                {invoice.invoice_number ||
                                  invoice.stripe_invoice_id}
                              </td>

                              <td className="px-5 py-4">
                                {formatBillingDate(invoice.paid_at || invoice.created_at, locale)}
                              </td>

                              <td className="px-5 py-4 font-bold">
                                {formatBillingCurrency(Number(invoice.amount_paid || invoice.amount_due || 0) / 100, locale)}
                              </td>

                              <td className="px-5 py-4">
                                <Badge
                                  variant={
                                    invoice.status === 'paid'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  className="capitalize"
                                >
                                  {t(`billing.invoiceStatus.${invoice.status}`, { defaultValue: invoice.status })}
                                </Badge>
                              </td>

                              <td className="px-5 py-4">
                                <InvoiceActions invoice={invoice} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="divide-y md:hidden">
                      {invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="space-y-4 p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold">
                                {invoice.invoice_number ||
                                  invoice.stripe_invoice_id}
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {formatBillingDate(invoice.paid_at || invoice.created_at, locale)}
                              </div>
                            </div>

                            <Badge
                              variant={
                                invoice.status === 'paid'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="capitalize"
                            >
                              {t(`billing.invoiceStatus.${invoice.status}`, { defaultValue: invoice.status })}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between rounded-xl bg-muted/35 p-4">
                            <span className="text-sm text-muted-foreground">
                              {t('billing.history.amount')}
                            </span>
                            <span className="text-lg font-bold">
                              {formatBillingCurrency(Number(invoice.amount_paid || invoice.amount_due || 0) / 100, locale)}
                            </span>
                          </div>

                          <InvoiceActions invoice={invoice} mobile />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function TrialWelcomeBanner({
  businessName,
  daysRemaining,
  progress,
  trialEnd,
}: {
  businessName: string;
  daysRemaining: number;
  progress: number;
  trialEnd: Date | null;
}) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  return (
    <Card className="overflow-hidden rounded-3xl border-blue-200 bg-gradient-to-r from-blue-50 via-card to-amber-50 shadow-card">
      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Zap className="h-6 w-6" />
            </div>

            <div>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                {t('billing.trial.fullPlatform')}
              </Badge>

              <h2 className="mt-3 text-xl font-bold">
                {t('billing.trial.welcome', { days: TRIAL_DAYS, business: businessName })}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t('billing.trial.description')}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('billing.trial.remaining')}
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {t('billing.trial.days', { count: daysRemaining })}
                </div>
              </div>

              <Clock3 className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
              />
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              {trialEnd
                ? t('billing.trial.ends', { date: formatBillingDate(trialEnd.toISOString(), locale) })
                : t('billing.trial.started')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceActions({
  invoice,
  mobile = false,
}: {
  invoice: any;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex gap-2 ${
        mobile ? 'grid grid-cols-2' : 'justify-end'
      }`}
    >
      {invoice.hosted_invoice_url && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={mobile ? 'w-full' : ''}
        >
          <a
            href={invoice.hosted_invoice_url}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="mr-2 h-4 w-4" />
            {t('billing.history.view')}
          </a>
        </Button>
      )}

      {invoice.invoice_pdf_url && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={mobile ? 'w-full' : ''}
        >
          <a
            href={invoice.invoice_pdf_url}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </a>
        </Button>
      )}
    </div>
  );
}

function SecurityLine({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>{text}</div>
    </div>
  );
}

function BillingLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function formatBillingDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatBillingCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}
