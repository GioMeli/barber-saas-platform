-- 00050_velliqo_production_communications.sql
-- Phase 13A: domain-independent communications architecture.
--
-- This migration completes the queue, retry, SMS, webhook-audit and worker
-- scheduling foundation. Live delivery remains globally paused until the Vault
-- secret `velliqo_communications_enabled` is set to `true` after Resend/Twilio
-- production configuration is complete.

begin;

-- ---------------------------------------------------------------------------
-- 1. Business-controlled communication preferences (managed from Storefront).
-- ---------------------------------------------------------------------------

alter table public.business_settings
  add column if not exists transactional_email_enabled boolean not null default true,
  add column if not exists transactional_sms_enabled boolean not null default false,
  add column if not exists communication_locale text not null default 'en',
  add column if not exists communication_reply_to_email text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'business_settings_communication_locale_check'
      and conrelid = 'public.business_settings'::regclass
  ) then
    alter table public.business_settings
      add constraint business_settings_communication_locale_check
      check (communication_locale in ('en', 'el', 'tr', 'de', 'es'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Queue and delivery hardening.
-- ---------------------------------------------------------------------------

alter table public.appointment_notification_jobs
  drop constraint if exists appointment_notification_jobs_channel_check;

alter table public.appointment_notification_jobs
  add constraint appointment_notification_jobs_channel_check
  check (channel in ('email', 'sms'));

alter table public.reminder_jobs
  add column if not exists available_at timestamptz;

update public.reminder_jobs
set available_at = coalesce(available_at, scheduled_for, now())
where available_at is null;

alter table public.reminder_jobs
  alter column available_at set default now(),
  alter column available_at set not null;

create index if not exists reminder_jobs_available_due_idx
  on public.reminder_jobs (available_at, scheduled_for, created_at)
  where status = 'queued';

alter table public.notification_deliveries
  add column if not exists appointment_notification_job_id uuid
    references public.appointment_notification_jobs(id) on delete set null,
  add column if not exists idempotency_key text,
  add column if not exists failure_code text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('queued', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'cancelled'));

create unique index if not exists notification_deliveries_appointment_job_recipient_uidx
  on public.notification_deliveries (appointment_notification_job_id, recipient)
  where appointment_notification_job_id is not null;

-- Earlier retry attempts may have produced more than one audit row for the
-- same reminder. Preserve the rows but detach older duplicates from the job so
-- the new idempotency constraint can be applied safely.
with ranked_reminder_deliveries as (
  select
    id,
    row_number() over (
      partition by reminder_job_id, recipient
      order by
        case when status in ('delivered', 'sent') then 0 else 1 end,
        created_at desc,
        id desc
    ) as row_rank
  from public.notification_deliveries
  where reminder_job_id is not null
)
update public.notification_deliveries delivery
set reminder_job_id = null,
    updated_at = now()
from ranked_reminder_deliveries ranked
where delivery.id = ranked.id
  and ranked.row_rank > 1;

create unique index if not exists notification_deliveries_reminder_job_recipient_uidx
  on public.notification_deliveries (reminder_job_id, recipient)
  where reminder_job_id is not null;

create unique index if not exists notification_deliveries_idempotency_uidx
  on public.notification_deliveries (idempotency_key)
  where idempotency_key is not null;

-- Transactional provider callbacks are stored separately from marketing events.
create table if not exists public.notification_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.notification_deliveries(id) on delete set null,
  business_id uuid references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('resend', 'twilio')),
  provider_event_id text not null unique,
  provider_message_id text,
  event_type text not null,
  occurred_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_delivery_events_delivery_idx
  on public.notification_delivery_events (delivery_id, created_at desc);

create index if not exists notification_delivery_events_business_idx
  on public.notification_delivery_events (business_id, created_at desc);

alter table public.notification_delivery_events enable row level security;

drop policy if exists "Business members can view notification delivery events"
  on public.notification_delivery_events;
create policy "Business members can view notification delivery events"
  on public.notification_delivery_events
  for select
  to authenticated
  using (business_id is not null and public.has_business_access(business_id));

drop policy if exists "Service role can manage notification delivery events"
  on public.notification_delivery_events;
create policy "Service role can manage notification delivery events"
  on public.notification_delivery_events
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.notification_delivery_events to authenticated;
grant all on public.notification_delivery_events to service_role;

-- ---------------------------------------------------------------------------
-- 3. Channel-aware transactional queue trigger.
-- ---------------------------------------------------------------------------

drop function if exists public.enqueue_appointment_notification(uuid, uuid, text, text, text);

