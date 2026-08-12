# Phase 14D — Admin Control Plane, Owner Support, Live Discovery & Offer Hardening

## Scope

Phase 14D expands Velliqo's operational control plane without exposing arbitrary database access to the Platform Admin. It adds an Owner Help Center and auditable support conversation workflow, platform-wide Owner announcements, per-tenant cost attribution, stricter fixed-term offer presentation/validation, and live arbitrary-location discovery.

## Platform Admin

`/admin` remains restricted to profiles with the `Platform Admin` role.

The control plane includes:

- platform MRR, subscription status and usage overview;
- Owner/business search and CSV export;
- protected correction of business identity/contact/status/location/currency/timezone and Owner profile details;
- protected Owner authentication-email correction via the existing `platform_admin_support` Edge Function;
- support notes and audit history;
- current-billing-period cost attribution per Owner/business;
- support request inbox with unread badge, conversation, reply and status transitions;
- broadcast/announcement creation for all active Owners;
- plan-locked fixed-term offer administration with start/end availability and redemption controls;
- platform cost model maintenance.

### Cost attribution

AI provider cost comes from recorded `ai_usage_events.estimated_cost`. Email, SMS, payment-processing and shared infrastructure values are cost-model estimates configured by Platform Admin. Shared fixed cost is allocated equally across trialing/active/past-due subscriptions. The displayed contribution is an operational estimate, not accounting profit.

## Owner Help Center

Every Owner page exposes the Help control in the top bar. The responsive drawer provides:

1. Velliqo AI Assistant;
2. email to `support@velliqo.com`;
3. Urgent Request.

Urgent Requests create an internal support request and conversation. Statuses are `Sent`, `Pending`, `Completed`, or `Cancelled`. Admin replies and status changes create normal Owner notifications that open the matching support conversation.

## Platform announcements

Platform Admin can publish an informational, important or critical announcement. A notification is inserted for every active business Owner and appears in the existing Owner notification centre.

## Fixed-term offers

The database remains authoritative for offer eligibility. Offer codes are:

- locked to one billing plan;
- constrained to a coherent availability window;
- rejected before `starts_at` or at/after `expires_at`;
- subject to maximum redemptions and one redemption per business;
- previewed before Checkout so the Billing UI locks the Owner to the correct plan;
- converted by the existing billing flow into a Stripe fixed-term subscription with an explicit cancellation date, so they do not auto-renew after the configured access term.

## Live discovery

`/discover` accepts arbitrary location text. Existing cities/districts remain suggestions only; they are not a whitelist. Location, service and business filters automatically update the results after a short debounce, so the page does not require a Search click after every change. Current-location coordinates remain supported.

## Deployment

Run locally first:

```powershell
npm run phase14d:check
npm run translations:check
npm run billing:check
npm run discovery:check
npm run ui:check
npm run responsive:check
npm run production:check
npm run typecheck
npm run build
```

Apply the database migration:

```powershell
npx supabase db push
```

Phase 14D does not introduce a new Edge Function. `platform_admin_support` is reused for protected Owner Auth email changes and should already be deployed from Phase 14C.

Then deploy the frontend through the normal GitHub/Vercel flow.

## Acceptance checks

- `/admin` is inaccessible to non-Platform-Admin accounts.
- Owner costs can be selected and exported per tenant.
- Owner support corrections write audit records.
- Help is present on desktop and mobile Owner layouts.
- Urgent Request produces a request and first message.
- Admin reply produces an Owner notification and opens the thread.
- Admin status change produces an Owner notification.
- Broadcast reaches each active Owner notification centre.
- Offer preview identifies the exact plan and prevents choosing a different plan.
- Expired, future, exhausted and already-used offers are rejected.
- `/discover` searches arbitrary city/area text and refreshes live on filter changes.
- `support@velliqo.com` is used for public/support contact; the former personal email does not appear in the application.
