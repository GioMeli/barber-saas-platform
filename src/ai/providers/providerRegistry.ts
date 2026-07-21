import type { AIProvider } from '../core/types';
const providers = new Map<string, AIProvider>();
export function registerAIProvider(name: string, provider: AIProvider) { providers.set(name, provider); }
export function getAIProvider(name: string) { const provider = providers.get(name); if (!provider) throw new Error(`AI provider "${name}" is not configured`); return provider; }
export function hasAIProvider(name: string) { return providers.has(name); }
