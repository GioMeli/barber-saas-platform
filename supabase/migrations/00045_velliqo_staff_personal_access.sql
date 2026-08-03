-- 00045_velliqo_staff_personal_access.sql
-- Passwordless, tenant-isolated personal appointment access for staff.

begin;

alter table public.employees
  add column if not exists personal_access_enabled boolean not null default false,
  add column if not exists personal_access_status text not null default 'disabled',
  add column if not exists staff_app_invited_at timestamptz,
  add column if not exists staff_app_activated_at timestamptz,
  add column if not exists staff_app_last_seen_at timestamptz,
  add column if not exists staff_app_revoked_at timestamptz,
  add column if not exists staff_access_version integer not null default 1;

alter table public.employees
  drop constraint if exists employees_personal_access_status_check;

alter table public.employees
  add constraint employees_personal_access_status_check
  check (personal_access_status in ('disabled', 'invited', 'active', 'revoked'));

create unique index if not exists employees_business_user_personal_access_uidx
  on public.employees (business_id, user_id)
  where user_id is not null;

create index if not exists employees_personal_access_lookup_idx
  on public.employees (user_id, business_id, personal_access_enabled)
  where user_id is not null;

create table if not exists public.staff_access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_access_audit_business_idx
  on public.staff_access_audit_logs (business_id, created_at desc);

create index if not exists staff_access_audit_employee_idx
  on public.staff_access_audit_logs (employee_id, created_at desc);

alter table public.staff_access_audit_logs enable row level security;

create or replace function public.can_manage_staff_access(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role = 'Owner'
  );
$$;

revoke all on function public.can_manage_staff_access(uuid) from public;
grant execute on function public.can_manage_staff_access(uuid) to authenticated, service_role;

drop policy if exists "Owners can view staff access audit logs"
  on public.staff_access_audit_logs;
create policy "Owners can view staff access audit logs"
  on public.staff_access_audit_logs
  for select
  to authenticated
  using (public.can_manage_staff_access(business_id));

revoke insert, update, delete on public.staff_access_audit_logs from anon, authenticated;
grant select on public.staff_access_audit_logs to authenticated;
grant all on public.staff_access_audit_logs to service_role;

create or replace function public.staff_has_active_access(p_employee_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    join public.businesses b on b.id = e.business_id
    where e.id = p_employee_id
      and e.user_id = auth.uid()
      and e.personal_access_enabled = true
      and e.personal_access_status in ('invited', 'active')
      and e.is_active = true
      and b.status = 'active'
  );
$$;

revoke all on function public.staff_has_active_access(uuid) from public;
grant execute on function public.staff_has_active_access(uuid) to authenticated, service_role;

-- Personal staff accounts can read only their own assigned appointments.
drop policy if exists "Staff can view own appointments" on public.appointments;
create policy "Staff can view own appointments"
  on public.appointments
  for select
  to authenticated
  using (
    employee_id is not null
    and public.staff_has_active_access(employee_id)
  );

-- Resolve the legacy /staff-portal route without exposing another employee.
create or replace function public.staff_resolve_portal()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select jsonb_build_object(
    'business_slug', b.slug,
    'employee_id', e.id,
    'access_enabled', e.personal_access_enabled
  )
  into v_result
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
    and b.status = 'active'
  order by e.updated_at desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.staff_resolve_portal() from public;
grant execute on function public.staff_resolve_portal() to authenticated;

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
    'appointments', v_appointments
  );
end;
$$;

revoke all on function public.staff_get_workspace(text) from public;
grant execute on function public.staff_get_workspace(text) to authenticated;

