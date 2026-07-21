# Sprint L1 — Public Booking Localization

## Scope

The complete public booking flow now reacts to the selected language without a page refresh in English, Greek, German, Spanish and Turkish.

## Localized areas

- Booking header and four-step progress navigation
- Multi-service selection, duration and price formatting
- Professional selection and fallback descriptions
- Locale-aware weekday, month, date and currency formatting
- Availability loading, time-of-day groups and empty states
- Business closure messages and closure date ranges
- Signed-in and guest customer detail forms
- Validation, booking failures and slot-conflict messages
- Booking summary, mobile progress bar and confirmation screen
- Calendar export text, directions and customer appointment actions

## Quality guardrail

Added `npm run translations:check`. The command verifies:

- identical key sets across EN, EL, DE, ES and TR;
- translation keys referenced statically in TypeScript/TSX;
- empty or non-string translation values.

The check also restored missing AI, report tooltip/count and storefront announcement keys discovered during validation.

## Verification

- TypeScript syntax parse for `PublicBooking.tsx`: passed
- Locale key parity: passed
- Static translation-reference check: passed
