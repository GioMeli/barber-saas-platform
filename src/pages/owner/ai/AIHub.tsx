import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Bot,
  CheckCircle2,
  Clock3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Gauge,
  History,
  Lightbulb,
  Loader2,
  FilePenLine,
  Megaphone,
  MessageSquareText,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVelliqoAI } from '@/hooks/useVelliqoAI';
import {
  AI_AGENT_REGISTRY,
  normalizeLanguage,
  type AIAgentKey,
  type VelliqoAIActionRequest,
  type VelliqoAIActionType,
  type VelliqoAIManagerAlert,
  type VelliqoAIManagerBriefing,
  type VelliqoAIMessage,
} from '@/ai';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { VelliqoVoiceAssistant } from '@/components/ai/VelliqoVoiceAssistant';
import { VelliqoActionConfirmationDialog } from '@/components/ai/VelliqoActionConfirmationDialog';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS: Array<{ key: string; agent: AIAgentKey }> = [
  { key: 'dailyBriefing', agent: 'business_coach' },
  { key: 'revenueChanges', agent: 'financial_analyst' },
  { key: 'retentionOpportunities', agent: 'customer_success' },
  { key: 'scheduleOpportunities', agent: 'scheduling_assistant' },
];

export default function AIHub() {
  const { t, i18n } = useTranslation();
  const { activeBusiness, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const assistantMode = searchParams.get('mode') === 'assistant';
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [agent, setAgent] = React.useState<AIAgentKey>('business_coach');
  const [draft, setDraft] = React.useState('');
  const [confirmationAction, setConfirmationAction] = React.useState<VelliqoAIActionRequest | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const firstName = profile?.full_name?.split(' ')[0] || t('ai.ownerFallback');

  const ai = useVelliqoAI({
    businessId: activeBusiness?.id,
    language,
    page: '/dashboard/ai',
  });

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ai.messages, ai.sending]);

  React.useEffect(() => {
    if (!assistantMode) return;
    const timer = window.setTimeout(() => {
      document.getElementById('velliqo-ai-composer')?.focus();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [assistantMode]);

  const send = async (message = draft, selectedAgent = agent) => {
    const cleanMessage = message.trim();
    if (!cleanMessage || ai.sending) return;
    setAgent(selectedAgent);
    setDraft('');
    const result = await ai.sendMessage({ agent: selectedAgent, message: cleanMessage });
    if (result?.pendingAction) setConfirmationAction(result.pendingAction);
    if (!result && cleanMessage === draft.trim()) setDraft(cleanMessage);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };


  const executeAction = async (action: VelliqoAIActionRequest) => {
    const result = await ai.executeAction(action.id);
    if (result?.success) {
      toast.success(t('ai.manager.actions.completedToast'));
      setConfirmationAction(null);
    } else if (result) {
      toast.error(result.error || t('ai.manager.actions.failedToast'));
      setConfirmationAction(null);
    }
    return result;
  };

  const cancelAction = async (action: VelliqoAIActionRequest) => {
    const result = await ai.rejectAction(action.id);
    if (result?.success) {
      toast.success(t('ai.manager.actions.cancelledToast'));
      setConfirmationAction(null);
    }
    return result;
  };

  const changeAction = async (action: VelliqoAIActionRequest) => {
    const result = await ai.rejectAction(action.id);
    if (!result?.success) return result;
    setConfirmationAction(null);
    setDraft(t('ai.manager.actions.changePrompt', { summary: action.summary }));
    window.setTimeout(() => document.getElementById('velliqo-ai-composer')?.focus(), 0);
    return result;
  };

  const refreshBriefing = async () => {
    const result = await ai.generateBriefing();
    if (result?.status === 'completed') toast.success(t('ai.manager.proactive.refreshSuccess'));
    else if (result?.status === 'skipped') toast.info(t('ai.manager.proactive.alreadyCurrent'));
  };

  const discussBriefing = (prompt?: string | null) => {
    const message = prompt?.trim() || t('ai.manager.proactive.discussPrompt');
    setAgent('business_coach');
    setDraft(message);
    window.setTimeout(() => document.getElementById('velliqo-ai-composer')?.focus(), 0);
  };

  const dismissAlert = async (alertId: string) => {
    if (await ai.setAlertStatus(alertId, 'dismissed')) {
      toast.success(t('ai.manager.proactive.alertDismissed'));
    }
  };

  const currency = activeBusiness?.currency || ai.snapshot?.business?.currency || 'EUR';
  const financeSummary = (ai.snapshot?.finance as any)?.summary || {};
  const cards = [
    {
      icon: CircleDollarSign,
      label: t('ai.manager.metrics.revenue'),
      value: formatCurrency(financeSummary.collectedRevenue, currency, language),
      helper: t('ai.manager.metrics.lastDays', { days: ai.snapshot?.period.days || 30 }),
    },
    {
      icon: CalendarDays,
      label: t('ai.manager.metrics.appointments'),
      value: String(ai.snapshot?.appointments.total ?? 0),
      helper: t('ai.manager.metrics.completion', { value: ai.snapshot?.appointments.completionRate ?? 0 }),
    },
    {
      icon: Users,
      label: t('ai.manager.metrics.customers'),
      value: String(ai.snapshot?.customers.total ?? 0),
      helper: t('ai.manager.metrics.atRisk', { value: ai.snapshot?.customers.atRisk ?? 0 }),
    },
    {
      icon: PackageSearch,
      label: t('ai.manager.metrics.inventory'),
      value: String(ai.snapshot?.inventory.lowStock ?? 0),
      helper: t('ai.manager.metrics.lowStock'),
    },
  ];

  return (
    <div className={cn('app-page pb-12', assistantMode && 'gap-4 pb-4')}>
      {assistantMode ? (
        <section className="relative overflow-hidden rounded-[1.5rem] border border-violet-300/20 bg-[#111027] px-4 py-4 text-white shadow-xl sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,.34),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(245,158,11,.14),transparent_34%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/brand/velliqo-ai.png"
                alt="Velliqo AI"
                className="h-12 w-12 shrink-0 rounded-2xl object-cover mix-blend-screen drop-shadow-[0_0_18px_rgba(168,85,247,.48)]"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[.16em] text-violet-200">Velliqo AI</div>
                <h1 className="mt-1 truncate text-xl font-extrabold">{t('ai.quickAccess.title')}</h1>
                <p className="mt-1 text-xs leading-5 text-white/62">{t('ai.quickAccess.description')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={ai.startNewConversation}
              >
                <Plus className="mr-2 h-4 w-4" />{t('ai.manager.newConversation')}
              </Button>
              <Button asChild className="bg-white text-slate-950 hover:bg-white/90">
                <Link to="/dashboard/ai">
                  <Gauge className="mr-2 h-4 w-4" />{t('ai.quickAccess.insights')}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={cn('relative min-w-0 overflow-hidden rounded-[1.5rem] border border-violet-300/20 bg-[#111027] p-4 text-white shadow-2xl sm:rounded-[2rem] sm:p-8 lg:p-10', assistantMode && 'hidden')}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(245,158,11,.16),transparent_30%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-violet-300/25 bg-violet-400/10 text-violet-100 hover:bg-violet-400/10">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />Velliqo AI
              </Badge>
              <Badge className="border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />{t('ai.manager.readOnly')}
              </Badge>
              <Badge className="border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">
                <CircleDollarSign className="mr-1.5 h-3.5 w-3.5" />{t('ai.manager.zeroExternalCost')}
              </Badge>
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t('ai.manager.welcome', { name: firstName })}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
              {t('ai.manager.introduction', {
                business: activeBusiness?.name || t('ai.yourBusiness'),
              })}
            </p>
            <div className="mobile-stack-actions mt-6 sm:flex sm:flex-wrap sm:gap-3">
              <Button
                className="bg-white text-slate-950 hover:bg-white/90"
                onClick={() => document.getElementById('velliqo-ai-composer')?.focus()}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />{t('ai.askVelliqo')}
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/dashboard/ai/settings">
                  <Settings className="mr-2 h-4 w-4" />{t('ai.settings')}
                </Link>
              </Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[170px] sm:max-w-[235px]">
            <img
              src="/brand/velliqo-ai.png"
              alt="Velliqo AI"
              className="w-full rounded-[2rem] shadow-[0_25px_70px_rgba(124,58,237,.35)]"
            />
          </div>
        </div>
      </section>

      {ai.error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('ai.manager.errorTitle')}</AlertTitle>
          <AlertDescription>{ai.error}</AlertDescription>
        </Alert>
      )}

      <section className={cn('grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]', assistantMode && 'hidden')}>
        <AIManagerBriefingPanel
          briefing={ai.briefing}
          loading={ai.loadingProactive}
          refreshing={ai.refreshingBriefing}
          language={language}
          onRefresh={() => void refreshBriefing()}
          onDiscuss={discussBriefing}
        />
        <AIProactiveAlertPanel
          alerts={ai.alerts}
          loading={ai.loadingProactive}
          onDiscuss={(alert) => discussBriefing(alert.suggested_prompt)}
          onDismiss={(alert) => void dismissAlert(alert.id)}
        />
      </section>

      <section className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', assistantMode && 'hidden')}>
        {ai.loadingSnapshot
          ? Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-3xl shadow-card"><CardContent className="p-5"><Skeleton className="h-11 w-11 rounded-2xl" /><Skeleton className="mt-4 h-4 w-28" /><Skeleton className="mt-3 h-8 w-20" /><Skeleton className="mt-2 h-3 w-32" /></CardContent></Card>
          ))
          : cards.map((card) => (
            <Card key={card.label} className="rounded-3xl shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void ai.refreshSnapshot()} aria-label={t('common.refresh')}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 text-sm font-semibold text-muted-foreground">{card.label}</div>
                <div className="mt-1 text-2xl font-extrabold tracking-tight">{card.value}</div>
                <div className="mt-2 text-xs text-muted-foreground">{card.helper}</div>
              </CardContent>
            </Card>
          ))}
      </section>

      <section
        id="velliqo-assistant-workspace"
        className={cn('grid gap-6', !assistantMode && 'xl:grid-cols-[280px_minmax(0,1fr)]')}
      >
        {!assistantMode ? (
        <Card className="rounded-3xl shadow-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{t('ai.manager.history')}</div>
                <h2 className="mt-1 font-extrabold">{t('ai.manager.conversations')}</h2>
              </div>
              <Button size="icon" variant="outline" onClick={ai.startNewConversation} aria-label={t('ai.manager.newConversation')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="mt-4 h-[220px] pr-3 sm:h-[280px] xl:h-[560px]">
              <div className="space-y-2">
                {ai.conversations.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    {t('ai.manager.noConversations')}
                  </div>
                )}
                {ai.conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group flex items-center gap-2 rounded-2xl border p-2 transition ${ai.activeConversationId === conversation.id ? 'border-primary/35 bg-primary/5' : 'hover:bg-muted/30'}`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-2 py-1 text-left"
                      onClick={() => void ai.openConversation(conversation.id)}
                    >
                      <div className="truncate text-sm font-semibold">{conversation.title || t('ai.manager.untitledConversation')}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <History className="h-3 w-3" />
                        {formatDate(conversation.updated_at, language)}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      onClick={async () => {
                        if (await ai.deleteConversation(conversation.id)) toast.success(t('ai.manager.conversationDeleted'));
                      }}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        ) : null}

        <Card className={cn('overflow-hidden rounded-3xl shadow-card', assistantMode && 'border-violet-200/80 shadow-[0_22px_70px_rgba(55,32,115,.16)]')}>
          <CardContent className="p-0">
            <div className="border-b bg-muted/15 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/brand/velliqo-ai.png"
                    alt="Velliqo AI"
                    className="h-11 w-11 rounded-2xl object-cover mix-blend-multiply dark:mix-blend-screen"
                  />
                  <div>
                    <h2 className="font-extrabold">{t('ai.manager.chatTitle')}</h2>
                    <p className="text-xs text-muted-foreground">{t('ai.manager.chatDescription')}</p>
                  </div>
                </div>
                <Select value={agent} onValueChange={(value: AIAgentKey) => setAgent(value)}>
                  <SelectTrigger className="w-full sm:w-[230px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(AI_AGENT_REGISTRY).map((definition) => (
                      <SelectItem key={definition.key} value={definition.key}>
                        {t(definition.nameKey, { defaultValue: formatAgentName(definition.key) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea
              className={cn(
                'h-[min(52dvh,430px)] min-h-[340px] px-3 py-4 sm:h-[430px] sm:px-6 sm:py-5',
                assistantMode && 'h-[calc(100dvh-23rem)] min-h-[360px] max-h-[680px] sm:h-[calc(100dvh-21rem)]',
              )}
            >
              {ai.loadingHistory ? (
                <div className="space-y-4"><Skeleton className="h-20 w-3/4 rounded-2xl" /><Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" /></div>
              ) : ai.messages.length === 0 ? (
                <div className="mx-auto flex min-h-[300px] max-w-2xl flex-col items-center justify-center text-center sm:min-h-[360px]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
                  <h3 className="mt-5 text-xl font-extrabold">{t('ai.manager.emptyTitle')}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{t('ai.manager.emptyDescription')}</p>
                  <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        type="button"
                        key={prompt.key}
                        onClick={() => void send(t(`ai.manager.prompts.${prompt.key}`), prompt.agent)}
                        className="rounded-2xl border bg-background p-4 text-left text-sm font-semibold transition hover:border-primary/30 hover:bg-primary/5"
                      >
                        <Lightbulb className="mb-2 h-4 w-4 text-primary" />
                        {t(`ai.manager.prompts.${prompt.key}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {ai.messages.map((message) => (
                    <AIMessageBubble
                      key={message.id}
                      message={message}
                      language={language}
                      actionBusyId={ai.actionBusyId}
                      onAskQuestion={(question, messageAgent) => void send(question, messageAgent || agent)}
                      onExecuteAction={(action) => void executeAction(action)}
                      onCancelAction={(action) => void cancelAction(action)}
                      onChangeAction={(action) => void changeAction(action)}
                    />
                  ))}
                  {ai.sending && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      {t('ai.manager.thinking')}
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t bg-background p-4 sm:p-5">
              <div className="rounded-2xl border bg-muted/10 p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                <Textarea
                  id="velliqo-ai-composer"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('ai.manager.placeholder')}
                  className="min-h-[82px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  maxLength={4000}
                  disabled={ai.sending}
                />
                <div className="flex flex-col gap-3 px-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />{t('ai.manager.aggregateDataNotice')}
                  </div>
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    <VelliqoVoiceAssistant
                      businessId={activeBusiness?.id}
                      conversationId={ai.activeConversationId}
                      language={language}
                      agent={agent}
                      sending={ai.sending}
                      actionBusyId={ai.actionBusyId}
                      onSendMessage={(message, selectedAgent) => ai.sendMessage({ agent: selectedAgent, message })}
                      onExecuteAction={executeAction}
                      onRejectAction={cancelAction}
                      onChangeAction={changeAction}
                    />
                    <Button onClick={() => void send()} disabled={!draft.trim() || ai.sending}>
                      {ai.sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {t('ai.manager.send')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <VelliqoActionConfirmationDialog
        open={Boolean(confirmationAction)}
        action={confirmationAction}
        busy={Boolean(confirmationAction && ai.actionBusyId === confirmationAction.id)}
        onOpenChange={(open) => {
          if (!open) setConfirmationAction(null);
        }}
        onConfirm={() => {
          if (confirmationAction) void executeAction(confirmationAction);
        }}
        onCancel={() => {
          if (confirmationAction) void cancelAction(confirmationAction);
        }}
        onChange={() => {
          if (confirmationAction) void changeAction(confirmationAction);
        }}
      />
    </div>
  );
}

function AIManagerBriefingPanel({
  briefing,
  loading,
  refreshing,
  language,
  onRefresh,
  onDiscuss,
}: {
  briefing: VelliqoAIManagerBriefing | null;
  loading: boolean;
  refreshing: boolean;
  language: string;
  onRefresh: () => void;
  onDiscuss: (prompt?: string | null) => void;
}) {
  const { t } = useTranslation();

  if (loading && !briefing) {
    return (
      <Card className="rounded-3xl shadow-card">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-10 w-44" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-violet-200/70 shadow-card">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b bg-gradient-to-r from-violet-50 to-amber-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[.15em] text-violet-700">
                {t('ai.manager.proactive.dailyBriefing')}
              </div>
              <h2 className="mt-1 text-lg font-extrabold">
                {briefing?.title || t('ai.manager.proactive.noBriefingTitle')}
              </h2>
              {briefing ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('ai.manager.proactive.generatedAt', { value: formatDate(briefing.generated_at, language) })}
                </p>
              ) : null}
            </div>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {refreshing ? t('ai.manager.proactive.refreshing') : t('ai.manager.proactive.refresh')}
          </Button>
        </div>

        <div className="p-5 sm:p-6">
          {briefing ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{briefing.summary}</p>
                <div className="shrink-0 rounded-2xl border bg-muted/20 px-4 py-3 text-center">
                  <div className="text-xs font-semibold text-muted-foreground">{t('ai.manager.proactive.healthScore')}</div>
                  <div className="mt-1 text-2xl font-extrabold">{briefing.business_health_score}/100</div>
                </div>
              </div>

              {briefing.priorities?.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {briefing.priorities.slice(0, 4).map((priority, index) => (
                    <div key={`${priority.category}-${index}`} className="rounded-2xl border bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold">{priority.title}</div>
                        <Badge variant="outline">{t(`ai.manager.severity.${priority.severity}`)}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{priority.explanation}</p>
                      <p className="mt-3 text-xs font-medium leading-5">{priority.next_step}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => onDiscuss(briefing.recommended_prompts?.[0])}>
                  <MessageSquareText className="mr-2 h-4 w-4" />{t('ai.manager.proactive.discuss')}
                </Button>
                {briefing.recommended_prompts?.slice(1, 3).map((prompt) => (
                  <Button key={prompt} variant="outline" onClick={() => onDiscuss(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed p-5">
              <p className="text-sm leading-6 text-muted-foreground">{t('ai.manager.proactive.noBriefingDescription')}</p>
              <Button onClick={onRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {t('ai.manager.proactive.generateNow')}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AIProactiveAlertPanel({
  alerts,
  loading,
  onDiscuss,
  onDismiss,
}: {
  alerts: VelliqoAIManagerAlert[];
  loading: boolean;
  onDiscuss: (alert: VelliqoAIManagerAlert) => void;
  onDismiss: (alert: VelliqoAIManagerAlert) => void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-3xl shadow-card">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold">{t('ai.manager.proactive.alertsTitle')}</div>
              <div className="text-xs text-muted-foreground">{t('ai.manager.proactive.alertsDescription')}</div>
            </div>
          </div>
          <Badge variant="outline">{alerts.length}</Badge>
        </div>

        <div className="mt-5 space-y-3">
          {loading && !alerts.length ? (
            <><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></>
          ) : alerts.length ? alerts.slice(0, 5).map((alert) => (
            <div key={alert.id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold">{alert.title}</div>
                    <Badge variant="outline">{t(`ai.manager.severity.${alert.severity}`)}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{alert.summary}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onDismiss(alert)} aria-label={t('ai.manager.proactive.dismiss')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onDiscuss(alert)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />{t('ai.manager.proactive.analyse')}
                </Button>
                {alert.destination_path ? (
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={alert.destination_path}>
                      {t('ai.manager.proactive.openArea')}<ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {t('ai.manager.proactive.noAlerts')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AIMessageBubble({
  message,
  language,
  actionBusyId,
  onAskQuestion,
  onExecuteAction,
  onCancelAction,
  onChangeAction,
}: {
  message: VelliqoAIMessage;
  language: string;
  actionBusyId: string | null;
  onAskQuestion: (question: string, agent?: AIAgentKey) => void;
  onExecuteAction: (action: VelliqoAIActionRequest) => void;
  onCancelAction: (action: VelliqoAIActionRequest) => void;
  onChangeAction: (action: VelliqoAIActionRequest) => void;
}) {
  const { t } = useTranslation();
  const response = message.metadata?.response;
  const pendingAction = message.metadata?.pending_action;
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-3xl rounded-tl-lg border bg-background p-4 text-sm leading-7 sm:p-5">
          <div className="whitespace-pre-wrap">{message.content}</div>

          {pendingAction ? (
            <AIActionConfirmationCard
              action={pendingAction}
              busy={actionBusyId === pendingAction.id}
              onExecute={() => onExecuteAction(pendingAction)}
              onCancel={() => onCancelAction(pendingAction)}
              onChange={() => onChangeAction(pendingAction)}
            />
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-1">
          <span className="text-[11px] text-muted-foreground">
            {formatDate(message.created_at, language)}
          </span>

          {response?.suggested_actions?.slice(0, 4).map((action) => (
            <Link
              key={`${action.type}-${action.title}`}
              to={action.destinationPath}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              {action.title}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>

        {response?.follow_up_questions?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {response.follow_up_questions.slice(0, 3).map((question) => (
              <button
                type="button"
                key={question}
                onClick={() => onAskQuestion(question, message.metadata?.agent)}
                className="rounded-full px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AIActionConfirmationCard({
  action,
  busy,
  onExecute,
  onCancel,
  onChange,
}: {
  action: VelliqoAIActionRequest;
  busy: boolean;
  onExecute: () => void;
  onCancel: () => void;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const isPending = action.status === 'pending';
  const isExecuted = action.status === 'executed';
  const isRejected = action.status === 'rejected';
  const isFailed = action.status === 'failed';
  const ActionIcon = actionIcon(action.action_type);

  const stateClasses = isExecuted
    ? 'border-emerald-200 bg-emerald-50/80'
    : isRejected
      ? 'border-slate-200 bg-slate-50'
      : isFailed
        ? 'border-red-200 bg-red-50/70'
        : 'border-violet-200 bg-violet-50/70';

  return (
    <div className={`mt-5 overflow-hidden rounded-2xl border ${stateClasses}`}>
      <div className="flex items-start justify-between gap-3 border-b border-current/10 px-4 py-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-violet-700 shadow-sm">
            <ActionIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
              {isPending ? t('ai.manager.actions.prepared') : t(`ai.manager.actions.status.${action.status}`)}
            </div>
            <div className="mt-0.5 font-bold text-foreground">
              {action.title || t(`ai.manager.actions.types.${action.action_type}`)}
            </div>
            {action.summary ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.summary}</p> : null}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 bg-white/70">
          {t(`ai.manager.actions.status.${action.status}`)}
        </Badge>
      </div>

      {action.preview?.items?.length ? (
        <dl className="grid gap-x-5 gap-y-3 px-4 py-4 sm:grid-cols-2">
          {action.preview.items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {action.preview?.warning ? (
        <div className="mx-4 mb-3 flex gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
          {action.preview.warning}
        </div>
      ) : null}

      {isPending ? (
        <div className="border-t border-current/10 bg-white/45 px-4 py-3">
          <div className="mb-3 flex gap-2 text-xs leading-5 text-muted-foreground">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('ai.manager.actions.reviewNotice')} {t('ai.manager.actions.expiresSoon')}</span>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" size="sm" onClick={onExecute} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-3.5 w-3.5" />}
              {busy ? t('ai.manager.actions.executing') : t('ai.manager.actions.confirm')}
            </Button>
            <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={onChange} disabled={busy}>
              <Pencil className="mr-2 h-3.5 w-3.5" />{t('ai.manager.actions.change')}
            </Button>
            <Button className="w-full sm:w-auto" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              <XCircle className="mr-2 h-3.5 w-3.5" />{t('ai.manager.actions.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-current/10 bg-white/45 px-4 py-3 text-xs font-semibold">
          {isExecuted ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
          {isRejected ? <XCircle className="h-4 w-4 text-slate-500" /> : null}
          {isFailed ? <AlertTriangle className="h-4 w-4 text-red-600" /> : null}
          {isExecuted ? t('ai.manager.actions.executed') : isRejected ? t('ai.manager.actions.rejected') : t('ai.manager.actions.failed')}
          {action.error_message ? <span className="font-normal text-muted-foreground">— {action.error_message}</span> : null}
        </div>
      )}
    </div>
  );
}

function actionIcon(actionType: VelliqoAIActionType) {
  if (actionType === 'create_customer') return UserPlus;
  if (actionType === 'create_appointment' || actionType === 'reschedule_appointment' || actionType === 'cancel_appointment') return CalendarDays;
  if (actionType === 'create_campaign_draft') return Megaphone;
  if (actionType === 'create_post_draft') return FilePenLine;
  return Bot;
}

function formatAgentName(agent: AIAgentKey) {
  return agent
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCurrency(value: unknown, currency: string, language: string) {
  const numeric = Number(value || 0);
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string, language: string) {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}
