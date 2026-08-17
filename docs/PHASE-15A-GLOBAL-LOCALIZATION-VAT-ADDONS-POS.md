# Phase 15A — Global Localization, VAT-Inclusive Pricing, Add-ons & POS Foundation

## Scope

Phase 15A prepares Velliqo for the final pre-launch hardening sequence by adding:

- five-language switching (English, Greek, German, Spanish, Turkish) across the public website, auth pages, public storefront/customer surfaces and demo chrome;
- revised plan pricing and Premium SMS allowance;
- VAT-inclusive Stripe pricing enforcement;
- Owner Add-ons for SMS, email and Velliqo AI capacity;
- quota-exhaustion notifications and an Owner popup;
- a recurring Velliqo POS Suite entitlement/workspace;
- add-on revenue/MRR separation in Platform Admin economics and CSV exports.

## Plans

| Plan | Monthly price | Premium SMS change |
|---|---:|---:|
| Standard | €34.99 | 25 SMS included |
| Professional (`pro` internal id) | €59.99 | 150 SMS included |
| Premium | €100.99 | 250 SMS included |

The public name is **Professional**, while the internal database/API id remains `pro` to avoid breaking existing entitlements and migrations.

## VAT-inclusive billing

Velliqo presents the listed EUR plan and add-on prices as VAT-inclusive where tax applies. The plan Checkout refuses a configured Stripe Price unless `tax_behavior` is `inclusive`. Add-on Checkout creates inline Stripe Price data with `tax_behavior: inclusive`.

Before Sandbox acceptance testing:

1. Configure Stripe Tax in Sandbox.
2. Create three new monthly EUR Prices, each on its own plan Product (required by the existing Customer Portal switching model):
   - Standard — €34.99/month — tax behavior **Inclusive**
   - Professional — €59.99/month — tax behavior **Inclusive**
   - Premium — €100.99/month — tax behavior **Inclusive**
3. Replace the three eligible products/prices in the normal Stripe Customer Portal configuration.
4. Update Supabase function secrets:
   - `STRIPE_PRICE_STANDARD`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PREMIUM`
   - `STRIPE_AUTOMATIC_TAX=true` after Stripe Tax is configured.

Do not reuse the former €29.99 / €49.99 / €89.99 Price IDs: the Checkout intentionally rejects them.

## Add-on catalogue

### SMS

- 100 SMS — €14.99
- 250 SMS — €34.99
- 500 SMS — €64.99
- 1,000 SMS — €119.99

### Email

- 1,000 emails — €4.99
- 5,000 emails — €14.99
- 10,000 emails — €24.99

### Velliqo AI

- 100 AI requests + 350K tokens — €9.99
- 500 AI requests + 1.75M tokens — €39.99
- 1,000 AI requests + 3.5M tokens — €69.99

Capacity packs can be purchased either:

- **Current billing cycle** — one-time payment; entitlement ends with the current base-plan billing period.
- **Monthly** — separate recurring Stripe subscription until cancelled or until the base Velliqo subscription ends.

When the effective email, SMS or AI allowance is exhausted, the server creates a quota alert and Owner notification. The globally mounted Owner quota dialog links directly to `/dashboard/addons`.

SMS provider cost varies by destination, message segmentation and carrier. The commercial pack prices must therefore be rechecked against live destination economics during the Twilio cutover before global activation.

## Velliqo POS Suite

Price: **€45.99/month** (recurring-only add-on).

The entitlement/workspace includes the product surface for:

- Tap to Pay on compatible mobile devices
- appointment-linked payments
- online payments
- deposits
- no-show and cancellation charges
- tips
- refunds
- payment links
- daily close
- payment history
- customer wallet / loyalty balance
- AI financial analysis
- payment reports

Phase 15A intentionally does **not** pretend that contactless card acceptance is already live in the browser/PWA. Real Tap to Pay requires Stripe Terminal native iOS/Android/React Native integration. The POS workspace is entitlement- and provider-ready; payment-provider execution is completed during the planned Live Stripe Connect/Terminal cutover.

For merchant payments, Velliqo's target payment architecture is Stripe Connect **direct charges** with the merchant/Owner connected account receiving the charge and bearing processing fees/refunds/chargebacks according to the final connected-account configuration. Velliqo must not silently absorb merchant card-processing fees.

## Platform Admin economics

`/admin → Economics` now separates:

- paid plan revenue;
- paid add-on revenue;
- plan MRR;
- recurring add-on MRR;
- total MRR;
- AI provider cost and token ledger;
- email cost;
- SMS cost;
- payment cost;
- infrastructure allocation;
- total operating cost;
- estimated operating contribution and margin.

The Platform summary CSV includes plan/add-on revenue and MRR separately. Owner profitability CSV and AI cost ledger CSV remain available.

### Recurring Velliqo operating-cost ledger

`/admin → Cost Model` now also contains a named recurring platform-cost ledger. A Platform Admin can add, pause/reactivate, edit and remove recurring monthly expenses such as Supabase, Vercel, Resend, monitoring, domains, support tooling, legal/compliance or another operational supplier. Each line stores its category, monthly EUR cost and optional notes.

These detailed recurring costs are included automatically in Platform Economics and allocated across active businesses for per-Owner profitability analysis. The ledger has its own detailed CSV export so the estimated Velliqo contribution can be reconciled outside the application without opening Supabase or another administration tool.

## Database / functions

Migration:

`supabase/migrations/00055_velliqo_addons_vat_localization_pos.sql`

New Edge Functions:

- `create_addon_checkout`
- `cancel_addon_subscription`

Changed Edge Functions:

- `create_subscription_checkout`
- `reconcile_subscription_checkout`
- `stripe_webhook`
- `velliqo-ai-manager`

## Deployment

Run local checks first:

```powershell
npm run phase15a:check
npm run translations:check
npm run billing:check
npm run responsive:check
npm run production:check
npm run typecheck
npm run build
```

After creating and configuring the new Stripe Sandbox Prices:

```powershell
npx supabase secrets set STRIPE_PRICE_STANDARD="price_..."
npx supabase secrets set STRIPE_PRICE_PRO="price_..."
npx supabase secrets set STRIPE_PRICE_PREMIUM="price_..."
npx supabase secrets set STRIPE_AUTOMATIC_TAX="true"

npx supabase db push

npx supabase functions deploy create_subscription_checkout
npx supabase functions deploy reconcile_subscription_checkout
npx supabase functions deploy create_addon_checkout
npx supabase functions deploy cancel_addon_subscription
npx supabase functions deploy stripe_webhook --no-verify-jwt
npx supabase functions deploy velliqo-ai-manager
```

Then perform Sandbox acceptance tests for all three plans, VAT display/calculation, one-time and recurring add-ons, quota exhaustion, add-on cancellation, base-plan cancellation with recurring add-ons, and Platform Admin economics exports.