create or replace function public.enqueue_appointment_notification(
  p_business_id uuid,
  p_appointment_id uuid,
  p_event_type text,
  p_recipient_type text,
  p_channel text,
  p_event_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.appointment_notification_jobs (
    business_id,
    appointment_id,
    event_type,
    recipient_type,
    channel,
    event_key,
    status,
    available_at,
    updated_at
  )
  values (
    p_business_id,
    p_appointment_id,
    p_event_type,
    p_recipient_type,
    p_channel,
    p_event_key,
    'queued',
    now(),
    now()
  )
  on conflict (event_key) do nothing;
end;
$$;

revoke all on function public.enqueue_appointment_notification(uuid, uuid, text, text, text, text) from public;
grant execute on function public.enqueue_appointment_notification(uuid, uuid, text, text, text, text) to service_role;

create or replace function public.sync_appointment_transactional_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version text;
  v_email_enabled boolean := true;
  v_sms_enabled boolean := false;
begin
  select
    coalesce(transactional_email_enabled, true),
    coalesce(transactional_sms_enabled, false)
  into v_email_enabled, v_sms_enabled
  from public.business_settings
  where business_id = new.business_id;

  if not found then
    v_email_enabled := true;
    v_sms_enabled := false;
  end if;

  if tg_op = 'INSERT' then
    v_version := coalesce(new.created_at::text, clock_timestamp()::text);

    if v_email_enabled then
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'booking_confirmation', 'customer', 'email',
        new.id::text || ':booking_confirmation:email:' || v_version
      );
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'owner_new_booking', 'owner', 'email',
        new.id::text || ':owner_new_booking:email:' || v_version
      );
    end if;

    if v_sms_enabled then
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'booking_confirmation', 'customer', 'sms',
        new.id::text || ':booking_confirmation:sms:' || v_version
      );
    end if;

    return new;
  end if;

  if new.status is distinct from old.status
     and new.status in ('cancelled_by_customer', 'cancelled_by_business') then
    v_version := new.status::text || ':' || coalesce(new.updated_at::text, clock_timestamp()::text);

    if v_email_enabled then
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'appointment_cancelled', 'customer', 'email',
        new.id::text || ':appointment_cancelled:email:' || v_version
      );
    end if;

    if v_sms_enabled then
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'appointment_cancelled', 'customer', 'sms',
        new.id::text || ':appointment_cancelled:sms:' || v_version
      );
    end if;

    return new;
  end if;

  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.employee_id is distinct from old.employee_id then
    v_version := new.start_time::text || ':' || new.end_time::text || ':' || coalesce(new.employee_id::text, 'unassigned');

    if v_email_enabled then
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'appointment_rescheduled', 'customer', 'email',
        new.id::text || ':appointment_rescheduled:email:' || v_version
      );
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'owner_appointment_rescheduled', 'owner', 'email',
        new.id::text || ':owner_appointment_rescheduled:email:' || v_version
      );
    end if;

    if v_sms_enabled then
      perform public.enqueue_appointment_notification(
        new.business_id, new.id, 'appointment_rescheduled', 'customer', 'sms',
        new.id::text || ':appointment_rescheduled:sms:' || v_version
      );
    end if;
  end if;

  return new;
end;
$$;

-- Existing trigger automatically uses the replaced function.

-- ---------------------------------------------------------------------------
-- 4. Vault-controlled cron workers. Applying this migration before the final
-- domain/provider setup is safe: jobs are no-ops until the enable flag is true.
-- ---------------------------------------------------------------------------

create or replace function public.velliqo_communications_are_enabled()
returns boolean
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select lower(btrim(decrypted_secret)) in ('true', '1', 'yes', 'on')
    from vault.decrypted_secrets
    where name = 'velliqo_communications_enabled'
    limit 1
  ), false);
$$;

revoke all on function public.velliqo_communications_are_enabled() from public, anon, authenticated;

create or replace function public.invoke_velliqo_appointment_notification_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_worker_url text;
  v_worker_secret text;
begin
  if not public.velliqo_communications_are_enabled() then
    return 0;
  end if;

  select btrim(decrypted_secret) into v_worker_url
  from vault.decrypted_secrets
  where name = 'velliqo_appointment_notification_worker_url'
  limit 1;

  select btrim(decrypted_secret) into v_worker_secret
  from vault.decrypted_secrets
  where name = 'velliqo_notification_function_secret'
  limit 1;

  if v_worker_url is null
     or v_worker_url !~ '^https://.+/functions/v1/process_appointment_notifications$'
     or v_worker_secret is null
     or length(v_worker_secret) < 32 then
    return 0;
  end if;

  return net.http_post(
    url := v_worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', v_worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

create or replace function public.invoke_velliqo_reminder_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_worker_url text;
  v_worker_secret text;
begin
  if not public.velliqo_communications_are_enabled() then
    return 0;
  end if;

  select btrim(decrypted_secret) into v_worker_url
  from vault.decrypted_secrets
  where name = 'velliqo_reminder_worker_url'
  limit 1;

  select btrim(decrypted_secret) into v_worker_secret
  from vault.decrypted_secrets
  where name = 'velliqo_reminder_function_secret'
  limit 1;

  if v_worker_url is null
     or v_worker_url !~ '^https://.+/functions/v1/process_reminder_jobs$'
     or v_worker_secret is null
     or length(v_worker_secret) < 32 then
    return 0;
  end if;

  return net.http_post(
    url := v_worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', v_worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.invoke_velliqo_appointment_notification_worker() from public, anon, authenticated;
revoke all on function public.invoke_velliqo_reminder_worker() from public, anon, authenticated;

do $cleanup$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname in ('process-appointment-notifications', 'process-appointment-reminders')
       or command ilike '%invoke_velliqo_appointment_notification_worker%'
       or command ilike '%invoke_velliqo_reminder_worker%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$cleanup$;

select cron.schedule(
  'process-appointment-notifications',
  '* * * * *',
  $cron$ select public.invoke_velliqo_appointment_notification_worker(); $cron$
);

select cron.schedule(
  'process-appointment-reminders',
  '* * * * *',
  $cron$ select public.invoke_velliqo_reminder_worker(); $cron$
);

commit;
