-- 00039_velliqo_ai_operational_automations.sql
-- Phase 9D — operational manager automations built on the existing proactive
-- manager (00038) and confirmation-based Action Engine (00037).
--
-- Operational handlers:
--   customer_reactivation
--   schedule_optimisation
--   low_stock_actions
--   campaign_planning
--
-- No campaign is sent and no appointment is moved automatically. The only
-- automatically executable business writes are low-risk campaign/post drafts,
-- and only when the owner explicitly selects auto_execute_low_risk.

begin;

-- ---------------------------------------------------------------------------
-- 1. Owner-configurable automation settings on the existing AI settings row.
-- ---------------------------------------------------------------------------

alter table public.ai_settings
  add column if not exists manager_automations_enabled boolean not null default false,
  add column if not exists automation_default_autonomy text not null default 'recommend_only',
  add column if not exists automation_timezone text,
  add column if not exists automation_max_runs_per_hour smallint not null default 20,
  add column if not exists automation_max_concurrent_runs smallint not null default 2,
  add column if not exists automation_last_worker_at timestamptz;

do $$
begin
  alter table public.ai_settings
    add constraint ai_settings_automation_default_autonomy_check
    check (automation_default_autonomy in (
      'disabled', 'recommend_only', 'prepare_draft', 'auto_execute_low_risk'
    ));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_settings
    add constraint ai_settings_automation_max_runs_check
    check (automation_max_runs_per_hour between 1 and 120);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_settings
    add constraint ai_settings_automation_max_concurrent_check
    check (automation_max_concurrent_runs between 1 and 10);
exception when duplicate_object then null;
end $$;

update public.ai_settings ai
set automation_timezone = coalesce(nullif(ai.automation_timezone, ''), nullif(b.timezone, ''), 'UTC')
from public.businesses b
where b.id = ai.business_id
  and (ai.automation_timezone is null or btrim(ai.automation_timezone) = '');

alter table public.ai_settings
  alter column automation_timezone set default 'UTC',
  alter column automation_timezone set not null;

-- ---------------------------------------------------------------------------
-- 2. Independent automation rules.
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_ai_automations(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role::text in ('Owner', 'Manager')
  );
$$;

revoke all on function public.can_manage_ai_automations(uuid) from public, anon;
grant execute on function public.can_manage_ai_automations(uuid) to authenticated, service_role;

create table if not exists public.ai_automation_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  automation_key text not null check (automation_key in (
    'proactive_recommendations',
    'daily_briefing',
    'customer_reactivation',
    'schedule_optimisation',
    'low_stock_actions',
    'campaign_planning'
  )),
  enabled boolean not null default false,
  handler_status text not null default 'available'
    check (handler_status in ('planned', 'available', 'paused')),
  autonomy_level text not null default 'recommend_only'
    check (autonomy_level in ('disabled', 'recommend_only', 'prepare_draft', 'auto_execute_low_risk')),
  schedule_kind text not null default 'manual'
    check (schedule_kind in ('manual', 'event', 'hourly', 'daily', 'weekly')),
  schedule_config jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  allowed_action_types text[] not null default '{}'::text[],
  risk_ceiling text not null default 'low' check (risk_ceiling in ('low', 'medium')),
  requires_confirmation boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures smallint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, automation_key)
);

create index if not exists ai_automation_rules_due_idx
  on public.ai_automation_rules (next_run_at, business_id)
  where enabled is true and handler_status = 'available';

create index if not exists ai_automation_rules_business_idx
  on public.ai_automation_rules (business_id, automation_key);

-- ---------------------------------------------------------------------------
-- 3. Extend the existing 00038 run table into a queued worker system while
--    preserving historical proactive/daily briefing rows.
-- ---------------------------------------------------------------------------

alter table public.ai_automation_runs
  add column if not exists rule_id uuid references public.ai_automation_rules(id) on delete set null,
  add column if not exists automation_key text,
  add column if not exists trigger_type text not null default 'system',
  add column if not exists idempotency_key text,
  add column if not exists scheduled_for timestamptz not null default now(),
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists attempt_count smallint not null default 0,
  add column if not exists max_attempts smallint not null default 3,
  add column if not exists input jsonb not null default '{}'::jsonb,
  add column if not exists output jsonb not null default '{}'::jsonb,
  add column if not exists action_request_ids uuid[] not null default '{}'::uuid[],
  add column if not exists error_code text;

alter table public.ai_automation_runs
  drop constraint if exists ai_automation_runs_run_type_check,
  drop constraint if exists ai_automation_runs_status_check,
  drop constraint if exists ai_automation_runs_trigger_type_check,
  drop constraint if exists ai_automation_runs_attempt_count_check,
  drop constraint if exists ai_automation_runs_max_attempts_check;

