-- 00015_public_business_storefront_access.sql
-- Restore safe anonymous read access to active storefront data.
-- The public store page must work without the owner being signed in.

begin;

alter table public.businesses enable row level security;
alter table public.business_settings enable row level security;
alter table public.services enable row level security;
alter table public.employees enable row level security;

drop policy if exists "Public can view businesses" on public.businesses;
drop policy if exists "Public can view active businesses" on public.businesses;

create policy "Public can view active businesses"
on public.businesses
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "Public can view business_settings"
  on public.business_settings;
drop policy if exists "Public can view active business settings"
  on public.business_settings;

create policy "Public can view active business settings"
on public.business_settings
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_settings.business_id
      and b.status = 'active'
  )
);

drop policy if exists "Public can view services" on public.services;
drop policy if exists "Public can view active bookable services"
  on public.services;

create policy "Public can view active bookable services"
on public.services
for select
to anon, authenticated
using (
  is_active = true
  and online_booking_enabled = true
  and exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.status = 'active'
  )
);

drop policy if exists "Public can view employees" on public.employees;
drop policy if exists "Public can view active employees"
  on public.employees;

create policy "Public can view active employees"
on public.employees
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.businesses b
    where b.id = employees.business_id
      and b.status = 'active'
  )
);

commit;
