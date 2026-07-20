


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'confirmed',
    'arrived',
    'in_progress',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_business',
    'no_show',
    'rescheduled'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."business_role" AS ENUM (
    'Owner',
    'Manager',
    'Employee'
);


ALTER TYPE "public"."business_role" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'unpaid',
    'deposit_paid',
    'paid',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'Platform Admin',
    'Business Owner',
    'Manager',
    'Employee',
    'Registered Customer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_duration" integer) RETURNS TABLE("available_time" time without time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_day_of_week int;
  v_start_time time;
  v_end_time time;
  v_is_closed boolean;
  v_interval int;
  v_current_time time;
  v_conflict_exists boolean;
begin
  -- Get day of week (0 = Sunday, 1 = Monday, ...)
  v_day_of_week := extract(dow from p_date);
  
  -- Get booking interval
  select booking_interval into v_interval
  from business_settings
  where business_id = p_business_id;
  
  if v_interval is null then
    v_interval := 30; -- default
  end if;

  -- Get working hours for employee or business
  select start_time, end_time, is_closed
  into v_start_time, v_end_time, v_is_closed
  from working_hours
  where business_id = p_business_id
    and (employee_id = p_employee_id or employee_id is null)
    and day_of_week = v_day_of_week
  order by employee_id nulls last
  limit 1;
  
  if not found or v_is_closed then
    return; -- No availability
  end if;

  -- Initialize current time to start of working hours
  v_current_time := v_start_time;

  -- Loop through time slots
  while v_current_time + (p_duration || ' minutes')::interval <= v_end_time loop
    
    -- Check for conflicts with existing appointments
    select exists (
      select 1
      from appointments a
      where a.business_id = p_business_id
        and a.employee_id = p_employee_id
        and a.status not in ('cancelled_by_customer', 'cancelled_by_business', 'no_show')
        and a.start_time::date = p_date
        and (
          (v_current_time >= a.start_time::time and v_current_time < a.end_time::time) or
          (v_current_time + (p_duration || ' minutes')::interval > a.start_time::time and v_current_time + (p_duration || ' minutes')::interval <= a.end_time::time) or
          (v_current_time <= a.start_time::time and v_current_time + (p_duration || ' minutes')::interval >= a.end_time::time)
        )
    ) into v_conflict_exists;

    -- Check for conflicts with breaks
    if not v_conflict_exists then
      select exists (
        select 1
        from breaks b
        where b.employee_id = p_employee_id
          and b.day_of_week = v_day_of_week
          and (
            (v_current_time >= b.start_time and v_current_time < b.end_time) or
            (v_current_time + (p_duration || ' minutes')::interval > b.start_time and v_current_time + (p_duration || ' minutes')::interval <= b.end_time) or
            (v_current_time <= b.start_time and v_current_time + (p_duration || ' minutes')::interval >= b.end_time)
          )
      ) into v_conflict_exists;
    end if;

    -- If no conflict, add to results
    if not v_conflict_exists then
      available_time := v_current_time;
      return next;
    end if;

    -- Increment by interval
    v_current_time := v_current_time + (v_interval || ' minutes')::interval;
  end loop;

  return;
end;
$$;


ALTER FUNCTION "public"."check_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_duration" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_business_appointments"("p_business_id" "uuid") RETURNS TABLE("appointment_id" "uuid", "booking_reference" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "status" "public"."appointment_status", "payment_status" "public"."payment_status", "total_price" numeric, "total_duration" integer, "employee_id" "uuid", "employee_name" "text", "services" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    a.id,
    coalesce(a.booking_reference, upper(substr(a.id::text, 1, 8))),
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.total_price,
    a.total_duration,
    e.id,
    e.name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'price', aps.price,
          'duration', aps.duration,
          'image_url', s.image_url
        )
        order by s.name
      ) filter (where aps.id is not null),
      '[]'::jsonb
    )
  from public.appointments a
  join public.customers c on c.id = a.customer_id
  left join public.employees e on e.id = a.employee_id
  left join public.appointment_services aps on aps.appointment_id = a.id
  left join public.services s on s.id = aps.service_id
  where a.business_id = p_business_id
    and c.user_id = auth.uid()
    and exists (
      select 1
      from public.customer_business_profiles cbp
      where cbp.business_id = p_business_id
        and cbp.user_id = auth.uid()
    )
  group by a.id, e.id, e.name
  order by a.start_time desc;
