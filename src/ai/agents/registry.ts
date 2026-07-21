import type { AIAgentKey, AICapability } from '../core/types';
export type AIAgentDefinition = { key: AIAgentKey; nameKey: string; descriptionKey: string; requiredCapabilities: AICapability[]; tone: 'strategic'|'analytical'|'creative'|'practical'|'supportive' };
export const AI_AGENT_REGISTRY: Record<AIAgentKey, AIAgentDefinition> = {
  business_coach: { key:'business_coach', nameKey:'ai.agents.businessCoach', descriptionKey:'ai.agents.businessCoachDescription', requiredCapabilities:['business_metrics'], tone:'strategic' },
  financial_analyst: { key:'financial_analyst', nameKey:'ai.agents.financialAnalyst', descriptionKey:'ai.agents.financialAnalystDescription', requiredCapabilities:['revenue'], tone:'analytical' },
  marketing_expert: { key:'marketing_expert', nameKey:'ai.agents.marketingExpert', descriptionKey:'ai.agents.marketingExpertDescription', requiredCapabilities:['marketing'], tone:'creative' },
  scheduling_assistant: { key:'scheduling_assistant', nameKey:'ai.agents.schedulingAssistant', descriptionKey:'ai.agents.schedulingAssistantDescription', requiredCapabilities:['appointments'], tone:'practical' },
  customer_success: { key:'customer_success', nameKey:'ai.agents.customerSuccess', descriptionKey:'ai.agents.customerSuccessDescription', requiredCapabilities:['customers'], tone:'supportive' },
  inventory_advisor: { key:'inventory_advisor', nameKey:'ai.agents.inventoryAdvisor', descriptionKey:'ai.agents.inventoryAdvisorDescription', requiredCapabilities:['inventory'], tone:'analytical' },
  support_assistant: { key:'support_assistant', nameKey:'ai.agents.supportAssistant', descriptionKey:'ai.agents.supportAssistantDescription', requiredCapabilities:[], tone:'supportive' },
};
