import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  History,
  Lightbulb,
  Loader2,
  MessageSquareText,
  PackageSearch,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVelliqoAI } from '@/hooks/useVelliqoAI';
import { AI_AGENT_REGISTRY, normalizeLanguage, type AIAgentKey, type VelliqoAIMessage } from '@/ai';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

const QUICK_PROMPTS: Array<{ key: string; agent: AIAgentKey }> = [
  { key: 'dailyBriefing', agent: 'business_coach' },
  { key: 'revenueChanges', agent: 'financial_analyst' },
  { key: 'retentionOpportunities', agent: 'customer_success' },
  { key: 'scheduleOpportunities', agent: 'scheduling_assistant' },
];

export default function AIHub() {
  const { t, i18n } = useTranslation();
  const { activeBusiness, profile } = useAuth();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [agent, setAgent] = React.useState<AIAgentKey>('business_coach');
  const [draft, setDraft] = React.useState('');
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

  const send = async (message = draft, selectedAgent = agent) => {
    const cleanMessage = message.trim();
    if (!cleanMessage || ai.sending) return;
    setAgent(selectedAgent);
    setDraft('');
    const result = await ai.sendMessage({ agent: selectedAgent, message: cleanMessage });
    if (!result && cleanMessage === draft.trim()) setDraft(cleanMessage);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
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
    <div className="app-page pb-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[#111027] p-6 text-white shadow-2xl sm:p-8 lg:p-10">
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
            <div className="mt-6 flex flex-wrap gap-3">
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
          <div className="mx-auto w-full max-w-[235px]">
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
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

            <ScrollArea className="mt-4 h-[280px] pr-3 xl:h-[560px]">
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

        <Card className="overflow-hidden rounded-3xl shadow-card">
          <CardContent className="p-0">
            <div className="border-b bg-muted/15 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <Bot className="h-5 w-5" />
                  </div>
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

            <ScrollArea className="h-[430px] px-4 py-5 sm:px-6">
              {ai.loadingHistory ? (
                <div className="space-y-4"><Skeleton className="h-20 w-3/4 rounded-2xl" /><Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" /></div>
              ) : ai.messages.length === 0 ? (
                <div className="mx-auto flex min-h-[360px] max-w-2xl flex-col items-center justify-center text-center">
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
                      onAskQuestion={(question, messageAgent) => void send(question, messageAgent || agent)}
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
                <div className="flex items-center justify-between gap-3 px-2 pb-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />{t('ai.manager.aggregateDataNotice')}
                  </div>
                  <Button onClick={() => void send()} disabled={!draft.trim() || ai.sending}>
                    {ai.sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {t('ai.manager.send')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function AIMessageBubble({
  message,
  language,
  onAskQuestion,
}: {
  message: VelliqoAIMessage;
  language: string;
  onAskQuestion: (question: string, agent?: AIAgentKey) => void;
}) {
  const response = message.metadata?.response;
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
