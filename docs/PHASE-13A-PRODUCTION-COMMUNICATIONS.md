# Phase 13A — Production Email/SMS Communications

## What is completed without a domain

Phase 13A completes the code and database architecture before live provider activation:

- tenant-controlled appointment email and SMS settings in **Owner → Marketing → Automations**;
- professional tenant-branded email templates;
- localized communication content in English, Greek, Turkish, German and Spanish;
- booking confirmation, cancellation and rescheduling messages;
- 24-hour and 2-hour reminders;
- email delivery through Resend;
- SMS delivery through Twilio;
- queue claiming, stale-lock recovery and exponential retry delays;
- idempotent delivery rows to reduce duplicate sends;
- Resend and Twilio delivery callbacks for both marketing and transactional messages;
- delivery-event audit tables;
- Supabase Cron workers controlled through Vault;
- a global safety gate that keeps real delivery disabled until providers are ready.

A purchased domain is **not required** to apply this code, run validation, deploy the functions or push the migration.

## What still requires the final domain

The domain is required before live email delivery because:

1. Resend must verify a sending domain using DNS records.
2. Supabase Auth Custom SMTP must use a production sender for Staff OTP and other Auth emails.
3. `APP_PUBLIC_URL`, email links, QR codes and redirect URLs must use the final production URL.
4. SPF, DKIM and preferably DMARC must be configured for deliverability.

Recommended separation after the domain is purchased:

- `auth.example.com` — Supabase Auth/OTP sender reputation;
- `notify.example.com` — appointment and reminder emails;
- `marketing.example.com` — promotional communication.

## SMS dependency

SMS does not require the Velliqo web domain. It requires:

- a Twilio account;
- a Messaging Service;
- at least one approved sender in its Sender Pool;
- country-specific sender registration/compliance where required;
- Twilio secrets in Supabase;
- a public status-callback Edge Function URL.

Leave the appointment SMS toggles in Marketing → Automations off until the Twilio account and sender are approved.

## Deployment now — safe while providers are unavailable

1. Run the repository checks.
2. Apply migration `00050_velliqo_production_communications.sql`.
3. Deploy the four communication Edge Functions.
4. Keep Vault secret `velliqo_communications_enabled` set to `false` or unset.
5. Push the frontend.

The cron jobs will run as no-ops until the safety gate is explicitly enabled.

## Edge Functions to deploy

```powershell
npx supabase functions deploy process_appointment_notifications --no-verify-jwt
npx supabase functions deploy process_reminder_jobs --no-verify-jwt
npx supabase functions deploy resend-marketing-webhook --no-verify-jwt
npx supabase functions deploy twilio-marketing-webhook --no-verify-jwt
```

## Hosted Edge Function secrets

Generate three different random secrets. Do not reuse them.

```powershell
npx supabase secrets set `
  NOTIFICATION_FUNCTION_SECRET="<LONG_RANDOM_VALUE>" `
  REMINDER_FUNCTION_SECRET="<DIFFERENT_LONG_RANDOM_VALUE>" `
  MARKETING_FUNCTION_SECRET="<DIFFERENT_LONG_RANDOM_VALUE>" `
  APP_PUBLIC_URL="https://temporary-or-final-app-url.example"
```

Provider secrets are added later:

```text
RESEND_API_KEY
RESEND_WEBHOOK_SECRET
EMAIL_FROM
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER
TWILIO_STATUS_CALLBACK_URL
TRANSACTIONAL_TWILIO_STATUS_CALLBACK_URL
```

## Vault configuration

Create these Vault values through the Supabase Dashboard/SQL editor. The two secret values must match the Edge Function secrets above.

```text
velliqo_communications_enabled = false
velliqo_appointment_notification_worker_url = https://PROJECT_REF.supabase.co/functions/v1/process_appointment_notifications
velliqo_reminder_worker_url = https://PROJECT_REF.supabase.co/functions/v1/process_reminder_jobs
velliqo_notification_function_secret = <NOTIFICATION_FUNCTION_SECRET>
velliqo_reminder_function_secret = <REMINDER_FUNCTION_SECRET>
```

Only after Resend and/or Twilio are fully configured and tested:

```text
velliqo_communications_enabled = true
```

## Marketing automation controls

The Owner can manage:

- appointment emails;
- appointment SMS;
- automated email reminders;
- automated SMS reminders;
- communication language;
- reply-to email.

Provider credentials remain platform-level secrets. Business owners never see or edit provider credentials.

## Test matrix before live activation

Test each event with a dedicated test business and real destinations:

| Event | Email | SMS | Owner alert |
|---|---:|---:|---:|
| New booking | Yes | Yes | Email |
| Cancellation | Yes | Yes | Existing in-app/owner workflows |
| Reschedule | Yes | Yes | Email |
| 24-hour reminder | Yes | Yes | Not applicable |
| 2-hour reminder | Yes | Yes | Not applicable |
| Resend delivered/bounced/complained callback | Yes | N/A | Audit |
| Twilio delivered/failed callback | N/A | Yes | Audit |

Verify language, timezone, business logo, reply-to address, store URL, booking reference, duplicate prevention and tenant isolation.

## Final activation order

1. Buy the final domain.
2. Connect it to Vercel and Supabase Auth redirects.
3. Verify Resend subdomains and DNS records.
4. Configure Supabase Custom SMTP for Staff OTP.
5. Configure Twilio sender/compliance.
6. Set live provider secrets.
7. Send controlled test messages.
8. Enable `velliqo_communications_enabled`.
9. Observe queues and webhook events for at least 24 hours before public launch.
