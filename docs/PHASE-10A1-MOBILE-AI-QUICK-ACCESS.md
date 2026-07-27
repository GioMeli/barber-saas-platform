# Phase 10A.1 — Owner Mobile Navigation and AI Quick Access

## Scope

This refinement makes the primary owner actions immediately understandable on mobile while preserving the complete workspace navigation in the menu drawer.

## Mobile bottom navigation

The five fixed destinations are now:

1. Home
2. Calendar
3. Add appointment
4. Velliqo AI
5. More

The bar uses the same sidebar colour system, safe-area padding and contrast tokens as the desktop owner navigation. Every label is centred directly under its icon. Sales remains available in the full navigation drawer.

The central plus button opens `/dashboard/calendar?action=new`, which invokes the existing owner appointment dialog instead of introducing a second booking workflow.

## Velliqo AI quick access

The AI button uses `/brand/velliqo-ai.png` without an extra icon background and opens `/dashboard/ai?mode=assistant`.

Assistant mode removes the dashboard analytics panels and opens a focused workspace containing:

- written message composer;
- voice assistant button;
- specialist selector;
- new conversation action;
- a direct return to AI insights.

It continues to use the existing Velliqo AI hook, conversation endpoint, permissions and Action Engine.

## Confirmation overlay

A reusable `VelliqoActionConfirmationDialog` now opens as soon as a written or spoken request prepares an action. It displays the action summary, risk, preview fields and warning before execution.

The owner can confirm, change or cancel without closing the voice assistant or leaving the focused conversation. Inline confirmation cards remain available as a fallback if the overlay is dismissed.

## Validation

Run:

```bash
npm run responsive:check
npm run mobile-ai:check
npm run voice:check
npm run ai:check
npm run typecheck
npm run build
```

This phase is frontend-only. It has no database migration and requires no Supabase function deployment.
