-- 00021_calendar_interactions.sql
-- Secure server-side calendar interactions:
-- reschedule, manual duration override, and status changes.
--
-- Resizing changes ONLY the selected appointment. It does not change service
-- catalogue durations or other appointments.

begin;

-- ---------------------------------------------------------------------------
-- 1. Manual-duration audit fields
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists duration_overridden boolean not null default false,
  add column if not exists original_total_duration integer,
  add column if not exists duration_override_reason text;

-- ---------------------------------------------------------------------------
-- 2. Owner reschedule RPC
-- Used by FullCalendar drag & drop.
-- ---------------------------------------------------------------------------

create or replace function public.owner_reschedule_appointment(
  p_business_id uuid,
  p_appointment_id uuid,
  p_employee_id uuid,
  p_local_date date,
  p_local_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_business public.businesses%rowtype;
  v_appointment public.appointments%rowtype;
  v_employee_id uuid;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_local_end timestamp;
  v_day_of_week integer;
  v_work_start time;
  v_work_end time;
  v_is_closed boolean;
begin
  if auth.uid() is null
     or not public.has_business_access(p_business_id) then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to this business.';
  end if;

  select *
  into v_business
  from public.businesses
  where id = p_business_id
    and status = 'active';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Business is not available.';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Appointment not found.';
  end if;

  if v_appointment.status in (
    'completed',
    'cancelled_by_customer',
    'cancelled_by_business',
    'no_show',
    'rescheduled'
  ) then
    raise exception using
      errcode = '22023',
      message = 'This appointment can no longer be moved.';
  end if;

  v_employee_id := coalesce(p_employee_id, v_appointment.employee_id);

  if v_employee_id is null then
    raise exception using
      errcode = '22023',
      message = 'Select a professional before moving the appointment.';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id = v_employee_id
      and e.business_id = p_business_id
      and e.is_active = true
  ) then
    raise exception using
      errcode = '22023',
      message = 'The selected professional is not available.';
  end if;

  -- The selected professional must provide every service in this appointment.
  if exists (
    select 1
    from public.appointment_services aps
    where aps.appointment_id = p_appointment_id
      and not exists (
        select 1
        from public.employee_services es
        where es.employee_id = v_employee_id
          and es.service_id = aps.service_id
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'The selected professional cannot provide all appointment services.';
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
    where t.employee_id = v_employee_id
      and t.status = 'approved'
      and p_local_date between t.start_date and t.end_date
  ) then
    raise exception using
      errcode = '22023',
      message = 'The selected professional is unavailable on this date.';
  end if;

  v_new_start := (
    (p_local_date + p_local_time)
    at time zone coalesce(nullif(v_business.timezone, ''), 'UTC')
  );

  v_new_end :=
    v_new_start
    + make_interval(mins => v_appointment.total_duration);

  v_local_end :=
    v_new_end at time zone
      coalesce(nullif(v_business.timezone, ''), 'UTC');

  if v_local_end::date <> p_local_date then
    raise exception using
      errcode = '22023',
      message = 'The appointment cannot continue into another day.';
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
      wh.employee_id = v_employee_id
      or wh.employee_id is null
    )
  order by (wh.employee_id is not null) desc
  limit 1;

  if not found or coalesce(v_is_closed, false) then
    raise exception using
      errcode = '22023',
      message = 'The business or professional is closed on this date.';
  end if;

  if p_local_time < v_work_start
     or v_local_end::time > v_work_end then
    raise exception using
      errcode = '22023',
      message = 'The new appointment time is outside working hours.';
  end if;

  if exists (
    select 1
    from public.breaks br
    where br.employee_id = v_employee_id
      and br.day_of_week = v_day_of_week
      and p_local_time < br.end_time
      and v_local_end::time > br.start_time
  ) then
    raise exception using
      errcode = '23P01',
      message = 'The new appointment time overlaps a staff break.';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.business_id = p_business_id
      and a.employee_id = v_employee_id
      and a.id <> p_appointment_id
      and a.status not in (
        'cancelled_by_customer',
        'cancelled_by_business',
        'no_show',
        'rescheduled'
      )
      and a.start_time < v_new_end
      and a.end_time > v_new_start
  ) then
    raise exception using
      errcode = '23P01',
      message = 'The new appointment time overlaps another appointment.';
  end if;

  update public.appointments
  set
    employee_id = v_employee_id,
    start_time = v_new_start,
    end_time = v_new_end,
    updated_at = now()
  where id = p_appointment_id;

  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    details
  )
  values (
    p_business_id,
    auth.uid(),
    'appointment_rescheduled',
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'old_employee_id', v_appointment.employee_id,
      'new_employee_id', v_employee_id,
      'old_start_time', v_appointment.start_time,
      'new_start_time', v_new_start,
      'old_end_time', v_appointment.end_time,
      'new_end_time', v_new_end
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'employee_id', v_employee_id,
    'start_time', v_new_start,
    'end_time', v_new_end,
    'total_duration', v_appointment.total_duration
  );

exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'The new appointment time overlaps another appointment.';
end;
$$;

revoke all on function public.owner_reschedule_appointment(
  uuid, uuid, uuid, date, time
) from public;

