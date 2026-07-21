export const AI_LANGUAGES = ['en', 'el', 'de', 'es', 'tr'] as const;
export type AILanguage = (typeof AI_LANGUAGES)[number];
export type AIAgentKey = 'business_coach' | 'financial_analyst' | 'marketing_expert' | 'scheduling_assistant' | 'customer_success' | 'inventory_advisor' | 'support_assistant';
export type AIRole = 'Business Owner' | 'Owner' | 'Manager' | 'Employee' | 'Customer' | 'Platform Admin';
export type AICapability = 'business_metrics' | 'revenue' | 'appointments' | 'customers' | 'staff' | 'services' | 'inventory' | 'marketing' | 'settings';
export interface AIContext {
  user: { id: string; role: AIRole; language: AILanguage; permissions: AICapability[] };
  business: { id: string; name: string; industryKey: string; timezone: string; currency: string; language: AILanguage };
  request: { agent: AIAgentKey; page?: string; message?: string; locale: AILanguage };
}
export interface AIProviderRequest { context: AIContext; systemPrompt: string; message: string; }
export interface AIProviderResponse { text: string; model?: string; usage?: { inputTokens?: number; outputTokens?: number }; }
export interface AIProvider { generate(request: AIProviderRequest): Promise<AIProviderResponse>; }
