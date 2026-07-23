import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  Globe2,
  Mail,
  Megaphone,
  MessageSquareText,
  PauseCircle,
  Plus,
  RefreshCcw,
  Send,
  Smartphone,
  Sparkles,
  Star,
  Target,
  Users,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';

type MarketingTab = 'overview' | 'campaigns' | 'automations' | 'reviews';
type CampaignStatus = 'draft' | 'scheduled' | 'paused' | 'completed' | 'cancelled';
type CampaignSegment = 'all' | 'active' | 'at_risk' | 'vip' | 'new' | 'registered' | 'guests';
type CampaignChannel = 'email' | 'sms' | 'in_app';
type CampaignObjective = 'announcement' | 'promotion' | 'win_back' | 'birthday' | 'review_request' | 'last_minute' | 'custom';

type CustomerInsight = {
  id: string;
  user_id: string | null;
  created_at: string;
  visits: number;
  completedVisits: number;
  noShows: number;
  revenue: number;
  lastVisit: Date | null;
  marketingConsent: boolean;
  emailAllowed: boolean;
  smsAllowed: boolean;
};

const EMPTY_CAMPAIGN = {
  name: '',
  channel: 'email' as CampaignChannel,
  objective: 'promotion' as CampaignObjective,
  audience_segment: 'all' as CampaignSegment,
  subject: '',
  message: '',
  schedule_enabled: false,
  scheduled_at: '',
};

const AUTOMATION_DEFINITIONS = [
  { key: 'birthday', icon: Sparkles, delayHours: 9 * 24 },
  { key: 'win_back', icon: RefreshCcw, delayHours: 60 * 24 },
  { key: 'review_request', icon: Star, delayHours: 24 },
  { key: 'no_show_recovery', icon: CalendarClock, delayHours: 4 },
  { key: 'last_minute_availability', icon: Clock3, delayHours: 2 },
] as const;

