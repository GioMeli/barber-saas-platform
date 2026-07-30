# Phase 10C.2 — Premium Customer Storefront, Booking & Store PWA

## Scope

- Tenant-scoped service image upload, replacement and deletion.
- Client-side 4:3 WebP preparation before upload.
- Service thumbnails in the owner catalogue, public storefront and booking flow.
- Premium storefront service presentation and verified-review summary.
- Installable per-store PWA manifest with the business name, slug and logo.
- Android/desktop install prompt plus iPhone/iPad Add to Home Screen guidance.
- Owner controls for enabling the customer app and choosing a short installed-app name.

## Security boundaries

- Service media paths begin with the authenticated business ID.
- Storage writes call `has_business_access` in RLS policies.
- Public users receive read-only access to the existing public service-media bucket.
- The manifest endpoint only returns active, PWA-enabled businesses.
- Customer storefront installation never exposes owner routes or internal data.

## Image specifications

- Input: JPG, PNG or WebP, maximum 5 MB.
- Stored output: WebP, 800 × 600, 4:3.
- Recommended business logo: square artwork with safe padding.

## Deployment

1. Run `npx supabase db push` for migration `00042`.
2. Deploy the web application so `/api/store-manifest` is available on the same origin.
3. Test installation over HTTPS on Chromium and Add to Home Screen on iOS/iPadOS.
4. Run `npm run customer-experience:check`, `npm run typecheck` and `npm run build`.
