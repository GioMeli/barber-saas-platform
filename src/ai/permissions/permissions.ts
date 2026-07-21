import type { AICapability, AIRole } from '../core/types';
const ROLE_CAPABILITIES: Record<AIRole, AICapability[]> = {
  'Business Owner': ['business_metrics','revenue','appointments','customers','staff','services','inventory','marketing','settings'],
  Owner: ['business_metrics','revenue','appointments','customers','staff','services','inventory','marketing','settings'],
  Manager: ['business_metrics','appointments','customers','staff','services','inventory','marketing'],
  Employee: ['appointments','customers','services'],
  Customer: ['appointments'],
  'Platform Admin': ['business_metrics','settings'],
};
export function getAICapabilities(role?: string | null): AICapability[] { return ROLE_CAPABILITIES[(role as AIRole) ?? 'Employee'] ?? ROLE_CAPABILITIES.Employee; }
export function assertAICapability(role: string | null | undefined, capability: AICapability) {
  if (!getAICapabilities(role).includes(capability)) throw new Error('AI_PERMISSION_DENIED');
}
