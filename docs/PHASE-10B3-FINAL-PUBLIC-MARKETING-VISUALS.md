# Phase 10B.3 — Final Public Marketing Visuals

This phase replaces the earlier reconstructed device mockups in the primary public marketing routes with the final product captures supplied for Velliqo.

## Final asset library

The eight assets live under `public/marketing/final/`:

- AI on mobile and laptop
- Owner Home on mobile, laptop and desktop
- Calendar on mobile and desktop
- Customer storefront on mobile and laptop

The images are complete device compositions. They are rendered directly with `object-contain`; they are not inserted into a second synthetic bezel or stretched to a different aspect ratio.

## Shared rendering components

`src/components/marketing/FinalProductVisuals.tsx` provides:

- `FinalProductVisual`
- `FinalProductPair`
- `FinalProductGallery`

These components provide responsive containment, intrinsic image rendering, priority loading for hero assets and consistent shadows/surfaces.

## Updated public routes

- `/`
- `/experience`
- `/velliqo-ai`
- `/why-velliqo`
- `/pricing`

The final captures are matched to the section they demonstrate: owner home, calendar, Velliqo AI and customer storefront.

## Validation

Run:

```bash
npm run final-marketing-visuals:check
npm run typecheck
npm run build
```

The dedicated check verifies all eight assets, the shared rendering layer and references in each updated public page.
