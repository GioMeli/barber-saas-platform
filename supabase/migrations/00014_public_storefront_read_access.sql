-- 00014_public_storefront_read_access.sql
-- Allow anonymous visitors to read only products explicitly published by the owner.
-- This fixes the storefront failing when the owner is not signed in.

begin;

alter table public.products enable row level security;

drop policy if exists "Public can view published products"
  on public.products;

create policy "Public can view published products"
on public.products
for select
to anon, authenticated
using (
  is_active = true
  and is_public = true
  and exists (
    select 1
    from public.businesses b
    where b.id = products.business_id
      and b.status = 'active'
  )
);

commit;
