# Phase 10B.1 — Public Visual System Upgrade and Contact Page

## Scope

This phase replaces hand-drawn marketing device shells with reusable frames derived from the original laptop, desktop monitor, tablet and phone assets supplied for Velliqo. Real product captures are rendered inside the corresponding screens without flattening the experience into a single non-responsive collage.

It also introduces a public `/contact` page with direct contact details and a reviewable email-draft form.

## Device visual system

Reusable component:

- `src/components/marketing/DeviceFrame.tsx`

Original-frame assets:

- `public/marketing/devices/laptop-original.png`
- `public/marketing/devices/desktop-original.png`
- `public/marketing/devices/tablet-original.png`
- `public/marketing/devices/phone-original.png`

The component keeps the product screenshot separate from the frame. This provides responsive scaling, accessible alt text, lazy loading and the ability to replace individual product captures without recreating the full composition.

Updated public pages include:

- Home / product page
- Experience
- Why Velliqo
- Reporting showcase
- Owner and customer device compositions

## Contact page

Route:

- `/contact`

Displayed contact details:

- Email: `georgeau791926@gmail.com`
- Phone: `+357 96 211 102`
- Region: `Nicosia, Cyprus`

No personal name is displayed.

The form creates a `mailto:` draft containing the visitor's name, email, business name, phone, business type, subject and message. It does not send the message automatically. The visitor reviews and sends the draft from their configured email application.

## Quality gate

Run:

```bash
npm run public-visual-contact:check
```

The validator confirms the route, navigation links, contact details, mailto/tel actions, absence of a displayed personal name, original device assets and use of all four reusable device frame variants.

## Deployment

This is a frontend-only phase.

- No Supabase migration
- No Edge Function deployment
- No new secret