export default function Marketing() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const { activeBusiness, user } = useAuth();
  const businessId = activeBusiness?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<MarketingTab>('overview');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsight[]>([]);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [reviewResponse, setReviewResponse] = useState('');

  useEffect(() => {
    if (businessId) void loadMarketingWorkspace();
  }, [businessId]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      openCreateCampaign();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const loadMarketingWorkspace = async () => {
    if (!businessId) return;
    setLoading(true);

    try {
      const [campaignResult, automationResult, reviewResult, postResult, customerResult, profileResult, appointmentResult] = await Promise.all([
        supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('marketing_automations')
          .select('*')
          .eq('business_id', businessId)
          .order('automation_key'),
        supabase
          .from('business_reviews')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('business_posts')
          .select('id, is_published, published_at, created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('id, user_id, created_at')
          .eq('business_id', businessId),
        supabase
          .from('customer_business_profiles')
          .select('customer_id, marketing_consent, email_notifications_enabled, sms_notifications_enabled')
          .eq('business_id', businessId),
        supabase
          .from('appointments')
          .select('customer_id, status, total_price, start_time')
          .eq('business_id', businessId),
      ]);

      if (campaignResult.error) throw campaignResult.error;
      if (automationResult.error) throw automationResult.error;
      if (reviewResult.error) throw reviewResult.error;
      if (postResult.error) throw postResult.error;
      if (customerResult.error) throw customerResult.error;
      if (profileResult.error) throw profileResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      setCampaigns(campaignResult.data ?? []);
      setAutomations(automationResult.data ?? []);
      setReviews(reviewResult.data ?? []);
      setPosts(postResult.data ?? []);

      const appointments = appointmentResult.data ?? [];
      const profilesByCustomer = new Map(
        (profileResult.data ?? [])
          .filter((profile: any) => profile.customer_id)
          .map((profile: any) => [profile.customer_id, profile])
      );
      const insights = (customerResult.data ?? []).map((customer: any) => {
        const customerAppointments = appointments.filter((appointment: any) => appointment.customer_id === customer.id);
        const completed = customerAppointments.filter((appointment: any) => appointment.status === 'completed');
        const noShows = customerAppointments.filter((appointment: any) => appointment.status === 'no_show');
        const lastVisitValue = completed
          .map((appointment: any) => new Date(appointment.start_time))
          .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;

        const profile = profilesByCustomer.get(customer.id) as any;
        return {
          id: customer.id,
          user_id: customer.user_id,
          created_at: customer.created_at,
          visits: customerAppointments.length,
          completedVisits: completed.length,
          noShows: noShows.length,
          revenue: completed.reduce((sum: number, appointment: any) => sum + Number(appointment.total_price ?? 0), 0),
          lastVisit: lastVisitValue,
          marketingConsent: profile?.marketing_consent === true,
          emailAllowed: profile?.email_notifications_enabled !== false,
          smsAllowed: profile?.sms_notifications_enabled !== false,
        };
      });

      setCustomerInsights(insights);
    } catch (error: any) {
      console.error('Marketing workspace load error:', error);
      toast.error(error.message || t('marketing.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const audienceCounts = useMemo(() => {
    const now = Date.now();
    const daysAgo = (date: Date | null) => date ? Math.floor((now - date.getTime()) / 86_400_000) : Number.POSITIVE_INFINITY;

    return {
      all: customerInsights.length,
      active: customerInsights.filter((customer) => daysAgo(customer.lastVisit) <= 60).length,
      at_risk: customerInsights.filter((customer) => {
        const days = daysAgo(customer.lastVisit);
        return days > 60 && days <= 180;
      }).length,
      vip: customerInsights.filter((customer) => customer.revenue >= 500 || customer.completedVisits >= 5).length,
      new: customerInsights.filter((customer) => now - new Date(customer.created_at).getTime() <= 30 * 86_400_000).length,
      registered: customerInsights.filter((customer) => Boolean(customer.user_id)).length,
      guests: customerInsights.filter((customer) => !customer.user_id).length,
    } satisfies Record<CampaignSegment, number>;
  }, [customerInsights]);

  const reachableAudienceCounts = useMemo(() => {
    const reachable = customerInsights.filter((customer) => {
      // In-app campaigns can only reach customers with a Velliqo account.
      // Email/SMS marketing consent is not relevant to the in-app channel.
      if (campaignForm.channel === 'in_app') {
        return Boolean(customer.user_id);
      }

      // External promotional communication requires explicit consent.
      if (!customer.marketingConsent) {
        return false;
      }

      if (campaignForm.channel === 'email') {
        return customer.emailAllowed;
      }

      if (campaignForm.channel === 'sms') {
        return customer.smsAllowed;
      }

      return false;
    });
    const reachableIds = new Set(reachable.map((customer) => customer.id));
    const now = Date.now();
    const daysAgo = (date: Date | null) => date ? Math.floor((now - date.getTime()) / 86_400_000) : Number.POSITIVE_INFINITY;
    const inReach = (predicate: (customer: CustomerInsight) => boolean) =>
      customerInsights.filter((customer) => reachableIds.has(customer.id) && predicate(customer)).length;

    return {
      all: reachable.length,
      active: inReach((customer) => daysAgo(customer.lastVisit) <= 60),
      at_risk: inReach((customer) => {
        const days = daysAgo(customer.lastVisit);
        return days > 60 && days <= 180;
      }),
      vip: inReach((customer) => customer.revenue >= 500 || customer.completedVisits >= 5),
      new: inReach((customer) => now - new Date(customer.created_at).getTime() <= 30 * 86_400_000),
      registered: inReach((customer) => Boolean(customer.user_id)),
      guests: inReach((customer) => !customer.user_id),
    } satisfies Record<CampaignSegment, number>;
  }, [campaignForm.channel, customerInsights]);

  const reachableCustomers = customerInsights.filter(
    (customer) => customer.marketingConsent && (customer.emailAllowed || customer.smsAllowed || Boolean(customer.user_id))
  ).length;

  const publishedPosts = posts.filter((post) => post.is_published).length;
  const pendingReviews = reviews.filter((review) => review.status === 'pending').length;
  const publishedReviews = reviews.filter((review) => review.status === 'published');
  const averageRating = publishedReviews.length
    ? publishedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / publishedReviews.length
    : 0;
  const activeAutomations = automations.filter((automation) => automation.is_enabled).length;
  const scheduledCampaigns = campaigns.filter((campaign) => campaign.status === 'scheduled').length;
  const attributedRevenue = campaigns.reduce((sum, campaign) => sum + Number(campaign.attributed_revenue ?? 0), 0);

  const currency = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: activeBusiness?.currency || 'EUR' }),
    [locale, activeBusiness?.currency]
  );

  const openCreateCampaign = () => {
    setEditingCampaignId(null);
    setCampaignForm(EMPTY_CAMPAIGN);
    setCampaignDialogOpen(true);
  };

  const openEditCampaign = (campaign: any) => {
    setEditingCampaignId(campaign.id);
    setCampaignForm({
      name: campaign.name ?? '',
      channel: campaign.channel ?? 'email',
      objective: campaign.objective ?? 'custom',
      audience_segment: campaign.audience_segment ?? 'all',
      subject: campaign.subject ?? '',
      message: campaign.message ?? '',
      schedule_enabled: campaign.status === 'scheduled',
      scheduled_at: campaign.scheduled_at ? String(campaign.scheduled_at).slice(0, 16) : '',
    });
    setCampaignDialogOpen(true);
  };

  const saveCampaign = async () => {
    if (!businessId || !campaignForm.name.trim() || !campaignForm.message.trim()) {
      toast.error(t('marketing.validation.campaignRequired'));
      return;
    }

    if (campaignForm.channel === 'email' && !campaignForm.subject.trim()) {
      toast.error(t('marketing.validation.subjectRequired'));
      return;
    }

    if (campaignForm.schedule_enabled && !campaignForm.scheduled_at) {
      toast.error(t('marketing.validation.scheduleRequired'));
      return;
    }

    setCampaignSaving(true);

    try {
      const payload = {
        business_id: businessId,
        name: campaignForm.name.trim(),
        channel: campaignForm.channel,
        objective: campaignForm.objective,
        audience_segment: campaignForm.audience_segment,
        subject: campaignForm.subject.trim() || null,
        message: campaignForm.message.trim(),
        status: campaignForm.schedule_enabled ? 'scheduled' : 'draft',
        scheduled_at: campaignForm.schedule_enabled ? new Date(campaignForm.scheduled_at).toISOString() : null,
        estimated_recipients: reachableAudienceCounts[campaignForm.audience_segment],
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      const result = editingCampaignId
        ? await supabase
            .from('marketing_campaigns')
            .update(payload)
            .eq('id', editingCampaignId)
            .eq('business_id', businessId)
        : await supabase.from('marketing_campaigns').insert(payload);

      if (result.error) throw result.error;
      toast.success(editingCampaignId ? t('marketing.messages.campaignUpdated') : t('marketing.messages.campaignCreated'));
      setCampaignDialogOpen(false);
      await loadMarketingWorkspace();
    } catch (error: any) {
      toast.error(error.message || t('marketing.messages.campaignSaveFailed'));
    } finally {
      setCampaignSaving(false);
    }
  };

  const updateCampaignStatus = async (campaign: any, status: CampaignStatus) => {
    if (!businessId) return;
    const { error } = await supabase
      .from('marketing_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('business_id', businessId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t('marketing.messages.statusUpdated'));
    await loadMarketingWorkspace();
  };

  const toggleAutomation = async (definition: (typeof AUTOMATION_DEFINITIONS)[number], enabled: boolean) => {
    if (!businessId) return;
    const existing = automations.find((automation) => automation.automation_key === definition.key);
    const payload = {
      business_id: businessId,
      automation_key: definition.key,
      channel: existing?.channel ?? 'email',
      is_enabled: enabled,
      delay_hours: existing?.delay_hours ?? definition.delayHours,
      message_template: existing?.message_template || t(`marketing.automations.${definition.key}.template`),
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('marketing_automations')
      .upsert(payload, { onConflict: 'business_id,automation_key' });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(enabled ? t('marketing.messages.automationEnabled') : t('marketing.messages.automationDisabled'));
    await loadMarketingWorkspace();
  };

  const openReview = (review: any) => {
    setSelectedReview(review);
    setReviewResponse(review.owner_response ?? '');
    setReviewDialogOpen(true);
  };

  const moderateReview = async (status: 'pending' | 'published' | 'hidden') => {
    if (!selectedReview) return;
    setReviewSaving(true);

    try {
      const { error } = await supabase.rpc('owner_moderate_business_review', {
        p_review_id: selectedReview.id,
        p_status: status,
        p_owner_response: reviewResponse.trim() || null,
      });
      if (error) throw error;

      toast.success(t('marketing.messages.reviewUpdated'));
      setReviewDialogOpen(false);
      await loadMarketingWorkspace();
    } catch (error: any) {
      toast.error(error.message || t('marketing.messages.reviewUpdateFailed'));
    } finally {
      setReviewSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">{t('marketing.status.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page pb-12">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('marketing.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('marketing.title')}</h1>
          <p className="app-page-description">{t('marketing.description')}</p>
        </div>
        <Button onClick={openCreateCampaign}>
          <Plus className="mr-2 h-4 w-4" />
          {t('marketing.actions.newCampaign')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5" />} label={t('marketing.metrics.reachableCustomers')} value={reachableCustomers} />
        <MetricCard icon={<WandSparkles className="h-5 w-5" />} label={t('marketing.metrics.activeAutomations')} value={activeAutomations} />
        <MetricCard icon={<Star className="h-5 w-5" />} label={t('marketing.metrics.averageRating')} value={averageRating ? averageRating.toFixed(1) : '—'} detail={t('marketing.metrics.publishedReviews', { count: publishedReviews.length })} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label={t('marketing.metrics.attributedRevenue')} value={currency.format(attributedRevenue)} />
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MarketingTab)} className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1 lg:grid-cols-4">
          <TabsTrigger value="overview" className="rounded-xl py-2.5">{t('marketing.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-xl py-2.5">{t('marketing.tabs.campaigns')}</TabsTrigger>
          <TabsTrigger value="automations" className="rounded-xl py-2.5">{t('marketing.tabs.automations')}</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-xl py-2.5">
            {t('marketing.tabs.reviews')}
            {pendingReviews > 0 && <Badge className="ml-2 h-5 min-w-5 justify-center px-1.5">{pendingReviews}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-3xl shadow-card">
              <CardContent className="p-6">
                <SectionHeading icon={<Target className="h-5 w-5" />} title={t('marketing.audience.title')} description={t('marketing.audience.description')} />
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.keys(audienceCounts) as CampaignSegment[]).map((segment) => (
                    <div key={segment} className="rounded-2xl border bg-muted/20 p-4">
                      <div className="text-2xl font-extrabold">{audienceCounts[segment]}</div>
                      <div className="mt-1 text-sm font-semibold">{t(`marketing.segments.${segment}`)}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(`marketing.segmentDescriptions.${segment}`)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl bg-slate-950 text-white shadow-card">
              <CardContent className="p-6">
                <SectionHeading light icon={<Sparkles className="h-5 w-5" />} title={t('marketing.commandCenter.title')} description={t('marketing.commandCenter.description')} />
                <div className="mt-6 space-y-3">
                  <InsightLine icon={<CalendarClock className="h-4 w-4" />} text={t('marketing.commandCenter.scheduled', { count: scheduledCampaigns })} />
                  <InsightLine icon={<Megaphone className="h-4 w-4" />} text={t('marketing.commandCenter.publishedPosts', { count: publishedPosts })} />
                  <InsightLine icon={<Star className="h-4 w-4" />} text={t('marketing.commandCenter.pendingReviews', { count: pendingReviews })} />
                  <InsightLine icon={<RefreshCcw className="h-4 w-4" />} text={t('marketing.commandCenter.atRisk', { count: audienceCounts.at_risk })} />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setActiveTab('campaigns')}>{t('marketing.actions.openCampaigns')}</Button>
                  <Button variant="secondary" onClick={() => setActiveTab('reviews')}>{t('marketing.actions.manageReviews')}</Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-6">
              <SectionHeading icon={<Globe2 className="h-5 w-5" />} title={t('marketing.onlinePresence.title')} description={t('marketing.onlinePresence.description')} />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <WorkspaceLink icon={<Megaphone className="h-5 w-5" />} title={t('marketing.onlinePresence.posts')} description={t('marketing.onlinePresence.postsDescription')} href="/dashboard/posts" />
                <WorkspaceLink icon={<Eye className="h-5 w-5" />} title={t('marketing.onlinePresence.storefront')} description={t('marketing.onlinePresence.storefrontDescription')} href="/dashboard/storefront" />
                <WorkspaceLink icon={<Star className="h-5 w-5" />} title={t('marketing.onlinePresence.reputation')} description={t('marketing.onlinePresence.reputationDescription')} onClick={() => setActiveTab('reviews')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeading icon={<Send className="h-5 w-5" />} title={t('marketing.campaigns.title')} description={t('marketing.campaigns.description')} />
                <Button onClick={openCreateCampaign}><Plus className="mr-2 h-4 w-4" />{t('marketing.actions.newCampaign')}</Button>
              </div>
              {campaigns.length === 0 ? (
                <div className="p-12 text-center">
                  <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-bold">{t('marketing.campaigns.emptyTitle')}</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t('marketing.campaigns.emptyDescription')}</p>
                  <Button className="mt-5" onClick={openCreateCampaign}>{t('marketing.actions.createFirstCampaign')}</Button>
                </div>
              ) : (
                <div className="divide-y">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_170px_150px_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{campaign.name}</h3>
                          <CampaignStatusBadge status={campaign.status} t={t} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.message}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{t(`marketing.channels.${campaign.channel}`)}</span>
                          <span>•</span>
                          <span>{t(`marketing.segments.${campaign.audience_segment}`)}</span>
                          <span>•</span>
                          <span>{t('marketing.campaigns.recipients', { count: campaign.estimated_recipients })}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('marketing.campaigns.schedule')}</div>
                        <div className="mt-1 text-sm font-semibold">
                          {campaign.scheduled_at ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(campaign.scheduled_at)) : t('marketing.campaigns.notScheduled')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('marketing.campaigns.performance')}</div>
                        <div className="mt-1 text-sm font-semibold">{campaign.converted_count} {t('marketing.campaigns.conversions')}</div>
                        <div className="text-xs text-muted-foreground">{currency.format(Number(campaign.attributed_revenue ?? 0))}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditCampaign(campaign)}>{t('common.edit')}</Button>
                        {campaign.status === 'scheduled' ? (
                          <Button size="sm" variant="outline" onClick={() => void updateCampaignStatus(campaign, 'paused')}><PauseCircle className="mr-1.5 h-4 w-4" />{t('marketing.actions.pause')}</Button>
                        ) : campaign.status === 'paused' ? (
                          <Button size="sm" variant="outline" onClick={() => void updateCampaignStatus(campaign, 'scheduled')}><CalendarClock className="mr-1.5 h-4 w-4" />{t('marketing.actions.resume')}</Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automations" className="mt-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {AUTOMATION_DEFINITIONS.map((definition) => {
              const automation = automations.find((item) => item.automation_key === definition.key);
              const enabled = Boolean(automation?.is_enabled);
              const Icon = definition.icon;
              return (
                <Card key={definition.key} className="rounded-3xl shadow-card">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                        <div>
                          <h3 className="font-bold">{t(`marketing.automations.${definition.key}.title`)}</h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(`marketing.automations.${definition.key}.description`)}</p>
                        </div>
                      </div>
                      <Switch checked={enabled} onCheckedChange={(checked) => void toggleAutomation(definition, checked)} />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/35 p-3 text-xs text-muted-foreground">
                      <Badge variant="outline">{t(`marketing.channels.${automation?.channel ?? 'email'}`)}</Badge>
                      <span>{t('marketing.automations.delay', { hours: automation?.delay_hours ?? definition.delayHours })}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card className="mt-4 rounded-3xl border-amber-200 bg-amber-50/70 shadow-none dark:border-amber-900/40 dark:bg-amber-950/20">
            <CardContent className="flex gap-3 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm leading-6 text-amber-950 dark:text-amber-100">{t('marketing.automations.providerNotice')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-0">
              <div className="border-b p-5">
                <SectionHeading icon={<Star className="h-5 w-5" />} title={t('marketing.reviews.title')} description={t('marketing.reviews.description')} />
              </div>
              {reviews.length === 0 ? (
                <div className="p-12 text-center">
                  <Star className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-bold">{t('marketing.reviews.emptyTitle')}</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t('marketing.reviews.emptyDescription')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {reviews.map((review) => (
                    <button key={review.id} type="button" className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-muted/25 sm:flex-row sm:items-center" onClick={() => openReview(review)}>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-bold">{review.customer_display_name || t('marketing.reviews.customer')}</div>
                          <ReviewStatusBadge status={review.status} t={t} />
                        </div>
                        <div className="mt-2 flex gap-0.5 text-amber-500">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < review.rating ? 'fill-current' : 'text-muted'}`} />)}</div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{review.comment || review.title || t('marketing.reviews.noComment')}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(review.created_at))}</div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>{editingCampaignId ? t('marketing.dialog.editCampaign') : t('marketing.dialog.newCampaign')}</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-4 sm:grid-cols-2">
            <Field label={t('marketing.fields.campaignName')} className="sm:col-span-2"><Input value={campaignForm.name} onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label={t('marketing.fields.channel')}>
              <Select value={campaignForm.channel} onValueChange={(value) => setCampaignForm((current) => ({ ...current, channel: value as CampaignChannel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="h-4 w-4" />{t('marketing.channels.email')}</span></SelectItem>
                  <SelectItem value="sms"><span className="flex items-center gap-2"><Smartphone className="h-4 w-4" />{t('marketing.channels.sms')}</span></SelectItem>
                  <SelectItem value="in_app"><span className="flex items-center gap-2"><MessageSquareText className="h-4 w-4" />{t('marketing.channels.in_app')}</span></SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('marketing.fields.objective')}>
              <Select value={campaignForm.objective} onValueChange={(value) => setCampaignForm((current) => ({ ...current, objective: value as CampaignObjective }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {(['announcement', 'promotion', 'win_back', 'birthday', 'review_request', 'last_minute', 'custom'] as CampaignObjective[]).map((objective) => <SelectItem key={objective} value={objective}>{t(`marketing.objectives.${objective}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('marketing.fields.audience')} className="sm:col-span-2">
              <Select value={campaignForm.audience_segment} onValueChange={(value) => setCampaignForm((current) => ({ ...current, audience_segment: value as CampaignSegment }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {(Object.keys(audienceCounts) as CampaignSegment[]).map((segment) => <SelectItem key={segment} value={segment}>
                    {t(`marketing.segments.${segment}`)}
                    {' '}
                    ({reachableAudienceCounts[segment]} / {audienceCounts[segment]})
                  </SelectItem>)}
              </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">{t('marketing.fields.consentHint')}</p>
            </Field>
            {campaignForm.channel === 'email' && <Field label={t('marketing.fields.subject')} className="sm:col-span-2"><Input value={campaignForm.subject} onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))} /></Field>}
            <Field label={t('marketing.fields.message')} className="sm:col-span-2"><Textarea rows={7} value={campaignForm.message} onChange={(event) => setCampaignForm((current) => ({ ...current, message: event.target.value }))} /></Field>
            <div className="sm:col-span-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div><Label>{t('marketing.fields.scheduleCampaign')}</Label><p className="mt-1 text-xs text-muted-foreground">{t('marketing.fields.scheduleHint')}</p></div>
                <Switch checked={campaignForm.schedule_enabled} onCheckedChange={(checked) => setCampaignForm((current) => ({ ...current, schedule_enabled: checked }))} />
              </div>
              {campaignForm.schedule_enabled && <Input className="mt-4" type="datetime-local" value={campaignForm.scheduled_at} onChange={(event) => setCampaignForm((current) => ({ ...current, scheduled_at: event.target.value }))} />}
            </div>
          </div>
          <DialogFooter><Button variant="outline" disabled={campaignSaving} onClick={() => setCampaignDialogOpen(false)}>{t('common.cancel')}</Button><Button disabled={campaignSaving} onClick={() => void saveCampaign()}>{campaignSaving ? t('common.saving') : t('marketing.actions.saveCampaign')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader><DialogTitle>{t('marketing.reviews.manageTitle')}</DialogTitle></DialogHeader>
          {selectedReview && (
            <div className="space-y-5 py-3">
              <div className="rounded-2xl bg-muted/35 p-4">
                <div className="font-bold">{selectedReview.customer_display_name || t('marketing.reviews.customer')}</div>
                <div className="mt-2 flex gap-0.5 text-amber-500">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < selectedReview.rating ? 'fill-current' : 'text-muted'}`} />)}</div>
                {selectedReview.title && <div className="mt-3 font-semibold">{selectedReview.title}</div>}
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedReview.comment || t('marketing.reviews.noComment')}</p>
              </div>
              <Field label={t('marketing.reviews.ownerResponse')}><Textarea rows={5} value={reviewResponse} onChange={(event) => setReviewResponse(event.target.value)} placeholder={t('marketing.reviews.responsePlaceholder')} /></Field>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" disabled={reviewSaving} onClick={() => void moderateReview('hidden')}>{t('marketing.reviews.hide')}</Button>
            <Button variant="outline" disabled={reviewSaving} onClick={() => void moderateReview('pending')}>{t('marketing.reviews.keepPending')}</Button>
            <Button disabled={reviewSaving} onClick={() => void moderateReview('published')}>{t('marketing.reviews.publish')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail?: string }) {
  return <Card className="rounded-3xl shadow-card"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div></div><div className="mt-4 text-2xl font-extrabold">{value}</div><div className="mt-1 text-sm font-semibold">{label}</div>{detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</CardContent></Card>;
}

function SectionHeading({ icon, title, description, light = false }: { icon: React.ReactNode; title: string; description: string; light?: boolean }) {
  return <div className="flex gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${light ? 'bg-white/10 text-white' : 'bg-primary/10 text-primary'}`}>{icon}</div><div><h2 className="font-extrabold">{title}</h2><p className={`mt-1 text-sm leading-6 ${light ? 'text-white/60' : 'text-muted-foreground'}`}>{description}</p></div></div>;
}

function InsightLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-sm"><span className="text-primary">{icon}</span><span>{text}</span></div>;
}

function WorkspaceLink({ icon, title, description, href, onClick }: { icon: React.ReactNode; title: string; description: string; href?: string; onClick?: () => void }) {
  const content = <><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></>;
  return href ? <Link to={href} className="rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">{content}</Link> : <button type="button" onClick={onClick} className="rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">{content}</button>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>;
}

function CampaignStatusBadge({ status, t }: { status: CampaignStatus; t: any }) {
  const variant = status === 'completed' ? 'default' : status === 'scheduled' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{t(`marketing.statuses.${status}`)}</Badge>;
}

function ReviewStatusBadge({ status, t }: { status: string; t: any }) {
  return <Badge variant={status === 'published' ? 'default' : status === 'hidden' ? 'outline' : 'secondary'}>{t(`marketing.reviewStatuses.${status}`)}</Badge>;
}
