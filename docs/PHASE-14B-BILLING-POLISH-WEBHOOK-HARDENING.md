# Phase 14B — Billing Polish, Stripe Webhook Hardening & Signup Viewport Fit

## Scope

This phase hardens the Stripe webhook signature path for Supabase Edge Functions, improves the Stripe-hosted Checkout/Portal experience, and keeps the Owner sign-up form fully visible on desktop after adding plan selection.

## 1. Stripe webhook verification

`stripe_webhook` now follows the Supabase/Deno Web Crypto verification path:

- reads the exact raw request body with `request.text()`
- uses `Stripe.createSubtleCryptoProvider()`
- verifies with `stripe.webhooks.constructEventAsync(...)`
- supports an optional `STRIPE_WEBHOOK_SECRET_PREVIOUS` during secret rotation
- never logs the webhook signing secret or the incoming Stripe signature

The public Stripe webhook must remain deployed with JWT verification disabled because Stripe authenticates requests with its own signature.

### Required sandbox secret re-sync

In Stripe Sandbox > Workbench > Webhooks > select the exact Velliqo endpoint > reveal its Signing secret. Copy that endpoint-specific `whsec_...` value and run:

```powershell
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_FROM_THE_EXACT_SANDBOX_ENDPOINT"
npx supabase functions deploy stripe_webhook --no-verify-jwt
```

Do not use a Stripe API secret key, Stripe CLI signing secret, or a signing secret from another webhook endpoint.

After deployment, use Stripe > Event deliveries > Resend on one previously failed event. The delivery should change from HTTP 400 `Invalid Stripe signature` to HTTP 200. Stripe retries prior failures automatically as well.

`STRIPE_WEBHOOK_SECRET_PREVIOUS` is optional and should only be set during a deliberate signing-secret rotation window.

## 2. Stripe-hosted Checkout polish

Checkout now:

- follows the selected Velliqo language (`en`, `el`, `de`, `es`, `tr`)
- explains clearly whether the customer is starting a 14-day trial, a normal monthly auto-renewing plan, or a fixed-term non-renewing offer
- tells the user there is no immediate charge when a trial is active
- includes clear post-submit return copy
- enables secure Checkout Session recovery if an open session expires
- still requires a payment method before the trial starts
- still collects billing address and tax ID information

The Customer Portal also follows the active Velliqo language.

## 3. Stripe visual branding

Stripe-hosted pages use the Stripe account's Branding settings. Configure this once in Sandbox and repeat it in Live before launch.

Recommended source assets from this repository:

- Icon: `public/brand/velliqo-mark-transparent-v2.png`
- Logo: `public/brand/velliqo-logo-transparent.png`

Recommended visual configuration:

- Business display name: `Velliqo`
- Brand/accent colour: use the Velliqo purple from the production UI
- Background: white / very light neutral
- Font: `Montserrat` if available in the Stripe Branding UI; otherwise `Inter`
- Shapes: rounded

Review the preview for Checkout, Customer Portal, invoices and receipts. Do not upload the old square-background logo.

## 4. Sign-up viewport fit

Desktop sign-up now uses the dynamic viewport (`100dvh`) and removes desktop scrolling. The plan selector, Owner details, primary action, business-type return control, privacy note and existing-login link remain in the same viewport on standard laptop/desktop displays.

Mobile remains naturally scrollable and now exposes both the business-type return control and language selector in the mobile header.

## Validation

Run:

```powershell
npm run billing:check
npm run responsive:check
npm run production:check
npm run translations:check
npm run typecheck
npm run build
```

Then deploy:

```powershell
npx supabase functions deploy stripe_webhook --no-verify-jwt
npx supabase functions deploy create_subscription_checkout
npx supabase functions deploy create_billing_portal_session
```

No database migration is required for Phase 14B.
