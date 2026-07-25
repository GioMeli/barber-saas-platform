import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BellRing,
  Bot,
  ChartNoAxesCombined,
  Clock3,
  Database,
  Loader2,
  Save,
  ShieldCheck,
  PackageSearch,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import { SUPPORTED_AI_LANGUAGES, normalizeLanguage, type AILanguage } from '@/ai';

type SettingsState = {
  enabled: boolean;
  default_language: AILanguage;
  retain_history: boolean;
  response_style: string;
  proactive_insights: boolean;
  allow_customer_data: boolean;
  allow_write_actions: boolean;
  proactive_briefing_enabled: boolean;
  briefing_time: string;
  notify_owner_on_ai_alert: boolean;
  monitor_revenue_changes: boolean;
  monitor_no_shows: boolean;
  monitor_customer_retention: boolean;
  monitor_inventory: boolean;
  monitor_marketing_performance: boolean;
};

export default function AISettings() {
  const { t, i18n } = useTranslation();
  const { activeBusiness } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<SettingsState>({
    enabled: true,
    default_language: normalizeLanguage(i18n.language),
    retain_history: true,
    response_style: 'balanced',
    proactive_insights: true,
    allow_customer_data: false,
    allow_write_actions: false,
    proactive_briefing_enabled: true,
    briefing_time: '08:00',
    notify_owner_on_ai_alert: true,
    monitor_revenue_changes: true,
    monitor_no_shows: true,
    monitor_customer_retention: true,
    monitor_inventory: true,
    monitor_marketing_performance: true,
  });

  React.useEffect(() => {
    if (!activeBusiness?.id) return;
    void (async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('enabled, default_language, retain_history, response_style, proactive_insights, allow_customer_data, allow_write_actions, proactive_briefing_enabled, briefing_time, notify_owner_on_ai_alert, monitor_revenue_changes, monitor_no_shows, monitor_customer_retention, monitor_inventory, monitor_marketing_performance')
        .eq('business_id', activeBusiness.id)
        .maybeSingle();

      if (error) toast.error(error.message);
      if (data) {
        setSettings({
          enabled: data.enabled,
          default_language: normalizeLanguage(data.default_language),
          retain_history: data.retain_history,
          response_style: data.response_style,
          proactive_insights: data.proactive_insights,
          allow_customer_data: Boolean(data.allow_customer_data),
          allow_write_actions: Boolean(data.allow_write_actions),
          proactive_briefing_enabled: data.proactive_briefing_enabled !== false,
          briefing_time: String(data.briefing_time || '08:00').slice(0, 5),
          notify_owner_on_ai_alert: data.notify_owner_on_ai_alert !== false,
          monitor_revenue_changes: data.monitor_revenue_changes !== false,
          monitor_no_shows: data.monitor_no_shows !== false,
          monitor_customer_retention: data.monitor_customer_retention !== false,
          monitor_inventory: data.monitor_inventory !== false,
          monitor_marketing_performance: data.monitor_marketing_performance !== false,
        });
      }
      setLoading(false);
    })();
  }, [activeBusiness?.id]);

  const save = async () => {
    if (!activeBusiness?.id) return;
    setSaving(true);
    const { error } = await supabase.from('ai_settings').upsert({
      business_id: activeBusiness.id,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id' });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t('ai.settingsSaved'));
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="app-page max-w-5xl pb-12">
      <header className="app-page-header">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Velliqo AI</span>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />{t('ai.manager.actionEngineBadge')}
            </Badge>
          </div>
          <h1 className="app-page-title">{t('ai.settings')}</h1>
          <p className="app-page-description">{t('ai.settingsDescription')}</p>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? t('common.saving') : t('common.save')}
        </Button>
      </header>

      <Card className="rounded-3xl shadow-card">
        <CardContent className="space-y-7 p-6 sm:p-7">
          <SettingRow
            icon={<Sparkles className="h-5 w-5" />}
            title={t('ai.enableAI')}
            description={t('ai.enableAIDescription')}
          >
            <Switch checked={settings.enabled} onCheckedChange={(enabled) => setSettings((current) => ({ ...current, enabled }))} />
          </SettingRow>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('ai.defaultLanguage')}</Label>
              <Select
                value={settings.default_language}
                onValueChange={(default_language: AILanguage) => setSettings((current) => ({ ...current, default_language }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_AI_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>{language.nativeLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('ai.responseStyle')}</Label>
              <Select
                value={settings.response_style}
                onValueChange={(response_style) => setSettings((current) => ({ ...current, response_style }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">{t('ai.concise')}</SelectItem>
                  <SelectItem value="balanced">{t('ai.balanced')}</SelectItem>
                  <SelectItem value="detailed">{t('ai.detailed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SettingRow
            icon={<Sparkles className="h-5 w-5" />}
            title={t('ai.manager.proactiveInsights')}
            description={t('ai.manager.proactiveInsightsDescription')}
          >
            <Switch
              checked={settings.proactive_insights}
              onCheckedChange={(proactive_insights) => setSettings((current) => ({ ...current, proactive_insights }))}
            />
          </SettingRow>

          <SettingRow
            icon={<ShieldCheck className="h-5 w-5" />}
            title={t('ai.conversationHistory')}
            description={t('ai.conversationHistoryDescription')}
          >
            <Switch
              checked={settings.retain_history}
              onCheckedChange={(retain_history) => setSettings((current) => ({ ...current, retain_history }))}
            />
          </SettingRow>

          <SettingRow
            icon={<UserRoundCog className="h-5 w-5" />}
            title={t('ai.customerData')}
            description={t('ai.manager.customerDataActionDescription')}
          >
            <Switch
              checked={settings.allow_customer_data}
              onCheckedChange={(allow_customer_data) => setSettings((current) => ({ ...current, allow_customer_data }))}
            />
          </SettingRow>

          <SettingRow
            icon={<Bot className="h-5 w-5" />}
            title={t('ai.manager.writeActions')}
            description={t('ai.manager.writeActionsDescription')}
          >
            <Switch
              checked={settings.allow_write_actions}
              onCheckedChange={(allow_write_actions) => setSettings((current) => ({ ...current, allow_write_actions }))}
            />
          </SettingRow>

          <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertTitle>{t('ai.manager.actionEngineBadge')}</AlertTitle>
            <AlertDescription>{t('ai.manager.actionSettingsWarning')}</AlertDescription>
          </Alert>

          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-950">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-violet-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold">{t('ai.manager.privateEngine')}</div>
                <p className="mt-1 text-sm leading-6 text-violet-900/75">{t('ai.manager.privateEngineDescription')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-card">
        <CardContent className="space-y-7 p-6 sm:p-7">
          <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">{t('ai.manager.proactive.settingsTitle')}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t('ai.manager.proactive.settingsDescription')}</p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-800">
              {t('ai.manager.proactive.backgroundMonitoring')}
            </Badge>
          </div>

          <SettingRow
            icon={<Sparkles className="h-5 w-5" />}
            title={t('ai.manager.proactive.dailyBriefingSetting')}
            description={t('ai.manager.proactive.dailyBriefingSettingDescription')}
          >
            <Switch
              checked={settings.proactive_briefing_enabled}
              onCheckedChange={(proactive_briefing_enabled) => setSettings((current) => ({ ...current, proactive_briefing_enabled }))}
            />
          </SettingRow>

          <div className="grid gap-5 border-b pb-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{t('ai.manager.proactive.briefingTime')}</Label>
              <Input
                type="time"
                value={settings.briefing_time}
                onChange={(event) => setSettings((current) => ({ ...current, briefing_time: event.target.value }))}
                disabled={!settings.proactive_briefing_enabled}
              />
              <p className="text-xs leading-5 text-muted-foreground">{t('ai.manager.proactive.briefingTimeDescription')}</p>
            </div>
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="text-sm font-bold">{t('ai.manager.proactive.timezoneTitle')}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('ai.manager.proactive.timezoneDescription', { timezone: activeBusiness?.timezone || 'UTC' })}</p>
            </div>
          </div>

          <SettingRow
            icon={<BellRing className="h-5 w-5" />}
            title={t('ai.manager.proactive.ownerNotifications')}
            description={t('ai.manager.proactive.ownerNotificationsDescription')}
          >
            <Switch
              checked={settings.notify_owner_on_ai_alert}
              onCheckedChange={(notify_owner_on_ai_alert) => setSettings((current) => ({ ...current, notify_owner_on_ai_alert }))}
            />
          </SettingRow>

          <div>
            <div className="mb-4 text-sm font-extrabold">{t('ai.manager.proactive.monitorsTitle')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MonitorToggle
                icon={<ChartNoAxesCombined className="h-4 w-4" />}
                title={t('ai.manager.proactive.monitorRevenue')}
                checked={settings.monitor_revenue_changes}
                onCheckedChange={(monitor_revenue_changes) => setSettings((current) => ({ ...current, monitor_revenue_changes }))}
              />
              <MonitorToggle
                icon={<Clock3 className="h-4 w-4" />}
                title={t('ai.manager.proactive.monitorNoShows')}
                checked={settings.monitor_no_shows}
                onCheckedChange={(monitor_no_shows) => setSettings((current) => ({ ...current, monitor_no_shows }))}
              />
              <MonitorToggle
                icon={<UsersRound className="h-4 w-4" />}
                title={t('ai.manager.proactive.monitorRetention')}
                checked={settings.monitor_customer_retention}
                onCheckedChange={(monitor_customer_retention) => setSettings((current) => ({ ...current, monitor_customer_retention }))}
              />
              <MonitorToggle
                icon={<PackageSearch className="h-4 w-4" />}
                title={t('ai.manager.proactive.monitorInventory')}
                checked={settings.monitor_inventory}
                onCheckedChange={(monitor_inventory) => setSettings((current) => ({ ...current, monitor_inventory }))}
              />
              <MonitorToggle
                icon={<Bot className="h-4 w-4" />}
                title={t('ai.manager.proactive.monitorMarketing')}
                checked={settings.monitor_marketing_performance}
                onCheckedChange={(monitor_marketing_performance) => setSettings((current) => ({ ...current, monitor_marketing_performance }))}
              />
            </div>
          </div>

          <Alert className="rounded-2xl border-violet-200 bg-violet-50 text-violet-950">
            <ShieldCheck className="h-4 w-4 text-violet-700" />
            <AlertTitle>{t('ai.manager.proactive.safetyTitle')}</AlertTitle>
            <AlertDescription>{t('ai.manager.proactive.safetyDescription')}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

function MonitorToggle({
  icon,
  title,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/10 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-primary shadow-sm">{icon}</div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b pb-6 last:border-0 last:pb-0">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div>
          <div className="font-bold">{title}</div>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
