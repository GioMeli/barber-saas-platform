export type BillingPlanId = 'standard' | 'pro' | 'premium';

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  price: number;
  stripePriceEnv: 'STRIPE_PRICE_STANDARD' | 'STRIPE_PRICE_PRO' | 'STRIPE_PRICE_PREMIUM';
  staffLimit: number;
  staffAppInstall: boolean;
  aiRequestsMonthly: number;
  aiTokensMonthly: number;
  emailMonthly: number;
  smsMonthly: number;
  advancedReports: boolean;
  aiAutomations: boolean;
  highlighted?: boolean;
  description: string;
};

export const BILLING_TRIAL_DAYS = 14;
export const BILLING_PLAN_STORAGE_KEY = 'velliqo.selectedPlan';
export const BILLING_OFFER_STORAGE_KEY = 'velliqo.offerCode';

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: 29.99,
    stripePriceEnv: 'STRIPE_PRICE_STANDARD',
    staffLimit: 3,
    staffAppInstall: false,
    aiRequestsMonthly: 100,
    aiTokensMonthly: 250_000,
    emailMonthly: 250,
    smsMonthly: 25,
    advancedReports: false,
    aiAutomations: false,
    description: 'Core operations for small teams that want one professional workspace.',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49.99,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    staffLimit: 10,
    staffAppInstall: true,
    aiRequestsMonthly: 500,
    aiTokensMonthly: 1_500_000,
    emailMonthly: 1_000,
    smsMonthly: 150,
    advancedReports: true,
    aiAutomations: true,
    highlighted: true,
    description: 'The complete operating plan for growing appointment-based businesses.',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 89.99,
    stripePriceEnv: 'STRIPE_PRICE_PREMIUM',
    staffLimit: 30,
    staffAppInstall: true,
    aiRequestsMonthly: 1_500,
    aiTokensMonthly: 5_000_000,
    emailMonthly: 3_000,
    smsMonthly: 500,
    advancedReports: true,
    aiAutomations: true,
    description: 'Higher capacity, AI allowance and communication volume for larger teams.',
  },
];

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === 'standard' || value === 'pro' || value === 'premium';
}

export function getBillingPlan(planId: unknown): BillingPlan {
  return BILLING_PLANS.find((plan) => plan.id === planId) ?? BILLING_PLANS[1];
}

export function formatPlanCurrency(value: number, locale = 'en-IE') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}
