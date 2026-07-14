-- Secure public availability and atomic booking foundation.
-- This migration restores public booking only through validated SECURITY DEFINER RPCs.

begin;

create extension if not exists btree_gist;

alter table public.appointments
  add column if not exists booking_reference text,
  add column if not exists guest_token_hash text;

update public.appointments
set booking_reference = upper(substr(replace(id::text, '-', ''), 1, 10))
where booking_reference is null;

alter table public.appointments
  alter column booking_reference set not null;

create unique index if not exists appointments_booking_reference_uidx
  on public.appointments (booking_reference);

create unique index if not exists appointments_guest_token_hash_uidx
  on public.appointments (guest_token_hash)
  where guest_token_hash is not null;

alter table public.appointments
  drop constraint if exists appointments_valid_time_range;

alter table public.appointments
  add constraint appointments_valid_time_range
  check (end_time > start_time);

-- Database-level protection against concurrent double bookings.
alter table public.appointments
  drop constraint if exists appointments_employee_no_overlap;

alter table public.appointments
  add constraint appointments_employee_no_overlap
  exclude using gist (
    employee_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (
    employee_id is not null
    and status not in (
      'cancelled_by_customer'::appointment_status,
      'cancelled_by_business'::appointment_status,
      'no_show'::appointment_status,
      'rescheduled'::appointment_status
    )
  );

create or replace function public.get_public_availability(
  p_business_id uuid,
  p_employee_id uuid,
  p_date date,
  p_service_ids uuid[]
)
returns table (
  employee_id uuid,
  available_time time
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_timezone text;
  v_interval integer;
  v_min_notice integer;
  v_max_booking_period integer;
  v_duration integer;
  v_requested_service_count integer;
  v_valid_service_count integer;
  v_day_of_week integer;
  v_employee record;
  v_start_time time;
  v_end_time time;
  v_is_closed boolean;
  v_current_time time;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
begin
  if p_business_id is null or p_date is null or p_service_ids is null
     or cardinality(p_service_ids) = 0 then
    return;
  end if;

  select b.timezone,
         coalesce(bs.booking_interval, 30),
         coalesce(bs.min_booking_notice, 2),
         coalesce(bs.max_booking_period, 60)
    into v_timezone, v_interval, v_min_notice, v_max_booking_period
  from public.businesses b
  left join public.business_settings bs on bs.business_id = b.id
  where b.id = p_business_id
    and b.status = 'active';

  if not found then
    return;
  end if;

  v_timezone := coalesce(nullif(v_timezone, ''), 'UTC');
  v_requested_service_count := cardinality(p_service_ids);

  select count(distinct s.id), coalesce(sum(s.duration), 0)
    into v_valid_service_count, v_duration
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  if v_valid_service_count <> v_requested_service_count or v_duration <= 0 then
    return;
  end if;

  if p_date > ((now() at time zone v_timezone)::date + v_max_booking_period)
     or p_date < (now() at time zone v_timezone)::date then
    return;
  end if;

  v_day_of_week := extract(dow from p_date);

  for v_employee in
    select e.id
    from public.employees e
    where e.business_id = p_business_id
      and e.is_active = true
      and (p_employee_id is null or e.id = p_employee_id)
      and not (
        e.inactive_start_date is not null
        and e.inactive_end_date is not null
        and p_date between e.inactive_start_date and e.inactive_end_date
      )
      and not exists (
        select 1
        from unnest(p_service_ids) requested_service_id
        where not exists (
          select 1
          from public.employee_services es
          where es.employee_id = e.id
            and es.service_id = requested_service_id
        )
      )
      and not exists (
        select 1
        from public.time_off t
        where t.employee_id = e.id
          and t.status = 'approved'
          and p_date between t.start_date and t.end_date
      )
    order by e.id
  loop
    select wh.start_time, wh.end_time, wh.is_closed
      into v_start_time, v_end_time, v_is_closed
    from public.working_hours wh
    where wh.business_id = p_business_id
      and wh.day_of_week = v_day_of_week
      and (wh.employee_id = v_employee.id or wh.employee_id is null)
    order by (wh.employee_id is not null) desc
    limit 1;

    if not found or coalesce(v_is_closed, false) then
      continue;
    end if;

    v_current_time := v_start_time;

    while v_current_time + make_interval(mins => v_duration) <= v_end_time loop
      v_slot_start := ((p_date + v_current_time) at time zone v_timezone);
      v_slot_end := v_slot_start + make_interval(mins => v_duration);

      if v_slot_start >= now() + make_interval(hours => v_min_notice)
         and not exists (
           select 1
           from public.breaks br
           where br.employee_id = v_employee.id
             and br.day_of_week = v_day_of_week
             and v_current_time < br.end_time
             and (v_current_time + make_interval(mins => v_duration)) > br.start_time
         )
         and not exists (
           select 1
           from public.appointments a
           where a.business_id = p_business_id
             and a.employee_id = v_employee.id
             and a.status not in (
               'cancelled_by_customer',
               'cancelled_by_business',
               'no_show',
               'rescheduled'
             )
             and a.start_time < v_slot_end
             and a.end_time > v_slot_start
         ) then
        employee_id := v_employee.id;
        available_time := v_current_time;
        return next;
      end if;

      v_current_time := v_current_time + make_interval(mins => v_interval);
    end loop;
  end loop;
end;
$$;

revoke all on function public.get_public_availability(uuid, uuid, date, uuid[]) from public;
grant execute on function public.get_public_availability(uuid, uuid, date, uuid[]) to anon, authenticated;

create or replace function public.secure_create_booking(
  p_business_id uuid,
  p_employee_id uuid,
  p_service_ids uuid[],
  p_local_date date,
  p_local_time time,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_business public.businesses%rowtype;
  v_settings public.business_settings%rowtype;
  v_duration integer;
  v_total_price numeric(10,2);
  v_deposit numeric(10,2);
  v_requested_service_count integer;
  v_valid_service_count integer;
  v_selected_employee uuid;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_customer_id uuid;
  v_user_id uuid;
  v_email text;
  v_phone text;
  v_name text;
  v_appointment_id uuid;
  v_booking_reference text;
  v_raw_guest_token text;
  v_guest_token_hash text;
begin
  v_name := nullif(trim(p_customer_name), '');
  v_email := nullif(lower(trim(p_customer_email)), '');
  v_phone := nullif(trim(p_customer_phone), '');
  v_user_id := auth.uid();

  if v_name is null then
    raise exception using errcode = '22023', message = 'Customer name is required.';
  end if;

  if v_phone is null then
    raise exception using errcode = '22023', message = 'Customer phone is required.';
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one service.';
  end if;

  select * into v_business
  from public.businesses
  where id = p_business_id
    and status = 'active';

  if not found then
    raise exception using errcode = 'P0002', message = 'Business is not available.';
  end if;

  select * into v_settings
  from public.business_settings
  where business_id = p_business_id;

  v_requested_service_count := cardinality(p_service_ids);

  select count(distinct s.id),
         coalesce(sum(s.duration), 0),
         coalesce(sum(s.price), 0),
         coalesce(sum(case when s.deposit_required then s.deposit_amount else 0 end), 0)
    into v_valid_service_count, v_duration, v_total_price, v_deposit
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  if v_valid_service_count <> v_requested_service_count or v_duration <= 0 then
    raise exception using errcode = '22023', message = 'One or more selected services are unavailable.';
  end if;

  select a.employee_id
    into v_selected_employee
  from public.get_public_availability(
    p_business_id,
    p_employee_id,
    p_local_date,
    p_service_ids
  ) a
  where a.available_time = p_local_time
  order by a.employee_id
  limit 1;

  if v_selected_employee is null then
    raise exception using errcode = '23P01', message = 'This appointment time is no longer available.';
  end if;

  v_start_time := ((p_local_date + p_local_time)
                   at time zone coalesce(nullif(v_business.timezone, ''), 'UTC'));
  v_end_time := v_start_time + make_interval(mins => v_duration);

  -- Resolve or create a business-scoped customer record.
  if v_user_id is not null then
    select c.id into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and c.user_id = v_user_id
    limit 1;
  end if;

  if v_customer_id is null and v_email is not null then
    select c.id into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and lower(c.email) = v_email
    limit 1;
  end if;

  if v_customer_id is null then
    select c.id into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and c.phone = v_phone
    order by c.created_at
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      business_id,
      user_id,
      full_name,
      email,
      phone,
      notes
    ) values (
      p_business_id,
      v_user_id,
      v_name,
      v_email,
      v_phone,
      nullif(trim(p_notes), '')
    )
    returning id into v_customer_id;
  else
    update public.customers
    set full_name = v_name,
        email = coalesce(v_email, email),
        phone = v_phone,
        user_id = case
          when user_id is null and v_user_id is not null then v_user_id
          else user_id
        end,
        updated_at = now()
    where id = v_customer_id;
  end if;

  v_booking_reference := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_raw_guest_token := encode(gen_random_bytes(32), 'hex');
  v_guest_token_hash := encode(digest(v_raw_guest_token, 'sha256'), 'hex');

  insert into public.appointments (
    business_id,
    customer_id,
    employee_id,
    start_time,
    end_time,
    status,
    payment_status,
    total_duration,
    total_price,
    deposit_amount,
    notes,
    guest_token,
    guest_token_hash,
    booking_reference
  ) values (
    p_business_id,
    v_customer_id,
    v_selected_employee,
    v_start_time,
    v_end_time,
    'pending',
    'unpaid',
    v_duration,
    v_total_price,
    v_deposit,
    nullif(trim(p_notes), ''),
    null,
    v_guest_token_hash,
    v_booking_reference
  )
  returning id into v_appointment_id;

  insert into public.appointment_services (
    appointment_id,
    service_id,
    price,
    duration
  )
  select v_appointment_id, s.id, s.price, s.duration
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    p_business_id,
    v_user_id,
    'public_booking_created',
    jsonb_build_object(
      'appointment_id', v_appointment_id,
      'employee_id', v_selected_employee,
      'booking_reference', v_booking_reference
    )
  );

  return jsonb_build_object(
    'id', v_appointment_id,
    'booking_reference', v_booking_reference,
    'manage_token', v_raw_guest_token,
    'employee_id', v_selected_employee,
    'start_time', v_start_time,
    'end_time', v_end_time,
    'total_duration', v_duration,
    'total_price', v_total_price,
    'deposit_amount', v_deposit,
    'status', 'pending'
  );
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'This appointment time has just been reserved. Please choose another time.';
end;
$$;

revoke all on function public.secure_create_booking(uuid, uuid, uuid[], date, time, text, text, text, text) from public;
grant execute on function public.secure_create_booking(uuid, uuid, uuid[], date, time, text, text, text, text) to anon, authenticated;

commit;
