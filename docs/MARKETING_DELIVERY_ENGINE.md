# Velliqo Marketing Delivery Engine — Phase 8

## Purpose

Phase 8 converts Marketing campaigns and supported automations from configuration-only records into a controlled server-side delivery pipeline.

The browser never sends bulk messages directly. Campaigns are materialised into an auditable queue, revalidated against the latest consent state immediately before delivery, and processed by a protected Supabase Edge Function.

## Safety model

- Every business starts in `disabled` delivery mode.
- `test` mode sends only to configured test destinations, or simulates delivery when no test destination is configured.
- `live` mode is the only mode that can contact real customers.
- Email and SMS channels must be enabled separately.
- Daily per-business email and SMS limits are enforced by the worker.
- Queue rows use idempotency keys, bounded retries and exponential backoff.
- Consent and suppressions are rechecked immediately before every send.
- Provider events are stored idempotently.
- Owner users can read delivery logs but cannot write queue/provider event rows directly.

## Included components

### Database migration

`supabase/migrations/00034_marketing_delivery_engine.sql`

Creates:

- `marketing_delivery_settings`
- `marketing_delivery_runs`
- `marketing_deliveries`
- `marketing_delivery_events`
- `marketing_suppressions`
- `customer_notifications`
- secure queue, claim and revalidation RPCs
- customer preference/suppression synchronization
- real-time customer inbox publication

### Edge Functions

- `process_marketing_deliveries`
- `marketing-unsubscribe`
- `resend-marketing-webhook`
- `twilio-marketing-webhook`

### Supported automation execution

- Birthday
- Win-back
- Review request
- No-show recovery

Last-minute availability remains intentionally manual until a specific calendar-slot trigger is implemented. This prevents broad, context-free sends.

## 1. Apply the database migration

From the linked repository:

```powershell
npx supabase migration list
npx supabase db push --dry-run
```

The preview should show only:

```text
00034_marketing_delivery_engine.sql
```

Then apply:

```powershell
npx supabase db push
```

Never use `supabase db reset --linked` against the hosted project.

## 2. Configure Edge Function secrets

Generate a long random worker secret. In PowerShell:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$marketingSecret = [Convert]::ToBase64String($bytes)
$marketingSecret
```

Set hosted secrets. Replace every placeholder with the real value:

```powershell
npx supabase secrets set `
  MARKETING_FUNCTION_SECRET="$marketingSecret" `
  APP_PUBLIC_URL="https://YOUR-VELLIQO-DOMAIN" `
  RESEND_API_KEY="re_xxxxxxxxx" `
  RESEND_WEBHOOK_SECRET="whsec_xxxxxxxxx" `
  EMAIL_FROM="Velliqo <notifications@YOUR-VERIFIED-DOMAIN>" `
  MARKETING_TEST_EMAIL="YOUR-TEST-EMAIL" `
  TWILIO_ACCOUNT_SID="ACxxxxxxxxx" `
  TWILIO_AUTH_TOKEN="xxxxxxxxx" `
  TWILIO_MESSAGING_SERVICE_SID="MGxxxxxxxxx" `
  TWILIO_STATUS_CALLBACK_URL="https://PROJECT_REF.supabase.co/functions/v1/twilio-marketing-webhook" `
  MARKETING_TEST_PHONE="+35700000000"
```

SMS is optional. Omit Twilio secrets until the provider is ready. The channel must remain disabled in the Velliqo Delivery Center until configuration is complete.

## 3. Deploy the Edge Functions

```powershell
npx supabase functions deploy process_marketing_deliveries --no-verify-jwt
npx supabase functions deploy marketing-unsubscribe --no-verify-jwt
npx supabase functions deploy resend-marketing-webhook --no-verify-jwt
npx supabase functions deploy twilio-marketing-webhook --no-verify-jwt
```

These public endpoints implement their own authentication:

- worker: shared secret header
- Resend: Svix webhook signature
- Twilio: `X-Twilio-Signature`
- unsubscribe: unguessable customer token and confirmation POST

## 4. Configure Resend

In Resend:

1. Verify the sending domain used by `EMAIL_FROM`.
2. Create a webhook pointing to:

```text
https://PROJECT_REF.supabase.co/functions/v1/resend-marketing-webhook
```

3. Subscribe to delivery, bounce, complaint, failure and delay events.
4. Copy the signing secret into `RESEND_WEBHOOK_SECRET`.

Every marketing email includes a visible unsubscribe link and one-click `List-Unsubscribe` headers.

## 5. Configure Twilio

For outbound status callbacks use:

```text
https://PROJECT_REF.supabase.co/functions/v1/twilio-marketing-webhook
```

Configure the same URL as the incoming-message webhook for the Messaging Service or sender number. The function verifies Twilio signatures and processes STOP/START-style preference keywords.

## 6. Schedule the worker

Create a Supabase Cron job that performs an HTTP `POST` every minute to:

```text
https://PROJECT_REF.supabase.co/functions/v1/process_marketing_deliveries
```

Header:

```text
x-marketing-secret: THE_SAME_MARKETING_FUNCTION_SECRET
```

Body:

```json
{}
```

Use the Supabase Dashboard Cron integration or a Vault-backed `pg_cron`/`pg_net` job. Do not hard-code the secret in a committed migration.

## 7. Manual worker test

Before scheduling, test the protected worker:

```powershell
$headers = @{ "x-marketing-secret" = $marketingSecret }
Invoke-RestMethod `
  -Method Post `
  -Uri "https://PROJECT_REF.supabase.co/functions/v1/process_marketing_deliveries" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body "{}"
```

A successful empty run should return queue counters and no authentication error.

## 8. Safe activation sequence

1. Open `Marketing → Delivery`.
2. Keep `Delivery mode = Disabled` while configuring providers.
3. Enable only the intended channel.
4. Set conservative daily limits.
5. Change to `Test mode`.
6. Queue a campaign with one or more eligible customers.
7. Confirm the test destination, delivery run, delivery row and provider webhook event.
8. Test email unsubscribe and SMS STOP behavior.
9. Only after successful verification, change to `Live mode`.

## 9. Customer consent rules

Email requires:

- marketing consent
- email channel enabled
- valid email destination
- no active email suppression

SMS requires:

- marketing consent
- SMS channel enabled
- valid phone destination
- no active SMS suppression

In-app requires a registered Velliqo customer account. Promotional email/SMS consent is not required for the in-app channel.

Re-consent lifts only customer-created suppressions. Bounce, complaint, provider and owner suppressions remain active for safety.

## 10. Production verification checklist

```powershell
npm ci
npm run delivery:check
npm run marketing:check
npm run production:check
npm run translations:check
npm run ui:check
npm run sales:check
npm run finance:check
npm run typecheck
npm run build
```

Then verify:

- disabled mode cannot send
- test mode never contacts real customer destinations
- live mode requires enabled provider channel
- duplicate campaign queue requests create one run
- retries do not duplicate provider messages
- unsubscribe takes effect before the next worker run
- bounced/complained email is suppressed
- invalid SMS destination is suppressed
- customer in-app notification is visible only to that customer
- owner delivery logs are isolated by business
