# Phase 12F — Complete Training, Certification and Owner Session Stability

## Scope

Phase 12F turns Training into a complete application-learning and certification system for both Owners and Staff. It also prevents background Supabase Auth revalidation from unmounting the Owner workspace and discarding an open React form.

## Curriculum coverage

The source of truth is `src/training/curriculum.ts`.

- Owner curriculum: 37 detailed lessons.
- Staff curriculum: 12 detailed lessons.
- Supported languages: English, Greek, German, Spanish and Turkish.
- Every lesson includes: feature title, exact workspace/page, objective, ordered workflow, required fields/checklist, expected result, safety guidance and a feature-specific visual.

The Owner curriculum covers account creation, onboarding, navigation, Tour, Training, Velliqo AI, Storefront configuration, services, staff, availability, Staff Portal access, calendar, appointments, delays, closures, customers, products, inventory, sales, transactions, finance, campaigns, delivery automations, reviews, posts, gallery, reports, exports, AI voice/actions/settings, billing and security.

The Staff curriculum covers OTP access on multiple devices, installation, navigation, schedule views, customers, appointment creation and management, realtime synchronization, profile/contact actions, permissions, privacy, trusted devices and certification.

## Feature visuals

`TrainingLessonVisual.tsx` supplies a fixed-size, feature-specific visual for every lesson using the application's local Lucide iconography and premium gradients. No generated image or external image URL is required, and the visual does not change card/dialog dimensions.

## Public Courses and Owner/Staff Training

- `/courses` exposes the detailed curriculum in read-only mode.
- `Owner → Training` stores lesson completion and certification progress.
- The Staff App exposes Training from desktop actions, the visible Training card, mobile bottom navigation and the More sheet.
- Course PDFs, optional videos and workspace/demo links remain available.

## Assessment

`src/training/quiz.ts` builds exactly 50 localized multiple-choice questions for each audience.

- Four answers per question.
- Five questions per page.
- All 50 questions must be answered.
- The assessment unlocks only when curriculum completion is 100%.
- Passing score: 80% or higher.
- Failed attempts can be repeated.
- Latest score, best score and attempt count are persisted.

## Certificate PDF

After a passing result, `trainingCertificatePdf.ts` creates a downloadable landscape PDF containing:

- Velliqo transparent branding.
- Participant's Owner or Staff name.
- Business name.
- Role-specific certification scope.
- Best assessment score.
- Issue date.
- Unique certificate number.

The certificate is rendered through Canvas before PDF encoding, so names using Greek and other Unicode characters remain visible.

## Persistence and RLS

Migration `00049_velliqo_training_certification.sql` creates `training_certifications`.

- Progress is synchronized to Supabase.
- Local storage remains a recovery/cache layer.
- Owners can only access their own Owner certification for a business they own.
- Staff can only access their own Staff certification when personal access remains active.
- Database constraints require score >=80 and the full current lesson count before a record can be marked passed.

Apply with:

```bash
npx supabase db push
```

No new Edge Function is required.

## Owner form-preserving auth refresh

`src/hooks/useAuth.ts` distinguishes initial/sign-in hydration from background token refresh. `TOKEN_REFRESHED` and tab-focus session recovery for the already hydrated user revalidate profile/membership data without setting the global blocking loading state. Therefore `ProtectedRoute` and `RequireOnboarding` do not replace the Owner workspace with a loading screen and do not unmount an open form.

This protects forms during background authentication refresh or returning to the browser tab. A deliberate browser reload, tab close, route change or device shutdown still requires each form to implement draft persistence separately if that behavior is desired later.

## Validation

Run:

```bash
npm run translations:check
npm run demo-training:check
npm run phase12:check
npm run phase12d:check
npm run training-certification:check
npm run owner-ux:check
npm run staff-ux:check
npm run responsive:check
npm run production:check
npm run typecheck
npm run build
```
