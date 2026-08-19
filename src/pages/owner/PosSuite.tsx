import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Banknote,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  History,
  Loader2,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const FEATURE_KEYS = [
  'tapToPay','appointmentPayments','onlinePayments','deposits','noShowCharges','cancellationCharges','tips','refunds','paymentLinks','dailyClose','paymentHistory','walletLoyalty','aiFinancialAnalysis','paymentReports',
] as const;

type PaymentAccount = {
  provider?: string;
  provider_account_id?: string | null;
  account_type?: string | null;
  onboarding_status?: 'not_started'|'pending'|'restricted'|'ready';
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  processing_fees_paid_by_owner?: boolean;
  country?: string | null;
  default_currency?: string | null;
  disabled_reason?: string | null;
  requirements_currently_due?: string[];
  requirements_eventually_due?: string[];
  requirements_past_due?: string[];
  requirements_pending_verification?: string[];
  connected_at?: string | null;
  last_synced_at?: string | null;
};

type MerchantBusy = 'onboarding' | 'refresh' | null;

export default function PosSuite() {
  const { t, i18n } = useTranslation();
  const { activeBusiness, businessMemberships } = useAuth();
  const businessId = activeBusiness?.id ?? businessMemberships[0]?.business_id;
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(false);
  const [account, setAccount] = React.useState<PaymentAccount | null>(null);
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [merchantBusy, setMerchantBusy] = React.useState<MerchantBusy>(null);
  const handledStripeReturn = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const [billing, accountResult, sales] = await Promise.all([
      (supabase as any).rpc('get_business_billing_summary', { p_business_id: businessId }),
      (supabase as any).from('business_payment_accounts').select('*').eq('business_id', businessId).maybeSingle(),
      (supabase as any).from('sale_transactions').select('id,receipt_number,total_amount,tip_amount,status,completed_at').eq('business_id', businessId).order('completed_at', { ascending: false }).limit(40),
    ]);
    setActive(Boolean(billing.data?.addons?.pos_active));
    setAccount(accountResult.data || null);
    setTransactions(sales.data || []);
    setLoading(false);
  }, [businessId]);

  React.useEffect(() => { void load(); }, [load]);

  const refreshMerchantStatus = React.useCallback(async (showToast = true) => {
    if (!businessId) return null;
    setMerchantBusy('refresh');
    try {
      const { data, error } = await supabase.functions.invoke('pos_merchant_account', {
        body: { businessId, action: 'refresh_status' },
      });
      if (error) throw error;
      if (data?.account) setAccount(data.account);
      if (showToast) {
        toast.success(data?.status === 'ready' ? t('posWorkspace.messages.ready') : t('posWorkspace.messages.statusRefreshed'));
      }
      return data;
    } catch (error: any) {
      toast.error(await getFunctionErrorMessage(error, t('posWorkspace.messages.refreshFailed')));
      return null;
    } finally {
      setMerchantBusy(null);
    }
  }, [businessId, t]);

  const startOnboarding = React.useCallback(async () => {
    if (!businessId) return;
    setMerchantBusy('onboarding');
    try {
      const { data, error } = await supabase.functions.invoke('pos_merchant_account', {
        body: { businessId, action: 'start_onboarding' },
      });
      if (error) throw error;
      if (data?.account) setAccount(data.account);
      if (data?.onboardingUrl) {
        window.location.assign(data.onboardingUrl);
        return;
      }
      if (data?.status === 'ready') toast.success(t('posWorkspace.messages.ready'));
      else toast.info(t('posWorkspace.messages.noOnboardingLink'));
    } catch (error: any) {
      toast.error(await getFunctionErrorMessage(error, t('posWorkspace.messages.onboardingFailed')));
    } finally {
      setMerchantBusy(null);
    }
  }, [businessId, t]);

  React.useEffect(() => {
    if (loading || !active || handledStripeReturn.current) return;
    const stripeState = searchParams.get('stripe');
    if (!stripeState) return;
    handledStripeReturn.current = true;

    if (stripeState === 'refresh') {
      void startOnboarding();
      return;
    }

    if (stripeState === 'return') {
      void (async () => {
        await refreshMerchantStatus(true);
        setSearchParams({}, { replace: true });
      })();
    }
  }, [active, loading, refreshMerchantStatus, searchParams, setSearchParams, startOnboarding]);

  const todayKey = new Date().toDateString();
  const today = transactions.filter((row) => row.completed_at && new Date(row.completed_at).toDateString() === todayKey && row.status !== 'voided');
  const todaySales = today.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const tips = today.reduce((sum, row) => sum + Number(row.tip_amount || 0), 0);
  const money = (value:number) => new Intl.NumberFormat(locale, { style:'currency', currency:'EUR' }).format(value);
  const providerReady = account?.onboarding_status === 'ready' && account?.charges_enabled === true && account?.payouts_enabled === true;
  const status = account?.provider_account_id ? (account.onboarding_status || 'pending') : 'not_started';
  const dueCount = Array.isArray(account?.requirements_currently_due) ? account!.requirements_currently_due!.length : 0;
  const pendingVerificationCount = Array.isArray(account?.requirements_pending_verification) ? account!.requirements_pending_verification!.length : 0;

  if (loading) return <div className="app-page"><div className="rounded-3xl border bg-card p-16 text-center text-muted-foreground">{t('system.loading')}</div></div>;

  if (!active) return <div className="app-page"><section className="overflow-hidden rounded-[2rem] border border-violet-200 bg-[radial-gradient(circle_at_90%_5%,rgba(168,85,247,.20),transparent_30%),linear-gradient(135deg,#fff,#f7f3ff)] p-6 shadow-card sm:p-9"><Badge className="bg-violet-700"><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />{t('posWorkspace.title')}</Badge><h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{t('posWorkspace.inactiveTitle')}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{t('posWorkspace.inactiveText')}</p><Button asChild className="mt-7 h-11 rounded-xl"><Link to="/dashboard/addons"><Sparkles className="mr-2 h-4 w-4" />{t('posWorkspace.openAddons')}</Link></Button></section></div>;

  return <div className="app-page space-y-6 pb-12">
    <header className="app-page-header"><div><div className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-primary">{t('posWorkspace.eyebrow')}</div><h1 className="app-page-title">{t('posWorkspace.title')}</h1><p className="app-page-description">{t('posWorkspace.description')}</p></div><Button asChild variant="outline"><Link to="/dashboard/addons">{t('navigation.addons')}<ExternalLink className="ml-2 h-4 w-4" /></Link></Button></header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<CircleDollarSign />} label={t('posWorkspace.todaySales')} value={money(todaySales)} />
      <Metric icon={<Banknote />} label={t('posWorkspace.tips')} value={money(tips)} />
      <Metric icon={<History />} label={t('posWorkspace.transactions')} value={String(today.length)} />
      <Metric icon={<ShieldCheck />} label={t('posWorkspace.providerFees')} value={t('posWorkspace.providerFeesValue')} small />
    </section>

    <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-950 text-white">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold"><CreditCard className="h-5 w-5 text-violet-300" />{t('posWorkspace.statusTitle')}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} t={t} />
            {account?.provider && <Badge variant="outline" className="border-white/15 text-white">{String(account.provider).toUpperCase()}</Badge>}
            {account?.country && <Badge variant="outline" className="border-white/15 text-white">{account.country}</Badge>}
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60">{t('posWorkspace.providerText')}</p>
          {status === 'restricted' && <div className="mt-4 flex max-w-3xl items-start gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{t('posWorkspace.restrictedText', { count: dueCount })}</span></div>}
          {pendingVerificationCount > 0 && <p className="mt-3 text-xs text-white/45">{t('posWorkspace.pendingVerification', { count: pendingVerificationCount })}</p>}
          {account?.last_synced_at && <p className="mt-2 text-xs text-white/35">{t('posWorkspace.lastSynced', { date: new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(account.last_synced_at)) })}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {!providerReady && <Button onClick={()=>void startOnboarding()} disabled={merchantBusy !== null} className="bg-white text-slate-950 hover:bg-white/90">{merchantBusy==='onboarding'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<CreditCard className="mr-2 h-4 w-4"/>}{account?.provider_account_id?t('posWorkspace.continueSetup'):t('posWorkspace.connectStripe')}</Button>}
            <Button variant="outline" onClick={()=>void refreshMerchantStatus(true)} disabled={merchantBusy !== null} className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">{merchantBusy==='refresh'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<RefreshCw className="mr-2 h-4 w-4"/>}{t('posWorkspace.refreshStatus')}</Button>
            {providerReady && <Button asChild variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">{t('posWorkspace.openStripe')}<ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
          </div>
        </div>
        <div className={`flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[.06] ${providerReady?'text-emerald-300':'text-violet-200'}`}>{providerReady?<CheckCircle2 className="h-9 w-9" />:<Smartphone className="h-9 w-9" />}</div>
      </CardContent>
    </Card>

    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
      <ShieldCheck className="mr-2 inline h-4 w-4" />{providerReady?t('posWorkspace.secureFlowReadyNext'):t('posWorkspace.secureFlowLocked')}
    </div>

    <section><h2 className="text-xl font-extrabold">{t('posWorkspace.features')}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{FEATURE_KEYS.map((key)=><div key={key} className="flex min-h-24 items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><CheckCircle2 className="h-4 w-4" /></span><span className="pt-1 text-sm font-bold leading-5">{t(`addons.pos.features.${key}`)}</span></div>)}</div><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950">{t('posWorkspace.nativeNote')}</div></section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />{t('posWorkspace.history')}</CardTitle></CardHeader><CardContent>{transactions.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('posWorkspace.noTransactions')}</div>:<div className="divide-y">{transactions.slice(0,12).map((row)=><div key={row.id} className="grid grid-cols-[1fr_auto] gap-4 py-3"><div><div className="text-sm font-extrabold">{row.receipt_number || row.id}</div><div className="mt-1 text-xs text-muted-foreground">{row.completed_at?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.completed_at)):''}</div></div><div className="text-right"><div className="text-sm font-black">{money(Number(row.total_amount||0))}</div><div className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{row.status || 'recorded'}</div></div></div>)}</div>}</CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
        <Shortcut to="/dashboard/sales" icon={<CalendarCheck2 />} title={t('posWorkspace.daily')} />
        <Shortcut to="/dashboard/customers" icon={<WalletCards />} title={t('posWorkspace.wallet')} />
        <Shortcut to="/dashboard/reports" icon={<ReceiptText />} title={t('posWorkspace.reports')} />
      </div>
    </section>
  </div>;
}

