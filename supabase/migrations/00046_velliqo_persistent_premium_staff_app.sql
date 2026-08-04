-- 00046_velliqo_persistent_premium_staff_app.sql
-- Persistent staff sessions, business customer selection and personal PWA hardening.

begin;

create or replace function public.staff_get_workspace(p_business_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_business public.businesses%rowtype;
  v_services jsonb;
  v_customers jsonb;
  v_appointments jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select e.*
  into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and b.status = 'active'
    and e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
  limit 1;

  if v_employee.id is not null then
    select b.* into v_business
    from public.businesses b
    where b.id = v_employee.business_id;
  end if;

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  update public.employees
  set
    personal_access_status = 'active',
    staff_app_activated_at = coalesce(staff_app_activated_at, now()),
    staff_app_last_seen_at = now(),
    updated_at = now()
  where id = v_employee.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'duration', s.duration,
        'price', s.price,
        'image_url', s.image_url
      ) order by s.name
    ),
    '[]'::jsonb
  )
  into v_services
  from public.employee_services es
  join public.services s on s.id = es.service_id
  where es.employee_id = v_employee.id
    and s.business_id = v_employee.business_id
    and s.is_active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'email', c.email,
        'phone', c.phone
      ) order by lower(c.full_name), c.created_at desc
    ),
    '[]'::jsonb
  )
  into v_customers
  from public.customers c
  where c.business_id = v_employee.business_id;

  select coalesce(jsonb_agg(rows.payload order by rows.start_time), '[]'::jsonb)
  into v_appointments
  from (
    select
      a.start_time,
      jsonb_build_object(
        'id', a.id,
        'business_id', a.business_id,
        'employee_id', a.employee_id,
        'customer_id', a.customer_id,
        'start_time', a.start_time,
        'end_time', a.end_time,
        'status', a.status,
        'total_duration', a.total_duration,
        'total_price', a.total_price,
        'notes', a.notes,
        'booking_reference', a.booking_reference,
        'customer', jsonb_build_object(
          'full_name', coalesce(c.full_name, 'Walk-in customer'),
          'phone', c.phone,
          'email', c.email
        ),
        'services', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'name', s.name,
              'duration', aps.duration,
              'price', aps.price
            ) order by s.name
          )
          from public.appointment_services aps
          left join public.services s on s.id = aps.service_id
          where aps.appointment_id = a.id
        ), '[]'::jsonb)
      ) as payload
    from public.appointments a
    left join public.customers c on c.id = a.customer_id
    where a.business_id = v_employee.business_id
      and a.employee_id = v_employee.id
      and a.start_time >= now() - interval '30 days'
      and a.start_time < now() + interval '180 days'
  ) rows;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'slug', v_business.slug,
      'name', v_business.name,
      'logo_url', v_business.logo_url,
      'address', v_business.address,
      'phone', v_business.phone,
      'email', v_business.email,
      'timezone', v_business.timezone,
      'currency', v_business.currency
    ),
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'business_id', v_employee.business_id,
      'name', v_employee.name,
      'email', v_employee.email,
      'phone', v_employee.phone,
      'photo_url', v_employee.photo_url,
      'bio', v_employee.bio,
      'personal_access_status', 'active',
      'staff_access_version', v_employee.staff_access_version
    ),
    'services', v_services,
    'customers', v_customers,
    'appointments', v_appointments
  );
end;
$$;

revoke all on function public.staff_get_workspace(text) from public;
grant execute on function public.staff_get_workspace(text) to authenticated;

