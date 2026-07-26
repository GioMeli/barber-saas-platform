import { supabase } from '@/db/supabase';
import type {
  AIAutomationConfiguration,
  AIAutomationRule,
  AIAutomationRuleUpdate,
  AIAutomationSettings,
  AIAutomationSettingsUpdate,
  OperationalAIAutomationKey,
} from './types';

const SETTINGS_COLUMNS = [
  'business_id',
  'manager_automations_enabled',
  'automation_default_autonomy',
  'automation_timezone',
  'automation_max_runs_per_hour',
  'automation_max_concurrent_runs',
  'automation_last_worker_at',
].join(',');

export async function loadAIAutomationConfiguration(
  businessId: string,
): Promise<AIAutomationConfiguration> {
  const [settingsResult, rulesResult] = await Promise.all([
    supabase
      .from('ai_settings')
      .select(SETTINGS_COLUMNS)
      .eq('business_id', businessId)
      .single(),
    supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('business_id', businessId)
      .order('automation_key'),
  ]);

  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (rulesResult.error) throw new Error(rulesResult.error.message);

  return {
    settings: settingsResult.data as unknown as AIAutomationSettings,
    rules: (rulesResult.data || []) as unknown as AIAutomationRule[],
  };
}

export async function saveAIAutomationConfiguration(input: {
  businessId: string;
  settings: AIAutomationSettingsUpdate;
  rules: AIAutomationRuleUpdate[];
}): Promise<AIAutomationConfiguration> {
  const { data, error } = await supabase.rpc('save_ai_automation_configuration', {
    p_business_id: input.businessId,
    p_settings: input.settings,
    p_rules: input.rules,
  });

  if (error) throw new Error(error.message || 'Failed to save Velliqo AI automations');
  return data as unknown as AIAutomationConfiguration;
}

export async function queueAIAutomationRun(
  businessId: string,
  automationKey: OperationalAIAutomationKey,
): Promise<string> {
  const { data, error } = await supabase.rpc('queue_ai_automation_run', {
    p_business_id: businessId,
    p_automation_key: automationKey,
  });

  if (error) throw new Error(error.message || 'Failed to queue the automation');
  return String(data || '');
}
