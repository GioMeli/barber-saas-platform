# Sprint L1 — Storefront Localization

## Scope

This sprint completes localization for the owner-facing Storefront Studio and the main public storefront experience in English, Greek, German, Spanish and Turkish.

## Localized areas

- Storefront Studio page header, readiness score and section navigation
- Branding, contact, location and sharing forms
- Validation, loading, save and clipboard notifications
- Store QR sharing, copy, native share and download actions
- Shared image uploader labels, progress and notifications
- Public storefront header, desktop navigation and mobile menu
- Hero status, booking calls to action, closure messaging and quick access
- Services, team, gallery, products, announcements and contact sections
- Customer sign-in and registration modal
- Empty states, stock states, post-type labels and accessibility labels
- Footer labels and mobile booking call to action

## Locale-aware behavior

- Public service and product prices use the selected locale with EUR currency formatting.
- Closure and announcement dates use the selected language locale.
- Language changes update the owner and public storefront without a page refresh.

## Dynamic content boundary

Business-created names and descriptions—such as service names, employee biographies, product names, announcements and closure descriptions—continue to display exactly as entered. Their multilingual data model belongs to the separate Dynamic Business Content sprint.

## Quality checks

- `npm run typecheck` — passed
- `npm run build` — passed
- Biome lint on the five modified TSX files — passed
- Locale parity — 994 flattened keys in every supported language, with no missing or extra keys

The repository-wide Biome command still encounters the pre-existing invalid UTF-8 issue in `src/db/database.types.ts`; the modified Storefront files pass Biome independently.
