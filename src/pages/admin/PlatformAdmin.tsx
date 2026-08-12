import React from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  BadgePercent,
  Bot,
  Building2,
  CircleDollarSign,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Gift,
  Headphones,
  Mail,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
  X,
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InternationalPhoneInput } from '@/components/inputs/InternationalPhoneInput';
import { cn } from '@/lib/utils';

const SUPPORT_EMAIL = 'support@velliqo.com';
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

type OwnerCostRow = {
  business_id: string;
  business_name: string;
  owner_name?: string | null;
  owner_email?: string | null;
  plan_id?: string | null;
  subscription_status?: string | null;
  period_start: string;
  period_end: string;
  estimated_revenue_eur: number;
  ai_requests: number;
  ai_tokens: number;
  ai_cost_eur: number;
  email_count: number;
  email_cost_eur: number;
  sms_count: number;
  sms_cost_eur: number;
  payment_cost_eur: number;
  allocated_fixed_cost_eur: number;
  total_estimated_cost_eur: number;
  estimated_contribution_eur: number;
};

type SupportRequest = {
  id: string;
  business_id: string;
  owner_id: string;
  subject: string;
  priority: string;
  status: 'sent' | 'pending' | 'completed' | 'cancelled';
  admin_unread: boolean;
  owner_unread: boolean;
  last_message_at: string;
  created_at: string;
};

type SupportMessage = { id: string; request_id: string; sender_id?: string | null; sender_role: 'owner'|'admin'; body: string; created_at: string };

