-- 00025_customer_crm.sql
begin;

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  appointment_id uuid null references public.appointments(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  type text not null check (
    type in (
      'formula',
      'general_note',
      'allergy',
      'preferred_style',
      'product',
      'consultation',
      'before_after',
      'other'
    )
  ),
  title text not null,
  content text null,
  formula_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_record_images (
  id uuid primary key default gen_random_uuid(),
  customer_record_id uuid not null references public.customer_records(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null,
  caption text null,
  created_at timestamptz not null default now()
);

create index if not exists customer_records_business_customer_idx
  on public.customer_records (business_id, customer_id, created_at desc);

create index if not exists customer_record_images_record_idx
  on public.customer_record_images (customer_record_id);

alter table public.customer_records enable row level security;
alter table public.customer_record_images enable row level security;

drop policy if exists "Business members can read customer records"
  on public.customer_records;
create policy "Business members can read customer records"
  on public.customer_records
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Business members can create customer records"
  on public.customer_records;
create policy "Business members can create customer records"
  on public.customer_records
  for insert
  to authenticated
  with check (public.has_business_access(business_id));

drop policy if exists "Business members can update customer records"
  on public.customer_records;
create policy "Business members can update customer records"
  on public.customer_records
  for update
  to authenticated
  using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

drop policy if exists "Business members can delete customer records"
  on public.customer_records;
create policy "Business members can delete customer records"
  on public.customer_records
  for delete
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Business members can read record images"
  on public.customer_record_images;
create policy "Business members can read record images"
  on public.customer_record_images
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Business members can create record images"
  on public.customer_record_images;
create policy "Business members can create record images"
  on public.customer_record_images
  for insert
  to authenticated
  with check (public.has_business_access(business_id));

drop policy if exists "Business members can delete record images"
  on public.customer_record_images;
create policy "Business members can delete record images"
  on public.customer_record_images
  for delete
  to authenticated
  using (public.has_business_access(business_id));

insert into storage.buckets (id, name, public)
values ('customer-records', 'customer-records', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Business members can upload customer record files"
  on storage.objects;
create policy "Business members can upload customer record files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'customer-records'
    and public.has_business_access(
      nullif((storage.foldername(name))[1], '')::uuid
    )
  );

drop policy if exists "Business members can delete customer record files"
  on storage.objects;
create policy "Business members can delete customer record files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'customer-records'
    and public.has_business_access(
      nullif((storage.foldername(name))[1], '')::uuid
    )
  );

commit;
