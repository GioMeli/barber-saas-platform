import type { AILanguage } from '@/ai/core/types';

export type AIVoicePermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';
export type AIVoiceSessionStatus = 'active' | 'completed' | 'interrupted' | 'failed';
export type AIVoiceEventType =
  | 'input_started'
  | 'input_final'
  | 'request_sent'
  | 'response_received'
  | 'speech_started'
  | 'speech_interrupted'
  | 'speech_completed'
  | 'confirmation_prompted'
  | 'confirmation_accepted'
  | 'confirmation_rejected'
  | 'confirmation_blocked'
  | 'error';

export interface AIVoiceSettings {
  voice_enabled: boolean;
  voice_auto_play: boolean;
  voice_continuous_mode: boolean;
  voice_allow_low_risk_confirmation: boolean;
  voice_rate: number;
  voice_pitch: number;
}

export interface AIVoiceSession {
  id: string;
  business_id: string;
  user_id: string;
  conversation_id?: string | null;
  language: AILanguage;
  status: AIVoiceSessionStatus;
  started_at: string;
  ended_at?: string | null;
}