export default function PlatformAdmin() {
  const { profile, loading } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [dashboard, setDashboard] = React.useState<Dashboard>({});
  const [businesses, setBusinesses] = React.useState<BusinessRow[]>([]);
  const [ownerCosts, setOwnerCosts] = React.useState<OwnerCostRow[]>([]);
  const [offers, setOffers] = React.useState<any[]>([]);
  const [redemptions, setRedemptions] = React.useState<any[]>([]);
  const [requests, setRequests] = React.useState<SupportRequest[]>([]);
  const [broadcasts, setBroadcasts] = React.useState<any[]>([]);
  const [audit, setAudit] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [selectedCostId, setSelectedCostId] = React.useState<string>('');
  const [editing, setEditing] = React.useState<BusinessRow | null>(null);
  const [editForm, setEditForm] = React.useState<any>({});
  const [supportNote, setSupportNote] = React.useState('');
  const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null);
  const [requestMessages, setRequestMessages] = React.useState<SupportMessage[]>([]);
  const [adminReply, setAdminReply] = React.useState('');
  const [broadcastForm, setBroadcastForm] = React.useState({ title: '', message: '', severity: 'info' });
  const [costs, setCosts] = React.useState({ fixed: '0', email: '0', sms: '0', percent: '0', fixedFee: '0' });
  const [form, setForm] = React.useState({ code: '', description: '', plan_id: 'pro' as BillingPlanId, duration_months: '6', percent_off: '0', trial_days: '14', max_redemptions: '', starts_at: '', expires_at: '' });

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const [dashboardResult, businessResult, costsResult, offerResult, redemptionResult, requestResult, broadcastResult, auditResult] = await Promise.all([
        (supabase as any).rpc('platform_admin_dashboard'),
        (supabase as any).rpc('platform_admin_business_rows', { p_search: null }),
        (supabase as any).rpc('platform_admin_owner_cost_rows'),
        (supabase as any).from('billing_offer_codes').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('billing_offer_redemptions').select('offer_code_id,status'),
        (supabase as any).from('platform_support_requests').select('*').order('last_message_at', { ascending: false }).limit(250),
        (supabase as any).from('platform_broadcasts').select('*').order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('platform_admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(150),
      ]);
      for (const result of [dashboardResult, businessResult, costsResult, offerResult, redemptionResult, requestResult, broadcastResult, auditResult]) if (result.error) throw result.error;
      const nextDashboard = dashboardResult.data || {};
      setDashboard(nextDashboard);
      setBusinesses(businessResult.data || []);
      setOwnerCosts(costsResult.data || []);
      setSelectedCostId((current) => current || costsResult.data?.[0]?.business_id || '');
      setOffers(offerResult.data || []);
      setRedemptions(redemptionResult.data || []);
      setRequests(requestResult.data || []);
      setBroadcasts(broadcastResult.data || []);
      setAudit(auditResult.data || []);
      const model = nextDashboard.cost_model || {};
      setCosts({ fixed: String(model.fixed_monthly_cost_eur ?? 0), email: String(model.email_unit_cost_eur ?? 0), sms: String(model.sms_unit_cost_eur ?? 0), percent: String(model.payment_fee_percent ?? 0), fixedFee: String(model.payment_fee_fixed_eur ?? 0) });
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load Velliqo control center');
    } finally { setBusy(false); }
  }, []);

  React.useEffect(() => { if (profile?.role === 'Platform Admin') void load(); }, [load, profile?.role]);

  React.useEffect(() => {
    if (profile?.role !== 'Platform Admin') return;
    const channel = supabase
      .channel('platform-admin-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_support_requests' }, () => void load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_support_messages' }, (payload) => {
        const item = payload.new as SupportMessage;
        if (item.request_id === selectedRequestId) void loadRequestMessages(item.request_id);
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, profile?.role, selectedRequestId]);

  if (loading) return <div className="p-10">Loading...</div>;
  if (profile?.role !== 'Platform Admin') return <Navigate to="/" replace />;

  const filteredBusinesses = businesses.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.business_name, row.slug, row.owner_name, row.owner_email, row.plan_id, row.subscription_status].some((value) => String(value || '').toLowerCase().includes(q));
  });
  const selectedCost = ownerCosts.find((row) => row.business_id === selectedCostId) ?? null;
  const unreadRequests = requests.filter((request) => request.admin_unread).length;
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;
  const selectedRequestBusiness = selectedRequest ? businesses.find((item) => item.business_id === selectedRequest.business_id) : null;

  async function loadRequestMessages(requestId: string) {
    const { data, error } = await (supabase as any).from('platform_support_messages').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
    if (error) return toast.error(error.message);
    setRequestMessages(data || []);
    await (supabase as any).rpc('platform_admin_mark_request_read', { p_request_id: requestId });
    setRequests((current) => current.map((item) => item.id === requestId ? { ...item, admin_unread: false } : item));
  }

  const openRequest = async (requestId: string) => { setSelectedRequestId(requestId); await loadRequestMessages(requestId); };

  const sendAdminReply = async () => {
    if (!selectedRequest || !adminReply.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('support_add_message', { p_request_id: selectedRequest.id, p_message: adminReply.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAdminReply('');
    await Promise.all([loadRequestMessages(selectedRequest.id), load()]);
  };

  const setRequestStatus = async (status: SupportRequest['status']) => {
    if (!selectedRequest) return;
    const { error } = await (supabase as any).rpc('platform_admin_set_request_status', { p_request_id: selectedRequest.id, p_status: status });
    if (error) return toast.error(error.message);
    toast.success(`Request marked ${status}`);
    await load();
  };

  const createBroadcast = async () => {
    if (broadcastForm.title.trim().length < 3 || broadcastForm.message.trim().length < 3) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('platform_admin_create_broadcast', { p_title: broadcastForm.title.trim(), p_message: broadcastForm.message.trim(), p_severity: broadcastForm.severity });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBroadcastForm({ title: '', message: '', severity: 'info' });
    toast.success('Announcement sent to all Owners');
    await load();
  };

  const createOffer = async () => {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) return toast.error('Use 4–32 letters, numbers, _ or - for the code.');
    if (form.starts_at && form.expires_at && new Date(form.expires_at) <= new Date(form.starts_at)) return toast.error('Offer expiry must be after its start date.');
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
      toast.success(`Offer ${code} created for ${form.plan_id.toUpperCase()} only`);
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

  const openSupport = async (row: BusinessRow) => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('platform_admin_business_detail', { p_business_id: row.business_id });
    setBusy(false);
    if (error) return toast.error(error.message);
    const business = data?.business || {};
    const owner = data?.owner || {};
    setEditing(row);
    setSupportNote('');
    setEditForm({
      name: business.name || row.business_name || '', slug: business.slug || row.slug || '', status: business.status || row.status || 'active',
      email: business.email || row.business_email || '', phone: business.phone || row.business_phone || '', address: business.address || '', country: business.country || row.country || '',
      currency: business.currency || 'EUR', timezone: business.timezone || 'UTC', owner_name: owner.full_name || row.owner_name || '', owner_phone: owner.phone || row.owner_phone || '', owner_email: owner.email || row.owner_email || '',
    });
  };

  const saveSupport = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('platform_admin_update_business_v2', {
        p_business_id: editing.business_id, p_name: editForm.name, p_slug: editForm.slug, p_status: editForm.status, p_email: editForm.email,
        p_phone: editForm.phone, p_address: editForm.address, p_country: editForm.country, p_currency: editForm.currency, p_timezone: editForm.timezone,
        p_owner_name: editForm.owner_name, p_owner_phone: editForm.owner_phone,
      });
      if (error) throw error;
      if (editForm.owner_email && editForm.owner_email.trim().toLowerCase() !== String(editing.owner_email || '').trim().toLowerCase()) {
        const { error: identityError } = await supabase.functions.invoke('platform_admin_support', { body: { action: 'update_owner_email', businessId: editing.business_id, email: editForm.owner_email.trim().toLowerCase() } });
        if (identityError) throw identityError;
      }
      if (supportNote.trim()) {
        const noteResult = await (supabase as any).from('platform_support_notes').insert({ business_id: editing.business_id, author_id: profile.id, note: supportNote.trim() });
        if (noteResult.error) throw noteResult.error;
      }
      toast.success('Subscriber support record updated');
      setEditing(null);
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to save support changes'); }
    finally { setBusy(false); }
  };

  const saveCosts = async () => {
    const { error } = await (supabase as any).rpc('platform_admin_save_cost_settings', {
      p_fixed_monthly_cost_eur: Number(costs.fixed || 0), p_email_unit_cost_eur: Number(costs.email || 0), p_sms_unit_cost_eur: Number(costs.sms || 0),
      p_payment_fee_percent: Number(costs.percent || 0), p_payment_fee_fixed_eur: Number(costs.fixedFee || 0),
    });
    if (error) return toast.error(error.message);
    toast.success('Cost model updated');
    await load();
  };

  const exportBusinesses = () => downloadCsv('velliqo-owners.csv', filteredBusinesses.map((row) => ({ business: row.business_name, slug: row.slug, status: row.status, owner: row.owner_name, owner_email: row.owner_email, plan: row.plan_id, subscription_status: row.subscription_status, billing_mode: row.billing_mode, staff: row.staff_count, customers: row.customer_count, appointments: row.appointment_count, ai_requests: row.ai_requests_period, ai_tokens: row.ai_tokens_period, ai_cost_eur: row.ai_cost_period, emails: row.email_period, sms: row.sms_period })));
  const exportOwnerCosts = () => downloadCsv('velliqo-owner-costs.csv', ownerCosts);

  return (
    <div className="min-h-screen bg-[#f6f5fb] p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_10%_0%,rgba(139,92,246,.42),transparent_36%),linear-gradient(135deg,#090817,#17122d_55%,#311161)] p-6 text-white shadow-[0_30px_90px_rgba(17,12,38,.22)] sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.22em] text-violet-200"><ShieldCheck className="h-4 w-4" />Velliqo control plane</div><h1 className="mt-3 text-3xl font-black sm:text-4xl">Platform Admin</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Run subscriber support, requests, platform announcements, billing health, owner-level costs, usage and commercial operations without opening the database.</p></div>
            <div className="flex flex-wrap gap-2"><Button asChild variant="secondary" className="rounded-xl"><a href={`mailto:${SUPPORT_EMAIL}`}><Mail className="mr-2 h-4 w-4" />{SUPPORT_EMAIL}</a></Button><Button variant="outline" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => void load()} disabled={busy}><RefreshCw className={cn('mr-2 h-4 w-4', busy && 'animate-spin')} />Refresh</Button></div>
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-5">
          <div className="overflow-x-auto pb-1"><TabsList className="h-auto min-w-max rounded-2xl bg-white p-1.5 shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="owners">Owners</TabsTrigger>
            <TabsTrigger value="owner-costs">Owner costs</TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">Requests{unreadRequests > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">{unreadRequests}</span>}</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="costs">Cost model</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList></div>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Metric icon={<Building2 />} label="Businesses" value={integer.format(dashboard.businesses || 0)} hint={`${dashboard.active_businesses || 0} active`} />
              <Metric icon={<CircleDollarSign />} label="MRR" value={eur.format(dashboard.mrr_eur || 0)} />
              <Metric icon={<WalletCards />} label="Estimated cost" value={eur.format(dashboard.estimated_monthly_cost_eur || 0)} />
              <Metric icon={<Activity />} label="Estimated profit" value={eur.format(dashboard.estimated_monthly_profit_eur || 0)} />
              <Metric icon={<Headphones />} label="Open requests" value={integer.format(requests.filter((r) => !['completed','cancelled'].includes(r.status)).length)} hint={`${unreadRequests} new`} />
              <Metric icon={<Bot />} label="AI requests" value={integer.format(dashboard.usage?.ai_requests || 0)} hint={`${integer.format(dashboard.usage?.ai_tokens || 0)} tokens`} />
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
              <Card className="rounded-3xl"><CardHeader><CardTitle>Subscriptions & usage</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><PlanTile name="Standard" value={dashboard.subscriptions?.standard || 0} price="€29.99" /><PlanTile name="Pro" value={dashboard.subscriptions?.pro || 0} price="€49.99" featured /><PlanTile name="Premium" value={dashboard.subscriptions?.premium || 0} price="€89.99" /><Usage icon={<Mail />} label="Emails" value={dashboard.usage?.emails || 0} /><Usage icon={<MessageSquareText />} label="SMS" value={dashboard.usage?.sms || 0} /><Usage icon={<CreditCard />} label="Webhook errors" value={dashboard.delivery_health?.stripe_webhook_errors || 0} /></CardContent></Card>
              <Card className="rounded-3xl"><CardHeader><CardTitle>Operations health</CardTitle></CardHeader><CardContent className="space-y-3"><StatusLine label="Trialing" value={dashboard.subscriptions?.trialing || 0} /><StatusLine label="Active" value={dashboard.subscriptions?.active || 0} /><StatusLine label="Past due" value={dashboard.subscriptions?.past_due || 0} /><StatusLine label="Delivery failures" value={dashboard.delivery_health?.failed || 0} /></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="owners" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-xl flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Business, Owner, email, plan…" className="pl-9" /></div><Button variant="outline" onClick={exportBusinesses}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>
            <div className="grid gap-3">{filteredBusinesses.map((row) => <div key={row.business_id} className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm transition hover:border-violet-200 lg:grid-cols-[1.2fr_.8fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="truncate text-lg font-black">{row.business_name}</div><Badge variant="outline">{String(row.plan_id || '—').toUpperCase()}</Badge><Badge className={row.status === 'active' ? 'bg-emerald-600' : 'bg-slate-500'}>{row.status}</Badge></div><div className="mt-1 text-sm text-muted-foreground">{row.owner_name || '—'} · {row.owner_email || '—'}</div><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{row.staff_count || 0} staff</span><span>·</span><span>{row.customer_count || 0} customers</span><span>·</span><span>{row.appointment_count || 0} appointments</span></div></div><div className="grid grid-cols-2 gap-2"><StatusLine label="AI cost" value={eur.format(row.ai_cost_period || 0)} raw /><StatusLine label="Email / SMS" value={`${row.email_period || 0} / ${row.sms_period || 0}`} raw /></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><a href={`/app/${row.slug}`} target="_blank" rel="noreferrer"><Store className="mr-2 h-4 w-4" />Storefront</a></Button><Button size="sm" onClick={() => void openSupport(row)}><Settings2 className="mr-2 h-4 w-4" />Manage</Button></div></div>)}</div>
          </TabsContent>

          <TabsContent value="owner-costs" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-black">Cost by Owner</h2><p className="text-sm text-muted-foreground">Recorded AI cost plus your configured email, SMS, payment and allocated infrastructure costs for the current billing period.</p></div><div className="flex flex-col gap-2 sm:flex-row"><Select value={selectedCostId} onValueChange={setSelectedCostId}><SelectTrigger className="w-full sm:w-[330px]"><SelectValue placeholder="Select Owner" /></SelectTrigger><SelectContent>{ownerCosts.map((row) => <SelectItem key={row.business_id} value={row.business_id}>{row.business_name} · {row.owner_email || '—'}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={exportOwnerCosts}><Download className="mr-2 h-4 w-4" />Export all</Button></div></div>
            {selectedCost && <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><Card className="rounded-3xl"><CardHeader><CardTitle>{selectedCost.business_name}</CardTitle><p className="text-sm text-muted-foreground">{selectedCost.owner_name || 'Owner'} · {selectedCost.owner_email || '—'}</p></CardHeader><CardContent className="space-y-3"><StatusLine label="Plan" value={String(selectedCost.plan_id || '—').toUpperCase()} raw /><StatusLine label="Subscription" value={selectedCost.subscription_status || '—'} raw /><StatusLine label="Period" value={`${dateOnly(selectedCost.period_start)} → ${dateOnly(selectedCost.period_end)}`} raw /><StatusLine label="Estimated revenue" value={eur.format(Number(selectedCost.estimated_revenue_eur || 0))} raw /><StatusLine label="Estimated contribution" value={eur.format(Number(selectedCost.estimated_contribution_eur || 0))} raw /></CardContent></Card><Card className="rounded-3xl"><CardHeader><CardTitle>Attributable cost breakdown</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><CostTile label="AI provider" value={selectedCost.ai_cost_eur} hint={`${integer.format(selectedCost.ai_requests || 0)} requests · ${integer.format(selectedCost.ai_tokens || 0)} tokens`} /><CostTile label="Email" value={selectedCost.email_cost_eur} hint={`${integer.format(selectedCost.email_count || 0)} messages`} /><CostTile label="SMS" value={selectedCost.sms_cost_eur} hint={`${integer.format(selectedCost.sms_count || 0)} messages`} /><CostTile label="Payment processing" value={selectedCost.payment_cost_eur} /><CostTile label="Allocated infrastructure" value={selectedCost.allocated_fixed_cost_eur} hint="Equal share of configured platform fixed cost" /><CostTile label="Total estimated cost" value={selectedCost.total_estimated_cost_eur} featured /></CardContent></Card></div>}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="grid min-h-[620px] overflow-hidden rounded-3xl border bg-white shadow-sm lg:grid-cols-[390px_1fr]"><div className="border-b lg:border-b-0 lg:border-r"><div className="border-b p-4"><div className="flex items-center justify-between"><div><h2 className="font-black">Support Requests</h2><p className="text-xs text-muted-foreground">Urgent Owner conversations</p></div>{unreadRequests > 0 && <Badge className="bg-red-600">{unreadRequests} new</Badge>}</div></div><div className="max-h-[560px] overflow-y-auto">{requests.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No requests yet.</div> : requests.map((request) => { const business=businesses.find((b)=>b.business_id===request.business_id); return <button key={request.id} onClick={() => void openRequest(request.id)} className={cn('w-full border-b p-4 text-left transition hover:bg-muted/50', selectedRequestId===request.id && 'bg-violet-50', request.admin_unread && 'border-l-4 border-l-violet-600 bg-violet-50/60')}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-black">{business?.owner_name || 'Owner'} · {business?.business_name || 'Business'}</div><div className="mt-1 truncate text-sm">{request.subject}</div></div><RequestBadge status={request.status} /></div><div className="mt-2 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat('en-IE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(request.last_message_at))}</div></button>; })}</div></div><div className="flex min-h-0 flex-col">{!selectedRequest ? <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground"><div><Headphones className="mx-auto h-10 w-10 text-violet-400" /><div className="mt-3 font-bold">Select a request</div><div className="mt-1 text-sm">Open the conversation, reply and update its status.</div></div></div> : <><div className="border-b p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-bold text-violet-700">{selectedRequestBusiness?.owner_name} · {selectedRequestBusiness?.business_name}</div><h3 className="mt-1 text-xl font-black">{selectedRequest.subject}</h3><div className="mt-2 flex items-center gap-2"><RequestBadge status={selectedRequest.status} /><span className="text-xs text-muted-foreground">#{selectedRequest.id.slice(0,8)}</span></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void setRequestStatus('pending')}>Pending</Button><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>void setRequestStatus('completed')}>Completed</Button><Button size="sm" variant="outline" onClick={()=>void setRequestStatus('cancelled')}>Cancelled</Button></div></div></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8f7fc] p-4 sm:p-6">{requestMessages.map((message)=><div key={message.id} className={cn('flex',message.sender_role==='admin'?'justify-end':'justify-start')}><div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',message.sender_role==='admin'?'rounded-br-md bg-violet-600 text-white':'rounded-bl-md border bg-white')}><div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">{message.sender_role==='admin'?'Velliqo Admin':selectedRequestBusiness?.owner_name || 'Owner'}</div><div className="whitespace-pre-wrap">{message.body}</div><div className="mt-1 text-[10px] opacity-60">{new Intl.DateTimeFormat('en-IE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(message.created_at))}</div></div></div>)}</div><div className="border-t p-4"><div className="flex gap-2"><Textarea value={adminReply} onChange={(e)=>setAdminReply(e.target.value)} placeholder="Reply as Velliqo Support…" className="min-h-14 resize-none" /><Button size="icon" className="h-14 w-14 shrink-0" onClick={()=>void sendAdminReply()} disabled={busy || !adminReply.trim() || ['completed','cancelled'].includes(selectedRequest.status)}><Send className="h-4 w-4" /></Button></div></div></>}</div></div>
          </TabsContent>

          <TabsContent value="announcements" className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
            <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-violet-600" />Notify all Owners</CardTitle><p className="text-sm text-muted-foreground">Creates a real notification in every active Owner workspace.</p></CardHeader><CardContent className="space-y-4"><Field label="Title"><Input value={broadcastForm.title} onChange={(e)=>setBroadcastForm({...broadcastForm,title:e.target.value})} maxLength={120} placeholder="Scheduled maintenance" /></Field><Field label="Message"><Textarea value={broadcastForm.message} onChange={(e)=>setBroadcastForm({...broadcastForm,message:e.target.value})} maxLength={2000} className="min-h-36" placeholder="Write the message Owners should see…" /></Field><Field label="Importance"><Select value={broadcastForm.severity} onValueChange={(value)=>setBroadcastForm({...broadcastForm,severity:value})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Information</SelectItem><SelectItem value="important">Important</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></Field><Button className="w-full" onClick={()=>void createBroadcast()} disabled={busy || broadcastForm.title.trim().length<3 || broadcastForm.message.trim().length<3}><Send className="mr-2 h-4 w-4" />Send to all Owners</Button></CardContent></Card>
            <Card className="rounded-3xl"><CardHeader><CardTitle>Announcement history</CardTitle></CardHeader><CardContent className="space-y-3">{broadcasts.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No announcements yet.</div>:broadcasts.map((item)=><div key={item.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><div className="font-black">{item.title}</div><Badge variant="outline" className="capitalize">{item.severity}</Badge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.message}</p><div className="mt-2 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat('en-IE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</div></div>)}</CardContent></Card>
          </TabsContent>

          <TabsContent value="offers" className="space-y-5">
            <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" />Create fixed-term offer</CardTitle><p className="text-sm text-muted-foreground">Each code is locked to exactly one plan and is redeemable only inside its configured availability window. The resulting Stripe subscription receives a fixed end date. No auto-renew.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Offer code"><Input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="PARTNER6" /></Field><Field label="Plan"><Select value={form.plan_id} onValueChange={(value)=>setForm({...form,plan_id:value as BillingPlanId})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BILLING_PLANS.map((plan)=><SelectItem key={plan.id} value={plan.id}>{plan.name} · {eur.format(plan.price)}</SelectItem>)}</SelectContent></Select></Field><Field label="Access duration (months)"><Input type="number" min="1" max="36" value={form.duration_months} onChange={(e)=>setForm({...form,duration_months:e.target.value})} /></Field><Field label="Discount %"><Input type="number" min="0" max="100" value={form.percent_off} onChange={(e)=>setForm({...form,percent_off:e.target.value})} /></Field><Field label="Trial days"><Input type="number" min="0" max="60" value={form.trial_days} onChange={(e)=>setForm({...form,trial_days:e.target.value})} /></Field><Field label="Max redemptions"><Input type="number" min="1" value={form.max_redemptions} onChange={(e)=>setForm({...form,max_redemptions:e.target.value})} placeholder="Unlimited" /></Field><Field label="Available from"><Input type="date" value={form.starts_at} onChange={(e)=>setForm({...form,starts_at:e.target.value})} /></Field><Field label="Code expires on"><Input type="date" value={form.expires_at} onChange={(e)=>setForm({...form,expires_at:e.target.value})} /></Field><Field label="Internal description"><Input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} placeholder="Partner launch offer" /></Field><div className="md:col-span-2 xl:col-span-3 flex items-end"><Button className="w-full" onClick={()=>void createOffer()} disabled={busy}><BadgePercent className="mr-2 h-4 w-4" />Create plan-locked non-renewing offer</Button></div></CardContent></Card>
            <Card className="rounded-3xl"><CardHeader><CardTitle>Offer codes</CardTitle></CardHeader><CardContent><div className="space-y-3">{offers.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No offer codes created yet.</div>:offers.map((offer)=>{const redeemed=redemptions.filter((item)=>item.offer_code_id===offer.id&&item.status==='redeemed').length;const state=offerState(offer,redeemed);return <div key={offer.id} className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black tracking-wide">{offer.code}</span><Badge variant="outline">{String(offer.plan_id).toUpperCase()}</Badge><Badge className={state.className}>{state.label}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{offer.duration_months} months access · {Number(offer.percent_off)}% off · {offer.trial_days} trial days · {redeemed}{offer.max_redemptions?` / ${offer.max_redemptions}`:''} redeemed</p><p className="mt-1 text-xs text-muted-foreground">Redeem window: {offer.starts_at?dateOnly(offer.starts_at):'Immediately'} → {offer.expires_at?dateOnly(offer.expires_at):'No code expiry'}</p></div><div className="text-sm font-bold text-amber-700">No auto-renew</div><Button size="sm" variant="outline" onClick={()=>void toggleOffer(offer)}>{offer.active?'Disable':'Enable'}</Button></div>})}</div></CardContent></Card>
          </TabsContent>

          <TabsContent value="costs"><Card className="max-w-5xl rounded-3xl"><CardHeader><CardTitle>Platform cost model</CardTitle><p className="text-sm leading-6 text-muted-foreground">Enter the real unit/provider costs you pay. Owner-cost reporting then attributes AI directly and applies these unit/shared values per tenant. This remains an operational estimate rather than statutory accounting profit.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Fixed infrastructure €/month"><Input type="number" min="0" step="0.01" value={costs.fixed} onChange={(e)=>setCosts({...costs,fixed:e.target.value})} /></Field><Field label="Email cost €/message"><Input type="number" min="0" step="0.000001" value={costs.email} onChange={(e)=>setCosts({...costs,email:e.target.value})} /></Field><Field label="SMS cost €/message"><Input type="number" min="0" step="0.000001" value={costs.sms} onChange={(e)=>setCosts({...costs,sms:e.target.value})} /></Field><Field label="Payment fee %"><Input type="number" min="0" step="0.001" value={costs.percent} onChange={(e)=>setCosts({...costs,percent:e.target.value})} /></Field><Field label="Payment fixed fee €"><Input type="number" min="0" step="0.0001" value={costs.fixedFee} onChange={(e)=>setCosts({...costs,fixedFee:e.target.value})} /></Field><div className="flex items-end"><Button className="w-full" onClick={()=>void saveCosts()} disabled={busy}>Save cost model</Button></div></CardContent></Card></TabsContent>

          <TabsContent value="audit"><Card className="rounded-3xl"><CardHeader><CardTitle>Admin audit trail</CardTitle><p className="text-sm text-muted-foreground">Recent protected corrections, support status changes and platform actions.</p></CardHeader><CardContent className="space-y-2">{audit.length===0?<div className="p-8 text-center text-sm text-muted-foreground">No admin audit events yet.</div>:audit.map((item)=><div key={item.id} className="grid gap-2 rounded-2xl border p-4 sm:grid-cols-[180px_1fr_auto] sm:items-center"><div className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('en-IE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</div><div><div className="font-bold">{item.action}</div><div className="text-xs text-muted-foreground">{item.target_type || 'platform'} · {item.target_id || '—'}</div></div>{item.business_id&&<Button size="sm" variant="outline" onClick={()=>{const row=businesses.find((b)=>b.business_id===item.business_id);if(row)void openSupport(row);}}>Open Owner</Button>}</div>)}</CardContent></Card></TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open)=>!open&&setEditing(null)}>
        <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto rounded-3xl"><DialogHeader><DialogTitle>Subscriber support · {editing?.business_name}</DialogTitle></DialogHeader>{editing&&<div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Business name"><Input value={editForm.name} onChange={(e)=>setEditForm({...editForm,name:e.target.value})} /></Field><Field label="Public slug"><Input value={editForm.slug} onChange={(e)=>setEditForm({...editForm,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} /></Field><Field label="Business status"><Select value={editForm.status} onValueChange={(value)=>setEditForm({...editForm,status:value})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></Field><Field label="Business email"><Input type="email" value={editForm.email} onChange={(e)=>setEditForm({...editForm,email:e.target.value})} /></Field><Field label="Business phone"><InternationalPhoneInput value={editForm.phone} onChange={(phone)=>setEditForm({...editForm,phone})} defaultCountry={editForm.country} /></Field><Field label="Address"><Input value={editForm.address} onChange={(e)=>setEditForm({...editForm,address:e.target.value})} /></Field><Field label="Country"><Input value={editForm.country} onChange={(e)=>setEditForm({...editForm,country:e.target.value})} /></Field><Field label="Currency"><Input value={editForm.currency} maxLength={3} onChange={(e)=>setEditForm({...editForm,currency:e.target.value.toUpperCase()})} /></Field><Field label="Timezone"><Input value={editForm.timezone} onChange={(e)=>setEditForm({...editForm,timezone:e.target.value})} /></Field><Field label="Owner name"><Input value={editForm.owner_name} onChange={(e)=>setEditForm({...editForm,owner_name:e.target.value})} /></Field><Field label="Owner phone"><InternationalPhoneInput value={editForm.owner_phone} onChange={(phone)=>setEditForm({...editForm,owner_phone:phone})} defaultCountry={editForm.country} /></Field><Field label="Owner auth email"><Input type="email" value={editForm.owner_email} onChange={(e)=>setEditForm({...editForm,owner_email:e.target.value})} /><p className="mt-1 text-xs text-muted-foreground">Updates the Supabase Auth identity through the protected Admin function and writes an audit record.</p></Field></div><div className="grid gap-3 rounded-2xl bg-muted/30 p-4 sm:grid-cols-3"><StatusLine label="Plan" value={editing.plan_id||'—'} raw /><StatusLine label="Subscription" value={editing.subscription_status||'—'} raw /><StatusLine label="Billing mode" value={editing.billing_mode||'—'} raw /><StatusLine label="Staff" value={editing.staff_count||0} /><StatusLine label="Customers" value={editing.customer_count||0} /><StatusLine label="Appointments" value={editing.appointment_count||0} /><StatusLine label="AI requests" value={editing.ai_requests_period||0} /><StatusLine label="AI cost" value={eur.format(editing.ai_cost_period||0)} raw /><StatusLine label="Email / SMS" value={`${editing.email_period||0} / ${editing.sms_period||0}`} raw /></div>{editing.stripe_customer_id&&<div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><a href={`https://dashboard.stripe.com/test/customers/${editing.stripe_customer_id}`} target="_blank" rel="noreferrer"><CreditCard className="mr-2 h-4 w-4" />Stripe customer<ExternalLink className="ml-2 h-3 w-3" /></a></Button><Button variant="outline" size="sm" onClick={()=>navigator.clipboard.writeText(editing.business_id)}><Copy className="mr-2 h-4 w-4" />Copy business ID</Button></div>}<Field label="Support note / reason for correction"><Textarea className="min-h-24" value={supportNote} onChange={(e)=>setSupportNote(e.target.value)} placeholder="Document what was corrected and why…" /></Field><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={()=>void saveSupport()} disabled={busy}>Save protected correction</Button></div></div>}</DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) { return <Card className="rounded-3xl"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div><div className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{value}</div>{hint&&<div className="mt-1 text-xs text-muted-foreground">{hint}</div>}</CardContent></Card>; }
function PlanTile({ name, value, price, featured }: { name:string; value:number; price:string; featured?:boolean }) { return <div className={cn('rounded-2xl border p-4',featured&&'border-amber-300 bg-amber-50/70')}><div className="text-sm font-bold">{name}</div><div className="mt-2 text-3xl font-black">{value}</div><div className="mt-1 text-xs text-muted-foreground">{price}/month</div></div>; }
function Usage({ icon,label,value,raw }: { icon:React.ReactNode; label:string; value:number|string; raw?:boolean }) { return <div className="flex items-center gap-3 rounded-2xl border p-4"><div className="rounded-xl bg-muted p-2 text-primary">{icon}</div><div><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="font-black">{raw?value:integer.format(Number(value||0))}</div></div></div>; }
function StatusLine({ label,value,raw }: { label:string; value:number|string; raw?:boolean }) { return <div className="rounded-xl border bg-background/80 px-3 py-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-bold">{raw?value:typeof value==='number'?integer.format(value):value}</div></div>; }
function CostTile({ label,value,hint,featured }: { label:string; value:number; hint?:string; featured?:boolean }) { return <div className={cn('rounded-2xl border p-4',featured&&'border-violet-300 bg-violet-50')}><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-xl font-black">{eur.format(Number(value||0))}</div>{hint&&<div className="mt-1 text-xs text-muted-foreground">{hint}</div>}</div>; }
function Field({ label,children }: { label:string; children:React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function RequestBadge({ status }: { status: SupportRequest['status'] }) { const classes={sent:'border-blue-200 bg-blue-50 text-blue-700',pending:'border-amber-200 bg-amber-50 text-amber-800',completed:'border-emerald-200 bg-emerald-50 text-emerald-700',cancelled:'border-slate-200 bg-slate-100 text-slate-600'};return <Badge variant="outline" className={cn('capitalize',classes[status])}>{status}</Badge>; }
function offerState(offer:any,redeemed:number){const now=Date.now();if(!offer.active)return{label:'Disabled',className:'bg-slate-500'};if(offer.starts_at&&new Date(offer.starts_at).getTime()>now)return{label:'Upcoming',className:'bg-blue-600'};if(offer.expires_at&&new Date(offer.expires_at).getTime()<=now)return{label:'Expired',className:'bg-slate-500'};if(offer.max_redemptions&&redeemed>=offer.max_redemptions)return{label:'Exhausted',className:'bg-slate-500'};return{label:'Active',className:'bg-emerald-600'};}
function dateOnly(value:string){return new Intl.DateTimeFormat('en-IE',{dateStyle:'medium'}).format(new Date(value));}
function downloadCsv(filename:string,rows:Record<string,any>[]){if(!rows.length)return toast.info('There is no data to export.');const keys=Array.from(new Set(rows.flatMap((row)=>Object.keys(row))));const escape=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`;const csv=[keys.map(escape).join(','),...rows.map((row)=>keys.map((key)=>escape(row[key])).join(','))].join('\r\n');const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url);}
