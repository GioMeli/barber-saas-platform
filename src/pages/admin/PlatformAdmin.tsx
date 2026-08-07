import React from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgePercent, Building2, CreditCard, Gift, Power, ReceiptText, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { BILLING_PLANS, type BillingPlanId } from '@/billing/plans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function PlatformAdmin() {
  const { profile, loading } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [businesses, setBusinesses] = React.useState<any[]>([]);
  const [businessCount, setBusinessCount] = React.useState(0);
  const [subscriptions, setSubscriptions] = React.useState<any[]>([]);
  const [offers, setOffers] = React.useState<any[]>([]);
  const [redemptions, setRedemptions] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ code: '', description: '', plan_id: 'pro' as BillingPlanId, duration_months: '6', percent_off: '0', trial_days: '14', max_redemptions: '', starts_at: '', expires_at: '' });

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const [businessResult, businessCountResult, subscriptionResult, offerResult, redemptionResult] = await Promise.all([
        (supabase as any).from('businesses').select('id,name,slug,status,created_at').order('created_at', { ascending: false }).limit(12),
        (supabase as any).from('businesses').select('id', { count: 'exact', head: true }),
        (supabase as any).from('subscriptions').select('business_id,plan_id,status,unit_amount,currency,billing_mode,fixed_term_ends_at,offer_code_id,created_at'),
        (supabase as any).from('billing_offer_codes').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('billing_offer_redemptions').select('offer_code_id,status'),
      ]);
      for (const result of [businessResult, businessCountResult, subscriptionResult, offerResult, redemptionResult]) if (result.error) throw result.error;
      setBusinesses(businessResult.data || []);
      setBusinessCount(Number(businessCountResult.count || 0));
      setSubscriptions(subscriptionResult.data || []);
      setOffers(offerResult.data || []);
      setRedemptions(redemptionResult.data || []);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load platform billing');
    } finally { setBusy(false); }
  }, []);

  React.useEffect(() => { if (profile?.role === 'Platform Admin') void load(); }, [load, profile?.role]);

  if (loading) return <div className="p-10">Loading...</div>;
  if (profile?.role !== 'Platform Admin') return <Navigate to="/" replace />;

  const activeSubscriptions = subscriptions.filter((item) => ['active', 'trialing', 'past_due'].includes(item.status));
  const mrrCents = subscriptions.filter((item) => ['active', 'past_due'].includes(item.status)).reduce((sum, item) => {
    const offer = item.offer_code_id ? offers.find((candidate) => candidate.id === item.offer_code_id) : null;
    const discount = Math.min(100, Math.max(0, Number(offer?.percent_off || 0)));
    return sum + Math.round(Number(item.unit_amount || 0) * (1 - discount / 100));
  }, 0);

  const createOffer = async () => {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) return toast.error('Use 4–32 letters, numbers, _ or - for the code.');
    setBusy(true);
    try {
      const { error } = await (supabase as any).from('billing_offer_codes').insert({
        code,
        description: form.description.trim() || null,
        plan_id: form.plan_id,
        duration_months: Number(form.duration_months),
        percent_off: Number(form.percent_off || 0),
        trial_days: Number(form.trial_days || 0),
        max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
        starts_at: form.starts_at ? new Date(`${form.starts_at}T00:00:00`).toISOString() : null,
        expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
        created_by: profile.id,
      });
      if (error) throw error;
      toast.success('Fixed-term offer code created');
      setForm({ code: '', description: '', plan_id: 'pro', duration_months: '6', percent_off: '0', trial_days: '14', max_redemptions: '', starts_at: '', expires_at: '' });
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to create offer'); }
    finally { setBusy(false); }
  };

  const toggleOffer = async (offer: any) => {
    const { error } = await (supabase as any).from('billing_offer_codes').update({ active: !offer.active, updated_at: new Date().toISOString() }).eq('id', offer.id);
    if (error) return toast.error(error.message);
    await load();
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">Velliqo control plane</div><h1 className="mt-2 text-3xl font-black">Platform Admin</h1><p className="mt-2 text-muted-foreground">Commercial operations, subscriptions and non-renewing offer codes.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></header>

        <div className="grid gap-5 md:grid-cols-3">
          <Metric icon={<Building2 className="h-5 w-5" />} label="Businesses" value={businessCount.toString()} />
          <Metric icon={<CreditCard className="h-5 w-5" />} label="Active / trial subscriptions" value={activeSubscriptions.length.toString()} />
          <Metric icon={<ReceiptText className="h-5 w-5" />} label="Current MRR" value={new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(mrrCents / 100)} />
        </div>

        <Card className="rounded-3xl shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" />Create fixed-term offer</CardTitle><p className="text-sm leading-6 text-muted-foreground">Offer subscriptions automatically receive a Stripe cancellation date. A 6- or 12-month offer never silently becomes an ongoing monthly subscription after its fixed term.</p></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Offer code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PARTNER6" /></Field>
            <Field label="Plan"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value as BillingPlanId })}>{BILLING_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · €{plan.price.toFixed(2)}</option>)}</select></Field>
            <Field label="Fixed term (months)"><Input type="number" min="1" max="36" step="1" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} /></Field>
            <Field label="Discount %"><Input type="number" min="0" max="100" step="1" value={form.percent_off} onChange={(e) => setForm({ ...form, percent_off: e.target.value })} /></Field>
            <Field label="Trial days"><Input type="number" min="0" max="60" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} /></Field>
            <Field label="Max redemptions"><Input type="number" min="1" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} placeholder="Unlimited" /></Field>
            <Field label="Starts on"><Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="Expires on"><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></Field>
            <Field label="Internal description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Partner launch offer" /></Field>
            <div className="md:col-span-2 xl:col-span-4"><Button onClick={() => void createOffer()} disabled={busy}><BadgePercent className="mr-2 h-4 w-4" />Create non-renewing offer</Button></div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-card"><CardHeader><CardTitle>Offer codes</CardTitle></CardHeader><CardContent><div className="space-y-3">{offers.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No offer codes created yet.</div> : offers.map((offer) => { const counts = redemptions.filter((item) => item.offer_code_id === offer.id); const redeemed = counts.filter((item) => item.status === 'redeemed').length; return <div key={offer.id} className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black tracking-wide">{offer.code}</span><Badge variant="outline">{String(offer.plan_id).toUpperCase()}</Badge><Badge className={offer.active ? '' : 'bg-muted text-muted-foreground'}>{offer.active ? 'Active' : 'Disabled'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{offer.duration_months} months · {Number(offer.percent_off)}% off · {offer.trial_days} trial days · {redeemed} redeemed{offer.max_redemptions ? ` / ${offer.max_redemptions}` : ''}</p></div><div className="text-sm font-bold text-amber-700">No auto-renew</div><Button size="sm" variant="outline" onClick={() => void toggleOffer(offer)}><Power className="mr-2 h-3.5 w-3.5" />{offer.active ? 'Disable' : 'Enable'}</Button></div>; })}</div></CardContent></Card>

        <Card className="rounded-3xl shadow-card"><CardHeader><CardTitle>Recent businesses</CardTitle></CardHeader><CardContent><div className="grid gap-2">{businesses.map((business) => { const subscription = subscriptions.find((item) => item.business_id === business.id); return <div key={business.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold">{business.name}</div><div className="text-xs text-muted-foreground">/{business.slug}</div></div><div className="flex items-center gap-2"><Badge variant="outline">{subscription?.plan_id || 'No plan'}</Badge><Badge>{subscription?.status || 'Not configured'}</Badge></div></div>; })}</div></CardContent></Card>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <Card className="rounded-2xl shadow-sm"><CardContent className="p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div className="mt-5 text-3xl font-black">{value}</div><div className="mt-1 text-sm font-semibold text-muted-foreground">{label}</div></CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-xs font-bold">{label}</Label>{children}</div>; }
