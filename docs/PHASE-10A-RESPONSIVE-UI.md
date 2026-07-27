# Phase 10A — Responsive UI Foundation

Phase 10A establishes a consistent responsive foundation for the Velliqo owner workspace and the customer-facing booking experience. It does not redesign the public marketing site; that is Phase 10B.

## Supported viewport targets

The implementation is designed for the following representative widths:

- 320–374 px: compact phones
- 375–430 px: standard and large phones
- 768–1023 px: tablets and small landscape devices
- 1024–1439 px: laptops and standard desktops
- 1440 px and above: wide desktop workspaces

## Owner workspace

- The fixed sidebar now starts at the large breakpoint. Tablets use the full-width workspace with the navigation drawer.
- A safe-area-aware mobile navigation dock exposes Home, Calendar, Sales, Velliqo AI and the full menu.
- Velliqo AI remains visible in the top bar and mobile dock.
- The owner content area reserves space for the mobile dock and prevents horizontal viewport overflow.
- Page headers and action groups stack automatically on narrow screens.
- Calendar height accounts for the mobile top bar and bottom navigation.
- AI conversation history, chat viewport, composer and action confirmation controls adapt to phone heights and widths.

## Customer and public experience

- Public navigation, authentication dialogs and the fixed booking CTA use dynamic viewport and safe-area units.
- Public booking steps use snap scrolling on narrow screens.
- The booking summary dock no longer overlaps the final content.
- Customer portal hero actions, appointment actions and profile save controls become full-width on phones.
- Generic service and appointment icons are used instead of industry-specific fallbacks.

## Shared UI primitives

- Dialogs use bounded `100dvh` heights and scroll internally on small devices.
- Sheets use a maximum viewport height and 92% phone width.
- Tables use contained horizontal scrolling.
- Tabs allow horizontal scrolling without shrinking labels.
- Common page, toolbar, action, card and metric classes enforce `min-width: 0` and mobile stacking.

## Automated validation

Run:

```bash
npm run responsive:check
```

The validator checks the responsive owner shell, mobile navigation, shared primitives, calendar, AI chat, customer portal and public booking safeguards. It is also included in the GitHub quality gate.

## Manual smoke-test matrix

After applying this phase, manually verify at 320, 390, 768, 1024 and 1440 px:

1. Owner sidebar/drawer and mobile bottom navigation.
2. Owner Home, Calendar, Sales, Customers, Staff, Services, Products, Marketing, Reports, Billing, AI and Settings.
3. Customer storefront, booking steps, customer account and authentication dialog.
4. Dialog keyboard focus, close controls, scroll containment and fixed bottom actions.
5. Portrait and landscape orientation where available.

Phase 10B will focus on premium marketing pages, professional media and Velliqo AI product positioning.
