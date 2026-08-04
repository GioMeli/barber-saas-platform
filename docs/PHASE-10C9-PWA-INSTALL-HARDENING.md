# Phase 10C.9 — Staff PWA install hardening

This patch fixes the employee-specific PWA installation flow that could remain on **Opening installer…** and could install with the generic Velliqo identity instead of the business identity.

## Root cause

The HTML document initially linked the generic `/manifest.webmanifest`. React replaced that manifest later with the employee-specific staff manifest. During workspace refreshes, the `useStaffPWA` effect cleanup also temporarily restored the generic manifest before assigning the employee manifest again. Chromium can create the deferred `beforeinstallprompt` event from the manifest that was active at installability detection time, so a later manifest swap can leave a stale install prompt.

The staff manifest also advertised tenant logos using `sizes: any`. Chromium installability guidance expects explicit 192x192 and 512x512 icon entries.

## Changes

- Select the staff/store manifest in `<head>` before React boots.
- Capture `beforeinstallprompt` globally before page components mount.
- Prevent dependency updates from transiently restoring the generic manifest.
- Add a 15-second recovery path so the custom install dialog cannot remain stuck indefinitely.
- Keep the employee name in staff links, magic-link redirects, PWA start URL and shortcuts.
- Advertise the business logo at explicit 192x192 and 512x512 sizes with Velliqo raster fallbacks.
- Apply the same early-manifest protection to customer storefront PWAs.

No database migration is required.

## Deployment

Deploy the frontend/API changes to Vercel. Because `manage-staff-access` and `staff-device-auth` now generate staff URLs containing `employeeName`, redeploy those two Supabase Edge Functions as well.

## Clean-install validation

1. Deploy the patch.
2. In the browser, remove any previously installed staff PWA for the same employee/business.
3. In DevTools > Application > Storage, clear site data for the Velliqo deployment once, or use a fresh browser profile.
4. Open the employee-specific staff link generated from Owner > Staff.
5. Confirm Application > Manifest shows the employee/business name, employee-specific `id`, business logo and 192x192 + 512x512 icon entries.
6. Click **Install personal app**.
7. Confirm the native browser installer opens and the installed app uses the business logo.
8. Launch the installed app and confirm the URL restores the same `employee` identity and trusted-device session.

## Validation commands

```bash
npm run production:check
npm run staff-access:check
npm run translations:check
npm run typecheck
npm run build
```
