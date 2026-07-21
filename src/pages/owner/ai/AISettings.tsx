import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { SUPPORTED_AI_LANGUAGES, normalizeLanguage, type AILanguage } from '@/ai';

export default function AISettings() {
  const { t, i18n } = useTranslation();
  const { activeBusiness } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState({ enabled: true, default_language: normalizeLanguage(i18n.language), retain_history: true, allow_customer_data: false, response_style: 'balanced' });
  React.useEffect(() => { if (!activeBusiness?.id) return; void (async () => { const { data, error } = await supabase.from('ai_settings').select('*').eq('business_id', activeBusiness.id).maybeSingle(); if (error) toast.error(error.message); if (data) setSettings({ enabled:data.enabled, default_language:normalizeLanguage(data.default_language), retain_history:data.retain_history, allow_customer_data:data.allow_customer_data, response_style:data.response_style }); setLoading(false); })(); }, [activeBusiness?.id]);
  const save = async () => { if (!activeBusiness?.id) return; setSaving(true); const { error } = await supabase.from('ai_settings').upsert({ business_id:activeBusiness.id, ...settings, updated_at:new Date().toISOString() }, { onConflict:'business_id' }); setSaving(false); if (error) toast.error(error.message); else toast.success(t('ai.settingsSaved')); };
  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return <div className="app-page max-w-4xl pb-12"><header className="app-page-header"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">Velliqo AI</div><h1 className="app-page-title">{t('ai.settings')}</h1><p className="app-page-description">{t('ai.settingsDescription')}</p></div><Button onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? t('common.saving') : t('common.save')}</Button></header>
    <Card className="rounded-3xl shadow-card"><CardContent className="space-y-7 p-6 sm:p-7">
      <SettingRow icon={<Sparkles className="h-5 w-5" />} title={t('ai.enableAI')} description={t('ai.enableAIDescription')}><Switch checked={settings.enabled} onCheckedChange={(enabled) => setSettings((s) => ({...s,enabled}))} /></SettingRow>
      <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>{t('ai.defaultLanguage')}</Label><Select value={settings.default_language} onValueChange={(value: AILanguage) => setSettings((s) => ({...s,default_language:value}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPORTED_AI_LANGUAGES.map((l)=><SelectItem key={l.code} value={l.code}>{l.nativeLabel}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t('ai.responseStyle')}</Label><Select value={settings.response_style} onValueChange={(response_style) => setSettings((s)=>({...s,response_style}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="concise">{t('ai.concise')}</SelectItem><SelectItem value="balanced">{t('ai.balanced')}</SelectItem><SelectItem value="detailed">{t('ai.detailed')}</SelectItem></SelectContent></Select></div></div>
      <SettingRow icon={<ShieldCheck className="h-5 w-5" />} title={t('ai.conversationHistory')} description={t('ai.conversationHistoryDescription')}><Switch checked={settings.retain_history} onCheckedChange={(retain_history)=>setSettings((s)=>({...s,retain_history}))} /></SettingRow>
      <SettingRow icon={<ShieldCheck className="h-5 w-5" />} title={t('ai.customerData')} description={t('ai.customerDataDescription')}><Switch checked={settings.allow_customer_data} onCheckedChange={(allow_customer_data)=>setSettings((s)=>({...s,allow_customer_data}))} /></SettingRow>
    </CardContent></Card>
  </div>;
}
function SettingRow({icon,title,description,children}:{icon:React.ReactNode;title:string;description:string;children:React.ReactNode}) { return <div className="flex items-start justify-between gap-5 border-b pb-6 last:border-0 last:pb-0"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div><div className="font-bold">{title}</div><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p></div></div>{children}</div>; }
