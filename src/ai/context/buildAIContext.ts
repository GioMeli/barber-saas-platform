import type { User } from '@supabase/supabase-js';
import type { AIAgentKey, AIContext } from '../core/types';
import { getAICapabilities } from '../permissions/permissions';
import { normalizeLanguage } from '../localization/languages';
export function buildAIContext(input: { user: User; profile: any; business: any; language: string; agent: AIAgentKey; page?: string; message?: string }): AIContext {
  const role = input.profile?.role ?? 'Employee';
  const language = normalizeLanguage(input.language);
  return {
    user: { id: input.user.id, role, language, permissions: getAICapabilities(role) },
    business: { id: input.business.id, name: input.business.name, industryKey: input.business.industry_key ?? 'hair_salon', timezone: input.business.timezone ?? 'UTC', currency: input.business.currency ?? 'EUR', language: normalizeLanguage(input.business.default_language ?? language) },
    request: { agent: input.agent, page: input.page, message: input.message, locale: language },
  };
}
