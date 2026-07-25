-- 00038_velliqo_ai_proactive_manager.sql
-- Proactive daily briefings, alerts and scheduled AI manager automation.
--
-- Required Supabase Vault entries before the scheduled job runs:
--   velliqo_ai_automation_worker_url
--   velliqo_ai_automation_worker_secret
--
-- Required Edge Function secret:
--   AI_AUTOMATION_FUNCTION_SECRET

begin;

alter table public.ai_settings
  add column if not exists proactive_briefing_enabled boolean not null default true,
  add column if not exists briefing_time time without time zone not null default '08:00',
  add column if not exists notify_owner_on_ai_alert boolean not null default true,
  add column if not exists monitor_revenue_changes boolean not null default true,
  add column if not exists monitor_no_shows boolean not null default true,
  add column if not exists monitor_customer_retention boolean not null default true,
  add column if not exists monitor_inventory boolean not null default true,
  add column if not exists monitor_marketing_performance boolean not null default true,
  add column if not exists automation_last_run_at timestamptz;

create table if not exists public.ai_manager_briefings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  briefing_date date not null,
  language text not null default 'en' check (language in ('en', 'el', 'de', 'es', 'tr')),
  title text not null,
  summary text not null,
  business_health_score integer not null default 0 check (business_health_score between 0 and 100),
  priorities jsonb not null default '[]'::jsonb,
  recommended_prompts jsonb not null default '[]'::jsonb,
  provider text not null default 'velliqo_free',
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, briefing_date)
);

create index if not exists ai_manager_briefings_business_date_idx
  on public.ai_manager_briefings (business_id, briefing_date desc);

create table if not exists public.ai_manager_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null check (
    category in ('business_health', 'finance', 'customers', 'scheduling', 'staff', 'services', 'inventory', 'marketing')
  ),
  severity text not null default 'info' check (severity in ('info', 'opportunity', 'warning', 'critical')),
  title text not null,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  recommendation text not null,
  suggested_prompt text,
  destination_path text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'dismissed', 'resolved')),
  dedupe_key text not null,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, dedupe_key)
);

create index if not exists ai_manager_alerts_business_status_idx
  on public.ai_manager_alerts (business_id, status, severity, last_seen_at desc);

create index if not exists ai_manager_alerts_business_category_idx
  on public.ai_manager_alerts (business_id, category, last_seen_at desc);

create table if not exists public.ai_automation_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  run_type text not null default 'daily_briefing' check (run_type in ('daily_briefing', 'manual_refresh', 'scheduled_scan')),
  status text not null default 'started' check (status in ('started', 'completed', 'partial', 'failed', 'skipped')),
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  alerts_created integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_automation_runs_business_started_idx
  on public.ai_automation_runs (business_id, started_at desc);

alter table public.ai_manager_briefings enable row level security;
alter table public.ai_manager_alerts enable row level security;
alter table public.ai_automation_runs enable row level security;

drop policy if exists "Business members read AI manager briefings" on public.ai_manager_briefings;
create policy "Business members read AI manager briefings"
on public.ai_manager_briefings
for select
to authenticated
using (public.has_business_access(business_id));

drop policy if exists "Business members read AI manager alerts" on public.ai_manager_alerts;
create policy "Business members read AI manager alerts"
on public.ai_manager_alerts
for select
to authenticated
using (public.has_business_access(business_id));

drop policy if exists "Business members update AI manager alert status" on public.ai_manager_alerts;
create policy "Business members update AI manager alert status"
on public.ai_manager_alerts
for update
to authenticated
using (public.has_business_access(business_id))
with check (public.has_business_access(business_id));

drop policy if exists "Owners read AI automation runs" on public.ai_automation_runs;
create policy "Owners read AI automation runs"
on public.ai_automation_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = ai_automation_runs.business_id
      and bm.user_id = auth.uid()
      and bm.role::text in ('Owner', 'Manager')
  )
);

revoke all on public.ai_manager_briefings from anon, authenticated;
revoke all on public.ai_manager_alerts from anon, authenticated;
revoke all on public.ai_automation_runs from anon, authenticated;
grant select on public.ai_manager_briefings to authenticated;
grant select, update (status, updated_at) on public.ai_manager_alerts to authenticated;
grant select on public.ai_automation_runs to authenticated;
grant all on public.ai_manager_briefings to service_role;
grant all on public.ai_manager_alerts to service_role;
grant all on public.ai_automation_runs to service_role;

-- Extend the existing owner notification centre with proactive AI events.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('new_appointment', 'new_customer', 'ai_briefing', 'ai_alert'));

create or replace function public.create_ai_owner_notification(
  p_business_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  if p_type not in ('ai_briefing', 'ai_alert') then
    raise exception using errcode = '22023', message = 'Unsupported AI notification type.';
  end if;

  insert into public.notifications (
    business_id,
    user_id,
    title,
    message,
    type,
    is_read,
    metadata,
    created_at
  )
  select
    p_business_id,
    bm.user_id,
    p_title,
    p_message,
    p_type,
    false,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.role::text in ('Owner', 'Manager')
    and not exists (
      select 1
      from public.notifications n
      where n.business_id = p_business_id
        and n.user_id = bm.user_id
        and n.type = p_type
        and n.metadata->>'dedupe_key' = p_metadata->>'dedupe_key'
        and n.created_at > now() - interval '7 days'
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.create_ai_owner_notification(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_ai_owner_notification(uuid, text, text, text, jsonb) to service_role;

-- Vault-backed scheduled invocation. The worker itself decides which businesses
-- are due according to their configured local briefing time.
create or replace function public.invoke_velliqo_ai_automation_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_worker_url text;
  v_worker_secret text;
begin
  select btrim(decrypted_secret)
    into v_worker_url
  from vault.decrypted_secrets
  where name = 'velliqo_ai_automation_worker_url'
  limit 1;

  select btrim(decrypted_secret)
    into v_worker_secret
  from vault.decrypted_secrets
  where name = 'velliqo_ai_automation_worker_secret'
  limit 1;

  if v_worker_url is null or v_worker_url = '' then
    raise exception 'Missing velliqo_ai_automation_worker_url in Supabase Vault';
  end if;

  if v_worker_url !~ '^https://.+/functions/v1/process-ai-manager-automations$' then
    raise exception 'Invalid velliqo_ai_automation_worker_url in Supabase Vault';
  end if;

  if v_worker_secret is null or length(v_worker_secret) < 32 then
    raise exception 'Missing or invalid velliqo_ai_automation_worker_secret in Supabase Vault';
  end if;

  return net.http_post(
    url := v_worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ai-automation-secret', v_worker_secret
    ),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

comment on function public.invoke_velliqo_ai_automation_worker()
is 'Invokes the Velliqo proactive AI manager worker using Vault-backed configuration.';

revoke all on function public.invoke_velliqo_ai_automation_worker() from public, anon, authenticated;

-- Keep exactly one hourly job. The worker resolves each business timezone and
-- does not generate duplicate daily briefings.
do $cleanup$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'process-ai-manager-automations'
      or command ilike '%invoke_velliqo_ai_automation_worker%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$cleanup$;

select cron.schedule(
  'process-ai-manager-automations',
  '7 * * * *',
  $cron$
    select public.invoke_velliqo_ai_automation_worker();
  $cron$
);

commit;