$$;


ALTER FUNCTION "public"."get_my_business_appointments"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_service_ids" "uuid"[]) RETURNS TABLE("employee_id" "uuid", "available_time" time without time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "public"."get_public_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_service_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, coalesce(new.raw_user_meta_data->>'role', 'Registered Customer')::user_role);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_business_access"("business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_has_access boolean;
begin
  select exists (
    select 1
    from business_members bm
    where bm.business_id = has_business_access.business_id
    and bm.user_id = auth.uid()
  ) into v_has_access;
  
  return v_has_access;
end;
$$;


ALTER FUNCTION "public"."has_business_access"("business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_business_owner"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_owner boolean;
begin
  select exists (
    select 1
    from business_members bm
    where bm.business_id = p_business_id
    and bm.user_id = auth.uid()
    and bm.role = 'Owner'
  ) into v_is_owner;
  
  return v_is_owner;
end;
$$;


ALTER FUNCTION "public"."is_business_owner"("p_business_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."customer_business_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "display_name" "text",
    "email" "text",
    "phone" "text",
    "marketing_consent" boolean DEFAULT false NOT NULL,
    "email_notifications_enabled" boolean DEFAULT true NOT NULL,
    "sms_notifications_enabled" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_business_profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_business_as_customer"("p_business_id" "uuid", "p_phone" "text" DEFAULT NULL::"text") RETURNS "public"."customer_business_profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_name text;
  v_customer_id uuid;
  v_profile public.customer_business_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.status = 'active'
  ) then
    raise exception 'Business not found or inactive';
  end if;

  select
    coalesce(p.email, u.email),
    p.full_name
  into v_email, v_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_user_id;

  -- Prefer an already-linked customer record.
  select c.id
  into v_customer_id
  from public.customers c
  where c.business_id = p_business_id
    and c.user_id = v_user_id
  order by c.created_at
  limit 1;

  -- Claim a matching prior guest record only within this business.
  if v_customer_id is null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and c.user_id is null
      and (
        (v_email is not null and lower(c.email) = lower(v_email))
        or (
          p_phone is not null
          and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
              = regexp_replace(p_phone, '\D', '', 'g')
        )
      )
    order by c.created_at
    limit 1;

    if v_customer_id is not null then
      update public.customers
      set
        user_id = v_user_id,
        email = coalesce(email, v_email),
        phone = coalesce(phone, p_phone),
        updated_at = now()
      where id = v_customer_id;
    end if;
  end if;

  -- If no customer record exists, create one for this business.
  if v_customer_id is null then
    insert into public.customers (
      business_id,
      user_id,
      full_name,
      email,
      phone
    )
    values (
      p_business_id,
      v_user_id,
      coalesce(nullif(v_name, ''), split_part(coalesce(v_email, 'Customer'), '@', 1)),
      v_email,
      nullif(p_phone, '')
    )
    returning id into v_customer_id;
  end if;

  insert into public.customer_business_profiles (
    business_id,
    user_id,
    customer_id,
    display_name,
    email,
    phone
  )
  values (
    p_business_id,
    v_user_id,
    v_customer_id,
    v_name,
    v_email,
    nullif(p_phone, '')
  )
  on conflict (business_id, user_id)
  do update set
    customer_id = excluded.customer_id,
    display_name = coalesce(excluded.display_name, customer_business_profiles.display_name),
    email = coalesce(excluded.email, customer_business_profiles.email),
    phone = coalesce(excluded.phone, customer_business_profiles.phone),
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;


ALTER FUNCTION "public"."join_business_as_customer"("p_business_id" "uuid", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_create_appointment"("p_business_id" "uuid", "p_customer_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_status" "public"."appointment_status" DEFAULT 'confirmed'::"public"."appointment_status", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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

  if p_status in (
    'cancelled_by_customer',
    'cancelled_by_business',
    'no_show',
    'rescheduled'
  ) then
    raise exception using errcode = '22023', message = 'Choose Pending or Confirmed for a new appointment.';
  end if;

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
    p_status,
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
    'status', p_status
  );
exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'This appointment time has just been reserved. Please choose another time.';
end;
$$;


ALTER FUNCTION "public"."owner_create_appointment"("p_business_id" "uuid", "p_customer_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_status" "public"."appointment_status", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_create_booking"("p_business_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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
    'status', 'pending'
  );
exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'This appointment time has just been reserved. Please choose another time.';
end;
$$;


ALTER FUNCTION "public"."secure_create_booking"("p_business_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_notes" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_service_id" "uuid" NOT NULL,
    "addon_id" "uuid",
    "price" numeric(10,2) NOT NULL
);


ALTER TABLE "public"."appointment_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "price" numeric(10,2) NOT NULL,
    "duration" integer NOT NULL
);


