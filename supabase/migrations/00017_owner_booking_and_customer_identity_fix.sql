-- 00017_owner_booking_and_customer_identity_fix.sql
-- Fix guest customer identity matching and add a secure owner appointment RPC.

begin;

-- ---------------------------------------------------------------------------
-- 1. Fix public booking customer resolution.
-- Guests with the same phone but a different name must not overwrite each other.
-- Authenticated users are resolved by user_id.
-- ---------------------------------------------------------------------------

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
  v_normalized_phone text;
  v_name text;
  v_appointment_id uuid;
  v_booking_reference text;
  v_raw_guest_token text;
  v_guest_token_hash text;
begin
  v_name := nullif(trim(p_customer_name), '');
  v_email := nullif(lower(trim(p_customer_email)), '');
  v_phone := nullif(trim(p_customer_phone), '');
  v_normalized_phone := regexp_replace(coalesce(v_phone, ''), '\D', '', 'g');
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

  v_requested_service_count := cardinality(p_service_ids);

  select
    count(distinct s.id),
    coalesce(sum(s.duration), 0),
    coalesce(sum(s.price), 0),
    coalesce(sum(case when s.deposit_required then s.deposit_amount else 0 end), 0)
  into
    v_valid_service_count,
    v_duration,
    v_total_price,
    v_deposit
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  if v_valid_service_count <> v_requested_service_count or v_duration <= 0 then
    raise exception using errcode = '22023', message = 'One or more selected services are unavailable.';
  end if;

  select availability.employee_id
  into v_selected_employee
  from public.get_public_availability(
    p_business_id,
    p_employee_id,
    p_local_date,
    p_service_ids
  ) availability
  where availability.available_time = p_local_time
  order by availability.employee_id
  limit 1;

  if v_selected_employee is null then
    raise exception using errcode = '23P01', message = 'This appointment time is no longer available.';
  end if;

  v_start_time := (
    (p_local_date + p_local_time)
    at time zone coalesce(nullif(v_business.timezone, ''), 'UTC')
  );
  v_end_time := v_start_time + make_interval(mins => v_duration);

  -- Authenticated users are identified only by their auth user id.
  if v_user_id is not null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and c.user_id = v_user_id
    order by c.created_at
    limit 1;

    if v_customer_id is null then
      insert into public.customers (
        business_id,
        user_id,
        full_name,
        email,
        phone,
        notes
      )
      values (
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
      set
        full_name = coalesce(nullif(full_name, ''), v_name),
        email = coalesce(email, v_email),
        phone = coalesce(phone, v_phone),
        updated_at = now()
      where id = v_customer_id;
    end if;
  else
    -- Guest email matching is limited to guest records.
    if v_email is not null then
      select c.id
      into v_customer_id
      from public.customers c
      where c.business_id = p_business_id
        and c.user_id is null
        and lower(c.email) = v_email
      order by c.created_at
      limit 1;
    end if;

    -- Phone-only matching also requires the exact same customer name.
    if v_customer_id is null and v_normalized_phone <> '' then
      select c.id
      into v_customer_id
      from public.customers c
      where c.business_id = p_business_id
        and c.user_id is null
        and lower(trim(c.full_name)) = lower(v_name)
        and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_normalized_phone
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
      )
      values (
        p_business_id,
        null,
        v_name,
        v_email,
        v_phone,
        nullif(trim(p_notes), '')
      )
      returning id into v_customer_id;
    else
      -- Never overwrite a guest customer's existing identity.
      update public.customers
      set
        email = coalesce(email, v_email),
        phone = coalesce(phone, v_phone),
        updated_at = now()
      where id = v_customer_id;
    end if;
  end if;

  v_booking_reference :=
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
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
  )
  values (
    p_business_id,
    v_customer_id,
    v_selected_employee,
    v_start_time,
    v_end_time,
    'confirmed',
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
  select
    v_appointment_id,
    s.id,
    s.price,
    s.duration
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
      'customer_id', v_customer_id,
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
    'status', 'confirmed'
  );
exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'This appointment time has just been reserved. Please choose another time.';
end;
$$;

revoke all on function public.secure_create_booking(
  uuid, uuid, uuid[], date, time, text, text, text, text
) from public;

