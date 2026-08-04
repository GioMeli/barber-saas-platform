-- 00047_velliqo_staff_trusted_device_profile_pwa.sql
-- Trusted-device sign-in, self-service staff profiles, and installable personal staff app hardening.

begin;

create table if not exists public.staff_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  token_hash text not null,
  device_label text,
  user_agent text,
  last_used_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, device_id)
);

create index if not exists staff_trusted_devices_lookup_idx
  on public.staff_trusted_devices (employee_id, device_id, revoked_at);

create index if not exists staff_trusted_devices_user_idx
  on public.staff_trusted_devices (user_id, updated_at desc);

alter table public.staff_trusted_devices enable row level security;

revoke all on public.staff_trusted_devices from anon, authenticated;
grant all on public.staff_trusted_devices to service_role;

create or replace function public.staff_register_trusted_device(
  p_business_slug text,
  p_device_id text,
  p_token_hash text,
  p_device_label text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_device_id !~ '^[A-Za-z0-9_-]{12,160}$' then
    raise exception using errcode = '22023', message = 'Invalid device identifier.';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid device credential.';
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

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  insert into public.staff_trusted_devices (
    business_id,
    employee_id,
    user_id,
    device_id,
    token_hash,
    device_label,
    user_agent,
    last_used_at,
    failed_attempts,
    locked_until,
    revoked_at,
    updated_at
  ) values (
    v_employee.business_id,
    v_employee.id,
    auth.uid(),
    p_device_id,
    lower(p_token_hash),
    nullif(left(trim(coalesce(p_device_label, '')), 120), ''),
    nullif(left(trim(coalesce(p_user_agent, '')), 500), ''),
    v_now,
    0,
    null,
    null,
    v_now
  )
  on conflict (employee_id, device_id)
  do update set
    user_id = excluded.user_id,
    token_hash = excluded.token_hash,
    device_label = excluded.device_label,
    user_agent = excluded.user_agent,
    last_used_at = excluded.last_used_at,
    failed_attempts = 0,
    locked_until = null,
    revoked_at = null,
    updated_at = excluded.updated_at;

  insert into public.staff_access_audit_logs (
    business_id,
    employee_id,
    actor_user_id,
    action,
    metadata
  ) values (
    v_employee.business_id,
    v_employee.id,
    auth.uid(),
    'trusted_device_registered',
    jsonb_build_object('device_id', p_device_id, 'device_label', p_device_label)
  );

  return jsonb_build_object(
    'ok', true,
    'employee_id', v_employee.id,
    'device_id', p_device_id,
    'trusted_at', v_now
  );
end;
$$;

revoke all on function public.staff_register_trusted_device(text, text, text, text, text) from public;
grant execute on function public.staff_register_trusted_device(text, text, text, text, text) to authenticated;

create or replace function public.staff_revoke_trusted_device(
  p_business_slug text,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select e.*
  into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and e.user_id = auth.uid()
  limit 1;

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable.';
  end if;

  update public.staff_trusted_devices
  set revoked_at = v_now, updated_at = v_now
  where employee_id = v_employee.id
    and user_id = auth.uid()
    and device_id = p_device_id
    and revoked_at is null;

  insert into public.staff_access_audit_logs (
    business_id,
    employee_id,
    actor_user_id,
    action,
    metadata
  ) values (
    v_employee.business_id,
    v_employee.id,
    auth.uid(),
    'trusted_device_revoked',
    jsonb_build_object('device_id', p_device_id)
  );

  return jsonb_build_object('ok', true, 'device_id', p_device_id);
end;
$$;

revoke all on function public.staff_revoke_trusted_device(text, text) from public;
grant execute on function public.staff_revoke_trusted_device(text, text) to authenticated;

create or replace function public.staff_update_own_profile(
  p_business_slug text,
  p_name text,
  p_phone text,
  p_bio text,
  p_photo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_name text := nullif(trim(p_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_bio text := nullif(trim(p_bio), '');
  v_photo text := nullif(trim(p_photo_url), '');
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if v_name is null or char_length(v_name) > 120 then
    raise exception using errcode = '22023', message = 'Enter a valid staff name.';
  end if;
  if v_phone is not null and char_length(v_phone) > 60 then
    raise exception using errcode = '22023', message = 'Phone number is too long.';
  end if;
  if v_bio is not null and char_length(v_bio) > 1200 then
    raise exception using errcode = '22023', message = 'Biography is too long.';
  end if;
  if v_photo is not null and char_length(v_photo) > 2000 then
    raise exception using errcode = '22023', message = 'Profile photo URL is invalid.';
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

  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  update public.employees
  set
    name = v_name,
    phone = v_phone,
    bio = v_bio,
    photo_url = v_photo,
    updated_at = v_now
  where id = v_employee.id
    and business_id = v_employee.business_id;

  update public.profiles
  set
    full_name = v_name,
    phone = v_phone,
    avatar_url = v_photo,
    updated_at = v_now
  where id = auth.uid();

  insert into public.staff_access_audit_logs (
    business_id,
    employee_id,
    actor_user_id,
    action,
    metadata
  ) values (
    v_employee.business_id,
    v_employee.id,
    auth.uid(),
    'profile_updated',
    jsonb_build_object(
      'name', v_name,
      'phone_changed', v_phone is distinct from v_employee.phone,
      'photo_changed', v_photo is distinct from v_employee.photo_url
    )
  );

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    v_employee.business_id,
    auth.uid(),
    'staff_profile_updated',
    jsonb_build_object('employee_id', v_employee.id)
  );

  return jsonb_build_object(
    'id', v_employee.id,
    'name', v_name,
    'email', v_employee.email,
    'phone', v_phone,
    'bio', v_bio,
    'photo_url', v_photo,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.staff_update_own_profile(text, text, text, text, text) from public;
grant execute on function public.staff_update_own_profile(text, text, text, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-avatars',
  'staff-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view staff avatars" on storage.objects;
create policy "Public can view staff avatars"
on storage.objects for select
using (bucket_id = 'staff-avatars');

drop policy if exists "Staff can upload own avatar" on storage.objects;
create policy "Staff can upload own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'staff-avatars'
  and exists (
    select 1
    from public.employees e
    where e.id::text = (storage.foldername(name))[1]
      and e.user_id = auth.uid()
      and e.personal_access_enabled = true
      and e.personal_access_status in ('invited', 'active')
      and e.is_active = true
  )
);

drop policy if exists "Staff can update own avatar" on storage.objects;
create policy "Staff can update own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'staff-avatars'
  and exists (
    select 1
    from public.employees e
    where e.id::text = (storage.foldername(name))[1]
      and e.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'staff-avatars'
  and exists (
    select 1
    from public.employees e
    where e.id::text = (storage.foldername(name))[1]
      and e.user_id = auth.uid()
      and e.personal_access_enabled = true
      and e.is_active = true
  )
);

drop policy if exists "Staff can delete own avatar" on storage.objects;
create policy "Staff can delete own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'staff-avatars'
  and exists (
    select 1
    from public.employees e
    where e.id::text = (storage.foldername(name))[1]
      and e.user_id = auth.uid()
  )
);

commit;
