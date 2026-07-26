import { supabase } from '@/db/supabase';
import type { AILanguage } from '@/ai/core/types';
import type { AIVoiceEventType, AIVoiceSessionStatus, AIVoiceSettings } from './types';

const DEFAULT_VOICE_SETTINGS: AIVoiceSettings = {
  voice_enabled: false,
  voice_auto_play: true,
  voice_continuous_mode: true,
  voice_allow_low_risk_confirmation: false,
  voice_rate: 1,
  voice_pitch: 1,
};

export async function loadAIVoiceSettings(businessId: string): Promise<AIVoiceSettings> {
  const { data, error } = await supabase
    .from('ai_settings')
    .select('voice_enabled, voice_auto_play, voice_continuous_mode, voice_allow_low_risk_confirmation, voice_rate, voice_pitch')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to load Velliqo Voice settings');
  if (!data) return DEFAULT_VOICE_SETTINGS;

  return {
    voice_enabled: Boolean(data.voice_enabled),
    voice_auto_play: data.voice_auto_play !== false,
    voice_continuous_mode: data.voice_continuous_mode !== false,
    voice_allow_low_risk_confirmation: Boolean(data.voice_allow_low_risk_confirmation),
    voice_rate: Number(data.voice_rate || 1),
    voice_pitch: Number(data.voice_pitch || 1),
  };
}

export async function startAIVoiceSession(input: {
  businessId: string;
  language: AILanguage;
  conversationId?: string | null;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc('start_ai_voice_session', {
    p_business_id: input.businessId,
    p_language: input.language,
    p_conversation_id: input.conversationId || null,
  });

  if (error) throw new Error(error.message || 'Failed to start the Velliqo Voice session');
  return String(data);
}

export async function logAIVoiceEvent(input: {
  businessId: string;
  sessionId: string;
  eventType: AIVoiceEventType;
  conversationId?: string | null;
  messageId?: string | null;
  actionRequestId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('log_ai_voice_event', {
    p_business_id: input.businessId,
    p_session_id: input.sessionId,
    p_event_type: input.eventType,
    p_conversation_id: input.conversationId || null,
    p_message_id: input.messageId || null,
    p_action_request_id: input.actionRequestId || null,
    p_metadata: input.metadata || {},
  });

  if (error) throw new Error(error.message || 'Failed to record the Velliqo Voice event');
}

export async function finishAIVoiceSession(input: {
  businessId: string;
  sessionId: string;
  status?: Exclude<AIVoiceSessionStatus, 'active'>;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('finish_ai_voice_session', {
    p_business_id: input.businessId,
    p_session_id: input.sessionId,
    p_status: input.status || 'completed',
  });

  if (error) throw new Error(error.message || 'Failed to finish the Velliqo Voice session');
}
