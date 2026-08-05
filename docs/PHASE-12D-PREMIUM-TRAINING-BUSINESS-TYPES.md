# Phase 12D — Premium Training and Business Types

## Scope

This phase upgrades presentation only. Existing course filters, PDFs, videos, demo routes, owner completion tracking, industry search, category grouping, local selection persistence and sign-up routing remain unchanged.

## Training and Courses

Both the public `/courses` page and Owner Training Portal now use a shared `TrainingCourseVisual` component. Every lesson receives a fixed-height visual header based on its lesson and category, stronger card contrast, clearer hierarchy and premium depth. The fixed media region prevents course cards from changing height when video availability changes.

## Business Types

The Business Types page keeps its existing search, category grouping and sign-up behavior. Each industry card now contains a fixed-height local vector illustration through `IndustryVisual`. Illustrations use the existing industry registry and Lucide assets already bundled with Velliqo; no generated imagery or remote image dependency is introduced.

The fixed visual height (`118px`) and consistent card minimum height ensure that illustrations never distort the grid or change card dimensions.

## Validation

Run:

```bash
npm run phase12d:check
npm run responsive:check
npm run typecheck
npm run build
```
