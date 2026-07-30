import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import {
  askVelliqoAI,
  executeVelliqoAIAction,
  loadAIManagerAlerts,
  loadLatestAIManagerBriefing,
  loadVelliqoAISnapshot,
  refreshAIManagerBriefing,
  rejectVelliqoAIAction,
  updateAIManagerAlertStatus,
  type AIAgentKey,
  type AILanguage,
  type VelliqoAIActionExecutionResult,
  type VelliqoAIBusinessSnapshot,
  type VelliqoAIConversation,
  type VelliqoAIMessage,
  type VelliqoAIManagerAlert,
  type VelliqoAIManagerAlertStatus,
  type VelliqoAIManagerBriefing,
  type VelliqoAIProactiveRefreshResult,
} from '@/ai';

export function useVelliqoAI(input: {
  businessId?: string;
  language: AILanguage;
  page?: string;
}) {
  const { businessId, language, page } = input;
  const [conversations, setConversations] = useState<VelliqoAIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VelliqoAIMessage[]>([]);
  const [snapshot, setSnapshot] = useState<VelliqoAIBusinessSnapshot | null>(null);
  const [briefing, setBriefing] = useState<VelliqoAIManagerBriefing | null>(null);
  const [alerts, setAlerts] = useState<VelliqoAIManagerAlert[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingProactive, setLoadingProactive] = useState(false);
  const [refreshingBriefing, setRefreshingBriefing] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!businessId) {
      setConversations([]);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('business_id', businessId)
      .eq('language', language)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setConversations((data || []) as VelliqoAIConversation[]);
  }, [businessId, language]);

  const refreshSnapshot = useCallback(async (periodDays = 30) => {
    if (!businessId) {
      setSnapshot(null);
      return;
    }

    setLoadingSnapshot(true);
    try {
      setSnapshot(await loadVelliqoAISnapshot(businessId, periodDays));
      setError(null);
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : String(snapshotError));
    } finally {
      setLoadingSnapshot(false);
    }
  }, [businessId]);

  const refreshProactive = useCallback(async (ensureSelectedLanguage = true) => {
    if (!businessId) {
      setBriefing(null);
      setAlerts([]);
      return;
    }

    setLoadingProactive(true);
    try {
      let [latestBriefing, activeAlerts] = await Promise.all([
        loadLatestAIManagerBriefing(businessId, language),
        loadAIManagerAlerts(businessId, language),
      ]);

      if (!latestBriefing && ensureSelectedLanguage) {
        await refreshAIManagerBriefing(businessId, language);
        [latestBriefing, activeAlerts] = await Promise.all([
          loadLatestAIManagerBriefing(businessId, language),
          loadAIManagerAlerts(businessId, language),
        ]);
      }

      setBriefing(latestBriefing);
      setAlerts(activeAlerts);
      setError(null);
    } catch (proactiveError) {
      setError(proactiveError instanceof Error ? proactiveError.message : String(proactiveError));
    } finally {
      setLoadingProactive(false);
    }
  }, [businessId, language]);

  const generateBriefing = useCallback(async (): Promise<VelliqoAIProactiveRefreshResult | null> => {
    if (!businessId || refreshingBriefing) return null;

    setRefreshingBriefing(true);
    setError(null);
    try {
      const result = await refreshAIManagerBriefing(businessId, language);
      await refreshProactive(false);
      return result;
    } catch (briefingError) {
      setError(briefingError instanceof Error ? briefingError.message : String(briefingError));
      return null;
    } finally {
      setRefreshingBriefing(false);
    }
  }, [businessId, language, refreshProactive, refreshingBriefing]);

  const setAlertStatus = useCallback(async (
    alertId: string,
    status: VelliqoAIManagerAlertStatus,
  ) => {
    if (!businessId) return false;
    try {
      await updateAIManagerAlertStatus({ businessId, alertId, status });
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      setError(null);
      return true;
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : String(alertError));
      return false;
    }
  }, [businessId]);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setLoadingHistory(true);
    try {
      const { data, error: queryError } = await supabase
        .from('ai_messages')
        .select('id, conversation_id, role, content, model, metadata, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setMessages((data || []) as VelliqoAIMessage[]);
      setError(null);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : String(historyError));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (payload: {
    agent: AIAgentKey;
    message: string;
    periodDays?: number;
  }) => {
    if (!businessId || sending) return null;

    const optimisticMessage: VelliqoAIMessage = {
      id: `local-${Date.now()}`,
      conversation_id: activeConversationId || 'pending',
      role: 'user',
      content: payload.message,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    setSending(true);
    setError(null);

    try {
      const result = await askVelliqoAI({
        businessId,
        agent: payload.agent,
        message: payload.message,
        conversationId: activeConversationId,
        language,
        page,
        periodDays: payload.periodDays || 30,
      });

      const assistantMessage: VelliqoAIMessage = {
        id: result.messageId,
        conversation_id: result.conversationId,
        role: 'assistant',
        content: result.response.answer,
        model: result.model,
        metadata: {
          response: result.response,
          read_only: result.readOnly,
          agent: payload.agent,
          provider: result.provider,
          external_ai: result.provider === 'openai',
          estimated_cost: result.estimatedCost,
          pending_action: result.pendingAction || null,
        },
        created_at: result.createdAt,
      };

      setActiveConversationId(result.conversationId);
      setMessages((current) => [...current, assistantMessage]);
      await refreshConversations();
      return result;
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimisticMessage.id));
      setError(sendError instanceof Error ? sendError.message : String(sendError));
      return null;
    } finally {
      setSending(false);
    }
  }, [activeConversationId, businessId, language, page, refreshConversations, sending]);


  const updateActionInMessages = useCallback((
    actionId: string,
    patch: Record<string, unknown>,
  ) => {
    setMessages((current) => current.map((message) => {
      const pendingAction = message.metadata?.pending_action;
      if (!pendingAction || pendingAction.id !== actionId) return message;

      return {
        ...message,
        metadata: {
          ...message.metadata,
          pending_action: {
            ...pendingAction,
            ...patch,
          },
        },
      };
    }));
  }, []);

  const executeAction = useCallback(async (
    actionId: string,
  ): Promise<VelliqoAIActionExecutionResult | null> => {
    if (!businessId || actionBusyId) return null;

    setActionBusyId(actionId);
    setError(null);
    try {
      const result = await executeVelliqoAIAction({ businessId, actionId });
      updateActionInMessages(actionId, {
        status: result.status,
        execution_result: result.result || null,
        error_message: result.error || null,
      });
      if (result.success) await refreshSnapshot();
      else setError(result.error || 'The Velliqo AI action failed');
      return result;
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : String(actionError);
      updateActionInMessages(actionId, { status: 'failed', error_message: message });
      setError(message);
      return null;
    } finally {
      setActionBusyId(null);
    }
  }, [actionBusyId, businessId, refreshSnapshot, updateActionInMessages]);

  const rejectAction = useCallback(async (
    actionId: string,
  ): Promise<VelliqoAIActionExecutionResult | null> => {
    if (!businessId || actionBusyId) return null;

    setActionBusyId(actionId);
    setError(null);
    try {
      const result = await rejectVelliqoAIAction({ businessId, actionId });
      updateActionInMessages(actionId, { status: result.status, error_message: null });
      return result;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
      return null;
    } finally {
      setActionBusyId(null);
    }
  }, [actionBusyId, businessId, updateActionInMessages]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    const { error: deleteError } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    if (activeConversationId === conversationId) startNewConversation();
    await refreshConversations();
    return true;
  }, [activeConversationId, refreshConversations, startNewConversation]);

  useEffect(() => {
    startNewConversation();
  }, [language, startNewConversation]);

  useEffect(() => {
    void refreshConversations();
    void refreshSnapshot();
    void refreshProactive(true);
  }, [refreshConversations, refreshProactive, refreshSnapshot]);

  return {
    conversations,
    activeConversationId,
    messages,
    snapshot,
    briefing,
    alerts,
    loadingHistory,
    loadingSnapshot,
    loadingProactive,
    refreshingBriefing,
    sending,
    actionBusyId,
    error,
    refreshConversations,
    refreshSnapshot,
    refreshProactive,
    generateBriefing,
    setAlertStatus,
    openConversation,
    startNewConversation,
    sendMessage,
    executeAction,
    rejectAction,
    deleteConversation,
  };
}
