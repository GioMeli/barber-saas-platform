# Phase 12B — Transparent Velliqo Branding

The Velliqo brand mark now uses a transparent alpha background consistently across the web shell and generic installed PWA.

## Assets

- `/brand/velliqo-mark.png` — centered transparent master mark.
- `/icons/favicon-32.png` and `/icons/favicon-48.png` — transparent browser icons.
- `/icons/apple-touch-icon.png` — transparent 180×180 touch asset.
- `/icons/icon-192.png` and `/icons/icon-512.png` — transparent PWA icons.

The legacy `*-maskable.png` files are retained only for repository compatibility. They are no longer declared as `purpose: maskable` in the generic Velliqo manifest, because a maskable declaration allows the operating system/browser to render the artwork on a forced icon plate. The generic Velliqo manifest now advertises only transparent `purpose: any` assets.

The service-worker cache version and manifest URLs were bumped so existing browsers fetch the new assets instead of serving the previous opaque icons.

## UI treatment

The Velliqo mark is rendered directly on the page without a border, artificial rounded tile, or logo-specific shadow in Owner, Auth, Demo, and marketing chrome. The surrounding page may still have its normal background; the image itself has no canvas/background.

## Platform note

The application supplies transparent PNG artwork. An operating system, launcher, browser, or device may still choose to composite an app icon onto its own system-controlled shape or color. That outer system treatment cannot be disabled by a web app; Velliqo no longer adds its own opaque background.