ALTER TABLE "public"."appointment_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "employee_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'pending'::"public"."appointment_status",
    "payment_status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status",
    "total_duration" integer NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "deposit_amount" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "guest_token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "booking_reference" "text" NOT NULL,
    "guest_token_hash" "text",
    CONSTRAINT "appointments_valid_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    CONSTRAINT "breaks_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."breaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_gallery_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "title" "text",
    "caption" "text",
    "alt_text" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_gallery_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."business_role" DEFAULT 'Employee'::"public"."business_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "author_user_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "post_type" "text" DEFAULT 'announcement'::"text" NOT NULL,
    "audience" "text" DEFAULT 'public'::"text" NOT NULL,
    "cover_image_url" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_posts_audience_check" CHECK (("audience" = ANY (ARRAY['public'::"text", 'registered_customers'::"text"]))),
    CONSTRAINT "business_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['announcement'::"text", 'holiday_closure'::"text", 'promotion'::"text", 'price_update'::"text", 'new_product'::"text", 'new_team_member'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."business_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_settings" (
    "business_id" "uuid" NOT NULL,
    "booking_interval" integer DEFAULT 30,
    "min_booking_notice" integer DEFAULT 2,
    "max_booking_period" integer DEFAULT 60,
    "cancellation_policy" "text",
    "terms_conditions" "text",
    "email_reminders_enabled" boolean DEFAULT true,
    "sms_reminders_enabled" boolean DEFAULT false,
    "primary_color" "text" DEFAULT '#0B0F19'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "cover_image_url" "text",
    "description" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "country" "text" DEFAULT 'US'::"text",
    "currency" "text" DEFAULT 'USD'::"text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "photos" "text"[] DEFAULT '{}'::"text"[],
    "map_url" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "district" "text",
    "postal_code" "text"
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_services" (
    "employee_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL
);