grant execute on function public.secure_create_booking(
  uuid, uuid, uuid[], date, time, text, text, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Secure owner/manual appointment creation.
-- Uses the same real availability engine and creates all rows atomically.
-- ---------------------------------------------------------------------------

create or replace function public.owner_create_appointment(
  p_business_id uuid,
  p_customer_id uuid,
  p_employee_id uuid,
  p_service_ids uuid[],
  p_local_date date,
  p_local_time time,
  p_status public.appointment_status default 'confirmed',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_business public.businesses%rowtype;
  v_customer public.customers%rowtype;
  v_duration integer;
  v_total_price numeric(10,2);
  v_deposit numeric(10,2);
  v_requested_service_count integer;
  v_valid_service_count integer;
  v_selected_employee uuid;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_appointment_id uuid;
  v_booking_reference text;
begin
  if auth.uid() is null or not public.has_business_access(p_business_id) then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;

  if p_customer_id is null then
    raise exception using errcode = '22023', message = 'Select a customer.';
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one service.';
  end if;

  -- The parameter is retained for frontend compatibility, but all new bookings
  -- are confirmed automatically because only real available slots are offered.

  select *
  into v_business
  from public.businesses
  where id = p_business_id
    and status = 'active';

  if not found then
    raise exception using errcode = 'P0002', message = 'Business is not available.';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and business_id = p_business_id;

  if not found then
    raise exception using errcode = '22023', message = 'The selected customer does not belong to this business.';
  end if;

  v_requested_service_count := cardinality(p_service_ids);

  select
    count(distinct s.id),
    coalesce(sum(s.duration), 0),
    coalesce(sum(s.price), 0),
    coalesce(sum(case when s.deposit_required then s.deposit_amount else 0 end), 0)
  into
    v_valid_service_count,
    v_duration,
    v_total_price,
    v_deposit
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  if v_valid_service_count <> v_requested_service_count or v_duration <= 0 then
    raise exception using errcode = '22023', message = 'One or more selected services are unavailable.';
  end if;

  select availability.employee_id
  into v_selected_employee
  from public.get_public_availability(
    p_business_id,
    p_employee_id,
    p_local_date,
    p_service_ids
  ) availability
  where availability.available_time = p_local_time
  order by availability.employee_id
  limit 1;

  if v_selected_employee is null then
    raise exception using errcode = '23P01', message = 'This appointment time is not available.';
  end if;

  v_start_time := (
    (p_local_date + p_local_time)
    at time zone coalesce(nullif(v_business.timezone, ''), 'UTC')
  );
  v_end_time := v_start_time + make_interval(mins => v_duration);
  v_booking_reference :=
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

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
  )
  values (
    p_business_id,
    p_customer_id,
    v_selected_employee,
    v_start_time,
    v_end_time,
    'confirmed',
    'unpaid',
    v_duration,
    v_total_price,
    v_deposit,
    nullif(trim(p_notes), ''),
    null,
    null,
    v_booking_reference
  )
  returning id into v_appointment_id;

  insert into public.appointment_services (
    appointment_id,
    service_id,
    price,
    duration
  )
  select
    v_appointment_id,
    s.id,
    s.price,
    s.duration
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    p_business_id,
    auth.uid(),
    'owner_booking_created',
    jsonb_build_object(
      'appointment_id', v_appointment_id,
      'customer_id', p_customer_id,
      'employee_id', v_selected_employee,
      'booking_reference', v_booking_reference
    )
  );

  return jsonb_build_object(
    'id', v_appointment_id,
    'booking_reference', v_booking_reference,
    'employee_id', v_selected_employee,
    'start_time', v_start_time,
    'end_time', v_end_time,
    'total_duration', v_duration,
    'total_price', v_total_price,
    'status', 'confirmed'
  );
exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'This appointment time has just been reserved. Please choose another time.';
end;
$$;

revoke all on function public.owner_create_appointment(
  uuid, uuid, uuid, uuid[], date, time, public.appointment_status, text
) from public;

grant execute on function public.owner_create_appointment(
  uuid, uuid, uuid, uuid[], date, time, public.appointment_status, text
) to authenticated;

commit;
