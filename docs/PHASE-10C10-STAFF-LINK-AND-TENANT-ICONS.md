# Phase 10C.10 — Compact staff access + tenant PWA icons

This patch hardens two parts of the personal staff app experience.

## Staff member dialog

- The real employee-specific URL is still copied to the clipboard, but the owner UI no longer renders the entire tokenized URL.
- The dialog shows a compact route preview and keeps the complete URL in the element title for inspection.
- The access row now has `min-width: 0`, a shrink-safe copy button and explicit horizontal overflow protection.
- The main Edit Staff Member dialog is `overflow-x-hidden`, preventing a long URL or other intrinsic-width content from creating a horizontal scrollbar.

## Business-specific installed icons

- Business logo uploads now also create exact 192x192 and 512x512 PNG PWA icon assets.
- Existing logos are backfilled automatically when an owner opens the Staff page.
- Staff and storefront manifests prefer those exact tenant PNGs, while Velliqo icons remain fallback assets for installability resilience.
- Apple touch icon metadata also points to the generated business icon when the business id is available.

No database migration is required.
