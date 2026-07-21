# Sprint L1 — Customers Localization

## Scope

Localized the owner Customers page and Customer Profile workflow through the shared i18next runtime.

## Included

- Customer page header, summary cards, filters, search, tables and mobile cards
- Add/edit customer dialog
- Customer validation, confirmation prompts and toast messages
- Customer type badges and localized date formatting
- Customer profile metrics, contact information and tabs
- Customer record creation/editing/deletion workflow
- Record types, empty states and appointment history labels
- Locale-aware customer, record and appointment dates

## Files

- `src/pages/owner/Customers.tsx`
- `src/pages/owner/CustomerProfile.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/el.json`
- `src/i18n/locales/de.json`
- `src/i18n/locales/es.json`
- `src/i18n/locales/tr.json`

## Validation note

The repository snapshot does not include `node_modules`, and dependency installation was unavailable in the execution environment. TypeScript parsing found no new syntax errors in the changed files; full dependency-aware typecheck and Vite build should be run after `npm install` locally.
