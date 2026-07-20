-- 00024_owner_dashboard_notifications.sql
-- Owner dashboard notifications for public bookings and new customers.

begin;

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('new_appointment', 'new_customer'));

create index if not exists notifications_business_created_idx
  on public.notifications (business_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications"
  on public.notifications;

create policy "Users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_business_access(business_id)
  );

drop policy if exists "Users can update own notifications"
  on public.notifications;

create policy "Users can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_business_access(business_id)
  )
  with check (
    user_id = auth.uid()
    and public.has_business_access(business_id)
  );

revoke insert, delete on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

create or replace function public.create_owner_notification(
  p_business_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('new_appointment', 'new_customer') then
    return;
  end if;

  insert into public.notifications (
    business_id,
    user_id,
    title,
    message,
    type,
    is_read,
    metadata,
    created_at
  )
  select
    p_business_id,
    bm.user_id,
    p_title,
    p_message,
    p_type,
    false,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.role = 'Owner';
end;
$$;

revoke all on function public.create_owner_notification(
  uuid, text, text, text, jsonb
) from public;

create or replace function public.notify_owner_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_owner_notification(
    new.business_id,
    'New Customer',
    coalesce(nullif(new.full_name, ''), 'A new customer') || ' was added',
    'new_customer',
    jsonb_build_object(
      'customer_id', new.id,
      'customer_name', new.full_name
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_owner_new_customer
  on public.customers;

create trigger trg_notify_owner_new_customer
after insert on public.customers
for each row
execute function public.notify_owner_new_customer();

create or replace function public.notify_owner_public_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment_id uuid;
  v_customer_name text;
  v_start_time timestamptz;
  v_business_id uuid;
begin
  if new.action <> 'public_booking_created' then
    return new;
  end if;

  v_appointment_id := nullif(new.details ->> 'appointment_id', '')::uuid;

  if v_appointment_id is null then
    return new;
  end if;

  select
    a.business_id,
    a.start_time,
    coalesce(c.full_name, 'Customer')
  into
    v_business_id,
    v_start_time,
    v_customer_name
  from public.appointments a
  left join public.customers c on c.id = a.customer_id
  where a.id = v_appointment_id;

  if v_business_id is null then
    return new;
  end if;

  perform public.create_owner_notification(
    v_business_id,
    '+1 Appointment',
    v_customer_name || ' · ' || to_char(v_start_time, 'DD Mon YYYY, HH24:MI'),
    'new_appointment',
    jsonb_build_object(
      'appointment_id', v_appointment_id,
      'customer_name', v_customer_name,
      'appointment_start', v_start_time
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_owner_public_appointment
  on public.audit_logs;

create trigger trg_notify_owner_public_appointment
after insert on public.audit_logs
for each row
when (new.action = 'public_booking_created')
execute function public.notify_owner_public_appointment();

-- Safe when the table has not already been added to Realtime.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end
$$;

commit;
