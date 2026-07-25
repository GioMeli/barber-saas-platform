import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import {
  askVelliqoAI,
  loadVelliqoAISnapshot,
  type AIAgentKey,
  type AILanguage,
  type VelliqoAIBusinessSnapshot,
  type VelliqoAIConversation,
  type VelliqoAIMessage,
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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [sending, setSending] = useState(false);
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
      .order('updated_at', { ascending: false })
      .limit(20);

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setConversations((data || []) as VelliqoAIConversation[]);
  }, [businessId]);

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
    void refreshConversations();
    void refreshSnapshot();
  }, [refreshConversations, refreshSnapshot]);

  return {
    conversations,
    activeConversationId,
    messages,
    snapshot,
    loadingHistory,
    loadingSnapshot,
    sending,
    error,
    refreshConversations,
    refreshSnapshot,
    openConversation,
    startNewConversation,
    sendMessage,
    deleteConversation,
  };
}