create or replace function public.staff_create_own_appointment(
  p_business_slug text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_service_ids uuid[],
  p_local_date date,
  p_local_time time,
  p_notes text default null
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

  if nullif(trim(p_customer_name), '') is null then
    raise exception using errcode = '22023', message = 'Customer name is required.';
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

  select c.id
  into v_customer_id
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
    returning id into v_customer_id;
  else
    update public.customers
    set
      full_name = trim(p_customer_name),
      email = coalesce(nullif(lower(trim(p_customer_email)), ''), email),
      phone = coalesce(nullif(trim(p_customer_phone), ''), phone),
      updated_at = now()
    where id = v_customer_id;
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
    v_appointment_id, jsonb_build_object('booking_reference', v_reference)
  );

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    v_employee.business_id, auth.uid(), 'staff_appointment_created',
    jsonb_build_object('appointment_id', v_appointment_id, 'employee_id', v_employee.id)
  );

  perform public.create_owner_notification(
    v_employee.business_id,
    'Staff appointment created',
    v_employee.name || ' created an appointment for ' || trim(p_customer_name),
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

revoke all on function public.staff_create_own_appointment(text, text, text, text, uuid[], date, time, text) from public;
grant execute on function public.staff_create_own_appointment(text, text, text, text, uuid[], date, time, text) to authenticated;

create or replace function public.staff_reschedule_own_appointment(
  p_business_slug text,
  p_appointment_id uuid,
  p_local_date date,
  p_local_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees%rowtype;
  v_business public.businesses%rowtype;
  v_appointment public.appointments%rowtype;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_local_end timestamp;
  v_day integer;
  v_work_start time;
  v_work_end time;
  v_closed boolean;
begin
  select e.* into v_employee
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

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
    and business_id = v_employee.business_id
    and employee_id = v_employee.id
  for update;

  if v_appointment.id is null then
    raise exception using errcode = 'P0002', message = 'Appointment not found.';
  end if;

  if v_appointment.status in ('completed', 'cancelled_by_customer', 'cancelled_by_business', 'no_show', 'rescheduled') then
    raise exception using errcode = '22023', message = 'This appointment can no longer be rescheduled.';
  end if;

  v_new_start := ((p_local_date + p_local_time) at time zone coalesce(nullif(v_business.timezone, ''), 'UTC'));
  v_new_end := v_new_start + make_interval(mins => v_appointment.total_duration);
  v_local_end := v_new_end at time zone coalesce(nullif(v_business.timezone, ''), 'UTC');
  v_day := extract(dow from p_local_date);

  if v_local_end::date <> p_local_date then
    raise exception using errcode = '22023', message = 'The appointment cannot continue into another day.';
  end if;

  select wh.start_time, wh.end_time, wh.is_closed
  into v_work_start, v_work_end, v_closed
  from public.working_hours wh
  where wh.business_id = v_employee.business_id
    and wh.day_of_week = v_day
    and (wh.employee_id = v_employee.id or wh.employee_id is null)
  order by (wh.employee_id is not null) desc
  limit 1;

  if v_work_start is null or coalesce(v_closed, false)
     or p_local_time < v_work_start
     or v_local_end::time > v_work_end then
    raise exception using errcode = '22023', message = 'The selected time is outside working hours.';
  end if;

  if exists (
    select 1 from public.business_closures bc
    where bc.business_id = v_employee.business_id
      and bc.is_active = true
      and p_local_date between bc.start_date and bc.end_date
  ) then
    raise exception using errcode = '22023', message = 'The business is closed on this date.';
  end if;

  if exists (
    select 1 from public.time_off t
    where t.employee_id = v_employee.id
      and t.status = 'approved'
      and p_local_date between t.start_date and t.end_date
  ) then
    raise exception using errcode = '22023', message = 'The staff member is unavailable on this date.';
  end if;

  if exists (
    select 1 from public.breaks br
    where br.employee_id = v_employee.id
      and br.day_of_week = v_day
      and p_local_time < br.end_time
      and v_local_end::time > br.start_time
  ) then
    raise exception using errcode = '23P01', message = 'The appointment overlaps a scheduled break.';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.business_id = v_employee.business_id
      and a.employee_id = v_employee.id
      and a.id <> p_appointment_id
      and a.status not in ('cancelled_by_customer', 'cancelled_by_business', 'no_show', 'rescheduled')
      and a.start_time < v_new_end
      and a.end_time > v_new_start
  ) then
    raise exception using errcode = '23P01', message = 'The selected time overlaps another appointment.';
  end if;

  update public.appointments
  set start_time = v_new_start, end_time = v_new_end, updated_at = now()
  where id = p_appointment_id;

  insert into public.staff_access_audit_logs (
    business_id, employee_id, actor_user_id, action, appointment_id, metadata
  ) values (
    v_employee.business_id, v_employee.id, auth.uid(), 'appointment_rescheduled',
    p_appointment_id,
    jsonb_build_object('old_start', v_appointment.start_time, 'new_start', v_new_start)
  );

  return jsonb_build_object('id', p_appointment_id, 'start_time', v_new_start, 'end_time', v_new_end);
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'The selected time overlaps another appointment.';
end;
$$;

revoke all on function public.staff_reschedule_own_appointment(text, uuid, date, time) from public;
grant execute on function public.staff_reschedule_own_appointment(text, uuid, date, time) to authenticated;

create or replace function public.staff_update_own_appointment_status(
  p_business_slug text,
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_old_status public.appointment_status;
begin
  select e.* into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
    and b.status = 'active'
  limit 1;

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  if p_status not in ('pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'no_show') then
    raise exception using errcode = '22023', message = 'Unsupported appointment status.';
  end if;

  select status into v_old_status
  from public.appointments
  where id = p_appointment_id
    and business_id = v_employee.business_id
    and employee_id = v_employee.id
  for update;

  if v_old_status is null then
    raise exception using errcode = 'P0002', message = 'Appointment not found.';
  end if;

  update public.appointments
  set status = p_status, updated_at = now()
  where id = p_appointment_id;

  insert into public.staff_access_audit_logs (
    business_id, employee_id, actor_user_id, action, appointment_id, metadata
  ) values (
    v_employee.business_id, v_employee.id, auth.uid(), 'appointment_status_changed',
    p_appointment_id, jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
  );

  return jsonb_build_object('id', p_appointment_id, 'old_status', v_old_status, 'status', p_status);
end;
$$;

revoke all on function public.staff_update_own_appointment_status(text, uuid, public.appointment_status) from public;
grant execute on function public.staff_update_own_appointment_status(text, uuid, public.appointment_status) to authenticated;

create or replace function public.staff_cancel_own_appointment(
  p_business_slug text,
  p_appointment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_old_status public.appointment_status;
begin
  select e.* into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
    and b.status = 'active'
  limit 1;

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  select status into v_old_status
  from public.appointments
  where id = p_appointment_id
    and business_id = v_employee.business_id
    and employee_id = v_employee.id
  for update;

  if v_old_status is null then
    raise exception using errcode = 'P0002', message = 'Appointment not found.';
  end if;

  if v_old_status in ('completed', 'cancelled_by_customer', 'cancelled_by_business', 'no_show', 'rescheduled') then
    raise exception using errcode = '22023', message = 'This appointment can no longer be cancelled.';
  end if;

  update public.appointments
  set
    status = 'cancelled_by_business',
    notes = case
      when nullif(trim(p_reason), '') is null then notes
      when nullif(trim(notes), '') is null then 'Staff cancellation: ' || trim(p_reason)
      else notes || E'\nStaff cancellation: ' || trim(p_reason)
    end,
    updated_at = now()
  where id = p_appointment_id;

  insert into public.staff_access_audit_logs (
    business_id, employee_id, actor_user_id, action, appointment_id, metadata
  ) values (
    v_employee.business_id, v_employee.id, auth.uid(), 'appointment_cancelled',
    p_appointment_id, jsonb_build_object('old_status', v_old_status, 'reason', nullif(trim(p_reason), ''))
  );

  return jsonb_build_object('id', p_appointment_id, 'status', 'cancelled_by_business');
end;
$$;

revoke all on function public.staff_cancel_own_appointment(text, uuid, text) from public;
grant execute on function public.staff_cancel_own_appointment(text, uuid, text) to authenticated;

create or replace function public.staff_update_own_appointment_notes(
  p_business_slug text,
  p_appointment_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
begin
  select e.* into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
    and b.status = 'active'
  limit 1;

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  update public.appointments
  set notes = nullif(trim(p_notes), ''), updated_at = now()
  where id = p_appointment_id
    and business_id = v_employee.business_id
    and employee_id = v_employee.id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Appointment not found.';
  end if;

  insert into public.staff_access_audit_logs (
    business_id, employee_id, actor_user_id, action, appointment_id
  ) values (
    v_employee.business_id, v_employee.id, auth.uid(), 'appointment_notes_updated', p_appointment_id
  );

  return jsonb_build_object('id', p_appointment_id, 'notes', nullif(trim(p_notes), ''));
end;
$$;

revoke all on function public.staff_update_own_appointment_notes(text, uuid, text) from public;
grant execute on function public.staff_update_own_appointment_notes(text, uuid, text) to authenticated;

-- Realtime keeps the owner calendar and the staff mini app synchronized.
do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.employees;
exception when duplicate_object then null;
end $$;

commit;
