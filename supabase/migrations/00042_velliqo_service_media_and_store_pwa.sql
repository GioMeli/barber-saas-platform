-- Phase 10C.2 — Premium customer storefront, service media and per-store PWA

alter table public.services
  add column if not exists image_path text;

alter table public.businesses
  add column if not exists pwa_enabled boolean not null default true,
  add column if not exists pwa_short_name text;

alter table public.businesses
  drop constraint if exists businesses_pwa_short_name_length_check;

alter table public.businesses
  add constraint businesses_pwa_short_name_length_check
  check (pwa_short_name is null or char_length(trim(pwa_short_name)) between 1 and 30);

alter table public.services
  drop constraint if exists services_image_path_business_scope_check;

alter table public.services
  add constraint services_image_path_business_scope_check
  check (
    image_path is null
    or split_part(image_path, '/', 1) = business_id::text
  );

create index if not exists services_business_image_path_idx
  on public.services (business_id, image_path)
  where image_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'services',
  'services',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Replace the legacy bucket-wide insert policy with tenant-scoped paths.
drop policy if exists "Authenticated users can upload services" on storage.objects;
drop policy if exists "Business members can upload service media" on storage.objects;
drop policy if exists "Business members can update service media" on storage.objects;
drop policy if exists "Business members can delete service media" on storage.objects;

create policy "Business members can upload service media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'services'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.has_business_access((storage.foldername(name))[1]::uuid)
    else false
  end
);

create policy "Business members can update service media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'services'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.has_business_access((storage.foldername(name))[1]::uuid)
    else false
  end
)
with check (
  bucket_id = 'services'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.has_business_access((storage.foldername(name))[1]::uuid)
    else false
  end
);

create policy "Business members can delete service media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'services'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.has_business_access((storage.foldername(name))[1]::uuid)
    else false
  end
);

comment on column public.services.image_path is
  'Tenant-scoped object path in the public services storage bucket.';
comment on column public.businesses.pwa_enabled is
  'Controls whether customers can install this storefront as a PWA.';
comment on column public.businesses.pwa_short_name is
  'Optional short installed-app label. Falls back to the business name.';