async function getFunctionErrorMessage(error: any, fallback: string) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    }
  } catch {
    // Keep the original Supabase error/fallback if the response body is unavailable.
  }
  return String(error?.message || fallback);
}

function StatusBadge({status,t}:{status:string;t:any}) {
  const classes = status==='ready'?'bg-emerald-600':status==='restricted'?'bg-amber-500 text-slate-950':status==='pending'?'bg-violet-500':'bg-slate-700';
  const key = status==='ready'?'ready':status==='restricted'?'restricted':status==='pending'?'pending':'notConnected';
  return <Badge className={classes}>{t(`posWorkspace.${key}`)}</Badge>;
}

function Metric({icon,label,value,small=false}:{icon:React.ReactNode;label:string;value:string;small?:boolean}) { return <Card className="rounded-3xl"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div><div className="mt-4 text-xs font-bold text-muted-foreground">{label}</div><div className={`mt-1 font-black ${small?'text-sm leading-5':'text-2xl'}`}>{value}</div></CardContent></Card>; }
function Shortcut({to,icon,title}:{to:string;icon:React.ReactNode;title:string}) { return <Button asChild variant="outline" className="h-auto min-h-24 justify-start rounded-2xl px-5"><Link to={to}><span className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">{icon}</span><span className="font-extrabold">{title}</span></Link></Button>; }
