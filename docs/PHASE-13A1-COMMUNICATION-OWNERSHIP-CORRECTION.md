# Phase 13A.1 — Communication Settings Ownership Correction

## Decision

Appointment confirmations, appointment updates and reminders are operational automations. Their owner-facing controls belong in:

**Owner → Marketing → Automations**

They do not belong in Storefront. Storefront remains responsible for:

- public business identity and branding;
- contact and location information;
- booking availability rules;
- cancellation policy and terms;
- SEO, discovery, public visibility and sharing.

## Marketing responsibility

Marketing → Automations now owns:

- appointment email confirmations and updates;
- appointment SMS confirmations and updates;
- email reminders;
- SMS reminders;
- default communication language;
- transactional reply-to email;
- customer lifecycle journeys such as birthday, win-back, review request and no-show recovery.

Marketing → Delivery remains responsible for provider-level delivery mode, channel availability, limits, sender identity and delivery logs.

## Data model

The database columns remain in `business_settings` because they are tenant-level operational preferences consumed by booking and notification workers. Moving the UI does not require a migration and does not duplicate data.

## Safety

Live delivery remains protected by the global `velliqo_communications_enabled` safety gate until Resend, Twilio, the verified domain and provider secrets are ready.
