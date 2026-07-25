import { supabase } from '@/db/supabase';
import type {
  AIAgentKey,
  AILanguage,
  VelliqoAIBusinessSnapshot,
  VelliqoAIFunctionResult,
} from '@/ai/core/types';

export async function askVelliqoAI(input: {
  businessId: string;
  agent: AIAgentKey;
  message: string;
  conversationId?: string | null;
  language: AILanguage;
  page?: string;
  periodDays?: number;
}): Promise<VelliqoAIFunctionResult> {
  const { data, error } = await supabase.functions.invoke('velliqo-ai-manager', {
    body: input,
  });

  if (error) {
    const context = (error as any)?.context;
    let message = error.message || 'Velliqo AI request failed';
    try {
      if (context instanceof Response) {
        const payload = await context.clone().json();
        message = payload?.error || message;
      }
    } catch {
      // Keep the original function error message.
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data as VelliqoAIFunctionResult;
}

export async function loadVelliqoAISnapshot(
  businessId: string,
  periodDays = 30,
): Promise<VelliqoAIBusinessSnapshot> {
  const { data, error } = await (supabase as any).rpc('get_ai_business_snapshot', {
    p_business_id: businessId,
    p_days: periodDays,
  });

  if (error) throw new Error(error.message || 'Failed to load Velliqo AI business snapshot');
  return data as VelliqoAIBusinessSnapshot;
}
