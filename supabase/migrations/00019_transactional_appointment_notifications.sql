-- 00019_transactional_appointment_notifications.sql
-- Immediate appointment emails:
-- customer booking confirmation, owner new-booking alert,
-- customer cancellation, and customer/owner reschedule notices.
--
-- This migration only creates an asynchronous queue and trigger.
-- It does not change the existing booking RPCs or appointment constraints.

begin;

create table if not exists public.appointment_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  appointment_id uuid not null
    references public.appointments(id) on delete cascade,

  event_type text not null,
  recipient_type text not null,
  channel text not null default 'email',

  event_key text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,

  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointment_notification_jobs_event_type_check
    check (
      event_type in (
        'booking_confirmation',
        'owner_new_booking',
        'appointment_cancelled',
        'appointment_rescheduled',
        'owner_appointment_rescheduled'
      )
    ),

  constraint appointment_notification_jobs_recipient_type_check
    check (recipient_type in ('customer', 'owner')),

  constraint appointment_notification_jobs_channel_check
    check (channel = 'email'),

  constraint appointment_notification_jobs_status_check
    check (
      status in (
        'queued',
        'processing',
        'sent',
        'failed',
        'cancelled'
      )
    ),

  constraint appointment_notification_jobs_attempts_check
    check (
      attempt_count >= 0
      and max_attempts > 0
      and attempt_count <= max_attempts
    ),

  constraint appointment_notification_jobs_event_key_unique
    unique (event_key)
);

create index if not exists appointment_notification_jobs_due_idx
  on public.appointment_notification_jobs (available_at, created_at)
  where status = 'queued';

create index if not exists appointment_notification_jobs_business_idx
  on public.appointment_notification_jobs (business_id, created_at desc);

create index if not exists appointment_notification_jobs_appointment_idx
  on public.appointment_notification_jobs (appointment_id, created_at desc);

alter table public.appointment_notification_jobs enable row level security;

drop policy if exists "Business members can view appointment notification jobs"
  on public.appointment_notification_jobs;

create policy "Business members can view appointment notification jobs"
  on public.appointment_notification_jobs
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Service role can manage appointment notification jobs"
  on public.appointment_notification_jobs;

create policy "Service role can manage appointment notification jobs"
  on public.appointment_notification_jobs
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.appointment_notification_jobs to authenticated;
grant all on public.appointment_notification_jobs to service_role;

create or replace function public.enqueue_appointment_notification(
  p_business_id uuid,
  p_appointment_id uuid,
  p_event_type text,
  p_recipient_type text,
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
    p_event_key,
    'queued',
    now(),
    now()
  )
  on conflict (event_key) do nothing;
end;
$$;

revoke all on function public.enqueue_appointment_notification(
  uuid,
  uuid,
  text,
  text,
  text
) from public;

grant execute on function public.enqueue_appointment_notification(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

create or replace function public.sync_appointment_transactional_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version text;
begin
  if tg_op = 'INSERT' then
    v_version := coalesce(new.created_at::text, clock_timestamp()::text);

    perform public.enqueue_appointment_notification(
      new.business_id,
      new.id,
      'booking_confirmation',
      'customer',
      new.id::text || ':booking_confirmation:' || v_version
    );

    perform public.enqueue_appointment_notification(
      new.business_id,
      new.id,
      'owner_new_booking',
      'owner',
      new.id::text || ':owner_new_booking:' || v_version
    );

    return new;
  end if;

  if new.status is distinct from old.status
     and new.status in ('cancelled_by_customer', 'cancelled_by_business') then
    v_version := new.status::text || ':' ||
      coalesce(new.updated_at::text, clock_timestamp()::text);

    perform public.enqueue_appointment_notification(
      new.business_id,
      new.id,
      'appointment_cancelled',
      'customer',
      new.id::text || ':appointment_cancelled:' || v_version
    );

    return new;
  end if;

  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.employee_id is distinct from old.employee_id then
    v_version :=
      new.start_time::text || ':' ||
      new.end_time::text || ':' ||
      coalesce(new.employee_id::text, 'unassigned');

    perform public.enqueue_appointment_notification(
      new.business_id,
      new.id,
      'appointment_rescheduled',
      'customer',
      new.id::text || ':appointment_rescheduled:' || v_version
    );

    perform public.enqueue_appointment_notification(
      new.business_id,
      new.id,
      'owner_appointment_rescheduled',
      'owner',
      new.id::text || ':owner_appointment_rescheduled:' || v_version
    );
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_sync_transactional_notifications
  on public.appointments;

create trigger appointments_sync_transactional_notifications
after insert or update of
  status,
  start_time,
  end_time,
  employee_id
on public.appointments
for each row
execute function public.sync_appointment_transactional_notifications();

commit;