create or replace function public.staff_create_own_appointment_v2(
  p_business_slug text,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_service_ids uuid[],
  p_local_date date,
  p_local_time time,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees%rowtype;
  v_business public.businesses%rowtype;
  v_customer_id uuid;
  v_customer_name text;
  v_duration integer;
  v_price numeric(10,2);
  v_deposit numeric(10,2);
  v_requested integer;
  v_valid integer;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
  v_reference text;
begin
  select e.*
  into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
    and b.status = 'active'
  limit 1;

  if v_employee.id is not null then
    select b.* into v_business
    from public.businesses b
    where b.id = v_employee.business_id;
  end if;

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  if p_customer_id is null and nullif(trim(p_customer_name), '') is null then
    raise exception using errcode = '22023', message = 'Select an existing customer or enter a customer name.';
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one service.';
  end if;

  v_requested := cardinality(p_service_ids);

  select
    count(distinct s.id),
    coalesce(sum(s.duration), 0),
    coalesce(sum(s.price), 0),
    coalesce(sum(case when s.deposit_required then s.deposit_amount else 0 end), 0)
  into v_valid, v_duration, v_price, v_deposit
  from public.services s
  join public.employee_services es
    on es.service_id = s.id
   and es.employee_id = v_employee.id
  where s.business_id = v_employee.business_id
    and s.id = any(p_service_ids)
    and s.is_active = true;

  if v_valid <> v_requested or v_duration <= 0 then
    raise exception using errcode = '22023', message = 'One or more selected services are unavailable for this staff member.';
  end if;

  if not exists (
    select 1
    from public.get_public_availability(
      v_employee.business_id,
      v_employee.id,
      p_local_date,
      p_service_ids
    ) availability
    where availability.employee_id = v_employee.id
      and availability.available_time = p_local_time
  ) then
    raise exception using errcode = '23P01', message = 'This appointment time is not available.';
  end if;

  if p_customer_id is not null then
    select c.id, c.full_name
    into v_customer_id, v_customer_name
    from public.customers c
    where c.id = p_customer_id
      and c.business_id = v_employee.business_id
    limit 1;

    if v_customer_id is null then
      raise exception using errcode = '42501', message = 'The selected customer is unavailable for this business.';
    end if;

    update public.customers
    set
      full_name = coalesce(nullif(trim(p_customer_name), ''), full_name),
      email = coalesce(nullif(lower(trim(p_customer_email)), ''), email),
      phone = coalesce(nullif(trim(p_customer_phone), ''), phone),
      updated_at = now()
    where id = v_customer_id
      and business_id = v_employee.business_id
    returning full_name into v_customer_name;
  else
    select c.id, c.full_name
    into v_customer_id, v_customer_name
    from public.customers c
    where c.business_id = v_employee.business_id
      and (
        (nullif(lower(trim(p_customer_email)), '') is not null and lower(c.email) = lower(trim(p_customer_email)))
        or (nullif(trim(p_customer_phone), '') is not null and c.phone = trim(p_customer_phone))
      )
    order by c.updated_at desc
    limit 1;

    if v_customer_id is null then
      insert into public.customers (business_id, full_name, email, phone)
      values (
        v_employee.business_id,
        trim(p_customer_name),
        nullif(lower(trim(p_customer_email)), ''),
        nullif(trim(p_customer_phone), '')
      )
      returning id, full_name into v_customer_id, v_customer_name;
    else
      update public.customers
      set
        full_name = trim(p_customer_name),
        email = coalesce(nullif(lower(trim(p_customer_email)), ''), email),
        phone = coalesce(nullif(trim(p_customer_phone), ''), phone),
        updated_at = now()
      where id = v_customer_id
        and business_id = v_employee.business_id
      returning full_name into v_customer_name;
    end if;
  end if;

  v_start := ((p_local_date + p_local_time) at time zone coalesce(nullif(v_business.timezone, ''), 'UTC'));
  v_end := v_start + make_interval(mins => v_duration);
  v_reference := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.appointments (
    business_id, customer_id, employee_id, start_time, end_time,
    status, payment_status, total_duration, total_price, deposit_amount,
    notes, guest_token, guest_token_hash, booking_reference
  ) values (
    v_employee.business_id, v_customer_id, v_employee.id, v_start, v_end,
    'confirmed', 'unpaid', v_duration, v_price, v_deposit,
    nullif(trim(p_notes), ''), null, null, v_reference
  ) returning id into v_appointment_id;

  insert into public.appointment_services (appointment_id, service_id, price, duration)
  select v_appointment_id, s.id, s.price, s.duration
  from public.services s
  where s.business_id = v_employee.business_id
    and s.id = any(p_service_ids);

  insert into public.staff_access_audit_logs (
    business_id, employee_id, actor_user_id, action, appointment_id, metadata
  ) values (
    v_employee.business_id, v_employee.id, auth.uid(), 'appointment_created',
    v_appointment_id, jsonb_build_object('booking_reference', v_reference, 'customer_id', v_customer_id)
  );

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    v_employee.business_id, auth.uid(), 'staff_appointment_created',
    jsonb_build_object('appointment_id', v_appointment_id, 'employee_id', v_employee.id)
  );

  perform public.create_owner_notification(
    v_employee.business_id,
    'Staff appointment created',
    v_employee.name || ' created an appointment for ' || v_customer_name,
    'new_appointment',
    jsonb_build_object(
      'appointment_id', v_appointment_id,
      'employee_id', v_employee.id,
      'source', 'staff_app'
    )
  );

  return jsonb_build_object(
    'id', v_appointment_id,
    'booking_reference', v_reference,
    'start_time', v_start,
    'end_time', v_end
  );
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'This appointment time has just been reserved.';
end;
$$;

revoke all on function public.staff_create_own_appointment_v2(text, uuid, text, text, text, uuid[], date, time, text) from public;
grant execute on function public.staff_create_own_appointment_v2(text, uuid, text, text, text, uuid[], date, time, text) to authenticated;

commit;
