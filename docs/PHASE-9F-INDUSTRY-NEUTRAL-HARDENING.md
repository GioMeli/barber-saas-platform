# Phase 9F — Industry-Neutral Platform Hardening

## Objective

Make Velliqo neutral at the platform level while preserving deliberate industry-specific configuration. Salon and barber businesses remain supported industries, but they are not defaults and do not define global UI, AI, notification or export behavior.

## Delivered controls

- Neutral fallback industry: `appointment_service_business`
- Database default and constraint migration: `00041_velliqo_industry_neutral_platform.sql`
- Dynamic AI industry context for conversations and daily briefings
- Generic fallback terminology for unknown industries
- Dynamic professional terminology from the industry registry
- Neutral calendar `PRODID` and UID namespace
- Legacy internal calendar class names renamed to `velliqo-*`
- Generic product documentation and repository README
- CI validator: `npm run industry-neutral:check`

## Notification and function audit

The following functions were reviewed for hard-coded sector assumptions:

- `process_appointment_notifications`
- `process_reminder_jobs`
- `process-ai-manager-automations`
- `velliqo-ai-manager`
- `process_marketing_deliveries`
- `marketing-unsubscribe`
- `resend-marketing-webhook`
- `twilio-marketing-webhook`
- `create_subscription_checkout`
- `stripe_webhook`

Transactional templates use actual business, service, professional, date, time, address and booking data. Where no industry-specific term is available, the platform uses neutral wording.

## Security behavior

Industry context never changes authorization. JWT validation, membership checks, RLS, `business_id` scoping, Action Engine permissions and confirmation requirements remain authoritative.

## Runtime validation matrix

Test at least these representative tenants:

1. Hair salon
2. Physiotherapy practice
3. Car detailing business
4. Consultancy
5. Pet grooming business
6. Tutoring service
7. Venue booking business
8. Generic appointment/service business fallback

For each tenant verify AI terminology, briefing language, confirmation email, reminder email, calendar export, customer portal and owner dashboard.

## Manual repository settings

Update the GitHub repository About description to:

`Multi-tenant SaaS platform for appointment-based and service businesses, powered by Velliqo AI.`

The historical repository slug may remain unchanged until a coordinated rename is planned with deployment and integration updates.
