import React from 'react';
import { Bot, CircleHelp, Clock3, Headphones, Mail, MessageSquareText, Send, ShieldCheck, Siren, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const SUPPORT_EMAIL = 'support@velliqo.com';

type SupportRequest = {
  id: string;
  business_id: string;
  owner_id: string;
  subject: string;
  priority: 'normal' | 'urgent';
  status: 'sent' | 'pending' | 'completed' | 'cancelled';
  owner_unread: boolean;
  last_message_at: string;
  created_at: string;
};

type SupportMessage = {
  id: string;
  request_id: string;
  sender_id: string | null;
  sender_role: 'owner' | 'admin';
  body: string;
  created_at: string;
};

type Props = {
  businessId?: string | null;
  businessName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAI: () => void;
  initialRequestId?: string | null;
  onInitialRequestHandled?: () => void;
};

export default function OwnerHelpCenter({
  businessId,
  businessName,
  open,
  onOpenChange,
  onOpenAI,
  initialRequestId,
  onInitialRequestHandled,
}: Props) {
  const { t } = useTranslation();
  const [requests, setRequests] = React.useState<SupportRequest[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [reply, setReply] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const selected = requests.find((item) => item.id === selectedId) ?? null;

  const loadRequests = React.useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('platform_support_requests')
      .select('id,business_id,owner_id,subject,priority,status,owner_unread,last_message_at,created_at')
      .eq('business_id', businessId)
      .order('last_message_at', { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message || t('support.errors.load'));
    setRequests((data || []) as SupportRequest[]);
  }, [businessId, t]);

  const loadMessages = React.useCallback(async (requestId: string) => {
    const { data, error } = await (supabase as any)
      .from('platform_support_messages')
      .select('id,request_id,sender_id,sender_role,body,created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) return toast.error(error.message || t('support.errors.load'));
    setMessages((data || []) as SupportMessage[]);
    await (supabase as any).rpc('owner_mark_support_request_read', { p_request_id: requestId });
    setRequests((current) => current.map((item) => item.id === requestId ? { ...item, owner_unread: false } : item));
  }, [t]);

  React.useEffect(() => {
    if (!open || !businessId) return;
    void loadRequests();
    const channel = supabase
      .channel(`owner-support-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_support_requests', filter: `business_id=eq.${businessId}` }, () => void loadRequests())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_support_messages' }, (payload) => {
        const row = payload.new as SupportMessage;
        if (row.request_id === selectedId) void loadMessages(row.request_id);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [businessId, loadMessages, loadRequests, open, selectedId]);

  React.useEffect(() => {
    if (!open || !initialRequestId) return;
    setSelectedId(initialRequestId);
    void loadMessages(initialRequestId);
    onInitialRequestHandled?.();
  }, [initialRequestId, loadMessages, onInitialRequestHandled, open]);

  const openRequest = (requestId: string) => {
    setSelectedId(requestId);
    void loadMessages(requestId);
  };

  const createRequest = async () => {
    if (!businessId || subject.trim().length < 3 || !message.trim()) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('owner_create_support_request', {
      p_business_id: businessId,
      p_subject: subject.trim(),
      p_message: message.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message || t('support.errors.create'));
    setSubject('');
    setMessage('');
    await loadRequests();
    setSelectedId(String(data));
    await loadMessages(String(data));
    toast.success(t('support.requestCreated'));
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('support_add_message', { p_request_id: selected.id, p_message: reply.trim() });
    setBusy(false);
    if (error) return toast.error(error.message || t('support.errors.reply'));
    setReply('');
    await Promise.all([loadRequests(), loadMessages(selected.id)]);
  };

  const emailSupport = () => {
    const subjectLine = encodeURIComponent(`Velliqo support · ${businessName || 'Owner workspace'}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subjectLine}`;
  };

  const closeConversation = () => {
    setSelectedId(null);
    setMessages([]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-none flex-col gap-0 overflow-hidden border-l border-violet-100 bg-[#fbfaff] p-0 sm:w-[94vw] sm:max-w-[600px] lg:max-w-[680px] [&>button]:hidden">
        <div className="relative overflow-hidden border-b border-violet-100 bg-[radial-gradient(circle_at_10%_0%,rgba(139,92,246,.22),transparent_38%),linear-gradient(135deg,#111026,#211347_58%,#5520a5)] px-5 py-5 text-white sm:px-6">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-violet-200"><CircleHelp className="h-4 w-4" />{t('support.eyebrow')}</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{t('support.title')}</h2>
              <p className="mt-1 max-w-lg text-sm leading-6 text-white/70">{t('support.description')}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)} aria-label={t('support.close')}><X className="h-5 w-5" /></Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="space-y-6 p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <HelpAction icon={<Bot className="h-5 w-5" />} title={t('support.ai.title')} description={t('support.ai.description')} onClick={() => { onOpenChange(false); onOpenAI(); }} accent="violet" />
                <HelpAction icon={<Mail className="h-5 w-5" />} title={t('support.email.title')} description={SUPPORT_EMAIL} onClick={emailSupport} accent="blue" />
                <HelpAction icon={<Siren className="h-5 w-5" />} title={t('support.urgent.title')} description={t('support.urgent.description')} onClick={() => document.getElementById('velliqo-new-support-request')?.scrollIntoView({ behavior: 'smooth' })} accent="amber" />
              </div>

              <section id="velliqo-new-support-request" className="rounded-3xl border border-amber-200/70 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Headphones className="h-5 w-5" /></span><div><div className="font-black">{t('support.newRequest.title')}</div><div className="text-xs text-muted-foreground">{t('support.newRequest.description')}</div></div></div>
                <div className="mt-4 space-y-3">
                  <Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} placeholder={t('support.newRequest.subject')} className="h-11 rounded-xl" />
                  <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} placeholder={t('support.newRequest.message')} className="min-h-28 rounded-xl" />
                  <Button type="button" className="w-full rounded-xl" onClick={() => void createRequest()} disabled={busy || subject.trim().length < 3 || !message.trim()}><Send className="mr-2 h-4 w-4" />{busy ? t('support.sending') : t('support.newRequest.send')}</Button>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-black">{t('support.requests.title')}</h3><p className="text-xs text-muted-foreground">{t('support.requests.description')}</p></div><Badge variant="outline">{requests.length}</Badge></div>
                {loading ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('support.loading')}</div> : requests.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('support.requests.empty')}</div> : <div className="space-y-2">{requests.map((request) => <button key={request.id} type="button" onClick={() => openRequest(request.id)} className={cn('flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md', request.owner_unread && 'border-violet-300 bg-violet-50/60')}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><MessageSquareText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-extrabold">{request.subject}</span>{request.owner_unread && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(request.last_message_at))}</span></span><StatusBadge status={request.status} t={t} /></button>)}</div>}
              </section>

              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs leading-5 text-emerald-900"><ShieldCheck className="h-4 w-4 shrink-0" />{t('support.securityNote')}</div>
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="border-b bg-white px-4 py-4 sm:px-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" onClick={closeConversation} className="text-xs font-bold text-violet-700 hover:text-violet-900">← {t('support.requests.back')}</button><h3 className="mt-2 truncate text-lg font-black">{selected.subject}</h3><div className="mt-1 flex items-center gap-2"><StatusBadge status={selected.status} t={t} /><span className="text-xs text-muted-foreground">#{selected.id.slice(0,8)}</span></div></div><Headphones className="mt-1 h-5 w-5 text-violet-600" /></div></div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7f5fb] p-4 sm:p-6">{messages.map((item) => <div key={item.id} className={cn('flex', item.sender_role === 'owner' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm', item.sender_role === 'owner' ? 'rounded-br-md bg-violet-600 text-white' : 'rounded-bl-md border bg-white text-slate-800')}><div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide opacity-70">{item.sender_role === 'owner' ? t('support.conversation.you') : t('support.conversation.admin')}</div><div className="whitespace-pre-wrap">{item.body}</div><div className="mt-1 text-[10px] opacity-65">{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</div></div></div>)}</div>
              <div className="border-t bg-white p-4 sm:p-5">{selected.status === 'completed' || selected.status === 'cancelled' ? <div className="rounded-2xl bg-muted p-4 text-center text-sm font-semibold text-muted-foreground">{t('support.conversation.closed')}</div> : <div className="flex gap-2"><Textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} placeholder={t('support.conversation.reply')} className="min-h-12 flex-1 resize-none rounded-xl" /><Button type="button" size="icon" className="h-12 w-12 shrink-0 rounded-xl" onClick={() => void sendReply()} disabled={busy || !reply.trim()}><Send className="h-4 w-4" /></Button></div>}</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HelpAction({ icon, title, description, onClick, accent }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; accent: 'violet'|'blue'|'amber' }) {
  const accents = { violet: 'bg-violet-100 text-violet-700', blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-700' };
  return <button type="button" onClick={onClick} className="group rounded-3xl border bg-white p-4 text-left shadow-[0_12px_35px_rgba(15,23,42,.05)] transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_18px_45px_rgba(15,23,42,.09)]"><span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', accents[accent])}>{icon}</span><div className="mt-3 text-sm font-black">{title}</div><div className="mt-1 break-words text-xs leading-5 text-muted-foreground">{description}</div></button>;
}

function StatusBadge({ status, t }: { status: SupportRequest['status']; t: (key: string, options?: any) => string }) {
  const classes: Record<SupportRequest['status'], string> = { sent: 'border-blue-200 bg-blue-50 text-blue-700', pending: 'border-amber-200 bg-amber-50 text-amber-800', completed: 'border-emerald-200 bg-emerald-50 text-emerald-700', cancelled: 'border-slate-200 bg-slate-100 text-slate-600' };
  return <Badge variant="outline" className={cn('shrink-0 capitalize', classes[status])}>{t(`support.status.${status}`)}</Badge>;
}
