import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FilePenLine,
  Gauge,
  Lightbulb,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVelliqoAI } from '@/hooks/useVelliqoAI';
import {
  AI_AGENT_REGISTRY,
  normalizeLanguage,
  type AIAgentKey,
  type VelliqoAIActionRequest,
  type VelliqoAIActionType,
  type VelliqoAIMessage,
} from '@/ai';
import { VelliqoVoiceAssistant } from '@/components/ai/VelliqoVoiceAssistant';
import { VelliqoActionConfirmationDialog } from '@/components/ai/VelliqoActionConfirmationDialog';

const QUICK_PROMPTS: Array<{ key: string; agent: AIAgentKey }> = [
  { key: 'dailyBriefing', agent: 'business_coach' },
  { key: 'revenueChanges', agent: 'financial_analyst' },
  { key: 'retentionOpportunities', agent: 'customer_success' },
  { key: 'scheduleOpportunities', agent: 'scheduling_assistant' },
];

type OwnerAIAssistantDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: string | null;
};

export default function OwnerAIAssistantDrawer({
  open,
  onOpenChange,
  businessId,
}: OwnerAIAssistantDrawerProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [agent, setAgent] = React.useState<AIAgentKey>('business_coach');
  const [draft, setDraft] = React.useState('');
  const [confirmationAction, setConfirmationAction] = React.useState<VelliqoAIActionRequest | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  const ai = useVelliqoAI({
    businessId: businessId || undefined,
    language,
    page: location.pathname,
  });

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      document.getElementById('velliqo-ai-drawer-composer')?.focus();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ai.messages, ai.sending, open]);

  const send = async (message = draft, selectedAgent = agent) => {
    const cleanMessage = message.trim();
    if (!cleanMessage || ai.sending) return;
    setAgent(selectedAgent);
    setDraft('');
    const result = await ai.sendMessage({ agent: selectedAgent, message: cleanMessage });
    if (result?.pendingAction) setConfirmationAction(result.pendingAction);
    if (!result && cleanMessage === draft.trim()) setDraft(cleanMessage);
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
    window.setTimeout(() => document.getElementById('velliqo-ai-drawer-composer')?.focus(), 0);
    return result;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="hidden h-[100dvh] w-[min(96vw,760px)] max-w-[760px] overflow-hidden border-l border-violet-300/20 p-0 lg:flex lg:flex-col 2xl:w-[min(58vw,860px)] 2xl:max-w-[860px]"
          data-tour="ai-drawer"
        >
          <SheetHeader className="relative shrink-0 overflow-hidden border-b border-white/10 bg-[#111027] px-5 py-5 text-left text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(139,92,246,.38),transparent_44%),radial-gradient(circle_at_100%_100%,rgba(236,72,153,.16),transparent_40%)]" />
            <div className="relative flex items-start gap-3 pr-8">
              <img
                src="/brand/velliqo-ai.png"
                alt="Velliqo AI"
                className="h-12 w-12 shrink-0 rounded-2xl object-cover mix-blend-screen drop-shadow-[0_0_18px_rgba(168,85,247,.55)]"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-200">Velliqo AI</div>
                <SheetTitle className="mt-1 text-xl font-extrabold text-white">
                  {t('ownerExperience.aiDrawer.title')}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs leading-5 text-white/62">
                  {t('ownerExperience.aiDrawer.description')}
                </SheetDescription>
              </div>
            </div>

            <div className="relative mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={ai.startNewConversation}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('ai.manager.newConversation')}
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-white text-slate-950 hover:bg-white/90"
                onClick={() => onOpenChange(false)}
              >
                <Link to="/dashboard/ai">
                  <Gauge className="mr-1.5 h-3.5 w-3.5" />
                  {t('ownerExperience.aiDrawer.openWorkspace')}
                </Link>
              </Button>
            </div>
          </SheetHeader>

          <div className="shrink-0 border-b bg-background px-4 py-3">
            <Select value={agent} onValueChange={(value: AIAgentKey) => setAgent(value)}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AI_AGENT_REGISTRY).map((definition) => (
                  <SelectItem key={definition.key} value={definition.key}>
                    {t(definition.nameKey, { defaultValue: formatAgentName(definition.key) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="min-h-0 flex-1 bg-muted/10 px-4 py-5">
            {ai.error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{ai.error}</AlertDescription>
              </Alert>
            ) : null}

            {ai.loadingHistory ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-4/5 rounded-2xl" />
                <Skeleton className="ml-auto h-16 w-3/4 rounded-2xl" />
              </div>
            ) : ai.messages.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-700">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-lg font-extrabold">{t('ai.manager.emptyTitle')}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {t('ownerExperience.aiDrawer.emptyDescription')}
                </p>
                <div className="mt-5 grid w-full gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      type="button"
                      key={prompt.key}
                      onClick={() => void send(t(`ai.manager.prompts.${prompt.key}`), prompt.agent)}
                      className="rounded-2xl border bg-background p-3 text-left text-sm font-semibold transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <Lightbulb className="mb-1.5 h-4 w-4 text-primary" />
                      {t(`ai.manager.prompts.${prompt.key}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {ai.messages.map((message) => (
                  <DrawerMessageBubble
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
                {ai.sending ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    {t('ai.manager.thinking')}
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            )}
          </ScrollArea>

          <div className="shrink-0 border-t bg-background p-4">
            <div className="rounded-2xl border bg-muted/10 p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
              <Textarea
                id="velliqo-ai-drawer-composer"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={t('ai.manager.placeholder')}
                className="min-h-[76px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                maxLength={4000}
                disabled={ai.sending}
              />
              <div className="flex items-end justify-between gap-3 px-2 pb-1">
                <div className="flex min-w-0 items-start gap-1.5 text-[10px] leading-4 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t('ai.manager.aggregateDataNotice')}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <VelliqoVoiceAssistant
                    businessId={businessId || undefined}
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
                  <Button
                    type="button"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    onClick={() => void send()}
                    disabled={!draft.trim() || ai.sending}
                    aria-label={t('ai.manager.send')}
                  >
                    {ai.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <VelliqoActionConfirmationDialog
        open={Boolean(confirmationAction)}
        action={confirmationAction}
        busy={Boolean(confirmationAction && ai.actionBusyId === confirmationAction.id)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmationAction(null);
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
    </>
  );
}

function DrawerMessageBubble({
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
  const response = message.metadata?.response;
  const pendingAction = message.metadata?.pending_action;
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">
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
        <div className="rounded-3xl rounded-tl-lg border bg-background p-4 text-sm leading-7">
          <div className="whitespace-pre-wrap">{message.content}</div>
          {pendingAction ? (
            <DrawerActionCard
              action={pendingAction}
              busy={actionBusyId === pendingAction.id}
              onExecute={() => onExecuteAction(pendingAction)}
              onCancel={() => onCancelAction(pendingAction)}
              onChange={() => onChangeAction(pendingAction)}
            />
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-1">
          <span className="text-[10px] text-muted-foreground">{formatDate(message.created_at, language)}</span>
          {response?.suggested_actions?.slice(0, 3).map((action) => (
            <Link
              key={`${action.type}-${action.title}`}
              to={action.destinationPath}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              {action.title}
              <ChevronRight className="h-3 w-3" />
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
                className="rounded-full bg-muted/60 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
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

function DrawerActionCard({
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

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/70">
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
          <ActionIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
            {isPending ? t('ai.manager.actions.prepared') : t(`ai.manager.actions.status.${action.status}`)}
          </div>
          <div className="mt-0.5 font-bold text-foreground">
            {action.title || t(`ai.manager.actions.types.${action.action_type}`)}
          </div>
          {action.summary ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.summary}</p> : null}
        </div>
      </div>

      {action.preview?.items?.length ? (
        <dl className="grid gap-2 border-t border-violet-200/60 px-3 py-3">
          {action.preview.items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 break-words text-xs font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {isPending ? (
        <div className="border-t border-violet-200/60 bg-white/55 px-3 py-3">
          <div className="mb-2 flex gap-2 text-[11px] leading-5 text-muted-foreground">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('ai.manager.actions.reviewNotice')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" onClick={onExecute} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span className="sr-only">{t('ai.manager.actions.confirm')}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={onChange} disabled={busy}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">{t('ai.manager.actions.change')}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              <XCircle className="h-3.5 w-3.5" />
              <span className="sr-only">{t('ai.manager.actions.cancel')}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-violet-200/60 bg-white/55 px-3 py-3 text-xs font-semibold">
          {isExecuted ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
          {isRejected ? <XCircle className="h-4 w-4 text-slate-500" /> : null}
          {isFailed ? <AlertTriangle className="h-4 w-4 text-red-600" /> : null}
          {isExecuted ? t('ai.manager.actions.executed') : isRejected ? t('ai.manager.actions.rejected') : t('ai.manager.actions.failed')}
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

function formatDate(value: string, language: string) {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}
