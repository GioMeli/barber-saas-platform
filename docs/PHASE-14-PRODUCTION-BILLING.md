# Phase 14 — Production Billing

## Commercial model

Velliqo launches with three monthly EUR plans:

| Plan | Monthly price | Staff limit* | Installable Staff App | Velliqo AI requests/month | AI token allowance/month | Email allowance/month | SMS allowance/month | Advanced reports | AI automations |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| Standard | €29.99 | 3 | No | 100 | 250,000 | 250 | 25 | Core only | No |
| Pro | €49.99 | 10 | Yes | 500 | 1,500,000 | 1,000 | 150 | Yes | Yes |
| Premium | €89.99 | 30 | Yes | 1,500 | 5,000,000 | 3,000 | 500 | Yes | Yes |

\*The owner is excluded from the staff-seat count.

All normal plans:

1. Collect billing details securely in Stripe Checkout before the trial begins.
2. Start a 14-day free trial only after Checkout completes.
3. Automatically charge the selected monthly plan after the trial.
4. Continue renewing monthly until the owner cancels or changes the subscription.
5. Do not store raw card details in Velliqo/Supabase.

The plan catalogue and server-side limits live in `public.billing_plans`. Frontend plan marketing lives in `src/billing/plans.ts`; change both together if commercial limits are revised before launch.

## Fixed-term Velliqo offer codes

Platform Admin can create a code for a specific plan and term (for example 6 or 12 months), optionally with a percentage discount and its own trial length.

Important behavior:

- The code is tied to one Velliqo plan.
- A code may be 100% discounted for free fixed access, or partially discounted.
- Checkout still collects the payment method because Velliqo uses `payment_method_collection=always`.
- After Checkout, the webhook applies a Stripe `cancel_at` date equal to the end of the trial plus the fixed number of months.
- The Stripe subscription therefore stops automatically at the fixed end date and does **not** become an ordinary auto-renewing plan.
- A fixed-term subscription is locked to its offer plan in the Velliqo Billing UI. Use a separate Stripe Customer Portal configuration for fixed-term subscriptions that does not allow plan switching.
- If exact access should be six months total including the trial, create the offer with `trial_days = 0`. With `trial_days = 14`, the fixed months start after the 14-day trial.

Velliqo offer codes are managed in `/admin`. They are intentionally not generic public Stripe Promotion Codes.

## Stripe setup — sandbox/test mode first

Do all configuration and lifecycle testing in Stripe test/sandbox mode before creating live prices or adding live keys.

### 1. Create the product and three recurring prices

In Stripe Dashboard create one product:

- Product name: `Velliqo`

Under the same product create three recurring monthly EUR prices:

- Standard: EUR 29.99 / month
- Pro: EUR 49.99 / month
- Premium: EUR 89.99 / month

Keep all three prices on the same Stripe Product. This is important for clean Customer Portal upgrades/downgrades, particularly scheduled downgrades.

Copy the three `price_...` IDs.

### 2. Supabase Edge Function secrets

Set these in the linked Supabase project:

```powershell
npx supabase secrets set STRIPE_SECRET_KEY="sk_test_..."
npx supabase secrets set STRIPE_PRICE_STANDARD="price_..."
npx supabase secrets set STRIPE_PRICE_PRO="price_..."
npx supabase secrets set STRIPE_PRICE_PREMIUM="price_..."
npx supabase secrets set APP_PUBLIC_URL="https://velliqo.com"
npx supabase secrets set STRIPE_AUTOMATIC_TAX="false"
```

Do not put Stripe secret keys in Vercel frontend environment variables or source control.

`STRIPE_AUTOMATIC_TAX` should remain `false` until the VAT/tax registrations and Stripe Tax setup have been reviewed for Velliqo's actual selling entity and customer locations.

### 3. Configure Stripe Customer Portal

Create **two** Customer Portal configurations.

#### A. Normal renewable subscriptions

Enable:

- Customer information / billing details
- Payment method updates
- Invoice history
- Subscription cancellation
- Cancellation mode: end of billing period
- Cancellation reason collection
- Subscription switching among Standard, Pro, Premium
- Upgrades: apply immediately with the chosen Stripe proration behavior
- Downgrades: schedule at the end of the billing period
- Promotion codes: OFF (Velliqo manages its own controlled offer codes)
- Quantity changes: OFF (Velliqo does not use Stripe seat quantities)

Copy the resulting portal configuration ID (`bpc_...`) and set:

```powershell
npx supabase secrets set STRIPE_PORTAL_CONFIGURATION_ID="bpc_..."
```

#### B. Fixed-term offer subscriptions

Create a second portal configuration that enables:

- Payment method updates
- Billing/customer information
- Invoice history
- Cancellation at end of period

Do **not** enable plan switching or promotion codes for this configuration. A Velliqo fixed-term offer is tied to its plan and end date.

Set:

```powershell
npx supabase secrets set STRIPE_PORTAL_FIXED_CONFIGURATION_ID="bpc_..."
```

### 4. Webhook endpoint

Deploy the billing functions first:

```powershell
npx supabase functions deploy create_subscription_checkout
npx supabase functions deploy create_billing_portal_session
npx supabase functions deploy stripe_webhook --no-verify-jwt
```

The webhook URL is:

```text
https://PROJECT_REF.supabase.co/functions/v1/stripe_webhook
```

Create a Stripe webhook destination for that URL and subscribe to:

