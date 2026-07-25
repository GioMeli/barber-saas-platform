export const AI_LANGUAGES = ['en', 'el', 'de', 'es', 'tr'] as const;
export type AILanguage = (typeof AI_LANGUAGES)[number];

export type AIAgentKey =
  | 'business_coach'
  | 'financial_analyst'
  | 'marketing_expert'
  | 'scheduling_assistant'
  | 'customer_success'
  | 'inventory_advisor'
  | 'support_assistant';

export type AIRole =
  | 'Business Owner'
  | 'Owner'
  | 'Manager'
  | 'Employee'
  | 'Customer'
  | 'Platform Admin';

export type AICapability =
  | 'business_metrics'
  | 'revenue'
  | 'appointments'
  | 'customers'
  | 'staff'
  | 'services'
  | 'inventory'
  | 'marketing'
  | 'settings';

export type AIInsightCategory =
  | 'business_health'
  | 'finance'
  | 'customers'
  | 'scheduling'
  | 'staff'
  | 'services'
  | 'inventory'
  | 'marketing';

export type AIInsightSeverity = 'info' | 'opportunity' | 'warning' | 'critical';

export type AISuggestedActionType =
  | 'open_calendar'
  | 'open_finance'
  | 'open_customers'
  | 'open_staff'
  | 'open_services'
  | 'open_inventory'
  | 'open_marketing'
  | 'open_reports';

export interface AIContext {
  user: { id: string; role: AIRole; language: AILanguage; permissions: AICapability[] };
  business: {
    id: string;
    name: string;
    industryKey: string;
    timezone: string;
    currency: string;
    language: AILanguage;
  };
  request: { agent: AIAgentKey; page?: string; message?: string; locale: AILanguage };
}

export interface AIProviderRequest {
  context: AIContext;
  systemPrompt: string;
  message: string;
}

export interface AIProviderResponse {
  text: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export interface VelliqoAIInsight {
  category: AIInsightCategory;
  severity: AIInsightSeverity;
  title: string;
  explanation: string;
  evidence: string[];
  recommendation: string;
}

export interface VelliqoAISuggestedAction {
  type: AISuggestedActionType;
  title: string;
  rationale: string;
  destinationPath: string;
}

export interface VelliqoAIResponse {
  answer: string;
  executive_summary: string;
  business_health_score: number;
  confidence: 'low' | 'medium' | 'high';
  insights: VelliqoAIInsight[];
  suggested_actions: VelliqoAISuggestedAction[];
  follow_up_questions: string[];
}

export interface VelliqoAIConversation {
  id: string;
  business_id: string;
  user_id: string;
  agent_key: AIAgentKey;
  title: string | null;
  language: AILanguage;
  created_at: string;
  updated_at: string;
}

export interface VelliqoAIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string | null;
  metadata?: {
    response?: VelliqoAIResponse;
    read_only?: boolean;
    agent?: AIAgentKey;
    topic?: AIInsightCategory | 'support';
    provider?: string;
    external_ai?: boolean;
    estimated_cost?: number;
    [key: string]: unknown;
  } | null;
  created_at: string;
}

export interface VelliqoAIFunctionResult {
  conversationId: string;
  messageId: string;
  createdAt: string;
  response: VelliqoAIResponse;
  model: string;
  provider: 'velliqo_free';
  usage: { inputTokens: number; outputTokens: number };
  estimatedCost: 0;
  readOnly: true;
}

export interface VelliqoAIBusinessSnapshot {
  generatedAt: string;
  period: {
    days: number;
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  business: {
    id: string;
    name: string;
    industryKey: string;
    currency: string;
    timezone: string;
    country?: string | null;
  };
  appointments: {
    periodDays: number;
    total: number;
    completed: number;
    confirmed: number;
    cancelled: number;
    noShows: number;
    bookedMinutes: number;
    appointmentValue: number;
    completionRate: number;
    cancellationRate: number;
    noShowRate: number;
    nextSevenDays: number;
  };
  customers: {
    total: number;
    registered: number;
    guests: number;
    newInPeriod: number;
    active: number;
    atRisk: number;
    dormant: number;
    customersWithNoShows: number;
    returning: number;
    returningRate: number;
  };
  staff: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  inventory: {
    activeProducts: number;
    lowStock: number;
    outOfStock: number;
    stockCostValue: number;
    stockRetailValue: number;
    lowStockItems: Array<Record<string, unknown>>;
  };
  marketing: {
    campaignsInPeriod: number;
    scheduled: number;
    completed: number;
    sent: number;
    delivered: number;
    converted: number;
    attributedRevenue: number;
  };
  finance: Record<string, any>;
  previousFinance: Record<string, any>;
  privacy: {
    containsCustomerNames: false;
    containsCustomerContacts: false;
    aggregationOnly: true;
  };
}
