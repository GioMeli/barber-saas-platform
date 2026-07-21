# Sprint L1 — Dashboard Localization Pass

## Scope

This pass localizes the owner dashboard and its directly rendered dashboard components for English, Greek, German, Spanish, and Turkish.

## Localized areas

- Dashboard greeting and localized date
- Header actions
- Daily schedule header, empty state, staff columns, break blocks, appointment fallbacks, and legend
- KPI cards
- Business pulse
- Business status and closure date formatting
- Today's alerts
- Business health metrics
- Notification button, panel, states, timestamps, errors, and system notification content
- Store-link and dashboard-loading toast messages

## Runtime behavior

Changing language through the shared Language Switcher updates these areas immediately without a page refresh. Dates use the locale mapped to the active Velliqo language.

## Validation

- `npm run typecheck` passed
- `npm run build` passed
- Existing bundle-size warning remains unrelated to this localization pass