ALTER TABLE "public"."employee_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "photo_url" "text",
    "bio" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "inactive_start_date" "date",
    "inactive_end_date" "date"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "supplier" "text",
    "amount" numeric(10,2) NOT NULL,
    "date" "date" NOT NULL,
    "receipt_url" "text",
    "payment_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "sku" "text",
    "cost_price" numeric(10,2) DEFAULT 0,
    "selling_price" numeric(10,2) NOT NULL,
    "current_stock" integer DEFAULT 0,
    "min_stock" integer DEFAULT 5,
    "supplier" "text",
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "is_public" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'Registered Customer'::"public"."user_role" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "preferred_language" "text" DEFAULT 'en'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "type" "text" NOT NULL,
    "payment_method" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "duration" integer NOT NULL,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "online_booking_enabled" boolean DEFAULT true,
    "deposit_required" boolean DEFAULT false,
    "deposit_amount" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan_id" "text" DEFAULT 'free_trial'::"text" NOT NULL,
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_off" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'approved'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_off" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."working_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_closed" boolean DEFAULT false,
    CONSTRAINT "working_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."working_hours" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointment_addons"
    ADD CONSTRAINT "appointment_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_employee_no_overlap" EXCLUDE USING "gist" ("employee_id" WITH =, "tstzrange"("start_time", "end_time", '[)'::"text") WITH &&) WHERE ((("employee_id" IS NOT NULL) AND ("status" <> ALL (ARRAY['cancelled_by_customer'::"public"."appointment_status", 'cancelled_by_business'::"public"."appointment_status", 'no_show'::"public"."appointment_status", 'rescheduled'::"public"."appointment_status"]))));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_guest_token_key" UNIQUE ("guest_token");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breaks"
    ADD CONSTRAINT "breaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_gallery_images"
    ADD CONSTRAINT "business_gallery_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_posts"
    ADD CONSTRAINT "business_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."customer_business_profiles"
    ADD CONSTRAINT "customer_business_profiles_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."customer_business_profiles"
    ADD CONSTRAINT "customer_business_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_email_key" UNIQUE ("business_id", "email");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_services"
    ADD CONSTRAINT "employee_services_pkey" PRIMARY KEY ("employee_id", "service_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_addons"
    ADD CONSTRAINT "service_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_off"
    ADD CONSTRAINT "time_off_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_business_id_employee_id_day_of_week_key" UNIQUE ("business_id", "employee_id", "day_of_week");



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "appointments_booking_reference_uidx" ON "public"."appointments" USING "btree" ("booking_reference");



CREATE UNIQUE INDEX "appointments_guest_token_hash_uidx" ON "public"."appointments" USING "btree" ("guest_token_hash") WHERE ("guest_token_hash" IS NOT NULL);



CREATE INDEX "idx_business_gallery_public" ON "public"."business_gallery_images" USING "btree" ("business_id", "is_public", "display_order");



CREATE INDEX "idx_business_posts_feed" ON "public"."business_posts" USING "btree" ("business_id", "is_published", "published_at" DESC);



CREATE INDEX "idx_customer_business_profiles_business" ON "public"."customer_business_profiles" USING "btree" ("business_id");



CREATE INDEX "idx_customer_business_profiles_user" ON "public"."customer_business_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_products_public_business" ON "public"."products" USING "btree" ("business_id", "is_public", "is_active");



ALTER TABLE ONLY "public"."appointment_addons"
    ADD CONSTRAINT "appointment_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_addons"
    ADD CONSTRAINT "appointment_addons_appointment_service_id_fkey" FOREIGN KEY ("appointment_service_id") REFERENCES "public"."appointment_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."breaks"
    ADD CONSTRAINT "breaks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_gallery_images"
    ADD CONSTRAINT "business_gallery_images_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_gallery_images"
    ADD CONSTRAINT "business_gallery_images_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_posts"
    ADD CONSTRAINT "business_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_posts"
    ADD CONSTRAINT "business_posts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_business_profiles"
    ADD CONSTRAINT "customer_business_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_business_profiles"
    ADD CONSTRAINT "customer_business_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_business_profiles"
    ADD CONSTRAINT "customer_business_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_services"
    ADD CONSTRAINT "employee_services_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_services"
    ADD CONSTRAINT "employee_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_addons"
    ADD CONSTRAINT "service_addons_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_off"
    ADD CONSTRAINT "time_off_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view profiles" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authorized users can view appointment addons" ON "public"."appointment_addons" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."appointment_services" "aps"
     JOIN "public"."appointments" "a" ON (("a"."id" = "aps"."appointment_id")))
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "a"."customer_id")))
  WHERE (("aps"."id" = "appointment_addons"."appointment_service_id") AND ("public"."has_business_access"("a"."business_id") OR ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Authorized users can view appointment services" ON "public"."appointment_services" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."appointments" "a"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "a"."customer_id")))
  WHERE (("a"."id" = "appointment_services"."appointment_id") AND ("public"."has_business_access"("a"."business_id") OR ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Business members can insert business" ON "public"."businesses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Business members can manage gallery" ON "public"."business_gallery_images" TO "authenticated" USING ("public"."has_business_access"("business_id")) WITH CHECK (("public"."has_business_access"("business_id") AND (("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Business members can manage posts" ON "public"."business_posts" TO "authenticated" USING ("public"."has_business_access"("business_id")) WITH CHECK (("public"."has_business_access"("business_id") AND (("author_user_id" IS NULL) OR ("author_user_id" = "auth"."uid"()))));



CREATE POLICY "Business members can update business" ON "public"."businesses" FOR UPDATE USING ("public"."has_business_access"("id"));



CREATE POLICY "Business members can view customer profiles" ON "public"."customer_business_profiles" FOR SELECT TO "authenticated" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Customers can insert their own record" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Customers can update own business profiles" ON "public"."customer_business_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Customers can update their own record" ON "public"."customers" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Customers can view own appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "appointments"."customer_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Customers can view own business profiles" ON "public"."customer_business_profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Customers can view their own record" ON "public"."customers" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Members can delete appointment addons" ON "public"."appointment_addons" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."appointment_services" "aps"
     JOIN "public"."appointments" "a" ON (("a"."id" = "aps"."appointment_id")))
  WHERE (("aps"."id" = "appointment_addons"."appointment_service_id") AND "public"."has_business_access"("a"."business_id")))));



