-- 00048_velliqo_owner_product_tour.sql
-- Phase 11A: persistent, per-owner guided product-tour progress.

begin;

create table if not exists public.owner_tour_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  tour_key text not null default 'owner-full-v1',
  current_step integer not null default 0 check (current_step >= 0),
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, business_id, tour_key)
);

create index if not exists owner_tour_progress_business_idx
  on public.owner_tour_progress (business_id, updated_at desc);

alter table public.owner_tour_progress enable row level security;

revoke all on public.owner_tour_progress from anon;
grant select, insert, update, delete on public.owner_tour_progress to authenticated;
grant all on public.owner_tour_progress to service_role;

drop policy if exists "Owners read their product tour progress" on public.owner_tour_progress;
create policy "Owners read their product tour progress"
  on public.owner_tour_progress
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_business_access(business_id)
  );

drop policy if exists "Owners create their product tour progress" on public.owner_tour_progress;
create policy "Owners create their product tour progress"
  on public.owner_tour_progress
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.has_business_access(business_id)
  );

drop policy if exists "Owners update their product tour progress" on public.owner_tour_progress;
create policy "Owners update their product tour progress"
  on public.owner_tour_progress
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

drop policy if exists "Owners delete their product tour progress" on public.owner_tour_progress;
create policy "Owners delete their product tour progress"
  on public.owner_tour_progress
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_business_access(business_id)
  );

commit;
