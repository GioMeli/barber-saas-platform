-- 00034_marketing_delivery_engine.sql
-- Production-safe campaign and automation delivery queue with consent enforcement,
-- retries, delivery logs, suppressions, in-app notifications and provider webhooks.

begin;

-- ---------------------------------------------------------------------------
-- 1. Customer marketing preferences and unsubscribe identity.
-- ---------------------------------------------------------------------------

alter table public.customer_business_profiles
  add column if not exists birth_date date,
  add column if not exists marketing_consent_updated_at timestamptz,
  add column if not exists email_unsubscribed_at timestamptz,
  add column if not exists sms_unsubscribed_at timestamptz,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists customer_business_profiles_unsubscribe_token_idx
  on public.customer_business_profiles (unsubscribe_token);

-- ---------------------------------------------------------------------------
-- 2. Per-business delivery controls. Delivery is disabled by default.
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_delivery_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  delivery_mode text not null default 'disabled'
    check (delivery_mode in ('disabled', 'test', 'live')),
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  daily_email_limit integer not null default 500 check (daily_email_limit between 0 and 100000),
  daily_sms_limit integer not null default 100 check (daily_sms_limit between 0 and 100000),
  from_name text,
  reply_to_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_marketing_delivery_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_delivery_settings_set_updated_at
  on public.marketing_delivery_settings;
create trigger marketing_delivery_settings_set_updated_at
before update on public.marketing_delivery_settings
for each row
execute function public.set_marketing_delivery_settings_updated_at();

alter table public.marketing_delivery_settings enable row level security;

drop policy if exists "Business members can manage marketing delivery settings"
  on public.marketing_delivery_settings;
create policy "Business members can manage marketing delivery settings"
on public.marketing_delivery_settings
for all
to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

revoke all on public.marketing_delivery_settings from anon;
grant select, insert, update, delete on public.marketing_delivery_settings to authenticated;
grant all on public.marketing_delivery_settings to service_role;

