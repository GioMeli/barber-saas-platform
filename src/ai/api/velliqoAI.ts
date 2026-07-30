import { supabase } from '@/db/supabase';
import type {
  AIAgentKey,
  AILanguage,
  VelliqoAIActionExecutionResult,
  VelliqoAIBusinessSnapshot,
  VelliqoAIFunctionResult,
  VelliqoAIManagerAlert,
  VelliqoAIManagerAlertStatus,
  VelliqoAIManagerBriefing,
  VelliqoAIProactiveRefreshResult,
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

export async function executeVelliqoAIAction(input: {
  businessId: string;
  actionId: string;
}): Promise<VelliqoAIActionExecutionResult> {
  const { data, error } = await (supabase as any).rpc('execute_ai_action_request', {
    p_business_id: input.businessId,
    p_action_id: input.actionId,
  });

  if (error) throw new Error(error.message || 'Failed to execute the Velliqo AI action');
  return data as VelliqoAIActionExecutionResult;
}

export async function rejectVelliqoAIAction(input: {
  businessId: string;
  actionId: string;
}): Promise<VelliqoAIActionExecutionResult> {
  const { data, error } = await (supabase as any).rpc('reject_ai_action_request', {
    p_business_id: input.businessId,
    p_action_id: input.actionId,
  });

  if (error) throw new Error(error.message || 'Failed to cancel the Velliqo AI action');
  return data as VelliqoAIActionExecutionResult;
}


export async function loadLatestAIManagerBriefing(
  businessId: string,
  language: AILanguage,
): Promise<VelliqoAIManagerBriefing | null> {
  const { data, error } = await supabase
    .from('ai_manager_briefings')
    .select('*')
    .eq('business_id', businessId)
    .eq('language', language)
    .order('briefing_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to load the Velliqo AI manager briefing');
  return (data as VelliqoAIManagerBriefing | null) || null;
}

export async function loadAIManagerAlerts(
  businessId: string,
  language: AILanguage,
): Promise<VelliqoAIManagerAlert[]> {
  const { data, error } = await supabase
    .from('ai_manager_alerts')
    .select('*')
    .eq('business_id', businessId)
    .eq('language', language)
    .in('status', ['new', 'reviewed'])
    .order('last_seen_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message || 'Failed to load proactive Velliqo alerts');
  return (data || []) as VelliqoAIManagerAlert[];
}

export async function refreshAIManagerBriefing(
  businessId: string,
  language: AILanguage,
): Promise<VelliqoAIProactiveRefreshResult> {
  const { data, error } = await supabase.functions.invoke('process-ai-manager-automations', {
    body: { businessId, force: true, source: 'owner_refresh', language },
  });

  if (error) {
    const context = (error as any)?.context;
    let message = error.message || 'Failed to refresh the Velliqo AI manager briefing';
    try {
      if (context instanceof Response) {
        const payload = await context.clone().json();
        message = payload?.error || message;
      }
    } catch {
      // Preserve the function invocation error.
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data as VelliqoAIProactiveRefreshResult;
}

export async function updateAIManagerAlertStatus(input: {
  businessId: string;
  alertId: string;
  status: VelliqoAIManagerAlertStatus;
}): Promise<void> {
  const { error } = await supabase
    .from('ai_manager_alerts')
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq('business_id', input.businessId)
    .eq('id', input.alertId);

  if (error) throw new Error(error.message || 'Failed to update the Velliqo AI alert');
}
