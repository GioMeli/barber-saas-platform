# Phase 9D — Operational Manager Automations

This release extends the existing Velliqo AI Manager (`00036`), secure Action
Engine (`00037`) and proactive manager (`00038`). It does not replace those
systems.

## Delivered automations

- **Customer reactivation** — identifies consented inactive customers and can
  prepare a `create_campaign_draft` confirmation.
- **Schedule optimisation** — finds usable gaps and staff-utilisation imbalance.
  It never moves appointments automatically.
- **Low-stock actions** — calculates suggested replenishment quantities and
  estimated restock cost. It never creates an external purchase order.
- **Campaign planning** — recommends an objective, audience and message and can
  prepare a campaign draft. It never sends a campaign.

Each rule is tenant-scoped and has an independent autonomy level:

- `disabled`
- `recommend_only`
- `prepare_draft`
- `auto_execute_low_risk`

`auto_execute_low_risk` is restricted in SQL to automation-generated,
low-risk `create_campaign_draft` and `create_post_draft` requests. Delivery,
appointment changes, cancellations and purchasing remain excluded.

## New components

- Migration: `supabase/migrations/00039_velliqo_ai_operational_automations.sql`
- Worker extension: `supabase/functions/process-ai-manager-automations/index.ts`
- Owner API/types: `src/ai/automations/`
- Owner controls: `src/pages/owner/ai/AISettings.tsx`
- Quality gate: `npm run automations:check`

## Safe defaults

After migration:

- `manager_automations_enabled = false`
- every operational rule is disabled
- no automation can create a draft until `allow_write_actions` is enabled
- every prepared action uses the existing Action Engine and audit log

The owner must explicitly enable the manager and then configure each rule in
**AI Settings → Manager Automations**.

## Local validation

From the repository root:

```powershell
npm install
npm run translations:check
npm run ai:check
npm run automations:check
npm run typecheck
npm run build
```

When a copied `node_modules` folder causes a native dependency error, rebuild
it for the current operating system:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```

## Supabase deployment

Apply the database migration:

```powershell
npx supabase db push
```

Deploy the updated worker:

```powershell
npx supabase functions deploy process-ai-manager-automations --no-verify-jwt
```

The existing Phase 9D proactive manager already requires:

- Edge Function secret: `AI_AUTOMATION_FUNCTION_SECRET`
- Vault entry: `velliqo_ai_automation_worker_url`
- Vault entry: `velliqo_ai_automation_worker_secret`

The Vault secret and Edge Function secret must contain the same strong random
value. No service-role key belongs in browser environment variables.

## Database verification

Run these queries in the Supabase SQL editor after deployment:

```sql
select automation_key, enabled, autonomy_level, handler_status,
       schedule_kind, next_run_at
from public.ai_automation_rules
order by business_id, automation_key;
```

```sql
select manager_automations_enabled, automation_default_autonomy,
       automation_timezone, automation_last_worker_at
from public.ai_settings;
```

```sql
select automation_key, status, attempt_count, max_attempts,
       scheduled_for, started_at, completed_at, error_code
from public.ai_automation_runs
order by created_at desc
limit 50;
```

## Runtime smoke test

1. Open **AI Settings → Manager Automations**.
2. Enable the manager master switch.
3. Enable one rule with `recommend_only`.
4. Save and verify a future `next_run_at` value.
5. Invoke the worker or wait for the existing scheduled invocation.
6. Confirm that a run reaches `completed` or `skipped`.
7. Confirm that recommendations appear in AI Manager alerts.
8. For draft testing, enable AI write actions and select `prepare_draft`.
9. Confirm that the Action Engine creates a pending confirmation card.
10. Verify that no campaign is sent and no appointment is changed.

Do not enable `auto_execute_low_risk` until the recommend-only and draft flows
have passed the production smoke test for the business.