CREATE POLICY "Members can delete appointment services" ON "public"."appointment_services" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_services"."appointment_id") AND "public"."has_business_access"("a"."business_id")))));



CREATE POLICY "Members can delete appointments" ON "public"."appointments" FOR DELETE TO "authenticated" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can delete customers" ON "public"."customers" FOR DELETE USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can insert appointment addons" ON "public"."appointment_addons" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."appointment_services" "aps"
     JOIN "public"."appointments" "a" ON (("a"."id" = "aps"."appointment_id")))
  WHERE (("aps"."id" = "appointment_addons"."appointment_service_id") AND "public"."has_business_access"("a"."business_id")))));



CREATE POLICY "Members can insert appointment services" ON "public"."appointment_services" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_services"."appointment_id") AND "public"."has_business_access"("a"."business_id")))));



CREATE POLICY "Members can insert appointments" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can insert customers" ON "public"."customers" FOR INSERT WITH CHECK ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage addons" ON "public"."service_addons" USING ("public"."has_business_access"(( SELECT "services"."business_id"
   FROM "public"."services"
  WHERE ("services"."id" = "service_addons"."service_id"))));



CREATE POLICY "Members can manage audit_logs" ON "public"."audit_logs" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage breaks" ON "public"."breaks" USING ("public"."has_business_access"(( SELECT "employees"."business_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "breaks"."employee_id"))));



CREATE POLICY "Members can manage business_settings" ON "public"."business_settings" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage categories" ON "public"."service_categories" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage employee_services" ON "public"."employee_services" USING ("public"."has_business_access"(( SELECT "employees"."business_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "employee_services"."employee_id"))));



CREATE POLICY "Members can manage employees" ON "public"."employees" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage expenses" ON "public"."expenses" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage notifications" ON "public"."notifications" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage products" ON "public"."products" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage sales" ON "public"."sales" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage services" ON "public"."services" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can manage stock_movements" ON "public"."stock_movements" USING ("public"."has_business_access"(( SELECT "products"."business_id"
   FROM "public"."products"
  WHERE ("products"."id" = "stock_movements"."product_id"))));



CREATE POLICY "Members can manage time_off" ON "public"."time_off" USING ("public"."has_business_access"(( SELECT "employees"."business_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "time_off"."employee_id"))));



CREATE POLICY "Members can manage working_hours" ON "public"."working_hours" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can update appointment addons" ON "public"."appointment_addons" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."appointment_services" "aps"
     JOIN "public"."appointments" "a" ON (("a"."id" = "aps"."appointment_id")))
  WHERE (("aps"."id" = "appointment_addons"."appointment_service_id") AND "public"."has_business_access"("a"."business_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."appointment_services" "aps"
     JOIN "public"."appointments" "a" ON (("a"."id" = "aps"."appointment_id")))
  WHERE (("aps"."id" = "appointment_addons"."appointment_service_id") AND "public"."has_business_access"("a"."business_id")))));



CREATE POLICY "Members can update appointment services" ON "public"."appointment_services" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_services"."appointment_id") AND "public"."has_business_access"("a"."business_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_services"."appointment_id") AND "public"."has_business_access"("a"."business_id")))));



CREATE POLICY "Members can update appointments" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ("public"."has_business_access"("business_id")) WITH CHECK ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can update customers" ON "public"."customers" FOR UPDATE USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can view appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can view business_members" ON "public"."business_members" FOR SELECT USING (("public"."has_business_access"("business_id") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Members can view customers" ON "public"."customers" FOR SELECT USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Members can view subscriptions" ON "public"."subscriptions" FOR SELECT USING ("public"."has_business_access"("business_id"));



CREATE POLICY "Owners can manage members" ON "public"."business_members" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Public can view active bookable services" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND ("online_booking_enabled" = true) AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "services"."business_id") AND ("b"."status" = 'active'::"text"))))));



CREATE POLICY "Public can view active business settings" ON "public"."business_settings" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_settings"."business_id") AND ("b"."status" = 'active'::"text")))));



CREATE POLICY "Public can view active businesses" ON "public"."businesses" FOR SELECT TO "authenticated", "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "Public can view active employees" ON "public"."employees" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "employees"."business_id") AND ("b"."status" = 'active'::"text"))))));



CREATE POLICY "Public can view addons" ON "public"."service_addons" FOR SELECT USING (true);



CREATE POLICY "Public can view categories" ON "public"."service_categories" FOR SELECT USING (true);



CREATE POLICY "Public can view employee_services" ON "public"."employee_services" FOR SELECT USING (true);



CREATE POLICY "Public can view public gallery images" ON "public"."business_gallery_images" FOR SELECT TO "authenticated", "anon" USING (("is_public" = true));



CREATE POLICY "Public can view published products" ON "public"."products" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND ("is_public" = true) AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "products"."business_id") AND ("b"."status" = 'active'::"text"))))));



