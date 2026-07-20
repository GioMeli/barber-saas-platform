-- 00022_automatic_completion_and_delay_manager.sql
-- Automatic completion one hour after appointment end time.
-- Atomic staff-delay preview and application.
--
-- Delay affects active appointments for ONE professional on ONE local date,
-- starting from the selected local time. Appointments are moved together.
-- No partial update is committed if any validation fails.

begin;

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1. Automatic completion worker
-- ---------------------------------------------------------------------------

create or replace function public.complete_expired_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with candidates as (
    select
      a.id,
      a.business_id,
      a.status as old_status
    from public.appointments a
    where a.status in (
      'pending',
      'confirmed',
      'arrived',
      'in_progress'
    )
      and a.end_time <= now() - interval '1 hour'
    for update skip locked
  ),
  updated as (
    update public.appointments a
    set
      status = 'completed',
      updated_at = now()
    from candidates c
    where a.id = c.id
    returning
      a.id,
      a.business_id,
      c.old_status
  ),
  audit_insert as (
    insert into public.audit_logs (
      business_id,
      user_id,
      action,
      details
    )
    select
      u.business_id,
      null,
      'appointment_auto_completed',
      jsonb_build_object(
        'appointment_id', u.id,
        'old_status', u.old_status,
        'new_status', 'completed',
        'completed_at', now(),
        'rule', 'one_hour_after_end_time'
      )
    from updated u
    returning 1
  )
  select count(*)
  into v_count
  from updated;

  return v_count;
end;
$$;

revoke all on function public.complete_expired_appointments() from public;
grant execute on function public.complete_expired_appointments() to service_role;

-- Run every five minutes. This gives a maximum practical delay of about
-- five minutes after the one-hour threshold.
do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'auto-complete-expired-appointments'
  order by jobid
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'auto-complete-expired-appointments',
    '*/5 * * * *',
    $cron$select public.complete_expired_appointments();$cron$
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Preview delay
-- ---------------------------------------------------------------------------

create or replace function public.owner_preview_staff_delay(
  p_business_id uuid,
  p_employee_id uuid,
  p_local_date date,
  p_delay_from time,
  p_delay_minutes integer
)
returns table (
  appointment_id uuid,
  booking_reference text,
  customer_name text,
  old_start_time timestamptz,
  old_end_time timestamptz,
  new_start_time timestamptz,
  new_end_time timestamptz,
  status public.appointment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text;
  v_delay_from_utc timestamptz;
begin
  if auth.uid() is null
     or not public.has_business_access(p_business_id) then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to this business.';
  end if;

  if p_delay_minutes < 1 or p_delay_minutes > 240 then
    raise exception using
      errcode = '22023',
      message = 'Delay must be between 1 and 240 minutes.';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.business_id = p_business_id
      and e.is_active = true
  ) then
    raise exception using
      errcode = '22023',
      message = 'Professional not found or inactive.';
  end if;

  select coalesce(nullif(b.timezone, ''), 'UTC')
  into v_timezone
  from public.businesses b
  where b.id = p_business_id
    and b.status = 'active';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Business is not available.';
  end if;

  v_delay_from_utc :=
    ((p_local_date + p_delay_from) at time zone v_timezone);

  return query
  select
    a.id,
    a.booking_reference,
    coalesce(c.full_name, 'Customer'),
    a.start_time,
    a.end_time,
    a.start_time + make_interval(mins => p_delay_minutes),
    a.end_time + make_interval(mins => p_delay_minutes),
    a.status
  from public.appointments a
  left join public.customers c on c.id = a.customer_id
  where a.business_id = p_business_id
    and a.employee_id = p_employee_id
    and a.start_time >= v_delay_from_utc
    and (a.start_time at time zone v_timezone)::date = p_local_date
    and a.status in (
      'pending',
      'confirmed',
      'arrived',
      'in_progress'
    )
  order by a.start_time;
end;
$$;

revoke all on function public.owner_preview_staff_delay(
  uuid, uuid, date, time, integer
) from public;