- `checkout.session.completed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.created`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.voided`
- `invoice.marked_uncollectible`

Copy the signing secret and set:

```powershell
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
```

The Edge Function validates Stripe signatures and stores processed Stripe event IDs in `stripe_webhook_events` for idempotency.

### 5. Revenue recovery and payment failure policy

Configure Stripe Billing revenue recovery before live launch:

- Enable Smart Retries (or an explicit retry policy appropriate to the business).
- Enable Stripe customer emails for failed payments and expiring/failed payment methods as desired.
- Allow payment method updates through Customer Portal.

Velliqo grants a short 7-day application grace window after the first `invoice.payment_failed` event. A successful invoice clears that grace. If the subscription remains `past_due` after the grace expires, the Owner workspace is billing-gated and new appointments/Staff access/provider operations are blocked. `unpaid`, `canceled`, `paused`, `incomplete_expired` and incomplete billing states do not receive paid access.

### 6. Billing trial behavior

Velliqo Checkout explicitly uses:

```text
payment_method_collection = always
subscription_data.trial_period_days = 14
```

Therefore:

- The card/payment method is collected before the free trial is activated.
- The trial begins only after successful Checkout completion.
- Stripe generates and attempts the first paid invoice when the trial finishes.
- A business that has already used its initial trial does not receive a second trial if it later creates another Checkout Session.

### 7. Signup/onboarding flow

The production flow is:

1. User starts Sign Up.
2. User chooses Standard, Pro or Premium.
3. Email/account authentication completes.
4. Business onboarding creates the business and selected operational data.
5. The selected plan is bootstrapped server-side as `incomplete` so staff limits are already enforced during onboarding.
6. Onboarding sends the owner to Stripe Checkout.
7. Stripe securely collects billing details.
8. `checkout.session.completed` is received by the signed webhook.
9. Stripe/Supabase synchronize the subscription and the 14-day trial begins.
10. Owner enters the workspace with the entitlements of the **selected** plan (the trial is not an unrestricted Premium trial).

If the owner closes Checkout after the business has already been created, Velliqo routes the owner to Billing to resume setup instead of creating a duplicate business.

### 8. Upgrades, downgrades and cancellation

Normal auto-renew subscriptions use Stripe Customer Portal.

- Upgrade: Stripe handles the price switch and configured proration; webhook updates Velliqo from the Stripe price ID.
- Downgrade: configure the portal to schedule the lower price at period end.
- Cancel: configure cancellation at period end. Access remains active while Stripe status remains active and ends when Stripe emits the final subscription lifecycle update.
- No owner action: the subscription continues to renew monthly automatically.
- Payment method failure/removal: the subscription does not silently become free; Stripe revenue recovery runs and Velliqo applies the short billing grace described above.

### 9. Entitlements enforced outside the UI

Phase 14 includes server-side enforcement for the most important paid/cost surfaces:

- Employee/staff count: database trigger
- Standard Staff App installation: manifest and Staff workspace entitlement
- New appointments: database billing access trigger
- Velliqo AI requests/tokens: Edge Function entitlement and monthly usage checks
- AI operational automations: plan entitlement
- Operational/marketing email and SMS: monthly provider allowance checks
- Advanced report tabs: plan UI entitlement
- Owner workspace: billing access gate
- Staff workspace: billing access gate

The later dedicated Security phase must still perform a full RLS/adversarial audit of every CRUD route and storage policy before public launch.

## Test matrix before live mode

Use Stripe test cards and, where useful, Stripe subscription simulations/test clocks.

At minimum test all of these:

1. Standard signup -> billing details -> 14-day trial -> first successful renewal.
2. Pro signup -> trial -> automatic renewal.
3. Premium signup -> trial -> automatic renewal.
4. Close Checkout before completion -> resume from Billing, no trial starts.
5. Attempt second trial after a previously used trial -> no new trial.
6. Standard cannot install Staff App; Pro/Premium can.
7. Staff limit rejects the next employee above each plan limit.
8. Standard advanced report/AI automation locks.
9. AI usage reaches monthly request/token limit and is rejected server-side.
10. Email/SMS allowance reaches limit and worker skips further sends.
11. Upgrade Standard -> Pro.
12. Upgrade Pro -> Premium.
13. Downgrade Premium -> Pro at period end.
14. Cancel ordinary subscription at period end.
15. Failed renewal -> past_due + 7-day Velliqo grace -> access gate after grace if unresolved.
16. Successful recovery payment clears grace.
17. 6-month fixed-term offer with discount -> fixed end date -> no auto-renew.
18. 12-month 100%-discount offer -> no charges during term -> no auto-renew afterward.
19. Expired/disabled/max-redemption offer is rejected.
20. Fixed-term Billing Portal does not allow plan switching.
21. Stripe webhook replay is idempotent.
22. Invoices/receipts appear in Owner Billing.

Do not switch to live keys until the complete matrix is green.

## Live-mode cutover

After sandbox validation:

1. Create the same Velliqo Product and three EUR monthly Prices in **live mode**.
2. Create the two live Customer Portal configurations.
3. Create the live webhook endpoint and signing secret.
4. Replace only the Supabase billing secrets with live `sk_live`, live `price_`, live `bpc_`, and live `whsec_` values.
5. Redeploy functions only if code changed; secret changes alone do not require source changes.
6. Run one controlled real payment/subscription with a test business you own.
7. Verify invoice, webhook, Billing page, cancellation and plan entitlement state before opening public signup.

## Taxes / VAT

Billing is technically ready to collect billing addresses and tax IDs, but enabling automated tax collection is a commercial/legal configuration decision. Before live sales, confirm VAT/tax obligations, Stripe Tax registrations/settings, invoice company details and prices (tax inclusive/exclusive) with the appropriate accountant/tax adviser for the Velliqo selling entity.
