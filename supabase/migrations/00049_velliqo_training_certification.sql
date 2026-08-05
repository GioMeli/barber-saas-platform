-- 00049_velliqo_training_certification.sql
-- Persistent owner/staff training progress, assessment results and certificates.

begin;

create table if not exists public.training_certifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  audience text not null check (audience in ('owner', 'staff')),
  completed_lesson_ids text[] not null default '{}',
  latest_score integer check (latest_score is null or latest_score between 0 and 100),
  best_score integer check (best_score is null or best_score between 0 and 100),
  quiz_attempts integer not null default 0 check (quiz_attempts >= 0),
  passed boolean not null default false,
  certificate_number text,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, audience),
  check (
    (audience = 'owner' and employee_id is null)
    or
    (audience = 'staff' and employee_id is not null)
  ),
  check (
    passed = false
    or
    (
      best_score is not null
      and best_score >= 80
      and certificate_number is not null
      and certified_at is not null
      and (
        (audience = 'owner' and cardinality(completed_lesson_ids) >= 37)
        or
        (audience = 'staff' and cardinality(completed_lesson_ids) >= 12)
      )
    )
  )
);

create index if not exists training_certifications_business_idx
  on public.training_certifications (business_id, audience, updated_at desc);

create unique index if not exists training_certifications_certificate_number_uidx
  on public.training_certifications (certificate_number)
  where certificate_number is not null;

alter table public.training_certifications enable row level security;

revoke all on public.training_certifications from anon;
grant select, insert, update on public.training_certifications to authenticated;
grant all on public.training_certifications to service_role;

create or replace function public.is_training_owner(p_business_id uuid)
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

revoke all on function public.is_training_owner(uuid) from public;
grant execute on function public.is_training_owner(uuid) to authenticated, service_role;

create or replace function public.is_training_staff(p_business_id uuid, p_employee_id uuid)
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
      and e.business_id = p_business_id
      and e.user_id = auth.uid()
      and e.personal_access_enabled = true
      and e.personal_access_status in ('invited', 'active')
      and e.is_active = true
      and b.status = 'active'
  );
$$;

revoke all on function public.is_training_staff(uuid, uuid) from public;
grant execute on function public.is_training_staff(uuid, uuid) to authenticated, service_role;

drop policy if exists "Owners read own training certification" on public.training_certifications;
create policy "Owners read own training certification"
  on public.training_certifications
  for select
  to authenticated
  using (
    audience = 'owner'
    and user_id = auth.uid()
    and public.is_training_owner(business_id)
  );

drop policy if exists "Owners create own training certification" on public.training_certifications;
create policy "Owners create own training certification"
  on public.training_certifications
  for insert
  to authenticated
  with check (
    audience = 'owner'
    and employee_id is null
    and user_id = auth.uid()
    and public.is_training_owner(business_id)
  );

drop policy if exists "Owners update own training certification" on public.training_certifications;
create policy "Owners update own training certification"
  on public.training_certifications
  for update
  to authenticated
  using (
    audience = 'owner'
    and user_id = auth.uid()
    and public.is_training_owner(business_id)
  )
  with check (
    audience = 'owner'
    and employee_id is null
    and user_id = auth.uid()
    and public.is_training_owner(business_id)
  );

drop policy if exists "Staff read own training certification" on public.training_certifications;
create policy "Staff read own training certification"
  on public.training_certifications
  for select
  to authenticated
  using (
    audience = 'staff'
    and user_id = auth.uid()
    and employee_id is not null
    and public.is_training_staff(business_id, employee_id)
  );

drop policy if exists "Staff create own training certification" on public.training_certifications;
create policy "Staff create own training certification"
  on public.training_certifications
  for insert
  to authenticated
  with check (
    audience = 'staff'
    and user_id = auth.uid()
    and employee_id is not null
    and public.is_training_staff(business_id, employee_id)
  );

drop policy if exists "Staff update own training certification" on public.training_certifications;
create policy "Staff update own training certification"
  on public.training_certifications
  for update
  to authenticated
  using (
    audience = 'staff'
    and user_id = auth.uid()
    and employee_id is not null
    and public.is_training_staff(business_id, employee_id)
  )
  with check (
    audience = 'staff'
    and user_id = auth.uid()
    and employee_id is not null
    and public.is_training_staff(business_id, employee_id)
  );

commit;