CREATE POLICY "Public can view published public posts" ON "public"."business_posts" FOR SELECT TO "authenticated", "anon" USING ((("is_published" = true) AND (COALESCE("published_at", "created_at") <= "now"()) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())) AND (("audience" = 'public'::"text") OR (("audience" = 'registered_customers'::"text") AND ("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."customer_business_profiles" "cbp"
  WHERE (("cbp"."business_id" = "business_posts"."business_id") AND ("cbp"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Public can view working_hours" ON "public"."working_hours" FOR SELECT USING (true);



CREATE POLICY "Service role can do anything on appointments" ON "public"."appointments" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can do anything on businesses" ON "public"."businesses" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can do anything on subscriptions" ON "public"."subscriptions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can insert themselves during onboarding" ON "public"."business_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."appointment_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."breaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_gallery_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_business_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_off" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."working_hours" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_duration" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_duration" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_duration" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_business_appointments"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_business_appointments"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_business_appointments"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_business_appointments"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_service_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_service_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_service_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_service_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_business_access"("business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_business_access"("business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_business_access"("business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_business_owner"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_business_owner"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_business_owner"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."customer_business_profiles" TO "anon";
GRANT ALL ON TABLE "public"."customer_business_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_business_profiles" TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_business_as_customer"("p_business_id" "uuid", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_business_as_customer"("p_business_id" "uuid", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_business_as_customer"("p_business_id" "uuid", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_business_as_customer"("p_business_id" "uuid", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."owner_create_appointment"("p_business_id" "uuid", "p_customer_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_status" "public"."appointment_status", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owner_create_appointment"("p_business_id" "uuid", "p_customer_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_status" "public"."appointment_status", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."owner_create_appointment"("p_business_id" "uuid", "p_customer_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_status" "public"."appointment_status", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owner_create_appointment"("p_business_id" "uuid", "p_customer_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_status" "public"."appointment_status", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."secure_create_booking"("p_business_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secure_create_booking"("p_business_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."secure_create_booking"("p_business_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."secure_create_booking"("p_business_id" "uuid", "p_employee_id" "uuid", "p_service_ids" "uuid"[], "p_local_date" "date", "p_local_time" time without time zone, "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_notes" "text") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointment_addons" TO "anon";
GRANT ALL ON TABLE "public"."appointment_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_addons" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointment_services" TO "anon";
GRANT ALL ON TABLE "public"."appointment_services" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_services" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."breaks" TO "anon";
GRANT ALL ON TABLE "public"."breaks" TO "authenticated";
GRANT ALL ON TABLE "public"."breaks" TO "service_role";



GRANT ALL ON TABLE "public"."business_gallery_images" TO "anon";
GRANT ALL ON TABLE "public"."business_gallery_images" TO "authenticated";
GRANT ALL ON TABLE "public"."business_gallery_images" TO "service_role";



GRANT ALL ON TABLE "public"."business_members" TO "anon";
GRANT ALL ON TABLE "public"."business_members" TO "authenticated";
GRANT ALL ON TABLE "public"."business_members" TO "service_role";



GRANT ALL ON TABLE "public"."business_posts" TO "anon";
GRANT ALL ON TABLE "public"."business_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."business_posts" TO "service_role";



GRANT ALL ON TABLE "public"."business_settings" TO "anon";
GRANT ALL ON TABLE "public"."business_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."business_settings" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."employee_services" TO "anon";
GRANT ALL ON TABLE "public"."employee_services" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_services" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."service_addons" TO "anon";
GRANT ALL ON TABLE "public"."service_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."service_addons" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."time_off" TO "anon";
GRANT ALL ON TABLE "public"."time_off" TO "authenticated";
GRANT ALL ON TABLE "public"."time_off" TO "service_role";



GRANT ALL ON TABLE "public"."working_hours" TO "anon";
GRANT ALL ON TABLE "public"."working_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."working_hours" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







