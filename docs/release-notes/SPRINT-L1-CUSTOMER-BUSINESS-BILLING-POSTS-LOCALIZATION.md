# Sprint L1 — Customer Portal, Business, Billing and Posts Localization

## Scope

This cumulative localization pass covers:

- Customer Portal
- Business closures and linked announcements
- Business Settings
- Billing and subscription screens
- Posts and announcements

## Implementation

All user-facing labels, actions, dialogs, validation messages, empty/loading states, confirmations, status badges and toast notifications in the covered modules now use i18next keys.

Locale-aware formatting was added for:

- appointment, closure, post, subscription and invoice dates;
- appointment times and relative countdowns;
- EUR currency values;
- subscription, invoice and appointment statuses.

The existing English, Greek, German, Spanish and Turkish locale files were updated cumulatively. No previous translation sections were removed.

## Validation

- `npm run translations:check` — passed
- 1,456 translation keys in each supported language
- 1,032 static translation references checked
- `npx --no-install tsc --noEmit --pretty false` — passed
- JSX text/attribute audit of the five changed pages — passed; only technical URL placeholders and non-user-facing fallback initials remain

## Changed files

- `src/pages/customer/CustomerPortal.tsx`
- `src/pages/owner/Business.tsx`
- `src/pages/owner/Settings.tsx`
- `src/pages/owner/Billing.tsx`
- `src/pages/owner/Posts.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/el.json`
- `src/i18n/locales/de.json`
- `src/i18n/locales/es.json`
- `src/i18n/locales/tr.json`
- `docs/development/TRANSLATION_PROGRESS.md`
