import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Bot, Check, CreditCard, Mail, MessageSquareText, PlusCircle, RefreshCw, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';

type Addon = {
  addon_id: string; category: 'sms'|'email'|'ai'|'pos'; name: string; description: string | null;
  units: number; token_units: number; monthly_price_cents: number; currency: string;
  allows_cycle_purchase: boolean; allows_recurring_purchase: boolean; metadata?: Record<string, any>;
};
type Entitlement = { id:string; addon_id:string; purchase_mode:'cycle'|'recurring'; status:string; units:number; token_units:number; starts_at?:string|null; ends_at?:string|null; cancel_at_period_end?:boolean };

const POS_FEATURE_KEYS = [
  'tapToPay','appointmentPayments','onlinePayments','deposits','noShowCharges','cancellationCharges','tips','refunds','paymentLinks','dailyClose','paymentHistory','walletLoyalty','aiFinancialAnalysis','paymentReports',
] as const;

export default function Addons() {
  const { t, i18n } = useTranslation();
  const { activeBusiness, businessMemberships } = useAuth();
  const businessId = activeBusiness?.id ?? businessMemberships[0]?.business_id;
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [searchParams] = useSearchParams();
  const [mode, setMode] = React.useState<'cycle'|'recurring'>('cycle');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [catalog, setCatalog] = React.useState<Addon[]>([]);
  const [entitlements, setEntitlements] = React.useState<Entitlement[]>([]);
  const [billing, setBilling] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_owner_addons', { p_business_id: businessId });
    if (error) toast.error(error.message || t('addons.messages.loadFailed'));
    else { setCatalog(data?.catalog || []); setEntitlements(data?.entitlements || []); setBilling(data?.billing || null); }
    setLoading(false);
  }, [businessId, t]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (searchParams.get('success') === 'true') { toast.success(t('addons.messages.purchaseProcessing')); void load(); }
    if (searchParams.get('canceled') === 'true') toast.info(t('addons.messages.purchaseCancelled'));
  }, [searchParams, load, t]);

  const checkout = async (addon: Addon, purchaseMode: 'cycle'|'recurring') => {
    if (!businessId) return;
    setBusy(`${addon.addon_id}:${purchaseMode}`);
    try {
      const { data, error } = await supabase.functions.invoke('create_addon_checkout', {
        body: { businessId, addonId: addon.addon_id, purchaseMode, locale: normalizeLanguage(i18n.resolvedLanguage) },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(t('addons.messages.checkoutMissing'));
      window.location.assign(data.url);
    } catch (error:any) {
      toast.error(error?.message || t('addons.messages.checkoutFailed'));
      setBusy(null);
    }
  };


  const cancelRecurring = async (item: Entitlement) => {
    if (!businessId || item.purchase_mode !== 'recurring') return;
    setBusy(`cancel:${item.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('cancel_addon_subscription', {
        body: { businessId, entitlementId: item.id },
      });
      if (error) throw error;
      toast.success(t('addons.messages.cancelScheduled'));
      await load();
      if (data?.endsAt) window.dispatchEvent(new CustomEvent('velliqo:usage-updated'));
    } catch (error:any) {
      toast.error(error?.message || t('addons.messages.cancelFailed'));
    } finally {
      setBusy(null);
    }
  };

  const money = (cents:number) => new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(cents/100);
  const activeFor = (addonId:string) => entitlements.filter((item)=>item.addon_id===addonId && ['active','past_due'].includes(item.status));
  const effective = billing?.effective_limits || {};
  const usage = billing?.usage || {};
  const pos = catalog.find((x)=>x.category==='pos');

  if (loading) return <div className="app-page"><div className="rounded-3xl border bg-card p-16 text-center text-muted-foreground">{t('addons.loading')}</div></div>;

  return (
    <div className="app-page space-y-7 pb-12">
      <header className="app-page-header">
        <div><div className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-primary">{t('addons.eyebrow')}</div><h1 className="app-page-title">{t('addons.title')}</h1><p className="app-page-description">{t('addons.description')}</p></div>
        <Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4" />{t('addons.refresh')}</Button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Allowance icon={<Bot />} label={t('addons.allowances.ai')} used={usage.ai_requests || 0} limit={effective.ai_requests || 0} />
        <Allowance icon={<Mail />} label={t('addons.allowances.email')} used={usage.email || 0} limit={effective.email || 0} />
        <Allowance icon={<MessageSquareText />} label={t('addons.allowances.sms')} used={usage.sms || 0} limit={effective.sms || 0} />
      </section>

      <Card className="overflow-hidden rounded-3xl border-violet-200/70 bg-gradient-to-br from-white via-violet-50/40 to-fuchsia-50/40 shadow-card">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><div className="flex items-center gap-2 font-extrabold"><Zap className="h-5 w-5 text-primary" />{t('addons.boosters.title')}</div><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{t('addons.boosters.description')}</p></div>
          <Tabs value={mode} onValueChange={(v)=>setMode(v as 'cycle'|'recurring')}><TabsList className="grid w-full grid-cols-2 lg:w-[330px]"><TabsTrigger value="cycle">{t('addons.modes.cycle')}</TabsTrigger><TabsTrigger value="recurring">{t('addons.modes.recurring')}</TabsTrigger></TabsList></Tabs>
        </CardContent>
      </Card>

      {(['sms','email','ai'] as const).map((category)=>{
        const items=catalog.filter((x)=>x.category===category);
        if (!items.length) return null;
        return <section key={category} className="space-y-4"><div><h2 className="text-xl font-extrabold">{t(`addons.categories.${category}.title`)}</h2><p className="mt-1 text-sm text-muted-foreground">{t(`addons.categories.${category}.description`)}</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((addon)=><AddonCard key={addon.addon_id} addon={addon} mode={mode} money={money} active={activeFor(addon.addon_id)} busy={busy===`${addon.addon_id}:${mode}`} onBuy={()=>void checkout(addon,mode)} t={t} />)}</div></section>;
      })}

      {pos && <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_85%_0%,rgba(139,92,246,.35),transparent_30%),linear-gradient(135deg,#090b15,#151229_55%,#29174d)] text-white shadow-[0_30px_90px_rgba(15,23,42,.22)]">
        <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[.85fr_1.15fr]">
          <div><Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10"><WalletCards className="mr-1 h-3.5 w-3.5" />{t('addons.pos.badge')}</Badge><h2 className="mt-5 text-3xl font-extrabold tracking-tight">{t('addons.pos.title')}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-white/65">{t('addons.pos.description')}</p><div className="mt-6 flex items-end gap-2"><span className="text-4xl font-black">{money(pos.monthly_price_cents)}</span><span className="pb-1 text-sm font-semibold text-white/55">{t('addons.pos.perMonth')}</span></div><div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100"><ShieldCheck className="mr-2 inline h-4 w-4" />{t('addons.pos.feeNotice')}</div><Button className="mt-6 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90" disabled={busy===`${pos.addon_id}:recurring` || activeFor(pos.addon_id).some(x=>x.status==='active')} onClick={()=>void checkout(pos,'recurring')}><CreditCard className="mr-2 h-4 w-4" />{activeFor(pos.addon_id).some(x=>x.status==='active') ? t('addons.pos.active') : t('addons.pos.subscribe')}</Button></div>
          <div className="grid gap-3 sm:grid-cols-2">{POS_FEATURE_KEYS.map((key)=><div key={key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.055] p-4"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-violet-200"><Check className="h-4 w-4" /></span><span className="text-sm font-semibold leading-6 text-white/80">{t(`addons.pos.features.${key}`)}</span></div>)}</div>
        </div>
        <div className="border-t border-white/10 bg-black/10 px-6 py-4 text-xs leading-5 text-white/45 sm:px-8">{t('addons.pos.tapToPayTechnical')}</div>
      </section>}

      <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" />{t('addons.active.title')}</CardTitle></CardHeader><CardContent>{entitlements.filter(x=>x.status!=='expired').length===0 ? <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">{t('addons.active.empty')}</div> : <div className="space-y-2">{entitlements.filter(x=>x.status!=='expired').map((item)=><div key={item.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold">{t(`addons.catalog.${item.addon_id}.name`,{defaultValue:catalog.find(x=>x.addon_id===item.addon_id)?.name || item.addon_id})}</div><div className="mt-1 text-xs text-muted-foreground">{item.purchase_mode==='recurring'?t('addons.modes.recurring'):t('addons.modes.cycle')}{item.ends_at?` · ${new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(item.ends_at))}`:''}{item.cancel_at_period_end?` · ${t('addons.active.endsAtPeriodEnd')}`:''}</div></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="w-fit capitalize">{t(`addons.active.statuses.${item.status}`, { defaultValue: item.status.replaceAll('_',' ') })}</Badge>{item.purchase_mode==='recurring' && item.status==='active' && !item.cancel_at_period_end && <Button size="sm" variant="outline" disabled={busy===`cancel:${item.id}`} onClick={()=>void cancelRecurring(item)}>{busy===`cancel:${item.id}`?t('addons.active.canceling'):t('addons.active.cancel')}</Button>}</div></div>)}</div>}</CardContent></Card>
    </div>
  );
}

function Allowance({icon,label,used,limit}:{icon:React.ReactNode;label:string;used:number;limit:number}) { const pct=limit>0?Math.min(100,used/limit*100):0; return <Card className="rounded-3xl"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</span><span className="text-sm font-extrabold">{Number(used).toLocaleString()} / {Number(limit).toLocaleString()}</span></div><div className="mt-4 text-sm font-bold">{label}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${pct}%`}} /></div></CardContent></Card>; }
function AddonCard({addon,mode,money,active,busy,onBuy,t}:{addon:Addon;mode:'cycle'|'recurring';money:(n:number)=>string;active:Entitlement[];busy:boolean;onBuy:()=>void;t:any}) { const available=mode==='cycle'?addon.allows_cycle_purchase:addon.allows_recurring_purchase; const name=t(`addons.catalog.${addon.addon_id}.name`,{defaultValue:addon.name}); const description=t(`addons.catalog.${addon.addon_id}.description`,{defaultValue:addon.description || ''}); return <Card className="rounded-3xl transition hover:-translate-y-0.5 hover:shadow-lg"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-extrabold">{name}</div><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{description}</p></div>{active.some(x=>x.status==='active')&&<Badge className="bg-emerald-600">{t('addons.active.badge')}</Badge>}</div><div className="mt-5 text-2xl font-black">{money(addon.monthly_price_cents)}</div><div className="mt-1 text-xs text-muted-foreground">{mode==='cycle'?t('addons.price.cycle'):t('addons.price.monthly')}</div>{addon.category==='ai'&&<div className="mt-3 text-xs font-semibold text-violet-700">+{Number(addon.token_units).toLocaleString()} {t('addons.aiTokens')}</div>}<Button className="mt-5 w-full rounded-xl" disabled={!available||busy} onClick={onBuy}>{busy?t('addons.buy.opening'):available?t('addons.buy.action'):t('addons.buy.unavailable')}</Button></CardContent></Card>; }
