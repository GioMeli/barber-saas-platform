# Sprint L1.4 — Staff Localization

## Scope

The owner Staff module is fully connected to the shared i18next runtime for English, Greek, German, Spanish, and Turkish.

## Implemented

- Staff page header, summary metrics, cards, statuses, contact fallbacks, service badges, actions, loading and empty states.
- Add/edit staff dialog, profile fields, service assignment, working hours, inactive dates and recurring breaks.
- Localized weekday names and pluralized schedule/break summaries.
- Localized validation, confirmation, success and error notifications.
- Language changes update the open Staff page and dialog without a refresh.
- Existing Supabase queries and persistence behavior were preserved.

## Validation

- `npm run typecheck` passed.
- A full Vite build could not be executed in the delivery environment because the uploaded `package-lock.json` is not synchronized with `package.json`, and `vite` was therefore not installed. Run `npm install` followed by `npm run build` in the development workspace.
