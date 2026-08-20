begin;

-- Velliqo is a multi-country SaaS. The original schema silently defaulted every
-- business that omitted these fields to US/USD. That is unsafe for Stripe
-- Connect because the legal country determines KYC, payouts and capabilities.
alter table public.businesses alter column country drop default;
alter table public.businesses alter column currency drop default;

comment on column public.businesses.country is 'Legal business country as ISO-3166-1 alpha-2. Must be selected during onboarding; never infer silently for payment onboarding.';
comment on column public.businesses.currency is 'Primary business currency as ISO-4217 alpha-3 selected during onboarding.';

commit;
