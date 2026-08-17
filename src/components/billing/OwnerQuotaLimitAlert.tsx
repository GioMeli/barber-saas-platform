import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Puzzle, X } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type QuotaAlert = { id:string; quota_type:'sms'|'email'|'ai_requests'|'ai_tokens'; used_amount:number; limit_amount:number; created_at:string };

export default function OwnerQuotaLimitAlert({ businessId }: { businessId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [alert, setAlert] = React.useState<QuotaAlert | null>(null);
  const [open, setOpen] = React.useState(false);

  const check = React.useCallback(async () => {
    if (!businessId) return;
    const { data, error } = await (supabase as any).rpc('owner_check_quota_alerts', { p_business_id: businessId });
    if (error) return;
    const next = (data?.alerts || [])[0] as QuotaAlert | undefined;
    if (next) { setAlert(next); setOpen(true); }
  }, [businessId]);

  React.useEffect(() => {
    if (!businessId) return;
    void check();
    const interval = window.setInterval(()=>void check(), 60_000);
    const handler = () => void check();
    window.addEventListener('velliqo:usage-updated', handler);
    return () => { window.clearInterval(interval); window.removeEventListener('velliqo:usage-updated', handler); };
  }, [businessId, check]);

  const close = async () => {
    setOpen(false);
    if (alert?.id) await (supabase as any).rpc('owner_mark_quota_alert_seen', { p_alert_id: alert.id });
    setAlert(null);
  };
  const buy = async () => { await close(); navigate('/dashboard/addons'); };
  const label = alert ? t(`addons.quota.types.${alert.quota_type}`) : '';

  return <Dialog open={open} onOpenChange={(value)=>{ if (!value) void close(); else setOpen(true); }}>
    <DialogContent className="max-w-lg overflow-hidden rounded-[1.75rem] border-amber-200 p-0">
      <div className="bg-gradient-to-br from-amber-50 via-white to-violet-50 p-6 sm:p-7">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle className="h-6 w-6" /></div>
          <DialogTitle className="text-2xl">{t('addons.quota.title')}</DialogTitle>
          <DialogDescription className="text-sm leading-6">{t('addons.quota.description',{type:label})}</DialogDescription>
        </DialogHeader>
        {alert && <div className="mt-5 rounded-2xl border bg-white/80 p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold">{label}</span><span className="text-sm font-extrabold">{Number(alert.used_amount).toLocaleString()} / {Number(alert.limit_amount).toLocaleString()}</span></div></div>}
        <div className="mt-6 grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={()=>void close()}><X className="mr-2 h-4 w-4" />{t('addons.quota.later')}</Button><Button onClick={()=>void buy()}><Puzzle className="mr-2 h-4 w-4" />{t('addons.quota.buy')}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
