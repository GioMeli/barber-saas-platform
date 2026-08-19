# Phase 15B.1 — POS Merchant Foundation

## Goal

Make the Velliqo POS add-on safe to expose to real owners before provider-backed card collection is enabled.

This phase deliberately separates **merchant onboarding** from **payment execution**. Owners can connect and verify their Stripe merchant account now, while Velliqo prevents card/online transactions from being marked as paid until Phase 15B.2 introduces provider-backed PaymentIntents, webhook confirmation, reconciliation and refunds.

## Architecture

Each Velliqo business has at most one row in `business_payment_accounts`:

`business_id -> provider -> provider_account_id -> onboarding/verification state`

Stripe account creation is server-side in `pos_merchant_account`. The account configuration is SaaS-oriented:

- Stripe collects processing fees from the connected business (`controller.fees.payer = account`).
- Stripe is responsible for payment losses (`controller.losses.payments = stripe`).
- Stripe collects verification requirements (`controller.requirement_collection = stripe`).
- The connected business receives the full Stripe Dashboard (`controller.stripe_dashboard.type = full`).

The function creates Stripe-hosted onboarding links and synchronizes `charges_enabled`, `payouts_enabled`, verification requirements and disabled reasons back to Supabase.

## Security changes

- `business_payment_accounts` is readable only by a `business_members.role = 'Owner'` member of the same tenant.
- Browser clients have no insert/update rights on merchant account state.
- `complete_business_sale` now rejects `card` and `online` manual payments.
- The original checkout implementation is private behind the hardened wrapper.
- Stripe-backed transactions cannot use the old local `void_business_sale` path as a pretend refund.
- Connected account creation is idempotent per `business_id`.

## Owner UX

`/dashboard/pos` now supports:

- Connect Stripe
- Continue Stripe setup
- Refresh verification state
- Ready / pending / action-required state
- Outstanding requirement counts
- Pending-verification counts
- Last synchronization timestamp
- Stripe Dashboard link once ready

Stripe return URLs come back to `/dashboard/pos`, where Velliqo retrieves the account again rather than trusting the redirect itself.

## Sales safety gate

`/dashboard/sales` keeps manual payment methods such as cash, bank transfer, gift card and other available. Card and online payment options are disabled until the secure provider-backed flow is implemented.

This prevents accounting revenue, stock movements and appointment payment state from being updated without a real successful card transaction.

## Deployment

1. Apply migration `00056_velliqo_pos_merchant_foundation.sql`.
2. Set `STRIPE_CONNECT_DEFAULT_COUNTRY` only as a fallback when business country data is not already stored as ISO-2.
3. Deploy `pos_merchant_account`.
4. Redeploy `stripe_webhook`.
5. In Stripe test mode, enable/configure Connect for the Velliqo platform.
6. Configure the Stripe webhook destination to include connected-account `account.updated` events.
7. Purchase/activate the Velliqo POS add-on for a test business.
8. Open `/dashboard/pos`, complete Stripe-hosted onboarding, and verify that Velliqo reaches `ready` only after Stripe reports charges and payouts enabled.
9. Confirm `/dashboard/sales` cannot complete card or online payments yet.
10. Run `npm run phase15b1:check`, `npm run translations:check`, `npm run typecheck`, and `npm run build`.

## Next phase — 15B.2

Implement real payment execution:

- server-calculated checkout totals
- Stripe PaymentIntent creation on the connected account
- idempotent payment attempt records
- Terminal/server-driven card collection where available
- online payment collection where applicable
- webhook-confirmed final sale completion
- provider IDs stored on `sale_payments`
- retries/failures without duplicate sales or stock movements
- real Stripe refunds and partial refunds
- reconciliation and receipt linkage
