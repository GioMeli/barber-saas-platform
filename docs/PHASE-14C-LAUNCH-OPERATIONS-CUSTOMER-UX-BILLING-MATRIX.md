# Phase 14C — Launch Operations, Customer UX & Billing Test Matrix

## Platform Admin

Production route: `/admin` (for profiles with role `Platform Admin`).

The control center provides:
- MRR, active/trial/past-due/cancelled subscription overview.
- Standard / Pro / Premium subscriber distribution.
- AI requests, tokens and recorded AI estimated cost.
- Email/SMS usage and delivery failure health.
- Stripe webhook processing-error count.
- Configurable operating-cost assumptions and an estimated monthly operating contribution.
- Searchable subscriber/business table with plan, usage and Stripe identifiers.
- Audited corrections for business/owner contact data and a protected owner Auth email correction workflow.
- Fixed-term offer administration.
- CSV export for platform summary and business usage/support data.

The profit value is an operational estimate. Configure real infrastructure/provider/payment cost assumptions before relying on it.

## Remaining Stripe Sandbox acceptance matrix

Already confirmed manually in this project: initial Checkout, 14-day trial activation, plan upgrade, cancellation and webhook signature delivery.

Run the remaining scenarios before Live mode. Use real Sandbox subscriptions rather than synthetic webhook payloads whenever possible, because real test subscriptions exercise the metadata and database synchronization used by Velliqo.

### A. Plan creation and trials

1. Create one new business for each plan: Standard, Pro and Premium.
2. Complete Checkout with a Sandbox test card and a payment method collected before access begins.
3. Expected Velliqo database state after each Checkout:
   - `status = trialing`
   - correct `plan_id`
   - `payment_method_collected = true`
   - `trial_ends_at` approximately 14 days after activation
   - populated Stripe customer/subscription identifiers
4. Expected Stripe state: subscription `trialing`, no €29.99/€49.99/€89.99 charge on day 0.
5. Confirm the Owner workspace becomes available after Checkout reconciliation/webhook processing.

### B. Trial plan changes

1. During a trial, change Standard → Pro and Pro → Premium.
2. Expected: the existing trial continues; no accidental early termination of the 14-day trial.
3. Confirm Velliqo updates the plan entitlement after `customer.subscription.updated`.
4. Confirm staff/AI/report limits change to the new plan.

### C. Downgrades

1. Active Premium → Pro and Pro → Standard.
2. Expected: downgrade is scheduled for the end of the current period when the portal condition is `decreasing_item_amount`.
3. Until period end, current paid entitlements remain.
4. At period rollover, Velliqo receives `customer.subscription.updated` and applies the lower plan.

### D. Renewal and invoice lifecycle

Use Stripe Billing simulations / test clocks where possible.

1. Advance through the end of the trial.
2. Expected: first non-zero invoice is paid and subscription becomes `active`.
3. Advance one monthly cycle.
4. Expected: recurring invoice is paid; `current_period_start/end` move forward and plan usage allowances reset to the new Stripe billing period.
5. Confirm `billing_invoices` and Billing UI show the corresponding invoice/receipt.

### E. Failed recurring payment and recovery

1. In Sandbox attach a Stripe payment method intended to fail a recurring payment, or use a Billing simulation designed for failed renewal.
2. Advance to invoice collection.
3. Expected webhook: `invoice.payment_failed`; Velliqo becomes `past_due` and establishes the configured grace period.
4. During grace, Billing page warns the Owner and links to Manage Billing.
5. Replace the payment method with a successful Sandbox card and retry/pay the invoice.
6. Expected webhook: `invoice.paid`; Velliqo clears `grace_until` and returns to normal paid access.
7. Advance beyond grace without recovery in a separate test and confirm paid workspace access is blocked according to the entitlement function.

### F. Cancellation / reactivation

1. Cancel a normal subscription in Customer Portal.
2. Expected: cancellation is scheduled at period end and the Owner keeps access until then.
3. Confirm Stripe/Velliqo `cancel_at_period_end` behavior and final `canceled` state when the period expires.
4. If the portal offers reactivation before period end, test reactivation and confirm access remains continuous.

### G. Fixed-term offers

Create isolated offer codes from `/admin`.

#### Six-month full offer
- Plan: Pro
- duration: 6 months
- discount: 100%
- trial days: 0
- max redemptions: 1

Expected:
- Checkout/redeem succeeds once.
- `billing_mode = fixed_term`.
- Stripe subscription has a fixed `cancel_at` corresponding to the six-month end.
- Fixed-term portal does not allow switching plans.
- At the fixed end, subscription ends and does not convert to monthly auto-renewal.

#### Twelve-month discounted offer
- Plan: Premium
- duration: 12 months
- chosen discount
- trial days either 0 for exactly 12 months, or 14 only when intentionally offering 14 days + 12 months.

Expected: same fixed-end/no-renew behavior.

Also verify:
- expired offer is rejected;
- disabled offer is rejected;
- max-redemption limit is enforced;
- a reserved but abandoned Checkout does not permanently consume capacity after reservation expiry/release;
- an offer locked to one plan cannot be redeemed for another plan.

### H. Plan entitlements

For each plan verify server-side behavior, not only hidden UI:

**Standard**
- maximum 3 staff seats (Owner excluded);
- browser Staff Portal available;
- downloadable Staff App unavailable;
- 100 AI requests / 250k tokens per billing period;
- 250 email / 25 SMS allowance;
- advanced reports and AI automations unavailable.

**Pro**
- maximum 10 staff;
- downloadable Staff App available;
- 500 AI requests / 1.5M tokens;
- 1,000 email / 150 SMS allowance;
- advanced reports and AI automations available.

**Premium**
- maximum 30 staff;
- downloadable Staff App available;
- 1,500 AI requests / 5M tokens;
- 3,000 email / 500 SMS allowance;
- advanced reports and AI automations available.

Attempt the first operation above each limit and confirm the backend rejects it gracefully.

### I. Webhook reliability

1. Confirm real billing deliveries return HTTP 2xx.
2. Resend one already-processed Stripe event.
3. Expected: `stripe_event_id` idempotency prevents double processing.
4. Query:

```sql
select stripe_event_id, event_type, livemode, processed_at, processing_error
from public.stripe_webhook_events
order by created_at desc
limit 50;
```

Expected: real Velliqo events have `processing_error is null`.

## International phone invariant

All edited/new phone values now use the shared international phone component and are stored in `+countrycode...` form. Booking submission rejects an invalid international number. Existing legacy data is not force-migrated in this phase; clean legacy non-international numbers before enabling live SMS automations.

## Customer storefront acceptance

Check these breakpoints: 360px, 390px, 768px, 1024px, 1440px+.

- Premium animated hero remains readable with/without cover image.
- Average rating is calculated from all published reviews, not only the visible cards.
- Review spotlight and full review section display correctly.
- Booking Date & Time step displays a real month calendar.
- Closed dates, past dates and dates beyond `max_booking_period` are disabled.
- Selecting a date refreshes available times; selecting a time enables Continue.
- Reduced-motion OS preference removes decorative animations.
- No horizontal overflow in customer or booking pages.
