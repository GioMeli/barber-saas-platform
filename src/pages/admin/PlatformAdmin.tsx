import React from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  BadgePercent,
  Bot,
  Building2,
  CircleDollarSign,
  CreditCard,
  Download,
  Gift,
  Headphones,
  Mail,
  MessageSquareText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { BILLING_PLANS, type BillingPlanId } from '@/billing/plans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InternationalPhoneInput } from '@/components/inputs/InternationalPhoneInput';

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const integer = new Intl.NumberFormat('en-IE');

type Dashboard = {
  businesses?: number;
  active_businesses?: number;
  mrr_eur?: number;
  estimated_monthly_cost_eur?: number;
  estimated_monthly_profit_eur?: number;
  subscriptions?: Record<string, number>;
  usage?: Record<string, number>;
  delivery_health?: Record<string, number>;
  cost_model?: Record<string, number>;
};

type BusinessRow = {
  business_id: string;
  business_name: string;
  slug: string;
  status: string;
  business_email?: string | null;
  business_phone?: string | null;
  country?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  plan_id?: string | null;
  subscription_status?: string | null;
  billing_mode?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  staff_count?: number;
  customer_count?: number;
  appointment_count?: number;
  ai_requests_period?: number;
  ai_tokens_period?: number;
  ai_cost_period?: number;
  email_period?: number;
  sms_period?: number;
  created_at: string;
};