grant execute on function public.owner_reschedule_appointment(
  uuid, uuid, uuid, date, time
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Owner resize RPC
-- Manual duration override for ONE appointment only.
-- ---------------------------------------------------------------------------

create or replace function public.owner_resize_appointment(
  p_business_id uuid,
  p_appointment_id uuid,
  p_new_duration_minutes integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_business public.businesses%rowtype;
  v_appointment public.appointments%rowtype;
  v_new_end timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day_of_week integer;
  v_work_start time;
  v_work_end time;
  v_is_closed boolean;
  v_original_duration integer;
begin
  if auth.uid() is null
     or not public.has_business_access(p_business_id) then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to this business.';
  end if;

  if p_new_duration_minutes < 5
     or p_new_duration_minutes > 480 then
    raise exception using
      errcode = '22023',
      message = 'Appointment duration must be between 5 and 480 minutes.';
  end if;

  select *
  into v_business
  from public.businesses
  where id = p_business_id
    and status = 'active';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Business is not available.';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Appointment not found.';
  end if;

  if v_appointment.employee_id is null then
    raise exception using
      errcode = '22023',
      message = 'Assign a professional before changing the duration.';
  end if;

  if v_appointment.status in (
    'completed',
    'cancelled_by_customer',
    'cancelled_by_business',
    'no_show',
    'rescheduled'
  ) then
    raise exception using
      errcode = '22023',
      message = 'This appointment duration can no longer be changed.';
  end if;

  v_new_end :=
    v_appointment.start_time
    + make_interval(mins => p_new_duration_minutes);

  v_local_start :=
    v_appointment.start_time at time zone
      coalesce(nullif(v_business.timezone, ''), 'UTC');

  v_local_end :=
    v_new_end at time zone
      coalesce(nullif(v_business.timezone, ''), 'UTC');

  if v_local_end::date <> v_local_start::date then
    raise exception using
      errcode = '22023',
      message = 'The appointment cannot continue into another day.';
  end if;

  v_day_of_week := extract(dow from v_local_start::date);

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
      wh.employee_id = v_appointment.employee_id
      or wh.employee_id is null
    )
  order by (wh.employee_id is not null) desc
  limit 1;

  if not found or coalesce(v_is_closed, false) then
    raise exception using
      errcode = '22023',
      message = 'The business or professional is closed on this date.';
  end if;

  if v_local_start::time < v_work_start
     or v_local_end::time > v_work_end then
    raise exception using
      errcode = '22023',
      message = 'The resized appointment would extend outside working hours.';
  end if;

  if exists (
    select 1
    from public.breaks br
    where br.employee_id = v_appointment.employee_id
      and br.day_of_week = v_day_of_week
      and v_local_start::time < br.end_time
      and v_local_end::time > br.start_time
  ) then
    raise exception using
      errcode = '23P01',
      message = 'The resized appointment would overlap a staff break.';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.business_id = p_business_id
      and a.employee_id = v_appointment.employee_id
      and a.id <> p_appointment_id
      and a.status not in (
        'cancelled_by_customer',
        'cancelled_by_business',
        'no_show',
        'rescheduled'
      )
      and a.start_time < v_new_end
      and a.end_time > v_appointment.start_time
  ) then
    raise exception using
      errcode = '23P01',
      message = 'The resized appointment would overlap another appointment.';
  end if;

  v_original_duration :=
    coalesce(
      v_appointment.original_total_duration,
      v_appointment.total_duration
    );

  update public.appointments
  set
    original_total_duration = v_original_duration,
    total_duration = p_new_duration_minutes,
    end_time = v_new_end,
    duration_overridden =
      p_new_duration_minutes <> v_original_duration,
    duration_override_reason = nullif(trim(p_reason), ''),
    updated_at = now()
  where id = p_appointment_id;

  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    details
  )
  values (
    p_business_id,
    auth.uid(),
    'appointment_duration_overridden',
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'old_duration', v_appointment.total_duration,
      'new_duration', p_new_duration_minutes,
      'original_service_duration', v_original_duration,
      'reason', nullif(trim(p_reason), '')
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'start_time', v_appointment.start_time,
    'end_time', v_new_end,
    'total_duration', p_new_duration_minutes,
    'original_total_duration', v_original_duration,
    'duration_overridden',
      p_new_duration_minutes <> v_original_duration
  );

exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'The resized appointment would overlap another appointment.';
end;
$$;

revoke all on function public.owner_resize_appointment(
  uuid, uuid, integer, text
) from public;

grant execute on function public.owner_resize_appointment(
  uuid, uuid, integer, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Secure status update RPC
-- UI label "Check in" maps to enum value "arrived".
-- ---------------------------------------------------------------------------

create or replace function public.owner_update_appointment_status(
  p_business_id uuid,
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status public.appointment_status;
begin
  if auth.uid() is null
     or not public.has_business_access(p_business_id) then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to this business.';
  end if;

  if p_status not in (
    'pending',
    'confirmed',
    'arrived',
    'in_progress',
    'completed',
    'cancelled_by_business',
    'no_show'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Unsupported appointment status.';
  end if;

  select status
  into v_old_status
  from public.appointments
  where id = p_appointment_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Appointment not found.';
  end if;

  update public.appointments
  set
    status = p_status,
    updated_at = now()
  where id = p_appointment_id
    and business_id = p_business_id;

  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    details
  )
  values (
    p_business_id,
    auth.uid(),
    'appointment_status_changed',
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'old_status', v_old_status,
      'new_status', p_status
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'old_status', v_old_status,
    'status', p_status
  );
end;
$$;

revoke all on function public.owner_update_appointment_status(
  uuid, uuid, public.appointment_status
) from public;

grant execute on function public.owner_update_appointment_status(
  uuid, uuid, public.appointment_status
) to authenticated;

commit;
