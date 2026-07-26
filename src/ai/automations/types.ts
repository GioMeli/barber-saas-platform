export const AI_AUTOMATION_KEYS = [
  'proactive_recommendations',
  'daily_briefing',
  'customer_reactivation',
  'schedule_optimisation',
  'low_stock_actions',
  'campaign_planning',
] as const;

export const OPERATIONAL_AI_AUTOMATION_KEYS = [
  'customer_reactivation',
  'schedule_optimisation',
  'low_stock_actions',
  'campaign_planning',
] as const;

export type AIAutomationKey = (typeof AI_AUTOMATION_KEYS)[number];
export type OperationalAIAutomationKey = (typeof OPERATIONAL_AI_AUTOMATION_KEYS)[number];
export type AIAutonomyLevel =
  | 'disabled'
  | 'recommend_only'
  | 'prepare_draft'
  | 'auto_execute_low_risk';
export type AIAutomationHandlerStatus = 'planned' | 'available' | 'paused';
export type AIAutomationScheduleKind = 'manual' | 'event' | 'hourly' | 'daily' | 'weekly';

export interface AIAutomationSettings {
  business_id: string;
  manager_automations_enabled: boolean;
  automation_default_autonomy: AIAutonomyLevel;
  automation_timezone: string;
  automation_max_runs_per_hour: number;
  automation_max_concurrent_runs: number;
  automation_last_worker_at?: string | null;
}

export interface AIAutomationRule {
  id: string;
  business_id: string;
  automation_key: AIAutomationKey;
  enabled: boolean;
  handler_status: AIAutomationHandlerStatus;
  autonomy_level: AIAutonomyLevel;
  schedule_kind: AIAutomationScheduleKind;
  schedule_config: Record<string, unknown>;
  parameters: Record<string, unknown>;
  allowed_action_types: string[];
  risk_ceiling: 'low' | 'medium';
  requires_confirmation: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface AIAutomationConfiguration {
  settings: AIAutomationSettings;
  rules: AIAutomationRule[];
}

export type AIAutomationSettingsUpdate = Pick<
  AIAutomationSettings,
  | 'manager_automations_enabled'
  | 'automation_default_autonomy'
  | 'automation_timezone'
>;

export type AIAutomationRuleUpdate = Pick<
  AIAutomationRule,
  'automation_key' | 'enabled' | 'autonomy_level' | 'requires_confirmation'
>;
