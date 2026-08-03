# Phase 10C.5 — Staff Personal Access App

## Purpose

Each business can grant or revoke passwordless personal appointment access for an individual staff member. The employee opens a branded, installable Staff App and sees only appointments assigned to their own employee identity and business.

## Owner workflow

1. Open **Staff** and add or edit a staff member.
2. Enter a valid staff email.
3. Enable **Personal appointment access** and save.
4. Velliqo provisions the passwordless account, creates the company Staff App link and sends the invite when Resend is configured.
5. The owner can resend the invite, copy the app link or revoke access.

Revocation is enforced by the database on every read and action. A live Realtime event plus a 60-second/focus validation removes the workspace from an already-open app.

## Staff App

Route: `/staff/:businessSlug`

The employee signs in through a single-use email magic link and can install the company-branded PWA. The workspace includes:

- personal day/week/list calendar;
- only the employee's assigned appointments;
- create an appointment assigned to themselves;
- reschedule within working hours and availability;
- update operational status;
- update appointment notes;
- cancel an appointment;
- customer phone/email for the assigned appointment;
- company contact details and directions.

The employee cannot access another employee's appointments, business reports, finance, products, marketing, billing, staff administration or another tenant.

## Synchronization

Staff actions write to the same tenant-scoped `appointments` records used by the owner app. Supabase Realtime refreshes the owner calendar and the staff calendar after changes.

## Security

- Owner authorization is checked inside `manage-staff-access`.
- Auth accounts are pre-provisioned; the public staff login uses `shouldCreateUser: false`.
- Every RPC verifies `auth.uid()`, business slug, employee identity, active state and `personal_access_enabled`.
- Staff writes are performed only through employee-scoped RPCs.
- Access changes and staff appointment actions are audit logged.
- Personal staff accounts do not receive broad `business_members` permissions.
- Existing non-staff profile roles are preserved when an email already belongs to a Velliqo account.

## Deployment

Database migration:

`00045_velliqo_staff_personal_access.sql`

Edge Function:

`manage-staff-access`

Vercel dynamic manifest:

`/staff-manifest/:slug.webmanifest`

Required Auth redirect URLs include the production and preview `/staff/**` routes.

## Validation

```bash
npm run staff-access:check
npm run translations:check
npm run typecheck
npm run build
```