grant execute on function public.owner_preview_staff_delay(
  uuid, uuid, date, time, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Apply delay atomically
-- ---------------------------------------------------------------------------

create or replace function public.owner_apply_staff_delay(
  p_business_id uuid,
  p_employee_id uuid,
  p_local_date date,
  p_delay_from time,
  p_delay_minutes integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_timezone text;
  v_delay_from_utc timestamptz;
  v_day_of_week integer;
  v_work_start time;
  v_work_end time;
  v_is_closed boolean;
  v_last_new_end_local timestamp;
  v_affected_count integer := 0;
  v_appointment record;
begin
  if auth.uid() is null
     or not public.has_business_access(p_business_id) then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to this business.';
  end if;

  if p_delay_minutes < 1 or p_delay_minutes > 240 then
    raise exception using
      errcode = '22023',
      message = 'Delay must be between 1 and 240 minutes.';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.business_id = p_business_id
      and e.is_active = true
  ) then
    raise exception using
      errcode = '22023',
      message = 'Professional not found or inactive.';
  end if;

  select coalesce(nullif(b.timezone, ''), 'UTC')
  into v_timezone
  from public.businesses b
  where b.id = p_business_id
    and b.status = 'active';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Business is not available.';
  end if;

  if exists (
    select 1
    from public.business_closures bc
    where bc.business_id = p_business_id
      and bc.is_active = true
      and p_local_date between bc.start_date and bc.end_date
  ) then
    raise exception using
      errcode = '22023',
      message = 'The business is closed on the selected date.';
  end if;

  if exists (
    select 1
    from public.time_off t
    where t.employee_id = p_employee_id
      and t.status = 'approved'
      and p_local_date between t.start_date and t.end_date
  ) then
    raise exception using
      errcode = '22023',
      message = 'The professional is unavailable on this date.';
  end if;

  v_day_of_week := extract(dow from p_local_date);

  select
    wh.start_time,
    wh.end_time,
    wh.is_closed
  into
    v_work_start,
    v_work_end,
    v_is_closed
  from public.working_hours wh
  where wh.business_id = p_business_id
    and wh.day_of_week = v_day_of_week
    and (
      wh.employee_id = p_employee_id
      or wh.employee_id is null
    )
  order by (wh.employee_id is not null) desc
  limit 1;

  if not found or coalesce(v_is_closed, false) then
    raise exception using
      errcode = '22023',
      message = 'The business or professional is closed on this date.';
  end if;

  v_delay_from_utc :=
    ((p_local_date + p_delay_from) at time zone v_timezone);

  -- Lock all affected appointments so the preview cannot become stale while
  -- this transaction is validating and moving them.
  perform 1
  from public.appointments a
  where a.business_id = p_business_id
    and a.employee_id = p_employee_id
    and a.start_time >= v_delay_from_utc
    and (a.start_time at time zone v_timezone)::date = p_local_date
    and a.status in (
      'pending',
      'confirmed',
      'arrived',
      'in_progress'
    )
  for update;

  select count(*)
  into v_affected_count
  from public.appointments a
  where a.business_id = p_business_id
    and a.employee_id = p_employee_id
    and a.start_time >= v_delay_from_utc
    and (a.start_time at time zone v_timezone)::date = p_local_date
    and a.status in (
      'pending',
      'confirmed',
      'arrived',
      'in_progress'
    );

  if v_affected_count = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'No active appointments were found for this delay.';
  end if;

  select
    max(
      (a.end_time + make_interval(mins => p_delay_minutes))
      at time zone v_timezone
    )
  into v_last_new_end_local
  from public.appointments a
  where a.business_id = p_business_id
    and a.employee_id = p_employee_id
    and a.start_time >= v_delay_from_utc
    and (a.start_time at time zone v_timezone)::date = p_local_date
    and a.status in (
      'pending',
      'confirmed',
      'arrived',
      'in_progress'
    );

  if v_last_new_end_local::date <> p_local_date
     or v_last_new_end_local::time > v_work_end then
    raise exception using
      errcode = '22023',
      message = 'The delay would move an appointment outside working hours.';
  end if;

  -- Validate breaks against every shifted appointment.
  if exists (
    select 1
    from public.appointments a
    join public.breaks br
      on br.employee_id = p_employee_id
     and br.day_of_week = v_day_of_week
    where a.business_id = p_business_id
      and a.employee_id = p_employee_id
      and a.start_time >= v_delay_from_utc
      and (a.start_time at time zone v_timezone)::date = p_local_date
      and a.status in (
        'pending',
        'confirmed',
        'arrived',
        'in_progress'
      )
      and (
        (
          a.start_time + make_interval(mins => p_delay_minutes)
        ) at time zone v_timezone
      )::time < br.end_time
      and (
        (
          a.end_time + make_interval(mins => p_delay_minutes)
        ) at time zone v_timezone
      )::time > br.start_time
  ) then
    raise exception using
      errcode = '23P01',
      message = 'The delay would move an appointment into a staff break.';
  end if;

  -- Validate against unaffected appointments.
  if exists (
    select 1
    from public.appointments moving
    join public.appointments fixed
      on fixed.business_id = moving.business_id
     and fixed.employee_id = moving.employee_id
     and fixed.id <> moving.id
     and fixed.status not in (
       'cancelled_by_customer',
       'cancelled_by_business',
       'no_show',
       'rescheduled'
     )
    where moving.business_id = p_business_id
      and moving.employee_id = p_employee_id
      and moving.start_time >= v_delay_from_utc
      and (moving.start_time at time zone v_timezone)::date = p_local_date
      and moving.status in (
        'pending',
        'confirmed',
        'arrived',
        'in_progress'
      )
      and not (
        fixed.start_time >= v_delay_from_utc
        and (fixed.start_time at time zone v_timezone)::date = p_local_date
        and fixed.status in (
          'pending',
          'confirmed',
          'arrived',
          'in_progress'
        )
      )
      and fixed.start_time <
        moving.end_time + make_interval(mins => p_delay_minutes)
      and fixed.end_time >
        moving.start_time + make_interval(mins => p_delay_minutes)
  ) then
    raise exception using
      errcode = '23P01',
      message = 'The delay would overlap an unaffected appointment.';
  end if;

  -- Move latest appointments first to avoid transient overlap with the next
  -- affected appointment under the exclusion constraint.
  for v_appointment in
    select a.id
    from public.appointments a
    where a.business_id = p_business_id
      and a.employee_id = p_employee_id
      and a.start_time >= v_delay_from_utc
      and (a.start_time at time zone v_timezone)::date = p_local_date
      and a.status in (
        'pending',
        'confirmed',
        'arrived',
        'in_progress'
      )
    order by a.start_time desc
  loop
    update public.appointments
    set
      start_time = start_time + make_interval(mins => p_delay_minutes),
      end_time = end_time + make_interval(mins => p_delay_minutes),
      updated_at = now()
    where id = v_appointment.id;
  end loop;

  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    details
  )
  values (
    p_business_id,
    auth.uid(),
    'staff_delay_applied',
    jsonb_build_object(
      'employee_id', p_employee_id,
      'local_date', p_local_date,
      'delay_from', p_delay_from,
      'delay_minutes', p_delay_minutes,
      'affected_count', v_affected_count,
      'reason', nullif(trim(p_reason), '')
    )
  );

  return jsonb_build_object(
    'employee_id', p_employee_id,
    'local_date', p_local_date,
    'delay_from', p_delay_from,
    'delay_minutes', p_delay_minutes,
    'affected_count', v_affected_count
  );

exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'The delay would create an appointment overlap.';
end;
$$;

revoke all on function public.owner_apply_staff_delay(
  uuid, uuid, date, time, integer, text
) from public;

grant execute on function public.owner_apply_staff_delay(
  uuid, uuid, date, time, integer, text
) to authenticated;

commit;