alter table public.ai_automation_runs
  add constraint ai_automation_runs_run_type_check
  check (run_type in (
    'daily_briefing', 'manual_refresh', 'scheduled_scan',
    'customer_reactivation', 'schedule_optimisation',
    'low_stock_actions', 'campaign_planning'
  )),
  add constraint ai_automation_runs_status_check
  check (status in ('queued', 'running', 'started', 'completed', 'partial', 'failed', 'skipped')),
  add constraint ai_automation_runs_trigger_type_check
  check (trigger_type in ('schedule', 'manual', 'event', 'retry', 'system')),
  add constraint ai_automation_runs_attempt_count_check
  check (attempt_count between 0 and 10),
  add constraint ai_automation_runs_max_attempts_check
  check (max_attempts between 1 and 10);

update public.ai_automation_runs
set automation_key = case run_type
  when 'daily_briefing' then 'daily_briefing'
  when 'manual_refresh' then 'daily_briefing'
  when 'scheduled_scan' then 'proactive_recommendations'
  else run_type
end
where automation_key is null;

create unique index if not exists ai_automation_runs_idempotency_uidx
  on public.ai_automation_runs (business_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists ai_automation_runs_queue_idx
  on public.ai_automation_runs (status, available_at, scheduled_for)
  where status in ('queued', 'running');

create index if not exists ai_automation_runs_rule_idx
  on public.ai_automation_runs (rule_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 4. Enrich proactive alerts so every operational result has evidence,
--    impact, proposed action and optional Action Engine confirmation.
-- ---------------------------------------------------------------------------

alter table public.ai_manager_alerts
  add column if not exists run_id uuid references public.ai_automation_runs(id) on delete set null,
  add column if not exists automation_key text,
  add column if not exists estimated_impact jsonb not null default '{}'::jsonb,
  add column if not exists recommended_action jsonb not null default '{}'::jsonb,
  add column if not exists action_type text,
  add column if not exists action_request_id uuid references public.ai_action_requests(id) on delete set null,
  add column if not exists confidence text not null default 'medium';

do $$
begin
  alter table public.ai_manager_alerts
    add constraint ai_manager_alerts_automation_key_check
    check (automation_key is null or automation_key in (
      'proactive_recommendations', 'daily_briefing', 'customer_reactivation',
      'schedule_optimisation', 'low_stock_actions', 'campaign_planning'
    ));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ai_manager_alerts
    add constraint ai_manager_alerts_confidence_check
    check (confidence in ('low', 'medium', 'high'));
exception when duplicate_object then null;
end $$;

create index if not exists ai_manager_alerts_automation_idx
  on public.ai_manager_alerts (business_id, automation_key, status, last_seen_at desc);

-- Link trusted automation-created confirmations to their originating run/rule.
alter table public.ai_action_requests
  add column if not exists automation_run_id uuid references public.ai_automation_runs(id) on delete set null,
  add column if not exists automation_rule_id uuid references public.ai_automation_rules(id) on delete set null,
  add column if not exists automation_generated boolean not null default false;

create index if not exists ai_action_requests_automation_run_idx
  on public.ai_action_requests (automation_run_id, created_at desc)
  where automation_generated is true;

-- ---------------------------------------------------------------------------
-- 5. Audit timestamps and rule seeding.
-- ---------------------------------------------------------------------------

create or replace function public.set_ai_automation_rule_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_ai_automation_rules_updated_at on public.ai_automation_rules;
create trigger set_ai_automation_rules_updated_at
before update on public.ai_automation_rules
for each row execute function public.set_ai_automation_rule_updated_at();

create or replace function public.next_ai_automation_run(
  p_schedule_kind text,
  p_schedule_config jsonb,
  p_from timestamptz,
  p_timezone text
)
returns timestamptz
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  v_zone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_local timestamp;
  v_candidate timestamp;
  v_hour integer := greatest(0, least(23, coalesce((p_schedule_config->>'hour')::integer, 8)));
  v_minute integer := greatest(0, least(59, coalesce((p_schedule_config->>'minute')::integer, 0)));
  v_weekday integer := greatest(0, least(6, coalesce((p_schedule_config->>'weekday')::integer, 1)));
  v_every_minutes integer := greatest(15, least(1440, coalesce((p_schedule_config->>'every_minutes')::integer, 60)));
begin
  if p_schedule_kind in ('manual', 'event') then
    return null;
  end if;

  begin
    v_local := p_from at time zone v_zone;
  exception when invalid_parameter_value then
    v_zone := 'UTC';
    v_local := p_from at time zone v_zone;
  end;

  if p_schedule_kind = 'hourly' then
    return p_from + make_interval(mins => v_every_minutes);
  elsif p_schedule_kind = 'daily' then
    v_candidate := date_trunc('day', v_local) + make_interval(hours => v_hour, mins => v_minute);
    if v_candidate <= v_local then
      v_candidate := v_candidate + interval '1 day';
    end if;
    return v_candidate at time zone v_zone;
  elsif p_schedule_kind = 'weekly' then
    v_candidate := date_trunc('day', v_local)
      + make_interval(
          days => ((v_weekday - extract(dow from v_local)::integer + 7) % 7),
          hours => v_hour,
          mins => v_minute
        );
    if v_candidate <= v_local then
      v_candidate := v_candidate + interval '7 days';
    end if;
    return v_candidate at time zone v_zone;
  end if;

  return null;
exception when others then
  return p_from + interval '1 hour';
end;
$$;

create or replace function public.seed_ai_operational_automations(
  p_business_id uuid,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_language text;
begin
  select
    coalesce(nullif(b.timezone, ''), 'UTC'),
    case when coalesce(ai.default_language, 'en') in ('en','el','de','es','tr')
      then coalesce(ai.default_language, 'en') else 'en' end
  into v_timezone, v_language
  from public.businesses b
  left join public.ai_settings ai on ai.business_id = b.id
  where b.id = p_business_id;

  insert into public.ai_settings (
    business_id, default_language, automation_timezone
  ) values (
    p_business_id, coalesce(v_language, 'en'), coalesce(v_timezone, 'UTC')
  ) on conflict (business_id) do update
    set automation_timezone = coalesce(nullif(public.ai_settings.automation_timezone, ''), excluded.automation_timezone);

  insert into public.ai_automation_rules (
    business_id, automation_key, enabled, handler_status, autonomy_level,
    schedule_kind, schedule_config, parameters, allowed_action_types,
    risk_ceiling, requires_confirmation, next_run_at, created_by, updated_by
  ) values
    (
      p_business_id, 'proactive_recommendations', false, 'available', 'recommend_only',
      'daily', '{"hour":8,"minute":0}'::jsonb, '{}'::jsonb, '{}'::text[],
      'low', false, null, p_user_id, p_user_id
    ),
    (
      p_business_id, 'daily_briefing', false, 'available', 'recommend_only',
      'daily', '{"hour":8,"minute":0}'::jsonb, '{}'::jsonb, '{}'::text[],
      'low', false, null, p_user_id, p_user_id
    ),
    (
      p_business_id, 'customer_reactivation', false, 'available', 'prepare_draft',
      'daily', '{"hour":9,"minute":0}'::jsonb,
      '{"inactive_days":90,"max_recipients":500,"channel":"email"}'::jsonb,
      array['create_campaign_draft']::text[], 'low', true, null, p_user_id, p_user_id
    ),
    (
      p_business_id, 'schedule_optimisation', false, 'available', 'recommend_only',
      'daily', '{"hour":6,"minute":0}'::jsonb,
      '{"lookahead_days":7,"minimum_gap_minutes":30}'::jsonb,
      '{}'::text[], 'low', true, null, p_user_id, p_user_id
    ),
    (
      p_business_id, 'low_stock_actions', false, 'available', 'recommend_only',
      'hourly', '{"every_minutes":60}'::jsonb,
      '{"target_stock_multiplier":2}'::jsonb,
      '{}'::text[], 'low', true, null, p_user_id, p_user_id
    ),
    (
      p_business_id, 'campaign_planning', false, 'available', 'prepare_draft',
      'weekly', '{"weekday":1,"hour":10,"minute":0}'::jsonb,
      '{"channel":"email","lookahead_days":14}'::jsonb,
      array['create_campaign_draft']::text[], 'low', true, null, p_user_id, p_user_id
    )
  on conflict (business_id, automation_key) do nothing;
end;
$$;

revoke all on function public.seed_ai_operational_automations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.seed_ai_operational_automations(uuid, uuid) to service_role;

select public.seed_ai_operational_automations(id, null)
from public.businesses;

create or replace function public.handle_new_business_ai_operational_automations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_ai_operational_automations(new.id, auth.uid());
  return new;
end;
$$;

drop trigger if exists seed_new_business_ai_operational_automations on public.businesses;
create trigger seed_new_business_ai_operational_automations
after insert on public.businesses
for each row execute function public.handle_new_business_ai_operational_automations();

-- ---------------------------------------------------------------------------
-- 6. Atomic owner/manager configuration RPC.
-- ---------------------------------------------------------------------------

create or replace function public.save_ai_automation_configuration(
  p_business_id uuid,
  p_settings jsonb,
  p_rules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule jsonb;
  v_key text;
  v_autonomy text;
  v_enabled boolean;
  v_requires_confirmation boolean;
  v_timezone text;
  v_allowed_actions text[];
begin
  if not public.can_manage_ai_automations(p_business_id) then
    raise exception using errcode = '42501', message = 'Only an owner or manager can configure AI automations.';
  end if;

  v_timezone := coalesce(nullif(btrim(p_settings->>'automation_timezone'), ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'Invalid IANA timezone.';
  end if;

  if coalesce(nullif(p_settings->>'automation_default_autonomy', ''), 'recommend_only')
     not in ('disabled', 'recommend_only', 'prepare_draft', 'auto_execute_low_risk') then
    raise exception using errcode = '22023', message = 'Invalid default autonomy level.';
  end if;

  update public.ai_settings
  set manager_automations_enabled = coalesce((p_settings->>'manager_automations_enabled')::boolean, manager_automations_enabled),
      automation_default_autonomy = coalesce(nullif(p_settings->>'automation_default_autonomy', ''), automation_default_autonomy),
      automation_timezone = v_timezone,
      updated_at = now()
  where business_id = p_business_id;

  if not found then
    perform public.seed_ai_operational_automations(p_business_id, auth.uid());
    update public.ai_settings
    set manager_automations_enabled = coalesce((p_settings->>'manager_automations_enabled')::boolean, manager_automations_enabled),
        automation_default_autonomy = coalesce(nullif(p_settings->>'automation_default_autonomy', ''), automation_default_autonomy),
        automation_timezone = v_timezone,
        updated_at = now()
    where business_id = p_business_id;
  end if;

  if jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Automation rules must be a JSON array.';
  end if;

  for v_rule in select value from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb))
  loop
    v_key := nullif(v_rule->>'automation_key', '');
    v_autonomy := coalesce(nullif(v_rule->>'autonomy_level', ''), 'recommend_only');
    v_enabled := coalesce((v_rule->>'enabled')::boolean, false);
    v_requires_confirmation := coalesce((v_rule->>'requires_confirmation')::boolean, true);

    if v_key not in (
      'proactive_recommendations', 'daily_briefing', 'customer_reactivation',
      'schedule_optimisation', 'low_stock_actions', 'campaign_planning'
    ) then
      raise exception using errcode = '22023', message = 'Unknown AI automation rule.';
    end if;

    if v_autonomy not in ('disabled', 'recommend_only', 'prepare_draft', 'auto_execute_low_risk') then
      raise exception using errcode = '22023', message = 'Invalid automation autonomy level.';
    end if;

    select allowed_action_types
    into v_allowed_actions
    from public.ai_automation_rules
    where business_id = p_business_id and automation_key = v_key
    for update;

    if not found then
      raise exception using errcode = '22023', message = 'AI automation rule was not seeded.';
    end if;

    if v_autonomy = 'disabled' then
      v_enabled := false;
    end if;

    -- Rules without trusted write actions remain recommendation-only even if a
    -- crafted browser request asks for a stronger autonomy level.
    if coalesce(cardinality(v_allowed_actions), 0) = 0
       and v_autonomy in ('prepare_draft', 'auto_execute_low_risk') then
      v_autonomy := 'recommend_only';
    end if;

    -- Automatic business writes remain limited to explicitly allow-listed,
    -- low-risk campaign/post draft creation.
    if v_autonomy = 'auto_execute_low_risk' then
      if coalesce(cardinality(v_allowed_actions), 0) = 0
         or not (v_allowed_actions <@ array['create_campaign_draft','create_post_draft']::text[]) then
        v_requires_confirmation := true;
      end if;
    else
      v_requires_confirmation := true;
    end if;

    update public.ai_automation_rules
    set enabled = v_enabled,
        autonomy_level = v_autonomy,
        requires_confirmation = v_requires_confirmation,
        next_run_at = case
          when v_enabled and handler_status = 'available' and automation_key in (
            'customer_reactivation', 'schedule_optimisation', 'low_stock_actions', 'campaign_planning'
          ) then coalesce(
            next_run_at,
            public.next_ai_automation_run(
              schedule_kind,
              schedule_config,
              now() - interval '1 minute',
              v_timezone
            )
          )
          else null
        end,
        updated_by = auth.uid()
    where business_id = p_business_id
      and automation_key = v_key;
  end loop;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    p_business_id,
    auth.uid(),
    'ai_automation_configuration_updated',
    jsonb_build_object(
      'manager_automations_enabled',
        (select manager_automations_enabled from public.ai_settings where business_id = p_business_id),
      'configured_rules', coalesce(jsonb_array_length(coalesce(p_rules, '[]'::jsonb)), 0)
    )
  );

  return jsonb_build_object(
    'settings', (
      select jsonb_build_object(
        'business_id', ai.business_id,
        'manager_automations_enabled', ai.manager_automations_enabled,
        'automation_default_autonomy', ai.automation_default_autonomy,
        'automation_timezone', ai.automation_timezone,
        'automation_max_runs_per_hour', ai.automation_max_runs_per_hour,
        'automation_max_concurrent_runs', ai.automation_max_concurrent_runs,
        'automation_last_worker_at', ai.automation_last_worker_at
      )
      from public.ai_settings ai
      where ai.business_id = p_business_id
    ),
    'rules', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.automation_key), '[]'::jsonb)
      from public.ai_automation_rules r
      where r.business_id = p_business_id
    )
  );
