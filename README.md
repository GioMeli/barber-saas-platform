# Velliqo

Velliqo is a multi-tenant SaaS platform for appointment-based and service businesses. It gives each business owner an isolated workspace for appointments, customers, team members, services, products, payments, marketing, reporting and AI-assisted operations.

## Platform principles

- **Industry neutral by default** — no business is treated as a salon, barber shop or any other sector unless its selected `industry_key` says so.
- **Tenant isolated** — operational data, AI context, automations, notifications and audit records are scoped to one `business_id`.
- **Confirmation based AI** — Velliqo AI uses the same permission and confirmation model as the rest of the platform.
- **Customer choice** — customers can book as guests or through the business-specific customer portal.
- **Production oriented** — Supabase RLS, audited Edge Functions, idempotent jobs, CI quality gates and deployment documentation are part of the repository.

## Supported business categories

Velliqo includes configurations for beauty and personal care, health and wellness, fitness, pet services, automotive services, home and field services, professional services, education, creative services, events and venues. Each owner selects one business type during onboarding.

## Technology

- React 18, TypeScript and Vite
- Supabase Auth, PostgreSQL, RLS, Storage and Edge Functions
- Stripe subscription foundation
- Resend and Twilio delivery foundations
- Velliqo AI Manager, operational automations and browser voice assistant
- Vercel deployment and GitHub Actions quality gates

## Local development

Requirements:

- Node.js 22
- npm 11
- Supabase CLI for database and Edge Function work

```bash
npm ci --include=optional
npm run dev
```

Quality validation:

```bash
npm run production:check
npm run translations:check
npm run ui:check
npm run sales:check
npm run finance:check
npm run marketing:check
npm run delivery:check
npm run ai:check
npm run automations:check
npm run voice:check
npm run industry-neutral:check
npm run typecheck
npm run build
```

## Database and functions

Migrations are stored in `supabase/migrations`. Edge Functions are stored in `supabase/functions`. Secrets must be configured through Supabase project secrets and must never be placed in frontend environment variables.

## Product identity

**Velliqo — Book. Manage. Grow.**

Recommended GitHub repository description:

> Multi-tenant SaaS platform for appointment-based and service businesses, powered by Velliqo AI.
