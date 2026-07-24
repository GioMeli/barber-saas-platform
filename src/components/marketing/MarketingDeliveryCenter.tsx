import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquareText,
  RefreshCcw,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  TestTube2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';

type DeliveryMode = 'disabled' | 'test' | 'live';

type DeliverySettings = {
  business_id: string;
  delivery_mode: DeliveryMode;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  daily_email_limit: number;
  daily_sms_limit: number;
  from_name: string;
  reply_to_email: string;
};

const DEFAULT_SETTINGS: Omit<DeliverySettings, 'business_id'> = {
  delivery_mode: 'disabled',
  email_enabled: false,
  sms_enabled: false,
  in_app_enabled: true,
  daily_email_limit: 500,
  daily_sms_limit: 100,
  from_name: '',
  reply_to_email: '',
};

export function MarketingDeliveryCenter() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const { activeBusiness } = useAuth();
  const businessId = activeBusiness?.id;

  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId) void loadDeliveryCenter();
  }, [businessId]);

  const loadDeliveryCenter = async () => {
    if (!businessId) return;
    setLoading(true);

    try {
      const [settingsResult, runsResult, deliveriesResult] = await Promise.all([
        supabase
          .from('marketing_delivery_settings')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('marketing_delivery_runs')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('marketing_deliveries')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (runsResult.error) throw runsResult.error;
      if (deliveriesResult.error) throw deliveriesResult.error;

      setSettings({
        business_id: businessId,
        ...DEFAULT_SETTINGS,
        ...(settingsResult.data || {}),
        from_name: settingsResult.data?.from_name || '',
        reply_to_email: settingsResult.data?.reply_to_email || '',
      });
      setRuns(runsResult.data || []);
      setDeliveries(deliveriesResult.data || []);
    } catch (error: any) {
      toast.error(error.message || t('marketingDelivery.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings || !businessId) return;
    if (settings.delivery_mode === 'live' && !window.confirm(t('marketingDelivery.messages.confirmLive'))) {
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase
        .from('marketing_delivery_settings')
        .upsert({
          business_id: businessId,
          delivery_mode: settings.delivery_mode,
          email_enabled: settings.email_enabled,
          sms_enabled: settings.sms_enabled,
          in_app_enabled: settings.in_app_enabled,
          daily_email_limit: Number(settings.daily_email_limit) || 0,
          daily_sms_limit: Number(settings.daily_sms_limit) || 0,
          from_name: settings.from_name.trim() || null,
          reply_to_email: settings.reply_to_email.trim().toLowerCase() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id' });

      if (error) throw error;
      toast.success(t('marketingDelivery.messages.settingsSaved'));
      await loadDeliveryCenter();
    } catch (error: any) {
      toast.error(error.message || t('marketingDelivery.messages.settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    const terminal = deliveries.filter((item) => ['sent', 'delivered', 'simulated'].includes(item.status));
    return {
      queued: deliveries.filter((item) => ['queued', 'processing'].includes(item.status)).length,
      successful: terminal.length,
      delivered: deliveries.filter((item) => item.status === 'delivered').length,
      failed: deliveries.filter((item) => ['failed', 'bounced', 'complained', 'undelivered'].includes(item.status)).length,
    };
  }, [deliveries]);

  if (loading || !settings) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeliveryMetric icon={<Clock3 className="h-5 w-5" />} label={t('marketingDelivery.metrics.queued')} value={totals.queued} />
        <DeliveryMetric icon={<Send className="h-5 w-5" />} label={t('marketingDelivery.metrics.successful')} value={totals.successful} />
        <DeliveryMetric icon={<CheckCircle2 className="h-5 w-5" />} label={t('marketingDelivery.metrics.delivered')} value={totals.delivered} />
        <DeliveryMetric icon={<XCircle className="h-5 w-5" />} label={t('marketingDelivery.metrics.failed')} value={totals.failed} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="rounded-3xl shadow-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <Settings2 className="h-5 w-5 text-primary" />
                  {t('marketingDelivery.settings.title')}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('marketingDelivery.settings.description')}
                </p>
              </div>
              <ModeBadge mode={settings.delivery_mode} t={t} />
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label>{t('marketingDelivery.settings.mode')}</Label>
                <Select
                  value={settings.delivery_mode}
                  onValueChange={(value) => setSettings((current) => current ? { ...current, delivery_mode: value as DeliveryMode } : current)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">{t('marketingDelivery.modes.disabled')}</SelectItem>
                    <SelectItem value="test">{t('marketingDelivery.modes.test')}</SelectItem>
                    <SelectItem value="live">{t('marketingDelivery.modes.live')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.delivery_mode === 'live' && (
                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm leading-6">{t('marketingDelivery.settings.liveWarning')}</p>
                </div>
              )}

              <ChannelToggle
                icon={<Mail className="h-5 w-5" />}
                title={t('marketingDelivery.channels.email')}
                description={t('marketingDelivery.channels.emailDescription')}
                checked={settings.email_enabled}
                onChange={(checked) => setSettings((current) => current ? { ...current, email_enabled: checked } : current)}
              />
              <ChannelToggle
                icon={<Smartphone className="h-5 w-5" />}
                title={t('marketingDelivery.channels.sms')}
                description={t('marketingDelivery.channels.smsDescription')}
                checked={settings.sms_enabled}
                onChange={(checked) => setSettings((current) => current ? { ...current, sms_enabled: checked } : current)}
              />
              <ChannelToggle
                icon={<MessageSquareText className="h-5 w-5" />}
                title={t('marketingDelivery.channels.inApp')}
                description={t('marketingDelivery.channels.inAppDescription')}
                checked={settings.in_app_enabled}
                onChange={(checked) => setSettings((current) => current ? { ...current, in_app_enabled: checked } : current)}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('marketingDelivery.settings.emailLimit')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.daily_email_limit}
                    onChange={(event) => setSettings((current) => current ? { ...current, daily_email_limit: Number(event.target.value) } : current)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketingDelivery.settings.smsLimit')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.daily_sms_limit}
                    onChange={(event) => setSettings((current) => current ? { ...current, daily_sms_limit: Number(event.target.value) } : current)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('marketingDelivery.settings.fromName')}</Label>
                  <Input
                    value={settings.from_name}
                    onChange={(event) => setSettings((current) => current ? { ...current, from_name: event.target.value } : current)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketingDelivery.settings.replyTo')}</Label>
                  <Input
                    type="email"
                    value={settings.reply_to_email}
                    onChange={(event) => setSettings((current) => current ? { ...current, reply_to_email: event.target.value } : current)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => void saveSettings()} disabled={saving}>
                  {saving ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {t('marketingDelivery.actions.saveSettings')}
                </Button>
                <Button variant="outline" onClick={() => void loadDeliveryCenter()}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {t('common.refresh')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-card">
          <CardContent className="p-0">
            <div className="border-b p-5 sm:p-6">
              <div className="flex items-center gap-2 text-lg font-bold">
                <Activity className="h-5 w-5 text-primary" />
                {t('marketingDelivery.runs.title')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t('marketingDelivery.runs.description')}</p>
            </div>

            {runs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <TestTube2 className="mx-auto mb-3 h-9 w-9" />
                {t('marketingDelivery.runs.empty')}
              </div>
            ) : (
              <div className="divide-y">
                {runs.map((run) => (
                  <div key={run.id} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{run.run_type === 'campaign' ? t('marketingDelivery.runs.campaign') : t('marketingDelivery.runs.automation')}</div>
                        <DeliveryStatusBadge status={run.status} t={t} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t(`marketing.channels.${run.channel}`)} · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(run.created_at))}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                      <RunCount label={t('marketingDelivery.runs.recipients')} value={run.recipient_count} />
                      <RunCount label={t('marketingDelivery.runs.sent')} value={run.sent_count} />
                      <RunCount label={t('marketingDelivery.runs.delivered')} value={run.delivered_count} />
                      <RunCount label={t('marketingDelivery.runs.failed')} value={run.failed_count} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl shadow-card">
        <CardContent className="p-0">
          <div className="border-b p-5 sm:p-6">
            <div className="flex items-center gap-2 text-lg font-bold">
              <Send className="h-5 w-5 text-primary" />
              {t('marketingDelivery.log.title')}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('marketingDelivery.log.description')}</p>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{t('marketingDelivery.log.empty')}</div>
          ) : (
            <div className="divide-y">
              {deliveries.slice(0, 25).map((delivery) => (
                <div key={delivery.id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_140px_150px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold">{delivery.customer_name || t('marketingDelivery.log.customer')}</div>
                      <DeliveryStatusBadge status={delivery.status} t={t} />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {maskDestination(delivery.destination, delivery.channel)}
                    </div>
                    {delivery.failure_message && (
                      <div className="mt-1 line-clamp-1 text-xs text-destructive">{delivery.failure_message}</div>
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{t(`marketing.channels.${delivery.channel}`)}</div>
                    <div className="text-xs text-muted-foreground">{delivery.provider || '—'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground md:text-right">
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(delivery.created_at))}
                    <div>{t('marketingDelivery.log.attempts', { count: delivery.attempt_count })}</div>
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

function DeliveryMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="rounded-3xl shadow-card">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-extrabold">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function ChannelToggle({ icon, title, description, checked, onChange }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ModeBadge({ mode, t }: { mode: DeliveryMode; t: any }) {
  const variant = mode === 'live' ? 'default' : 'outline';
  return <Badge variant={variant}>{t(`marketingDelivery.modes.${mode}`)}</Badge>;
}

function DeliveryStatusBadge({ status, t }: { status: string; t: any }) {
  const danger = ['failed', 'bounced', 'complained', 'undelivered'].includes(status);
  const success = ['completed', 'sent', 'delivered', 'simulated'].includes(status);
  return (
    <Badge variant={danger ? 'destructive' : success ? 'default' : 'outline'}>
      {t(`marketingDelivery.statuses.${status}`, { defaultValue: status })}
    </Badge>
  );
}

function RunCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-bold">{value || 0}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function maskDestination(value: string, channel: string) {
  if (!value) return '—';
  if (channel === 'email') {
    const [name, domain] = value.split('@');
    return domain ? `${name.slice(0, 2)}•••@${domain}` : value;
  }
  if (channel === 'sms') return `${value.slice(0, 4)}••••${value.slice(-2)}`;
  return value.slice(0, 8) + '…';
}
