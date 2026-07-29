# Phase 10B.2 — Precision Device Mockups

This refinement replaces approximate percentage-based screenshot placement with exact SVG screen geometry for every public marketing device.

## What changed

- Laptop, desktop, tablet and phone frames use fixed native view boxes and exact screen coordinates.
- Screenshots are clipped inside the real visible screen with SVG clip paths.
- Device-ready WebP captures use the exact aspect ratio of each screen, preventing stretching and accidental crops.
- Multi-device compositions stack on smaller viewports and overlap only inside a bounded desktop showcase.
- Decorative rotations were removed so the frame and the product interface share one perspective.
- Public sections no longer use negative horizontal positioning that can cover nearby copy.

## Capture ratios

- Laptop screen: 417 × 265
- Desktop screen: 679 × 356
- Tablet screen: 446 × 308
- Phone screen: 262 × 562

New product screenshots should be exported or cropped to the same ratios before being placed in `public/marketing/screens/precision`.

## Validation

Run:

```bash
npm run precision-devices:check
npm run responsive:check
npm run premium-marketing:check
npm run public-visual-contact:check
npm run typecheck
npm run build
```
