# Phase 10C.1 - Full Demo and Professional Courses

## Full owner demo

`/demo` now opens a complete owner-style workspace rather than a small product widget. The demo mirrors the owner navigation and includes local-only versions of Home, Calendar, Sales, Finance, Customers, Staff, Services, Products, Marketing, Posts, Gallery, Storefront, Business, Reports, Billing, Velliqo AI, Courses and Settings.

All demo actions use React state. The demo imports no Supabase client, performs no database query and sends no provider request. Actions may be completed to demonstrate the workflow, but they disappear after refresh or Reset Demo.

## Courses

`/courses` is available to everyone. The owner Training Portal remains at `/dashboard/training` with local progress tracking. Both surfaces use the same 12-course catalog and localized PDF paths.

Each course is ready for a future `videoUrl`. Until videos are supplied, the interface shows a clear video-coming-soon state and offers a direct practice link to the corresponding demo module.

## Professional PDF guides

The 60 PDFs were regenerated for English, Greek, German, Spanish and Turkish. Each PDF contains:

- Velliqo branding and logo
- the exact owner workspace route
- guide-specific step-by-step instructions
- real Velliqo application screenshots
- verification and troubleshooting guidance
- a final owner checklist
- security and data-protection reminders

Run `python scripts/generate-training-pdfs.py` whenever guide content or screenshots change.

## Validation

```bash
npm run demo-training:check
npm run translations:check
npm run typecheck
npm run build
```