end;
$$;

revoke all on function public.save_ai_automation_configuration(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_ai_automation_configuration(uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Queue, claim, retry and completion service functions.
-- ---------------------------------------------------------------------------

create or replace function public.service_queue_due_ai_automation_runs(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule record;
  v_count integer := 0;
  v_inserted integer;
  v_key text;
begin
  for v_rule in
    select
      r.*,
      ai.automation_timezone,
      ai.automation_max_runs_per_hour
    from public.ai_automation_rules r
    join public.ai_settings ai on ai.business_id = r.business_id
    where ai.enabled is true
      and ai.manager_automations_enabled is true
      and r.enabled is true
      and r.handler_status = 'available'
      and r.automation_key in (
        'customer_reactivation', 'schedule_optimisation',
        'low_stock_actions', 'campaign_planning'
      )
      and r.next_run_at is not null
      and r.next_run_at <= now()
      and (
        select count(*)
        from public.ai_automation_runs recent
        where recent.business_id = r.business_id
          and recent.started_at >= now() - interval '1 hour'
      ) < ai.automation_max_runs_per_hour
    order by r.next_run_at
    for update of r skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    v_key := v_rule.automation_key || ':' ||
      extract(epoch from date_trunc('minute', v_rule.next_run_at))::bigint::text;

    insert into public.ai_automation_runs (
      business_id, rule_id, run_type, automation_key, trigger_type,
      status, idempotency_key, scheduled_for, available_at, input
    ) values (
      v_rule.business_id,
      v_rule.id,
      v_rule.automation_key,
      v_rule.automation_key,
      'schedule',
      'queued',
      v_key,
      v_rule.next_run_at,
      now(),
      jsonb_build_object('parameters', v_rule.parameters)
    )
    on conflict (business_id, idempotency_key) where idempotency_key is not null
    do nothing;

    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;

    update public.ai_automation_rules
    set next_run_at = public.next_ai_automation_run(
      v_rule.schedule_kind,
      v_rule.schedule_config,
      greatest(now(), v_rule.next_run_at),
      v_rule.automation_timezone
    )
    where id = v_rule.id;
  end loop;

  return v_count;
end;
$$;

create or replace function public.queue_ai_automation_run(
  p_business_id uuid,
  p_automation_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.ai_automation_rules%rowtype;
  v_run_id uuid;
begin
  if not public.can_manage_ai_automations(p_business_id) then
    raise exception using errcode = '42501', message = 'Only an owner or manager can run AI automations.';
  end if;

  select * into v_rule
  from public.ai_automation_rules
  where business_id = p_business_id
    and automation_key = p_automation_key
    and handler_status = 'available';

  if not found then
    raise exception using errcode = 'P0002', message = 'Available AI automation rule not found.';
  end if;

  if p_automation_key not in (
    'customer_reactivation', 'schedule_optimisation',
    'low_stock_actions', 'campaign_planning'
  ) then
    raise exception using errcode = '22023', message = 'This automation uses the proactive manager workflow.';
  end if;

  insert into public.ai_automation_runs (
    business_id, rule_id, run_type, automation_key, trigger_type,
    status, idempotency_key, scheduled_for, available_at, input
  ) values (
    p_business_id,
    v_rule.id,
    v_rule.automation_key,
    v_rule.automation_key,
    'manual',
    'queued',
    v_rule.automation_key || ':manual:' || gen_random_uuid()::text,
    now(),
    now(),
    jsonb_build_object('parameters', v_rule.parameters, 'requested_by', auth.uid())
  ) returning id into v_run_id;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    p_business_id,
    auth.uid(),
    'ai_automation_manual_run_queued',
    jsonb_build_object('run_id', v_run_id, 'automation_key', p_automation_key)
  );

  return v_run_id;
end;
$$;

revoke all on function public.queue_ai_automation_run(uuid, text) from public, anon;
grant execute on function public.queue_ai_automation_run(uuid, text) to authenticated, service_role;

create or replace function public.service_claim_ai_automation_runs(
  p_worker_id uuid,
  p_limit integer default 20
)
returns setof public.ai_automation_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business record;
  v_active integer;
  v_slots integer;
  v_claimed integer;
  v_remaining integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  for v_business in
    select ai.business_id, ai.automation_max_concurrent_runs
    from public.ai_settings ai
    where ai.manager_automations_enabled is true
      and exists (
        select 1
        from public.ai_automation_runs pending
        where pending.business_id = ai.business_id
          and pending.status = 'queued'
          and pending.available_at <= now()
          and pending.attempt_count < pending.max_attempts
      )
    order by ai.automation_last_worker_at nulls first, ai.business_id
    for update of ai skip locked
  loop
    select count(*)::integer into v_active
    from public.ai_automation_runs active
    where active.business_id = v_business.business_id
      and active.status = 'running';

    v_slots := least(
      greatest(0, v_business.automation_max_concurrent_runs - v_active),
      v_remaining
    );

    if v_slots > 0 then
      return query
      with candidates as (
        select r.id
        from public.ai_automation_runs r
        where r.business_id = v_business.business_id
          and r.status = 'queued'
          and r.available_at <= now()
          and r.attempt_count < r.max_attempts
        order by r.scheduled_for, r.started_at
        for update of r skip locked
        limit v_slots
      )
      update public.ai_automation_runs r
      set status = 'running',
          started_at = coalesce(r.started_at, now()),
          locked_at = now(),
          locked_by = p_worker_id,
          attempt_count = r.attempt_count + 1,
          error_code = null,
          error_message = null,
          updated_at = now()
      from candidates c
      where r.id = c.id
      returning r.*;

      get diagnostics v_claimed = row_count;
      v_remaining := v_remaining - v_claimed;

      update public.ai_settings
      set automation_last_worker_at = now(), updated_at = now()
      where business_id = v_business.business_id;

      exit when v_remaining <= 0;
    end if;
  end loop;
end;
$$;

create or replace function public.service_recover_stale_ai_automation_runs(
  p_stale_minutes integer default 15
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.ai_automation_runs
  set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
      available_at = case when attempt_count >= max_attempts then available_at else now() + interval '5 minutes' end,
      completed_at = case when attempt_count >= max_attempts then now() else null end,
      locked_at = null,
      locked_by = null,
      error_code = 'stale_worker_claim',
      error_message = 'The automation worker did not finish within the allowed execution window.',
      updated_at = now()
  where status = 'running'
    and locked_at < now() - make_interval(
      mins => greatest(5, least(coalesce(p_stale_minutes, 15), 120))
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.service_finish_ai_automation_run(
  p_run_id uuid,
  p_status text,
  p_output jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_error_message text default null,
  p_action_request_ids uuid[] default '{}'::uuid[]
)
returns public.ai_automation_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.ai_automation_runs%rowtype;
begin
  if p_status not in ('completed', 'partial', 'failed', 'skipped') then
    raise exception using errcode = '22023', message = 'Invalid terminal automation status.';
  end if;

  update public.ai_automation_runs
  set status = p_status,
      output = coalesce(p_output, '{}'::jsonb),
      error_code = p_error_code,
      error_message = left(p_error_message, 2000),
      action_request_ids = coalesce(p_action_request_ids, '{}'::uuid[]),
      completed_at = now(),
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where id = p_run_id
    and status = 'running'
  returning * into v_run;

  if not found then
    raise exception using errcode = 'P0002', message = 'Running automation job not found.';
  end if;

  update public.ai_automation_rules
  set last_run_at = now(),
      last_success_at = case when p_status in ('completed', 'partial') then now() else last_success_at end,
      last_failure_at = case when p_status = 'failed' then now() else last_failure_at end,
      consecutive_failures = case
        when p_status in ('completed', 'partial', 'skipped') then 0
        else least(consecutive_failures + 1, 32767)
      end,
      updated_at = now()
  where id = v_run.rule_id;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    v_run.business_id,
    null,
    'ai_automation_run_' || p_status,
    jsonb_build_object(
      'run_id', v_run.id,
      'automation_key', v_run.automation_key,
      'status', p_status,
      'error_code', p_error_code,
      'action_request_ids', coalesce(p_action_request_ids, '{}'::uuid[])
    )
  );

  return v_run;
end;
$$;

create or replace function public.service_retry_or_fail_ai_automation_run(
  p_run_id uuid,
  p_error_code text,
  p_error_message text
)
returns public.ai_automation_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.ai_automation_runs%rowtype;
  v_terminal boolean;
begin
  select attempt_count >= max_attempts
  into v_terminal
  from public.ai_automation_runs
  where id = p_run_id and status = 'running'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Running automation job not found.';
  end if;

  update public.ai_automation_runs
  set status = case when v_terminal then 'failed' else 'queued' end,
      available_at = case when v_terminal then available_at else now() + make_interval(mins => least(30, 5 * attempt_count)) end,
      completed_at = case when v_terminal then now() else null end,
      locked_at = null,
      locked_by = null,
      error_code = left(p_error_code, 120),
      error_message = left(p_error_message, 2000),
      updated_at = now()
  where id = p_run_id
  returning * into v_run;

  if v_terminal then
    update public.ai_automation_rules
    set last_run_at = now(),
        last_failure_at = now(),
        consecutive_failures = least(consecutive_failures + 1, 32767),
        updated_at = now()
    where id = v_run.rule_id;

    insert into public.audit_logs (business_id, user_id, action, details)
    values (
      v_run.business_id,
      null,
      'ai_automation_run_failed',
      jsonb_build_object(
        'run_id', v_run.id,
        'automation_key', v_run.automation_key,
        'error_code', p_error_code,
        'attempt_count', v_run.attempt_count
      )
    );
  end if;

  return v_run;
end;
$$;

revoke all on function public.service_queue_due_ai_automation_runs(integer) from public, anon, authenticated;
revoke all on function public.service_claim_ai_automation_runs(uuid, integer) from public, anon, authenticated;
revoke all on function public.service_recover_stale_ai_automation_runs(integer) from public, anon, authenticated;
revoke all on function public.service_finish_ai_automation_run(uuid, text, jsonb, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.service_retry_or_fail_ai_automation_run(uuid, text, text) from public, anon, authenticated;

grant execute on function public.service_queue_due_ai_automation_runs(integer) to service_role;
grant execute on function public.service_claim_ai_automation_runs(uuid, integer) to service_role;
grant execute on function public.service_recover_stale_ai_automation_runs(integer) to service_role;
grant execute on function public.service_finish_ai_automation_run(uuid, text, jsonb, text, text, uuid[]) to service_role;
grant execute on function public.service_retry_or_fail_ai_automation_run(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Safe auto-execution extension for low-risk DRAFT actions only.
--    Sending campaigns, moving/cancelling appointments and inventory purchases
--    are intentionally excluded.
-- ---------------------------------------------------------------------------

create or replace function public.service_execute_ai_low_risk_draft_action(
  p_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_action public.ai_action_requests%rowtype;
  v_rule public.ai_automation_rules%rowtype;
  v_settings public.ai_settings%rowtype;
  v_payload jsonb;
  v_result jsonb;
begin
  select * into v_action
  from public.ai_action_requests
  where id = p_action_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AI action request not found.';
  end if;

  if v_action.status = 'executed' then
    return jsonb_build_object(
      'success', true,
      'status', 'executed',
      'result', coalesce(v_action.execution_result, '{}'::jsonb),
      'idempotent_replay', true
    );
  end if;

  if v_action.status <> 'pending'
     or v_action.automation_generated is not true
     or v_action.risk_level <> 'low'
     or v_action.action_type not in ('create_campaign_draft', 'create_post_draft') then
    raise exception using errcode = '42501', message = 'This AI action is not eligible for automatic draft execution.';
  end if;

  select * into v_rule
  from public.ai_automation_rules
  where id = v_action.automation_rule_id
    and business_id = v_action.business_id
  for update;

  if not found
     or v_rule.enabled is not true
     or v_rule.handler_status <> 'available'
     or v_rule.autonomy_level <> 'auto_execute_low_risk'
     or v_rule.requires_confirmation is true
     or not (v_action.action_type = any(v_rule.allowed_action_types)) then
    raise exception using errcode = '42501', message = 'The automation rule does not permit automatic draft execution.';
  end if;

  select * into v_settings
  from public.ai_settings
  where business_id = v_action.business_id;

  if not found
     or v_settings.enabled is false
     or v_settings.manager_automations_enabled is false
     or coalesce(v_settings.allow_write_actions, false) is false then
    raise exception using errcode = '42501', message = 'AI automation write actions are disabled.';
  end if;

  if not exists (
    select 1
    from public.business_members bm
    where bm.business_id = v_action.business_id
      and bm.user_id = v_action.requested_by
      and bm.role::text in ('Owner', 'Manager')
  ) then
    raise exception using errcode = '42501', message = 'The automation action does not have a valid owner or manager actor.';
  end if;

  v_payload := coalesce(v_action.payload, '{}'::jsonb);

  if v_action.action_type = 'create_campaign_draft' then
    if nullif(btrim(v_payload->>'name'), '') is null
       or nullif(btrim(v_payload->>'message'), '') is null then
      raise exception using errcode = '22023', message = 'Campaign name and message are required.';
    end if;

    insert into public.marketing_campaigns (
      business_id, name, channel, objective, audience_segment,
      subject, message, status, scheduled_at, created_by
    ) values (
      v_action.business_id,
      btrim(v_payload->>'name'),
      coalesce(nullif(v_payload->>'channel', ''), 'email'),
      coalesce(nullif(v_payload->>'objective', ''), 'custom'),
      coalesce(nullif(v_payload->>'audience_segment', ''), 'all'),
      nullif(btrim(v_payload->>'subject'), ''),
      btrim(v_payload->>'message'),
      'draft',
      null,
      v_action.requested_by
    )
    returning jsonb_build_object(
      'campaign_id', id,
      'name', name,
      'status', status
    ) into v_result;
  else
    if nullif(btrim(v_payload->>'title'), '') is null
       or nullif(btrim(v_payload->>'content'), '') is null then
      raise exception using errcode = '22023', message = 'Post title and content are required.';
    end if;

    insert into public.business_posts (
      business_id, author_user_id, title, content, post_type,
      audience, is_published, published_at, expires_at
    ) values (
      v_action.business_id,
      v_action.requested_by,
      btrim(v_payload->>'title'),
      btrim(v_payload->>'content'),
      coalesce(nullif(v_payload->>'post_type', ''), 'announcement'),
      coalesce(nullif(v_payload->>'audience', ''), 'public'),
      false,
      null,
      nullif(v_payload->>'expires_at', '')::timestamptz
    )
    returning jsonb_build_object(
      'post_id', id,
      'title', title,
      'status', 'draft'
    ) into v_result;
  end if;

  update public.ai_action_requests
  set status = 'executed',
      approved_by = requested_by,
      approved_at = now(),
      execution_started_at = now(),
      executed_at = now(),
      execution_result = v_result,
      error_message = null,
      updated_at = now()
  where id = v_action.id;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    v_action.business_id,
    v_action.requested_by,
    'ai_automation_low_risk_draft_executed',
    jsonb_build_object(
      'action_id', v_action.id,
      'action_type', v_action.action_type,
      'automation_run_id', v_action.automation_run_id,
      'automation_rule_id', v_action.automation_rule_id,
      'result', v_result
    )
  );

  return jsonb_build_object(
    'success', true,
    'status', 'executed',
    'action_id', v_action.id,
    'action_type', v_action.action_type,
    'result', v_result,
    'automatic', true
  );
exception when others then
  update public.ai_action_requests
  set status = 'failed',
      error_message = left(sqlerrm, 1000),
      updated_at = now()
  where id = p_action_id
    and status <> 'executed';
  raise;
end;
$$;

revoke all on function public.service_execute_ai_low_risk_draft_action(uuid) from public, anon, authenticated;
grant execute on function public.service_execute_ai_low_risk_draft_action(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. RLS and grants.
-- ---------------------------------------------------------------------------

alter table public.ai_automation_rules enable row level security;

drop policy if exists "Managers read AI automation rules" on public.ai_automation_rules;
create policy "Managers read AI automation rules"
on public.ai_automation_rules
for select
to authenticated
using (public.can_manage_ai_automations(business_id));

-- Configuration writes go through save_ai_automation_configuration so clients
-- cannot change allowed_action_types or handler_status.
revoke all on public.ai_automation_rules from public, anon, authenticated;
grant select on public.ai_automation_rules to authenticated;
grant all on public.ai_automation_rules to service_role;

-- Keep existing run read policy from 00038 and ensure service access.
grant select on public.ai_automation_runs to authenticated;
grant all on public.ai_automation_runs to service_role;

grant select, update (status, updated_at) on public.ai_manager_alerts to authenticated;
grant all on public.ai_manager_alerts to service_role;

comment on table public.ai_automation_rules is
  'Owner-configurable Velliqo AI automation rules. Trusted handlers and allowed action types cannot be changed directly from the browser.';

comment on function public.service_execute_ai_low_risk_draft_action(uuid) is
  'Executes only automation-generated low-risk campaign/post drafts. It never sends a campaign or changes appointments.';

commit;
