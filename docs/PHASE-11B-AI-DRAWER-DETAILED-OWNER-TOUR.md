# Phase 11B — Wider AI Drawer and Detailed Owner Tour

## Desktop Velliqo AI

- The Owner AI drawer now uses up to 760 px on normal desktop screens and up to 860 px on very large screens.
- The wider conversation column gives messages, action cards, voice controls and the composer more usable room.
- User message bubbles use a narrower maximum line length for easier reading.
- Mobile behaviour is unchanged; mobile continues to use the existing bottom navigation AI entry.

## Detailed Owner tour

The product tour is now versioned as `owner-detailed-v2`. Existing Phase 11A completion does not suppress the improved tour.

The tour now:

- is divided into page-specific chapters;
- allows direct chapter navigation;
- navigates between Owner routes;
- highlights page sections, controls and individual tabs;
- safely opens creation dialogs and the Calendar tools sheet for demonstration;
- explains the principal fields and decisions inside creation forms;
- never submits a form or saves data automatically;
- closes temporary dialogs before moving to the next area;
- persists progress in the existing `owner_tour_progress` table;
- includes translated navigation and safety text across all locale files.

Coverage includes Home, Calendar views and forms, Sales checkout/catalog/transactions, Finance, Customers, Staff, Services, Products, Marketing, Posts, Gallery, every Storefront section, Business closures, every Reports tab, Billing, Velliqo AI and Training.

## Infrastructure

No new migration or Edge Function is required. Phase 11B reuses migration `00048_velliqo_owner_product_tour.sql`.