-- ---------------------------------------------------------------------------
-- 3. Delivery runs, queue rows, provider events and suppressions.
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_delivery_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  automation_id uuid references public.marketing_automations(id) on delete cascade,
  run_type text not null check (run_type in ('campaign', 'automation')),
  run_key text not null unique,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  status text not null default 'preparing'
    check (status in ('preparing', 'queued', 'processing', 'completed', 'partial', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  queued_count integer not null default 0 check (queued_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_delivery_runs_source_check check (
    (run_type = 'campaign' and campaign_id is not null and automation_id is null)
    or (run_type = 'automation' and automation_id is not null and campaign_id is null)
  )
);

create unique index if not exists marketing_delivery_runs_campaign_once_idx
  on public.marketing_delivery_runs (campaign_id)
  where campaign_id is not null;

create index if not exists marketing_delivery_runs_business_created_idx
  on public.marketing_delivery_runs (business_id, created_at desc);

create table if not exists public.marketing_deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.marketing_delivery_runs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  automation_id uuid references public.marketing_automations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  destination text not null,
  customer_name text,
  subject text,
  message text not null,
  status text not null default 'queued'
    check (status in (
      'queued', 'processing', 'sent', 'delivered', 'simulated',
      'failed', 'skipped', 'cancelled', 'bounced', 'complained', 'undelivered'
    )),
  provider text,
  provider_message_id text,
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  consent_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_deliveries_due_idx
  on public.marketing_deliveries (status, next_attempt_at, created_at)
  where status = 'queued';

create index if not exists marketing_deliveries_business_created_idx
  on public.marketing_deliveries (business_id, created_at desc);

create index if not exists marketing_deliveries_provider_message_idx
  on public.marketing_deliveries (provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.marketing_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.marketing_deliveries(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null,
  occurred_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists marketing_delivery_events_message_idx
  on public.marketing_delivery_events (provider, provider_message_id, received_at desc);

create table if not exists public.marketing_suppressions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  destination text not null,
  reason text not null,
  source text not null default 'customer'
    check (source in ('customer', 'owner', 'bounce', 'complaint', 'provider', 'system')),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  unique (business_id, channel, destination)
);

-- ---------------------------------------------------------------------------
-- 4. Customer in-app inbox.
-- ---------------------------------------------------------------------------

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  delivery_id uuid unique references public.marketing_deliveries(id) on delete set null,
  title text,
  message text not null,
  notification_type text not null default 'marketing'
    check (notification_type in ('marketing', 'system', 'appointment')),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists customer_notifications_user_unread_idx
  on public.customer_notifications (user_id, is_read, created_at desc);

alter table public.customer_notifications enable row level security;

drop policy if exists "Customers can read their own notifications"
  on public.customer_notifications;
create policy "Customers can read their own notifications"
on public.customer_notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Customers can update their own notifications"
  on public.customer_notifications;
create policy "Customers can update their own notifications"
on public.customer_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on public.customer_notifications from anon, authenticated;
grant select, update on public.customer_notifications to authenticated;
grant all on public.customer_notifications to service_role;

-- ---------------------------------------------------------------------------
-- 5. Owner read access. Queue writes remain service-role/RPC only.
-- ---------------------------------------------------------------------------

alter table public.marketing_delivery_runs enable row level security;
alter table public.marketing_deliveries enable row level security;
alter table public.marketing_delivery_events enable row level security;
alter table public.marketing_suppressions enable row level security;

drop policy if exists "Business members can view marketing delivery runs"
  on public.marketing_delivery_runs;
create policy "Business members can view marketing delivery runs"
on public.marketing_delivery_runs
for select
to authenticated
using (public.is_business_owner(business_id));

drop policy if exists "Business members can view marketing deliveries"
  on public.marketing_deliveries;
create policy "Business members can view marketing deliveries"
on public.marketing_deliveries
for select
to authenticated
using (public.is_business_owner(business_id));

drop policy if exists "Business members can view marketing delivery events"
  on public.marketing_delivery_events;
create policy "Business members can view marketing delivery events"
on public.marketing_delivery_events
for select
to authenticated
using (business_id is not null and public.is_business_owner(business_id));

drop policy if exists "Business members can view marketing suppressions"
  on public.marketing_suppressions;
create policy "Business members can view marketing suppressions"
on public.marketing_suppressions
for select
to authenticated
using (public.is_business_owner(business_id));

revoke all on public.marketing_delivery_runs from anon, authenticated;
revoke all on public.marketing_deliveries from anon, authenticated;
revoke all on public.marketing_delivery_events from anon, authenticated;
revoke all on public.marketing_suppressions from anon, authenticated;

grant select on public.marketing_delivery_runs to authenticated;
grant select on public.marketing_deliveries to authenticated;
grant select on public.marketing_delivery_events to authenticated;
grant select on public.marketing_suppressions to authenticated;
grant all on public.marketing_delivery_runs to service_role;
grant all on public.marketing_deliveries to service_role;
grant all on public.marketing_delivery_events to service_role;
grant all on public.marketing_suppressions to service_role;

-- Campaigns gain explicit processing/failure states now that a worker exists.
alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_status_check;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_status_check
  check (status in ('draft', 'scheduled', 'paused', 'processing', 'completed', 'failed', 'cancelled'));

-- Automation subjects are stored with the owner's current language.
alter table public.marketing_automations
  add column if not exists subject_template text;

-- ---------------------------------------------------------------------------
-- 6. Shared helpers.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_marketing_destination(
  p_channel text,
  p_destination text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_channel = 'email' then lower(btrim(coalesce(p_destination, '')))
    when p_channel = 'sms' then regexp_replace(coalesce(p_destination, ''), '[^0-9+]', '', 'g')
    else btrim(coalesce(p_destination, ''))
  end;
$$;

-- Keep customer channel preferences and the suppression registry synchronized.
-- Re-consent only lifts suppressions created by the customer; provider bounces,
-- complaints and owner blocks stay active until explicitly reviewed.
create or replace function public.sync_customer_marketing_suppressions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.normalize_marketing_destination('email', new.email);
  v_phone text := public.normalize_marketing_destination('sms', new.phone);
  v_now timestamptz := now();
begin
  if v_email <> '' then
    if new.marketing_consent is not true
       or new.email_notifications_enabled is not true
       or new.email_unsubscribed_at is not null then
      insert into public.marketing_suppressions (
        business_id, customer_id, channel, destination, reason, source, lifted_at
      ) values (
        new.business_id, new.customer_id, 'email', v_email,
        case when new.email_unsubscribed_at is not null then 'customer_unsubscribe' else 'customer_preference' end,
        'customer', null
      )
      on conflict (business_id, channel, destination) do update
      set customer_id = excluded.customer_id,
          reason = excluded.reason,
          source = 'customer',
          created_at = v_now,
          lifted_at = null
      where public.marketing_suppressions.source = 'customer';
    else
      update public.marketing_suppressions
      set lifted_at = v_now
      where business_id = new.business_id
        and channel = 'email'
        and destination = v_email
        and source = 'customer'
        and lifted_at is null;
    end if;
  end if;

  if v_phone <> '' then
    if new.marketing_consent is not true
       or new.sms_notifications_enabled is not true
       or new.sms_unsubscribed_at is not null then
      insert into public.marketing_suppressions (
        business_id, customer_id, channel, destination, reason, source, lifted_at
      ) values (
        new.business_id, new.customer_id, 'sms', v_phone,
        case when new.sms_unsubscribed_at is not null then 'customer_unsubscribe' else 'customer_preference' end,
        'customer', null
      )
      on conflict (business_id, channel, destination) do update
      set customer_id = excluded.customer_id,
          reason = excluded.reason,
          source = 'customer',
          created_at = v_now,
          lifted_at = null
      where public.marketing_suppressions.source = 'customer';
    else
      update public.marketing_suppressions
      set lifted_at = v_now
      where business_id = new.business_id
        and channel = 'sms'
        and destination = v_phone
        and source = 'customer'
        and lifted_at is null;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.email is distinct from new.email then
      update public.marketing_suppressions
      set lifted_at = coalesce(lifted_at, v_now)
      where business_id = old.business_id
        and channel = 'email'
        and destination = public.normalize_marketing_destination('email', old.email)
        and source = 'customer';
    end if;
    if old.phone is distinct from new.phone then
      update public.marketing_suppressions
      set lifted_at = coalesce(lifted_at, v_now)
      where business_id = old.business_id
        and channel = 'sms'
        and destination = public.normalize_marketing_destination('sms', old.phone)
        and source = 'customer';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_profiles_sync_marketing_suppressions
  on public.customer_business_profiles;
create trigger customer_profiles_sync_marketing_suppressions
after insert or update of
  marketing_consent,
  email_notifications_enabled,
  sms_notifications_enabled,
  email_unsubscribed_at,
  sms_unsubscribed_at,
  email,
  phone
on public.customer_business_profiles
for each row
execute function public.sync_customer_marketing_suppressions();

-- Backfill the suppression registry for profiles that have not opted in.
insert into public.marketing_suppressions (
  business_id, customer_id, channel, destination, reason, source, lifted_at
)
select
  cbp.business_id,
  cbp.customer_id,
  channel_data.channel,
  channel_data.destination,
  case
    when channel_data.unsubscribed_at is not null then 'customer_unsubscribe'
    else 'customer_preference'
  end,
  'customer',
  null
from public.customer_business_profiles cbp
cross join lateral (
  values
    ('email'::text, public.normalize_marketing_destination('email', cbp.email), cbp.email_notifications_enabled, cbp.email_unsubscribed_at),
    ('sms'::text, public.normalize_marketing_destination('sms', cbp.phone), cbp.sms_notifications_enabled, cbp.sms_unsubscribed_at)
) as channel_data(channel, destination, channel_enabled, unsubscribed_at)
where channel_data.destination <> ''
  and (
    cbp.marketing_consent is not true
    or channel_data.channel_enabled is not true
    or channel_data.unsubscribed_at is not null
  )
on conflict (business_id, channel, destination) do update
set customer_id = excluded.customer_id,
    reason = excluded.reason,
    source = 'customer',
    lifted_at = null
where public.marketing_suppressions.source = 'customer';

create or replace function public.is_marketing_service_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

revoke all on function public.is_marketing_service_role() from public;
grant execute on function public.is_marketing_service_role() to service_role;


-- Apply Twilio STOP/START style keywords to every matching customer profile.
-- This is service-role only because the request is authenticated by Twilio at the Edge Function.
create or replace function public.service_apply_sms_marketing_keyword(
  p_phone text,
  p_keyword text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_marketing_destination('sms', p_phone);
  v_keyword text := upper(btrim(coalesce(p_keyword, '')));
  v_count integer := 0;
begin
  if not public.is_marketing_service_role() then
    raise exception 'Service role required';
  end if;

  if v_phone = '' then
    return 0;
  end if;

  if v_keyword in ('STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT') then
    update public.customer_business_profiles cbp
    set sms_notifications_enabled = false,
        sms_unsubscribed_at = now(),
        marketing_consent_updated_at = now(),
        updated_at = now()
    where public.normalize_marketing_destination('sms', cbp.phone) = v_phone;
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  if v_keyword in ('START', 'YES', 'UNSTOP') then
    update public.customer_business_profiles cbp
    set sms_notifications_enabled = true,
        sms_unsubscribed_at = null,
        marketing_consent_updated_at = now(),
        updated_at = now()
    where public.normalize_marketing_destination('sms', cbp.phone) = v_phone
      and cbp.marketing_consent is true;
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  return 0;
end;
$$;

revoke all on function public.service_apply_sms_marketing_keyword(text, text) from public;
grant execute on function public.service_apply_sms_marketing_keyword(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Materialise a campaign exactly once.
-- ---------------------------------------------------------------------------

create or replace function public.queue_marketing_campaign_internal(
  p_campaign_id uuid,
  p_requested_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.marketing_campaigns;
  v_run_id uuid;
  v_inserted integer := 0;
  v_is_service boolean := public.is_marketing_service_role();
begin
  select * into v_campaign
  from public.marketing_campaigns
  where id = p_campaign_id
  for update;

  if v_campaign.id is null then
    raise exception 'Campaign not found';
  end if;

  if not v_is_service and not public.is_business_owner(v_campaign.business_id) then
    raise exception 'Access denied';
  end if;

  if v_campaign.status in ('cancelled', 'completed', 'failed') then
    raise exception 'Campaign cannot be queued from its current status';
  end if;

  insert into public.marketing_delivery_settings (business_id)
  values (v_campaign.business_id)
  on conflict (business_id) do nothing;

  insert into public.marketing_delivery_runs (
    business_id,
    campaign_id,
    run_type,
    run_key,
    channel,
    status,
    scheduled_for,
    started_at,
    metadata
  ) values (
    v_campaign.business_id,
    v_campaign.id,
    'campaign',
    'campaign:' || v_campaign.id::text,
    v_campaign.channel,
    'preparing',
    coalesce(v_campaign.scheduled_at, now()),
    now(),
    jsonb_build_object('requested_by', coalesce(p_requested_by, auth.uid()))
  )
  on conflict do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select id into v_run_id
    from public.marketing_delivery_runs
    where campaign_id = v_campaign.id;
    return v_run_id;
  end if;

  with customer_metrics as (
    select
      c.id as customer_id,
      coalesce(c.user_id, cbp.user_id) as user_id,
      c.full_name,
      c.created_at,
      public.normalize_marketing_destination('email', coalesce(cbp.email, c.email)) as email,
      public.normalize_marketing_destination('sms', coalesce(cbp.phone, c.phone)) as phone,
      cbp.marketing_consent,
      cbp.email_notifications_enabled,
      cbp.sms_notifications_enabled,
      cbp.unsubscribe_token,
      max(a.start_time) filter (where a.status = 'completed') as last_completed_at,
      count(a.id) filter (where a.status = 'completed')::integer as completed_visits,
      coalesce(sum(a.total_price) filter (where a.status = 'completed'), 0)::numeric as lifetime_revenue
    from public.customers c
    left join public.customer_business_profiles cbp
      on cbp.business_id = c.business_id
     and cbp.customer_id = c.id
    left join public.appointments a
      on a.business_id = c.business_id
     and a.customer_id = c.id
    where c.business_id = v_campaign.business_id
    group by
      c.id,
      c.user_id,
      c.full_name,
      c.created_at,
      cbp.user_id,
      cbp.email,
      cbp.phone,
      cbp.marketing_consent,
      cbp.email_notifications_enabled,
      cbp.sms_notifications_enabled,
      cbp.unsubscribe_token,
      c.email,
      c.phone
  ), segmented as (
    select *,
      case v_campaign.audience_segment
        when 'all' then true
        when 'active' then last_completed_at >= now() - interval '60 days'
        when 'at_risk' then last_completed_at < now() - interval '60 days'
                            and last_completed_at >= now() - interval '180 days'
        when 'vip' then lifetime_revenue >= 500 or completed_visits >= 5
        when 'new' then created_at >= now() - interval '30 days'
        when 'registered' then user_id is not null
        when 'guests' then user_id is null
        else false
      end as segment_match
    from customer_metrics
  ), eligible as (
    select *,
      case v_campaign.channel
        when 'email' then email
        when 'sms' then phone
        when 'in_app' then user_id::text
      end as destination,
      case v_campaign.channel
        when 'email' then marketing_consent is true
                          and email_notifications_enabled is true
                          and email <> ''
        when 'sms' then marketing_consent is true
                        and sms_notifications_enabled is true
                        and phone <> ''
        when 'in_app' then user_id is not null
        else false
      end as channel_eligible
    from segmented
    where segment_match
  )
  insert into public.marketing_deliveries (
    run_id,
    business_id,
    campaign_id,
    customer_id,
    user_id,
    channel,
    destination,
    customer_name,
    subject,
    message,
    status,
    idempotency_key,
    consent_snapshot,
    metadata
  )
  select
    v_run_id,
    v_campaign.business_id,
    v_campaign.id,
    e.customer_id,
    e.user_id,
    v_campaign.channel,
    e.destination,
    e.full_name,
    v_campaign.subject,
    v_campaign.message,
    'queued',
    'campaign/' || v_campaign.id::text || '/' || e.customer_id::text || '/' || v_campaign.channel,
    jsonb_build_object(
      'marketing_consent', e.marketing_consent,
      'email_enabled', e.email_notifications_enabled,
      'sms_enabled', e.sms_notifications_enabled,
      'captured_at', now()
    ),
    jsonb_build_object(
      'unsubscribe_token', e.unsubscribe_token,
      'audience_segment', v_campaign.audience_segment,
      'objective', v_campaign.objective
    )
  from eligible e
  where e.channel_eligible
    and not exists (
      select 1
      from public.marketing_suppressions s
      where s.business_id = v_campaign.business_id
        and s.channel = v_campaign.channel
        and s.destination = e.destination
        and s.lifted_at is null
    )
  on conflict (idempotency_key) do nothing;

  get diagnostics v_inserted = row_count;

  update public.marketing_delivery_runs
  set recipient_count = v_inserted,
      queued_count = v_inserted,
      status = case when v_inserted = 0 then 'completed' else 'queued' end,
      completed_at = case when v_inserted = 0 then now() else null end,
      updated_at = now(),
      metadata = metadata || case
        when v_inserted = 0 then jsonb_build_object('reason', 'no_eligible_recipients')
        else '{}'::jsonb
      end
  where id = v_run_id;

  update public.marketing_campaigns
  set status = case when v_inserted = 0 then 'completed' else 'processing' end,
      estimated_recipients = v_inserted,
      updated_at = now()
  where id = v_campaign.id;

  return v_run_id;
end;
$$;

revoke all on function public.queue_marketing_campaign_internal(uuid, uuid) from public;
grant execute on function public.queue_marketing_campaign_internal(uuid, uuid) to service_role;

create or replace function public.owner_queue_marketing_campaign(
  p_campaign_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.queue_marketing_campaign_internal(p_campaign_id, auth.uid());
end;
$$;

revoke all on function public.owner_queue_marketing_campaign(uuid) from public;
grant execute on function public.owner_queue_marketing_campaign(uuid) to authenticated;

create or replace function public.service_queue_due_marketing_campaigns(
  p_limit integer default 20
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign record;
  v_count integer := 0;
begin
  if not public.is_marketing_service_role() then
    raise exception 'Service role required';
  end if;

  for v_campaign in
    select id
    from public.marketing_campaigns
    where status = 'scheduled'
      and scheduled_at is not null
      and scheduled_at <= now()
    order by scheduled_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  loop
    perform public.queue_marketing_campaign_internal(v_campaign.id, null);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.service_queue_due_marketing_campaigns(integer) from public;
grant execute on function public.service_queue_due_marketing_campaigns(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Automation candidate materialisation.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_marketing_automation_candidate(
  p_automation_id uuid,
  p_customer_id uuid,
  p_event_key text,
  p_appointment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_automation public.marketing_automations;
  v_customer record;
  v_destination text;
  v_run_id uuid;
  v_subject text;
begin
  if not public.is_marketing_service_role() then
    raise exception 'Service role required';
  end if;

  select * into v_automation
  from public.marketing_automations
  where id = p_automation_id
    and is_enabled = true;

  if v_automation.id is null then
    return null;
  end if;

  select
    c.id as customer_id,
    c.full_name,
    coalesce(c.user_id, cbp.user_id) as user_id,
    public.normalize_marketing_destination('email', coalesce(cbp.email, c.email)) as email,
    public.normalize_marketing_destination('sms', coalesce(cbp.phone, c.phone)) as phone,
    cbp.marketing_consent,
    cbp.email_notifications_enabled,
    cbp.sms_notifications_enabled,
    cbp.unsubscribe_token
  into v_customer
  from public.customers c
  left join public.customer_business_profiles cbp
    on cbp.business_id = c.business_id
   and cbp.customer_id = c.id
  where c.id = p_customer_id
    and c.business_id = v_automation.business_id;

  if v_customer.customer_id is null then
    return null;
  end if;

  v_destination := case v_automation.channel
    when 'email' then v_customer.email
    when 'sms' then v_customer.phone
    when 'in_app' then v_customer.user_id::text
  end;

  if v_automation.channel = 'email' and not (
    v_customer.marketing_consent is true
    and v_customer.email_notifications_enabled is true
    and coalesce(v_destination, '') <> ''
  ) then return null; end if;

  if v_automation.channel = 'sms' and not (
    v_customer.marketing_consent is true
    and v_customer.sms_notifications_enabled is true
    and coalesce(v_destination, '') <> ''
  ) then return null; end if;

  if v_automation.channel = 'in_app' and v_customer.user_id is null then
    return null;
  end if;

  if v_automation.channel in ('email', 'sms') and exists (
    select 1 from public.marketing_suppressions s
    where s.business_id = v_automation.business_id
      and s.channel = v_automation.channel
      and s.destination = v_destination
      and s.lifted_at is null
  ) then return null; end if;

  insert into public.marketing_delivery_settings (business_id)
  values (v_automation.business_id)
  on conflict (business_id) do nothing;

  insert into public.marketing_delivery_runs (
    business_id,
    automation_id,
    run_type,
    run_key,
    channel,
    status,
    scheduled_for,
    started_at,
    recipient_count,
    queued_count,
    metadata
  ) values (
    v_automation.business_id,
    v_automation.id,
    'automation',
    'automation:' || v_automation.id::text || ':' || p_event_key,
    v_automation.channel,
    'queued',
    now(),
    now(),
    1,
    1,
    p_metadata || jsonb_build_object('automation_key', v_automation.automation_key)
  )
  on conflict (run_key) do nothing
  returning id into v_run_id;

  if v_run_id is null then
    return null;
  end if;

  v_subject := coalesce(nullif(v_automation.subject_template, ''), case v_automation.automation_key
    when 'birthday' then 'A birthday message from your business'
    when 'win_back' then 'We would love to see you again'
    when 'review_request' then 'How was your recent visit?'
    when 'no_show_recovery' then 'Let us help you reschedule'
    else 'A message from your business'
  end);

  insert into public.marketing_deliveries (
    run_id,
    business_id,
    automation_id,
    customer_id,
    user_id,
    appointment_id,
    channel,
    destination,
    customer_name,
    subject,
    message,
    status,
    idempotency_key,
    consent_snapshot,
    metadata
  ) values (
    v_run_id,
    v_automation.business_id,
    v_automation.id,
    v_customer.customer_id,
    v_customer.user_id,
    p_appointment_id,
    v_automation.channel,
    v_destination,
    v_customer.full_name,
    v_subject,
    v_automation.message_template,
    'queued',
    'automation/' || v_automation.id::text || '/' || p_event_key || '/' || v_automation.channel,
    jsonb_build_object(
      'marketing_consent', v_customer.marketing_consent,
      'email_enabled', v_customer.email_notifications_enabled,
      'sms_enabled', v_customer.sms_notifications_enabled,
      'captured_at', now()
    ),
    p_metadata || jsonb_build_object(
      'unsubscribe_token', v_customer.unsubscribe_token,
      'automation_key', v_automation.automation_key
    )
  );

  return v_run_id;
end;
$$;

revoke all on function public.enqueue_marketing_automation_candidate(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function public.enqueue_marketing_automation_candidate(uuid, uuid, text, uuid, jsonb) to service_role;

create or replace function public.service_prepare_marketing_automations(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_automation record;
  v_candidate record;
  v_count integer := 0;
  v_limit integer := greatest(1, least(p_limit, 500));
begin
  if not public.is_marketing_service_role() then
    raise exception 'Service role required';
  end if;

  for v_automation in
    select * from public.marketing_automations
    where is_enabled = true
    order by updated_at
  loop
    if v_automation.automation_key = 'review_request' then
      for v_candidate in
        select a.id as appointment_id, a.customer_id, a.end_time as event_at
        from public.appointments a
        where a.business_id = v_automation.business_id
          and a.status = 'completed'
          and a.end_time <= now() - make_interval(hours => v_automation.delay_hours)
        order by a.end_time desc
        limit v_limit
      loop
        if public.enqueue_marketing_automation_candidate(
          v_automation.id,
          v_candidate.customer_id,
          'appointment:' || v_candidate.appointment_id::text,
          v_candidate.appointment_id,
          jsonb_build_object('event_at', v_candidate.event_at)
        ) is not null then v_count := v_count + 1; end if;
      end loop;

    elsif v_automation.automation_key = 'no_show_recovery' then
      for v_candidate in
        select a.id as appointment_id, a.customer_id, a.start_time as event_at
        from public.appointments a
        where a.business_id = v_automation.business_id
          and a.status = 'no_show'
          and a.start_time <= now() - make_interval(hours => v_automation.delay_hours)
        order by a.start_time desc
        limit v_limit
      loop
        if public.enqueue_marketing_automation_candidate(
          v_automation.id,
          v_candidate.customer_id,
          'appointment:' || v_candidate.appointment_id::text,
          v_candidate.appointment_id,
          jsonb_build_object('event_at', v_candidate.event_at)
        ) is not null then v_count := v_count + 1; end if;
      end loop;

    elsif v_automation.automation_key = 'win_back' then
      for v_candidate in
        select
          c.id as customer_id,
          max(a.start_time) filter (where a.status = 'completed') as last_visit
        from public.customers c
        join public.appointments a
          on a.business_id = c.business_id
         and a.customer_id = c.id
        where c.business_id = v_automation.business_id
        group by c.id
        having max(a.start_time) filter (where a.status = 'completed')
                 <= now() - make_interval(hours => v_automation.delay_hours)
           and not exists (
             select 1
             from public.appointments future
             where future.business_id = c.business_id
               and future.customer_id = c.id
               and future.start_time > now()
               and future.status not in ('cancelled_by_customer', 'cancelled_by_business', 'no_show')
           )
        order by last_visit
        limit v_limit
      loop
        if public.enqueue_marketing_automation_candidate(
          v_automation.id,
          v_candidate.customer_id,
          'customer:' || v_candidate.customer_id::text || ':' || to_char(now(), 'YYYY-MM'),
          null,
          jsonb_build_object('last_visit', v_candidate.last_visit)
        ) is not null then v_count := v_count + 1; end if;
      end loop;

    elsif v_automation.automation_key = 'birthday' then
      for v_candidate in
        select cbp.customer_id, cbp.birth_date
        from public.customer_business_profiles cbp
        where cbp.business_id = v_automation.business_id
          and cbp.customer_id is not null
          and cbp.birth_date is not null
          and extract(month from cbp.birth_date) = extract(month from current_date)
          and extract(day from cbp.birth_date) = extract(day from current_date)
        limit v_limit
      loop
        if public.enqueue_marketing_automation_candidate(
          v_automation.id,
          v_candidate.customer_id,
          'customer:' || v_candidate.customer_id::text || ':birthday:' || to_char(current_date, 'YYYY'),
          null,
          jsonb_build_object('birth_date', v_candidate.birth_date)
        ) is not null then v_count := v_count + 1; end if;
      end loop;
    end if;

    update public.marketing_automations
    set last_run_at = now(), updated_at = now()
    where id = v_automation.id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.service_prepare_marketing_automations(integer) from public;
grant execute on function public.service_prepare_marketing_automations(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Atomic worker claims and send-time consent validation.
-- ---------------------------------------------------------------------------

create or replace function public.claim_marketing_deliveries(
  p_worker_id text,
  p_limit integer default 25
)
returns setof public.marketing_deliveries
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select d.id
    from public.marketing_deliveries d
    join public.marketing_delivery_settings s on s.business_id = d.business_id
    where d.status = 'queued'
      and d.next_attempt_at <= now()
      and s.delivery_mode <> 'disabled'
      and (
        (d.channel = 'email' and s.email_enabled)
        or (d.channel = 'sms' and s.sms_enabled)
        or (d.channel = 'in_app' and s.in_app_enabled)
      )
    order by d.next_attempt_at, d.created_at
    for update of d skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.marketing_deliveries d
  set status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      attempt_count = d.attempt_count + 1,
      updated_at = now()
  from candidates c
  where d.id = c.id
  returning d.*;
$$;

revoke all on function public.claim_marketing_deliveries(text, integer) from public;
grant execute on function public.claim_marketing_deliveries(text, integer) to service_role;

create or replace function public.revalidate_marketing_delivery(
  p_delivery_id uuid
)
returns table (
  allowed boolean,
  current_destination text,
  delivery_mode text,
  reason text,
  unsubscribe_token uuid,
  business_name text,
  business_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.marketing_deliveries;
  v_profile record;
  v_settings public.marketing_delivery_settings;
begin
  if not public.is_marketing_service_role() then
    raise exception 'Service role required';
  end if;

  select * into v_delivery
  from public.marketing_deliveries
  where id = p_delivery_id;

  if v_delivery.id is null then
    return query select false, null::text, null::text, 'delivery_not_found', null::uuid, null::text, null::text;
    return;
  end if;

  select * into v_settings
  from public.marketing_delivery_settings
  where business_id = v_delivery.business_id;

  if v_settings.delivery_mode is null or v_settings.delivery_mode = 'disabled' then
    return query select false, null::text, coalesce(v_settings.delivery_mode, 'disabled'), 'delivery_disabled', null::uuid, null::text, null::text;
    return;
  end if;

  select
    c.full_name,
    coalesce(c.user_id, cbp.user_id) as user_id,
    public.normalize_marketing_destination('email', coalesce(cbp.email, c.email)) as email,
    public.normalize_marketing_destination('sms', coalesce(cbp.phone, c.phone)) as phone,
    cbp.marketing_consent,
    cbp.email_notifications_enabled,
    cbp.sms_notifications_enabled,
    cbp.unsubscribe_token,
    b.name as business_name,
    b.slug as business_slug
  into v_profile
  from public.customers c
  join public.businesses b on b.id = c.business_id
  left join public.customer_business_profiles cbp
    on cbp.business_id = c.business_id
   and cbp.customer_id = c.id
  where c.id = v_delivery.customer_id
    and c.business_id = v_delivery.business_id;

  if v_profile.full_name is null then
    return query select false, null::text, v_settings.delivery_mode, 'customer_not_found', null::uuid, null::text, null::text;
    return;
  end if;

  if v_delivery.channel = 'email' then
    if not (v_profile.marketing_consent is true and v_profile.email_notifications_enabled is true and coalesce(v_profile.email, '') <> '') then
      return query select false, v_profile.email, v_settings.delivery_mode, 'email_consent_missing', v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
      return;
    end if;
    if exists (
      select 1 from public.marketing_suppressions s
      where s.business_id = v_delivery.business_id
        and s.channel = 'email'
        and s.destination = v_profile.email
        and s.lifted_at is null
    ) then
      return query select false, v_profile.email, v_settings.delivery_mode, 'email_suppressed', v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
      return;
    end if;
    return query select true, v_profile.email, v_settings.delivery_mode, null::text, v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
    return;
  end if;

  if v_delivery.channel = 'sms' then
    if not (v_profile.marketing_consent is true and v_profile.sms_notifications_enabled is true and coalesce(v_profile.phone, '') <> '') then
      return query select false, v_profile.phone, v_settings.delivery_mode, 'sms_consent_missing', v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
      return;
    end if;
    if exists (
      select 1 from public.marketing_suppressions s
      where s.business_id = v_delivery.business_id
        and s.channel = 'sms'
        and s.destination = v_profile.phone
        and s.lifted_at is null
    ) then
      return query select false, v_profile.phone, v_settings.delivery_mode, 'sms_suppressed', v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
      return;
    end if;
    return query select true, v_profile.phone, v_settings.delivery_mode, null::text, v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
    return;
  end if;

  if v_delivery.channel = 'in_app' then
    if v_profile.user_id is null then
      return query select false, null::text, v_settings.delivery_mode, 'customer_account_missing', v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
      return;
    end if;
    return query select true, v_profile.user_id::text, v_settings.delivery_mode, null::text, v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
    return;
  end if;

  return query select false, null::text, v_settings.delivery_mode, 'unsupported_channel', v_profile.unsubscribe_token, v_profile.business_name, v_profile.business_slug;
end;
$$;

revoke all on function public.revalidate_marketing_delivery(uuid) from public;
grant execute on function public.revalidate_marketing_delivery(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Aggregate delivery status back to run and campaign.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_marketing_delivery_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.marketing_delivery_runs;
  v_total integer;
  v_queued integer;
  v_sent integer;
  v_delivered integer;
  v_failed integer;
  v_skipped integer;
  v_terminal integer;
begin
  select * into v_run from public.marketing_delivery_runs where id = new.run_id;

  select
    count(*),
    count(*) filter (where status in ('queued', 'processing')),
    count(*) filter (where status in ('sent', 'delivered', 'bounced', 'complained', 'undelivered')),
    count(*) filter (where status = 'delivered'),
    count(*) filter (where status in ('failed', 'bounced', 'complained', 'undelivered')),
    count(*) filter (where status in ('skipped', 'simulated', 'cancelled')),
    count(*) filter (where status in ('sent', 'delivered', 'simulated', 'failed', 'skipped', 'cancelled', 'bounced', 'complained', 'undelivered'))
  into v_total, v_queued, v_sent, v_delivered, v_failed, v_skipped, v_terminal
  from public.marketing_deliveries
  where run_id = new.run_id;

  update public.marketing_delivery_runs
  set recipient_count = v_total,
      queued_count = v_queued,
      sent_count = v_sent,
      delivered_count = v_delivered,
      failed_count = v_failed,
      skipped_count = v_skipped,
      status = case
        when v_terminal < v_total then 'processing'
        when v_failed = 0 then 'completed'
        when v_failed < v_total then 'partial'
        else 'failed'
      end,
      completed_at = case when v_terminal = v_total then coalesce(completed_at, now()) else null end,
      updated_at = now()
  where id = new.run_id;

  if v_run.campaign_id is not null then
    update public.marketing_campaigns
    set sent_count = v_sent,
        delivered_count = v_delivered,
        status = case
          when v_terminal < v_total then 'processing'
          when v_failed = v_total and v_total > 0 then 'failed'
          else 'completed'
        end,
        updated_at = now()
    where id = v_run.campaign_id;
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_deliveries_refresh_totals
  on public.marketing_deliveries;
create trigger marketing_deliveries_refresh_totals
after insert or update of status on public.marketing_deliveries
for each row
execute function public.refresh_marketing_delivery_totals();

-- ---------------------------------------------------------------------------
-- 11. Realtime customer inbox.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_notifications'
  ) then
    alter publication supabase_realtime add table public.customer_notifications;
  end if;
end;
$$;

commit;
