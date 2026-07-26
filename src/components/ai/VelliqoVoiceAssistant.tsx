import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleStop,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  PauseCircle,
  Play,
  Settings,
  ShieldCheck,
  Volume2,
  Waves,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  finishAIVoiceSession,
  loadAIVoiceSettings,
  logAIVoiceEvent,
  startAIVoiceSession,
  type AIAgentKey,
  type AILanguage,
  type AIVoiceSettings,
  type VelliqoAIActionExecutionResult,
  type VelliqoAIActionRequest,
  type VelliqoAIFunctionResult,
} from '@/ai';
import { useBrowserVoice } from '@/hooks/useBrowserVoice';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const DEFAULT_SETTINGS: AIVoiceSettings = {
  voice_enabled: false,
  voice_auto_play: true,
  voice_continuous_mode: true,
  voice_allow_low_risk_confirmation: false,
  voice_rate: 1,
  voice_pitch: 1,
};

type VoiceStage = 'idle' | 'listening' | 'thinking' | 'speaking' | 'confirming' | 'error';
type ConfirmationIntent = 'confirm' | 'reject' | 'unknown';

export function VelliqoVoiceAssistant({
  businessId,
  conversationId,
  language,
  agent,
  sending,
  actionBusyId,
  onSendMessage,
  onExecuteAction,
  onRejectAction,
}: {
  businessId?: string;
  conversationId?: string | null;
  language: AILanguage;
  agent: AIAgentKey;
  sending: boolean;
  actionBusyId: string | null;
  onSendMessage: (message: string, agent: AIAgentKey) => Promise<VelliqoAIFunctionResult | null>;
  onExecuteAction: (action: VelliqoAIActionRequest) => Promise<VelliqoAIActionExecutionResult | null>;
  onRejectAction: (action: VelliqoAIActionRequest) => Promise<VelliqoAIActionExecutionResult | null>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<AIVoiceSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = React.useState(false);
  const [settingsUnavailable, setSettingsUnavailable] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<VoiceStage>('idle');
  const [transcript, setTranscript] = React.useState('');
  const [assistantText, setAssistantText] = React.useState('');
  const [pendingAction, setPendingAction] = React.useState<VelliqoAIActionRequest | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);
  const openRef = React.useRef(false);
  const finalTranscriptHandlerRef = React.useRef<(value: string) => void>(() => undefined);

  const voice = useBrowserVoice({
    language,
    rate: settings.voice_rate,
    pitch: settings.voice_pitch,
    onFinalTranscript: (value) => finalTranscriptHandlerRef.current(value),
    onError: (message) => {
      setStage('error');
      toast.error(message);
      void safeLog('error', { reason: message.slice(0, 160) });
    },
  });

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (!open || !businessId) return;
    setLoadingSettings(true);
    setSettingsUnavailable(false);
    void loadAIVoiceSettings(businessId)
      .then(setSettings)
      .catch((error) => {
        console.warn('Velliqo Voice settings are unavailable', error);
        setSettingsUnavailable(true);
      })
      .finally(() => setLoadingSettings(false));
  }, [businessId, open]);

  const safeLog = React.useCallback(async (
    eventType: Parameters<typeof logAIVoiceEvent>[0]['eventType'],
    metadata?: Record<string, unknown>,
    links?: {
      conversationId?: string | null;
      messageId?: string | null;
      actionRequestId?: string | null;
    },
  ) => {
    const activeSessionId = sessionIdRef.current;
    if (!businessId || !activeSessionId) return;
    try {
      await logAIVoiceEvent({
        businessId,
        sessionId: activeSessionId,
        eventType,
        conversationId: links?.conversationId || conversationId || null,
        messageId: links?.messageId || null,
        actionRequestId: links?.actionRequestId || null,
        metadata,
      });
    } catch (auditError) {
      console.warn('Unable to record Velliqo Voice audit event', auditError);
    }
  }, [businessId, conversationId]);

  const beginListening = React.useCallback(async () => {
    if (!sessionIdRef.current || sending || actionBusyId) return;
    setStage(pendingAction ? 'confirming' : 'listening');
    setTranscript('');
    voice.clearTranscript();
    await safeLog('input_started', { awaiting_confirmation: Boolean(pendingAction) });
    const started = await voice.startListening();
    if (!started) setStage('error');
  }, [actionBusyId, pendingAction, safeLog, sending, voice]);

  const speakText = React.useCallback((text: string, options?: {
    confirmation?: boolean;
    resume?: boolean;
  }) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    setStage(options?.confirmation ? 'confirming' : 'speaking');
    void safeLog('speech_started', {
      character_count: cleanText.length,
      confirmation: Boolean(options?.confirmation),
    });
    voice.speak(cleanText, () => {
      void safeLog('speech_completed', {
        character_count: cleanText.length,
        confirmation: Boolean(options?.confirmation),
      });
      if (options?.resume !== false && settings.voice_continuous_mode && openRef.current) {
        window.setTimeout(() => void beginListening(), 250);
      } else {
        setStage(options?.confirmation ? 'confirming' : 'idle');
      }
    });
  }, [beginListening, safeLog, settings.voice_continuous_mode, voice]);

  const speakActionResult = React.useCallback((result: VelliqoAIActionExecutionResult | null, successKey: string) => {
    if (result?.success) {
      const message = t(successKey);
      setAssistantText(message);
      setPendingAction(null);
      speakText(message);
      return;
    }
    const message = result?.error || t('ai.voice.actionFailed');
    setAssistantText(message);
    speakText(message);
  }, [speakText, t]);

  const handleConfirmation = React.useCallback(async (
    action: VelliqoAIActionRequest,
    intent: ConfirmationIntent,
  ) => {
    if (intent === 'reject') {
      await safeLog('confirmation_rejected', { risk_level: action.risk_level }, { actionRequestId: action.id });
      const result = await onRejectAction(action);
      speakActionResult(result, 'ai.voice.actionCancelled');
      return;
    }

    if (intent === 'confirm') {
      if (action.risk_level !== 'low' || !settings.voice_allow_low_risk_confirmation) {
        await safeLog('confirmation_blocked', {
          risk_level: action.risk_level,
          reason: action.risk_level === 'low' ? 'setting_disabled' : 'risk_boundary',
        }, { actionRequestId: action.id });
        const message = t('ai.voice.useVisibleConfirmation');
        setAssistantText(message);
        speakText(message, { confirmation: true, resume: false });
        return;
      }

      await safeLog('confirmation_accepted', { risk_level: action.risk_level }, { actionRequestId: action.id });
      const result = await onExecuteAction(action);
      speakActionResult(result, 'ai.voice.actionCompleted');
      return;
    }

    const message = t('ai.voice.confirmationNotUnderstood');
    setAssistantText(message);
    speakText(message, { confirmation: true });
  }, [onExecuteAction, onRejectAction, safeLog, settings.voice_allow_low_risk_confirmation, speakActionResult, speakText, t]);

  const processTranscript = React.useCallback(async (rawTranscript: string) => {
    const cleanTranscript = rawTranscript.trim();
    if (!cleanTranscript || !sessionIdRef.current) return;

    setTranscript(cleanTranscript);
    await safeLog('input_final', {
      character_count: cleanTranscript.length,
      awaiting_confirmation: Boolean(pendingAction),
    }, pendingAction ? { actionRequestId: pendingAction.id } : undefined);

    if (pendingAction) {
      await handleConfirmation(pendingAction, classifyConfirmation(cleanTranscript, language));
      return;
    }

    setStage('thinking');
    await safeLog('request_sent', { agent });
    const result = await onSendMessage(cleanTranscript, agent);

    if (!result) {
      const message = t('ai.voice.requestFailed');
      setAssistantText(message);
      setStage('error');
      speakText(message, { resume: false });
      return;
    }

    const action = result.pendingAction || null;
    setPendingAction(action);
    setAssistantText(result.response.answer);
    await safeLog('response_received', {
      provider: result.provider,
      has_pending_action: Boolean(action),
      output_length: result.response.answer.length,
    }, {
      conversationId: result.conversationId,
      messageId: result.messageId,
      actionRequestId: action?.id || null,
    });

    let spokenText = result.response.answer;
    if (action) {
      await safeLog('confirmation_prompted', {
        risk_level: action.risk_level,
        action_type: action.action_type,
      }, {
        conversationId: result.conversationId,
        messageId: result.messageId,
        actionRequestId: action.id,
      });
      spokenText = `${spokenText} ${action.risk_level === 'low' && settings.voice_allow_low_risk_confirmation
        ? t('ai.voice.lowRiskConfirmationPrompt')
        : t('ai.voice.visibleConfirmationPrompt')}`;
    }

    if (settings.voice_auto_play) {
      speakText(spokenText, { confirmation: Boolean(action) });
    } else {
      setStage(action ? 'confirming' : 'idle');
    }
  }, [agent, handleConfirmation, language, onSendMessage, pendingAction, safeLog, settings.voice_allow_low_risk_confirmation, settings.voice_auto_play, speakText, t]);

  React.useEffect(() => {
    finalTranscriptHandlerRef.current = (value) => {
      void processTranscript(value);
    };
  }, [processTranscript]);

  const startSession = React.useCallback(async () => {
    if (!businessId || loadingSettings || settingsUnavailable || !settings.voice_enabled) return;
    const permissionGranted = await voice.requestPermission();
    if (!permissionGranted) return;

    try {
      const newSessionId = await startAIVoiceSession({
        businessId,
        language,
        conversationId,
      });
      sessionIdRef.current = newSessionId;
      setSessionId(newSessionId);
      setPendingAction(null);
      setAssistantText(t('ai.voice.readyMessage'));
      setTranscript('');
      setStage('idle');
      await beginListening();
    } catch (sessionError) {
      const message = sessionError instanceof Error ? sessionError.message : String(sessionError);
      setStage('error');
      toast.error(message);
    }
  }, [beginListening, businessId, conversationId, language, loadingSettings, settings.voice_enabled, settingsUnavailable, t, voice]);

  const endSession = React.useCallback(async (status: 'completed' | 'interrupted' | 'failed' = 'completed') => {
    voice.stopListening(true);
    voice.stopSpeaking();
    const activeSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    setPendingAction(null);
    setStage('idle');
    if (businessId && activeSessionId) {
      try {
        await finishAIVoiceSession({ businessId, sessionId: activeSessionId, status });
      } catch (finishError) {
        console.warn('Unable to finish Velliqo Voice session', finishError);
      }
    }
  }, [businessId, voice]);

  const interruptAndSpeak = React.useCallback(async () => {
    if (voice.speaking) {
      voice.stopSpeaking();
      await safeLog('speech_interrupted', { source: 'user_barge_in' });
    }
    await beginListening();
  }, [beginListening, safeLog, voice]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) void endSession('interrupted');
  };

  const busy = sending || Boolean(actionBusyId) || stage === 'thinking';
  const statusLabel = t(`ai.voice.status.${stage}`);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={t('ai.voice.open')} title={t('ai.voice.open')}>
          <Mic className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-50">
              <Waves className="mr-1.5 h-3.5 w-3.5" />{t('ai.voice.phaseBadge')}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />{t('ai.voice.samePermissions')}
            </Badge>
          </div>
          <DialogTitle className="flex items-center gap-2 pt-2 text-xl">
            <Headphones className="h-5 w-5 text-violet-600" />{t('ai.voice.title')}
          </DialogTitle>
          <DialogDescription>{t('ai.voice.description')}</DialogDescription>
        </DialogHeader>

        {loadingSettings ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : settingsUnavailable ? (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('ai.voice.unavailableTitle')}</AlertTitle>
            <AlertDescription>{t('ai.voice.unavailableDescription')}</AlertDescription>
          </Alert>
        ) : !settings.voice_enabled ? (
          <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-950">
            <MicOff className="h-4 w-4 text-amber-700" />
            <AlertTitle>{t('ai.voice.disabledTitle')}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{t('ai.voice.disabledDescription')}</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard/ai/settings"><Settings className="mr-2 h-4 w-4" />{t('ai.voice.openSettings')}</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : !voice.supported ? (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('ai.voice.unsupportedTitle')}</AlertTitle>
            <AlertDescription>{t('ai.voice.unsupportedDescription')}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border bg-gradient-to-br from-violet-50 via-background to-amber-50 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full shadow-sm ${voice.listening
                    ? 'bg-red-100 text-red-700 ring-8 ring-red-100/50'
                    : voice.speaking
                      ? 'bg-violet-100 text-violet-700 ring-8 ring-violet-100/50'
                      : 'bg-white text-violet-700 ring-8 ring-slate-100'}`}>
                    {stage === 'thinking' ? <Loader2 className="h-7 w-7 animate-spin" />
                      : voice.listening ? <Mic className="h-7 w-7" />
                        : voice.speaking ? <Volume2 className="h-7 w-7" />
                          : <Bot className="h-7 w-7" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{t('ai.voice.currentStatus')}</div>
                    <div className="mt-1 text-lg font-extrabold">{statusLabel}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {sessionId ? t('ai.voice.sessionActive') : t('ai.voice.sessionInactive')}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!sessionId ? (
                    <Button onClick={() => void startSession()} disabled={busy || !businessId}>
                      <Mic className="mr-2 h-4 w-4" />{t('ai.voice.start')}
                    </Button>
                  ) : voice.speaking ? (
                    <Button onClick={() => void interruptAndSpeak()}>
                      <PauseCircle className="mr-2 h-4 w-4" />{t('ai.voice.interrupt')}
                    </Button>
                  ) : voice.listening ? (
                    <Button variant="outline" onClick={() => voice.stopListening()}>
                      <CircleStop className="mr-2 h-4 w-4" />{t('ai.voice.stopListening')}
                    </Button>
                  ) : (
                    <Button onClick={() => void beginListening()} disabled={busy}>
                      <Mic className="mr-2 h-4 w-4" />{t('ai.voice.speakNow')}
                    </Button>
                  )}
                  {sessionId ? (
                    <Button variant="ghost" onClick={() => void endSession('completed')}>
                      <XCircle className="mr-2 h-4 w-4" />{t('ai.voice.end')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-h-36 rounded-2xl border p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
                  <Mic className="h-3.5 w-3.5" />{t('ai.voice.youSaid')}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {voice.interimTranscript || voice.finalTranscript || transcript || t('ai.voice.transcriptPlaceholder')}
                </p>
              </div>
              <div className="min-h-36 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />{t('ai.voice.velliqoSaid')}
                  </div>
                  {assistantText ? (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => speakText(assistantText, { confirmation: Boolean(pendingAction), resume: false })} aria-label={t('ai.voice.replay')}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {assistantText || t('ai.voice.responsePlaceholder')}
                </p>
              </div>
            </div>

            {pendingAction ? (
              <Alert className="rounded-2xl border-violet-200 bg-violet-50 text-violet-950">
                <ShieldCheck className="h-4 w-4 text-violet-700" />
                <AlertTitle className="flex flex-wrap items-center gap-2">
                  {t('ai.voice.pendingAction')}
                  <Badge variant="outline">{t(`ai.manager.actions.types.${pendingAction.action_type}`)}</Badge>
                  <Badge variant="outline">{t('ai.voice.risk', { value: pendingAction.risk_level })}</Badge>
                </AlertTitle>
                <AlertDescription>
                  {pendingAction.summary}
                  <div className="mt-2 text-xs font-medium">
                    {pendingAction.risk_level === 'low' && settings.voice_allow_low_risk_confirmation
                      ? t('ai.voice.sayYesOrNo')
                      : t('ai.voice.confirmInVisibleCard')}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {voice.permission === 'denied' || voice.error ? (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('ai.voice.microphoneErrorTitle')}</AlertTitle>
                <AlertDescription>{voice.error || t('ai.voice.microphoneDenied')}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {t('ai.voice.privacyNotice')}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function classifyConfirmation(transcript: string, language: AILanguage): ConfirmationIntent {
  const normalized = transcript
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words: Record<AILanguage, { confirm: string[]; reject: string[] }> = {
    en: { confirm: ['yes', 'confirm', 'approve', 'proceed', 'execute'], reject: ['no', 'cancel', 'reject', 'stop'] },
    el: { confirm: ['ναι', 'επιβεβαιωσε', 'εγκρινω', 'προχωρα', 'εκτελεσε'], reject: ['οχι', 'ακυρωσε', 'απορριψε', 'σταματα'] },
    de: { confirm: ['ja', 'bestatigen', 'genehmigen', 'ausfuhren', 'weiter'], reject: ['nein', 'abbrechen', 'ablehnen', 'stopp'] },
    es: { confirm: ['si', 'confirmar', 'aprobar', 'continuar', 'ejecutar'], reject: ['no', 'cancelar', 'rechazar', 'detener'] },
    tr: { confirm: ['evet', 'onayla', 'devam', 'uygula', 'calistir'], reject: ['hayir', 'iptal', 'reddet', 'dur'] },
  };

  if (words[language].confirm.some((word) => normalized === word || normalized.startsWith(`${word} `))) return 'confirm';
  if (words[language].reject.some((word) => normalized === word || normalized.startsWith(`${word} `))) return 'reject';
  return 'unknown';
}