export default function PlatformAdmin() {
  const { profile, loading } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [dashboard, setDashboard] = React.useState<Dashboard>({});
  const [businesses, setBusinesses] = React.useState<BusinessRow[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<any[]>([]);
  const [offers, setOffers] = React.useState<any[]>([]);
  const [redemptions, setRedemptions] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [editing, setEditing] = React.useState<BusinessRow | null>(null);
  const [editForm, setEditForm] = React.useState<any>({});
  const [supportNote, setSupportNote] = React.useState('');
  const [costs, setCosts] = React.useState({ fixed: '0', email: '0', sms: '0', percent: '0', fixedFee: '0' });
  const [form, setForm] = React.useState({ code: '', description: '', plan_id: 'pro' as BillingPlanId, duration_months: '6', percent_off: '0', trial_days: '14', max_redemptions: '', starts_at: '', expires_at: '' });

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const [dashboardResult, businessResult, subscriptionResult, offerResult, redemptionResult] = await Promise.all([
        (supabase as any).rpc('platform_admin_dashboard'),
        (supabase as any).rpc('platform_admin_business_rows', { p_search: null }),
        (supabase as any).from('subscriptions').select('business_id,plan_id,status,unit_amount,currency,billing_mode,fixed_term_ends_at,offer_code_id,created_at'),
        (supabase as any).from('billing_offer_codes').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('billing_offer_redemptions').select('offer_code_id,status'),
      ]);
      for (const result of [dashboardResult, businessResult, subscriptionResult, offerResult, redemptionResult]) if (result.error) throw result.error;
      const nextDashboard = dashboardResult.data || {};
      setDashboard(nextDashboard);
      setBusinesses(businessResult.data || []);
      setSubscriptions(subscriptionResult.data || []);
      setOffers(offerResult.data || []);
      setRedemptions(redemptionResult.data || []);
      const model = nextDashboard.cost_model || {};
      setCosts({
        fixed: String(model.fixed_monthly_cost_eur ?? 0),
        email: String(model.email_unit_cost_eur ?? 0),
        sms: String(model.sms_unit_cost_eur ?? 0),
        percent: String(model.payment_fee_percent ?? 0),
        fixedFee: String(model.payment_fee_fixed_eur ?? 0),
      });
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load Velliqo control center');
    } finally { setBusy(false); }
  }, []);

  React.useEffect(() => { if (profile?.role === 'Platform Admin') void load(); }, [load, profile?.role]);

  if (loading) return <div className="p-10">Loading...</div>;
  if (profile?.role !== 'Platform Admin') return <Navigate to="/" replace />;

  const filteredBusinesses = businesses.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.business_name, row.slug, row.owner_name, row.owner_email, row.plan_id, row.subscription_status]
      .some((value) => String(value || '').toLowerCase().includes(q));
  });

  const createOffer = async () => {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) return toast.error('Use 4–32 letters, numbers, _ or - for the code.');
    setBusy(true);
    try {
      const { error } = await (supabase as any).from('billing_offer_codes').insert({
        code, description: form.description.trim() || null, plan_id: form.plan_id,
        duration_months: Number(form.duration_months), percent_off: Number(form.percent_off || 0),
        trial_days: Number(form.trial_days || 0), max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
        starts_at: form.starts_at ? new Date(`${form.starts_at}T00:00:00`).toISOString() : null,
        expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null, created_by: profile.id,
      });
      if (error) throw error;
      toast.success('Fixed-term offer created');
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

  const openSupport = (row: BusinessRow) => {
    setEditing(row);
    setSupportNote('');
    setEditForm({
      name: row.business_name || '', status: row.status || 'active', email: row.business_email || '', phone: row.business_phone || '',
      address: '', country: row.country || '', timezone: '', owner_name: row.owner_name || '', owner_phone: row.owner_phone || '', owner_email: row.owner_email || '',
    });
  };

  const saveSupport = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('platform_admin_update_business', {
        p_business_id: editing.business_id, p_name: editForm.name, p_status: editForm.status, p_email: editForm.email,
        p_phone: editForm.phone, p_address: null, p_country: editForm.country, p_timezone: null,
        p_owner_name: editForm.owner_name, p_owner_phone: editForm.owner_phone,
      });
      if (error) throw error;
      if (editForm.owner_email && editForm.owner_email.trim().toLowerCase() !== String(editing.owner_email || '').trim().toLowerCase()) {
        const { error: identityError } = await supabase.functions.invoke('platform_admin_support', {
          body: { action: 'update_owner_email', businessId: editing.business_id, email: editForm.owner_email.trim().toLowerCase() },
        });
        if (identityError) throw identityError;
      }
      if (supportNote.trim()) {
        const noteResult = await (supabase as any).from('platform_support_notes').insert({ business_id: editing.business_id, author_id: profile.id, note: supportNote.trim() });
        if (noteResult.error) throw noteResult.error;
      }
      toast.success('Business support record updated');
      setEditing(null);
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to save support changes'); }
    finally { setBusy(false); }
  };

  const saveCosts = async () => {
    const { error } = await (supabase as any).rpc('platform_admin_save_cost_settings', {
      p_fixed_monthly_cost_eur: Number(costs.fixed || 0), p_email_unit_cost_eur: Number(costs.email || 0),
      p_sms_unit_cost_eur: Number(costs.sms || 0), p_payment_fee_percent: Number(costs.percent || 0),
      p_payment_fee_fixed_eur: Number(costs.fixedFee || 0),
    });
    if (error) return toast.error(error.message);
    toast.success('Cost model updated');
    await load();
  };

  const exportBusinesses = () => downloadCsv('velliqo-businesses.csv', filteredBusinesses.map((row) => ({
    business: row.business_name, slug: row.slug, status: row.status, owner: row.owner_name, owner_email: row.owner_email,
    plan: row.plan_id, subscription_status: row.subscription_status, billing_mode: row.billing_mode,
    staff: row.staff_count, customers: row.customer_count, appointments: row.appointment_count,
    ai_requests: row.ai_requests_period, ai_tokens: row.ai_tokens_period, ai_cost_eur: row.ai_cost_period,
    emails: row.email_period, sms: row.sms_period, stripe_customer: row.stripe_customer_id, created_at: row.created_at,
  })));

  const exportSummary = () => downloadCsv('velliqo-platform-summary.csv', [
    { metric: 'Businesses', value: dashboard.businesses ?? 0 },
    { metric: 'Active businesses', value: dashboard.active_businesses ?? 0 },
    { metric: 'MRR EUR', value: dashboard.mrr_eur ?? 0 },
    { metric: 'Estimated monthly cost EUR', value: dashboard.estimated_monthly_cost_eur ?? 0 },
    { metric: 'Estimated monthly profit EUR', value: dashboard.estimated_monthly_profit_eur ?? 0 },
    { metric: 'AI requests', value: dashboard.usage?.ai_requests ?? 0 },
    { metric: 'AI tokens', value: dashboard.usage?.ai_tokens ?? 0 },
    { metric: 'Emails', value: dashboard.usage?.emails ?? 0 },
    { metric: 'SMS', value: dashboard.usage?.sms ?? 0 },
  ]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_30%),hsl(var(--muted)/0.28)] p-4 sm:p-7 lg:p-9">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <header className="overflow-hidden rounded-[28px] border bg-card shadow-sm">
          <div className="grid gap-5 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.22em] text-violet-200"><ShieldCheck className="h-4 w-4" />Velliqo control plane</div><h1 className="mt-3 text-3xl font-black sm:text-4xl">Platform Admin</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Subscriber support, billing health, product usage, operational costs and commercial performance in one operator workspace.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={exportSummary}><Download className="mr-2 h-4 w-4" />Export summary</Button><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
          </div>
        </header>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5">
            <TabsTrigger value="overview" className="rounded-xl"><Activity className="mr-2 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="businesses" className="rounded-xl"><Building2 className="mr-2 h-4 w-4" />Businesses & support</TabsTrigger>
            <TabsTrigger value="offers" className="rounded-xl"><Gift className="mr-2 h-4 w-4" />Offers</TabsTrigger>
            <TabsTrigger value="costs" className="rounded-xl"><Settings2 className="mr-2 h-4 w-4" />Cost model</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric icon={<Building2 className="h-5 w-5" />} label="Businesses" value={integer.format(dashboard.businesses || 0)} hint={`${dashboard.active_businesses || 0} active`} />
              <Metric icon={<WalletCards className="h-5 w-5" />} label="MRR" value={eur.format(dashboard.mrr_eur || 0)} hint="Recurring subscription revenue" />
              <Metric icon={<CircleDollarSign className="h-5 w-5" />} label="Estimated profit" value={eur.format(dashboard.estimated_monthly_profit_eur || 0)} hint={`${eur.format(dashboard.estimated_monthly_cost_eur || 0)} estimated costs`} />
              <Metric icon={<Bot className="h-5 w-5" />} label="AI usage" value={integer.format(dashboard.usage?.ai_requests || 0)} hint={`${integer.format(dashboard.usage?.ai_tokens || 0)} tokens`} />
              <Metric icon={<Headphones className="h-5 w-5" />} label="Delivery health" value={integer.format(dashboard.delivery_health?.delivered || 0)} hint={`${dashboard.delivery_health?.failed || 0} failed · ${dashboard.delivery_health?.stripe_webhook_errors || 0} Stripe errors`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <Card className="rounded-3xl"><CardHeader><CardTitle>Subscription portfolio</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">
                <PlanTile name="Standard" value={dashboard.subscriptions?.standard || 0} price="€29.99" />
                <PlanTile name="Pro" value={dashboard.subscriptions?.pro || 0} price="€49.99" featured />
                <PlanTile name="Premium" value={dashboard.subscriptions?.premium || 0} price="€89.99" />
                <StatusLine label="Trialing" value={dashboard.subscriptions?.trialing || 0} />
                <StatusLine label="Active" value={dashboard.subscriptions?.active || 0} />
                <StatusLine label="Past due" value={dashboard.subscriptions?.past_due || 0} />
              </CardContent></Card>
              <Card className="rounded-3xl"><CardHeader><CardTitle>Platform usage this period</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
                <Usage icon={<Users className="h-4 w-4" />} label="Active staff" value={dashboard.usage?.staff || 0} />
                <Usage icon={<CreditCard className="h-4 w-4" />} label="Appointments created" value={dashboard.usage?.appointments || 0} />
                <Usage icon={<Mail className="h-4 w-4" />} label="Emails delivered/sent" value={dashboard.usage?.emails || 0} />
                <Usage icon={<MessageSquareText className="h-4 w-4" />} label="SMS delivered/sent" value={dashboard.usage?.sms || 0} />
                <Usage icon={<Bot className="h-4 w-4" />} label="AI estimated cost" value={eur.format(dashboard.usage?.ai_estimated_cost_eur || 0)} raw />
                <Usage icon={<Users className="h-4 w-4" />} label="New customers" value={dashboard.usage?.customers || 0} />
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="businesses" className="space-y-5">
            <Card className="rounded-3xl"><CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Businesses & support</CardTitle><p className="mt-1 text-sm text-muted-foreground">Find a subscriber, inspect plan/usage and correct business or owner contact details with an audit trail.</p></div><Button variant="outline" onClick={exportBusinesses}><Download className="mr-2 h-4 w-4" />Export CSV</Button></CardHeader><CardContent>
              <div className="relative mb-5"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-xl pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, owner, email, plan…" /></div>
              <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[1080px] text-sm"><thead className="bg-muted/45 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Business</th><th>Plan</th><th>Status</th><th>Staff</th><th>Customers</th><th>Appointments</th><th>AI requests</th><th>Emails/SMS</th><th>Support</th></tr></thead><tbody className="divide-y">{filteredBusinesses.map((row) => <tr key={row.business_id} className="hover:bg-muted/20"><td className="p-3"><div className="font-bold">{row.business_name}</div><div className="text-xs text-muted-foreground">{row.owner_name || 'Owner'} · {row.owner_email || '—'}</div></td><td><Badge variant="outline">{row.plan_id || '—'}</Badge></td><td><Badge className={row.subscription_status === 'active' || row.subscription_status === 'trialing' ? '' : 'bg-amber-100 text-amber-900'}>{row.subscription_status || row.status}</Badge></td><td>{row.staff_count || 0}</td><td>{row.customer_count || 0}</td><td>{row.appointment_count || 0}</td><td>{row.ai_requests_period || 0}<div className="text-xs text-muted-foreground">{integer.format(row.ai_tokens_period || 0)} tokens</div></td><td>{row.email_period || 0} / {row.sms_period || 0}</td><td><Button size="sm" variant="outline" onClick={() => openSupport(row)}><Headphones className="mr-2 h-4 w-4" />Open</Button></td></tr>)}</tbody></table></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="offers" className="space-y-5">
            <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" />Create fixed-term offer</CardTitle><p className="text-sm leading-6 text-muted-foreground">Create controlled 1–36 month offers that stop automatically and never silently become an ongoing plan.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Offer code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PARTNER6" /></Field>
              <Field label="Plan"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value as BillingPlanId })}>{BILLING_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · €{plan.price.toFixed(2)}</option>)}</select></Field>
              <Field label="Fixed term (months)"><Input type="number" min="1" max="36" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} /></Field>
              <Field label="Discount %"><Input type="number" min="0" max="100" value={form.percent_off} onChange={(e) => setForm({ ...form, percent_off: e.target.value })} /></Field>
              <Field label="Trial days"><Input type="number" min="0" max="60" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} /></Field>
              <Field label="Max redemptions"><Input type="number" min="1" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} placeholder="Unlimited" /></Field>
              <Field label="Starts on"><Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
              <Field label="Expires on"><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></Field>
              <Field label="Internal description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Partner launch offer" /></Field>
              <div className="md:col-span-2 xl:col-span-4"><Button onClick={() => void createOffer()} disabled={busy}><BadgePercent className="mr-2 h-4 w-4" />Create non-renewing offer</Button></div>
            </CardContent></Card>
            <Card className="rounded-3xl"><CardHeader><CardTitle>Offer codes</CardTitle></CardHeader><CardContent><div className="space-y-3">{offers.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No offer codes created yet.</div> : offers.map((offer) => { const redeemed = redemptions.filter((item) => item.offer_code_id === offer.id && item.status === 'redeemed').length; return <div key={offer.id} className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black tracking-wide">{offer.code}</span><Badge variant="outline">{String(offer.plan_id).toUpperCase()}</Badge><Badge className={offer.active ? '' : 'bg-muted text-muted-foreground'}>{offer.active ? 'Active' : 'Disabled'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{offer.duration_months} months · {Number(offer.percent_off)}% off · {offer.trial_days} trial days · {redeemed} redeemed{offer.max_redemptions ? ` / ${offer.max_redemptions}` : ''}</p></div><div className="text-sm font-bold text-amber-700">No auto-renew</div><Button size="sm" variant="outline" onClick={() => void toggleOffer(offer)}>{offer.active ? 'Disable' : 'Enable'}</Button></div>; })}</div></CardContent></Card>
          </TabsContent>

          <TabsContent value="costs">
            <Card className="max-w-4xl rounded-3xl"><CardHeader><CardTitle>Estimated profitability model</CardTitle><p className="text-sm leading-6 text-muted-foreground">Enter your real provider/infrastructure costs. Velliqo combines these with recorded AI and communication usage to estimate monthly operating contribution. This is an operational estimate, not accounting profit.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Fixed infrastructure €/month"><Input type="number" min="0" step="0.01" value={costs.fixed} onChange={(e) => setCosts({ ...costs, fixed: e.target.value })} /></Field>
              <Field label="Email cost €/message"><Input type="number" min="0" step="0.000001" value={costs.email} onChange={(e) => setCosts({ ...costs, email: e.target.value })} /></Field>
              <Field label="SMS cost €/message"><Input type="number" min="0" step="0.000001" value={costs.sms} onChange={(e) => setCosts({ ...costs, sms: e.target.value })} /></Field>
              <Field label="Payment fee %"><Input type="number" min="0" step="0.001" value={costs.percent} onChange={(e) => setCosts({ ...costs, percent: e.target.value })} /></Field>
              <Field label="Payment fixed fee €"><Input type="number" min="0" step="0.0001" value={costs.fixedFee} onChange={(e) => setCosts({ ...costs, fixedFee: e.target.value })} /></Field>
              <div className="flex items-end"><Button className="w-full" onClick={() => void saveCosts()} disabled={busy}>Save cost model</Button></div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>Subscriber support · {editing?.business_name}</DialogTitle></DialogHeader>
          {editing && <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Business name"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field><Field label="Business status"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></Field><Field label="Business email"><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></Field><Field label="Business phone"><InternationalPhoneInput value={editForm.phone} onChange={(phone) => setEditForm({ ...editForm, phone })} defaultCountry={editForm.country} /></Field><Field label="Country"><Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} /></Field><Field label="Owner name"><Input value={editForm.owner_name} onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })} /></Field><Field label="Owner phone"><InternationalPhoneInput value={editForm.owner_phone} onChange={(phone) => setEditForm({ ...editForm, owner_phone: phone })} defaultCountry={editForm.country} /></Field><Field label="Owner auth email"><Input type="email" value={editForm.owner_email} onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Changing this updates the owner’s Supabase Auth identity through the protected Platform Admin function and writes an audit record.</p></Field></div>
            <div className="grid gap-3 rounded-2xl bg-muted/30 p-4 sm:grid-cols-3"><StatusLine label="Plan" value={editing.plan_id || '—'} raw /><StatusLine label="Subscription" value={editing.subscription_status || '—'} raw /><StatusLine label="Billing mode" value={editing.billing_mode || '—'} raw /><StatusLine label="Staff" value={editing.staff_count || 0} /><StatusLine label="Customers" value={editing.customer_count || 0} /><StatusLine label="Appointments" value={editing.appointment_count || 0} /><StatusLine label="AI requests" value={editing.ai_requests_period || 0} /><StatusLine label="AI cost" value={eur.format(editing.ai_cost_period || 0)} raw /><StatusLine label="Email / SMS" value={`${editing.email_period || 0} / ${editing.sms_period || 0}`} raw /></div>
            <Field label="Support note / reason for correction"><textarea className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm" value={supportNote} onChange={(e) => setSupportNote(e.target.value)} placeholder="Document what was corrected and why…" /></Field>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void saveSupport()} disabled={busy}>Save support correction</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) { return <Card className="rounded-3xl"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div><div className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{value}</div>{hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}</CardContent></Card>; }
function PlanTile({ name, value, price, featured }: { name: string; value: number; price: string; featured?: boolean }) { return <div className={`rounded-2xl border p-4 ${featured ? 'border-amber-300 bg-amber-50/70' : ''}`}><div className="text-sm font-bold">{name}</div><div className="mt-2 text-3xl font-black">{value}</div><div className="mt-1 text-xs text-muted-foreground">{price}/month</div></div>; }
function Usage({ icon, label, value, raw }: { icon: React.ReactNode; label: string; value: number | string; raw?: boolean }) { return <div className="flex items-center gap-3 rounded-2xl border p-4"><div className="rounded-xl bg-muted p-2 text-primary">{icon}</div><div><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="font-black">{raw ? value : integer.format(Number(value || 0))}</div></div></div>; }
function StatusLine({ label, value, raw }: { label: string; value: number | string; raw?: boolean }) { return <div className="rounded-xl border bg-background/80 px-3 py-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-bold">{raw ? value : typeof value === 'number' ? integer.format(value) : value}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function downloadCsv(filename: string, rows: Record<string, any>[]) { if (!rows.length) return toast.info('There is no data to export.'); const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))); const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`; const csv = [keys.map(escape).join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\r\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
