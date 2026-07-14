-- 00013_store_customer_experience.sql
-- Optional customer accounts per business, storefront posts, gallery and map foundation.

begin;

-- ---------------------------------------------------------------------------
-- 1. Storefront fields
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists postal_code text;

alter table public.products
  add column if not exists description text,
  add column if not exists is_public boolean not null default true;

create index if not exists idx_products_public_business
  on public.products (business_id, is_public, is_active);

-- ---------------------------------------------------------------------------
-- 2. Customer profile scoped to one business
-- A user has one Supabase account, but a separate relationship/profile
-- for every barber shop or salon they choose to join.
-- ---------------------------------------------------------------------------

create table if not exists public.customer_business_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  display_name text,
  email text,
  phone text,
  marketing_consent boolean not null default false,
  email_notifications_enabled boolean not null default true,
  sms_notifications_enabled boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists idx_customer_business_profiles_user
  on public.customer_business_profiles (user_id);

create index if not exists idx_customer_business_profiles_business
  on public.customer_business_profiles (business_id);

alter table public.customer_business_profiles enable row level security;

drop policy if exists "Customers can view own business profiles"
  on public.customer_business_profiles;
create policy "Customers can view own business profiles"
on public.customer_business_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Customers can update own business profiles"
  on public.customer_business_profiles;
create policy "Customers can update own business profiles"
on public.customer_business_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Business members can view customer profiles"
  on public.customer_business_profiles;
create policy "Business members can view customer profiles"
on public.customer_business_profiles
for select
to authenticated
using (public.has_business_access(business_id));

-- Direct inserts are intentionally not allowed from the browser.
-- Membership creation is performed by the secure RPC below.

-- ---------------------------------------------------------------------------
-- 3. Store posts / announcements
-- ---------------------------------------------------------------------------

create table if not exists public.business_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  content text not null,
  post_type text not null default 'announcement'
    check (post_type in (
      'announcement',
      'holiday_closure',
      'promotion',
      'price_update',
      'new_product',
      'new_team_member',
      'general'
    )),
  audience text not null default 'public'
    check (audience in ('public', 'registered_customers')),
  cover_image_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_posts_feed
  on public.business_posts (business_id, is_published, published_at desc);

alter table public.business_posts enable row level security;

drop policy if exists "Public can view published public posts"
  on public.business_posts;
create policy "Public can view published public posts"
on public.business_posts
for select
to anon, authenticated
using (
  is_published = true
  and coalesce(published_at, created_at) <= now()
  and (expires_at is null or expires_at > now())
  and (
    audience = 'public'
    or (
      audience = 'registered_customers'
      and auth.uid() is not null
      and exists (
        select 1
        from public.customer_business_profiles cbp
        where cbp.business_id = business_posts.business_id
          and cbp.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "Business members can manage posts"
  on public.business_posts;
create policy "Business members can manage posts"
on public.business_posts
for all
to authenticated
using (public.has_business_access(business_id))
with check (
  public.has_business_access(business_id)
  and (author_user_id is null or author_user_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- 4. Store gallery
-- ---------------------------------------------------------------------------

create table if not exists public.business_gallery_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  image_url text not null,
  title text,
  caption text,
  alt_text text,
  display_order integer not null default 0,
  is_public boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_gallery_public
  on public.business_gallery_images (business_id, is_public, display_order);

alter table public.business_gallery_images enable row level security;

drop policy if exists "Public can view public gallery images"
  on public.business_gallery_images;
create policy "Public can view public gallery images"
on public.business_gallery_images
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "Business members can manage gallery"
  on public.business_gallery_images;
create policy "Business members can manage gallery"
on public.business_gallery_images
for all
to authenticated
using (public.has_business_access(business_id))
with check (
  public.has_business_access(business_id)
  and (created_by is null or created_by = auth.uid())
);

-- ---------------------------------------------------------------------------
-- 5. Secure RPC: join a specific business as an optional registered customer
-- Also links prior guest customer records that match the authenticated email
-- or the supplied phone number.
-- ---------------------------------------------------------------------------

create or replace function public.join_business_as_customer(
  p_business_id uuid,
  p_phone text default null
)
returns public.customer_business_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_name text;
  v_customer_id uuid;
  v_profile public.customer_business_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.status = 'active'
  ) then
    raise exception 'Business not found or inactive';
  end if;

  select
    coalesce(p.email, u.email),
    p.full_name
  into v_email, v_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_user_id;

  -- Prefer an already-linked customer record.
  select c.id
  into v_customer_id
  from public.customers c
  where c.business_id = p_business_id
    and c.user_id = v_user_id
  order by c.created_at
  limit 1;

  -- Claim a matching prior guest record only within this business.
  if v_customer_id is null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and c.user_id is null
      and (
        (v_email is not null and lower(c.email) = lower(v_email))
        or (
          p_phone is not null
          and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
              = regexp_replace(p_phone, '\D', '', 'g')
        )
      )
    order by c.created_at
    limit 1;

    if v_customer_id is not null then
      update public.customers
      set
        user_id = v_user_id,
        email = coalesce(email, v_email),
        phone = coalesce(phone, p_phone),
        updated_at = now()
      where id = v_customer_id;
    end if;
  end if;

  -- If no customer record exists, create one for this business.
  if v_customer_id is null then
    insert into public.customers (
      business_id,
      user_id,
      full_name,
      email,
      phone
    )
    values (
      p_business_id,
      v_user_id,
      coalesce(nullif(v_name, ''), split_part(coalesce(v_email, 'Customer'), '@', 1)),
      v_email,
      nullif(p_phone, '')
    )
    returning id into v_customer_id;
  end if;

  insert into public.customer_business_profiles (
    business_id,
    user_id,
    customer_id,
    display_name,
    email,
    phone
  )
  values (
    p_business_id,
    v_user_id,
    v_customer_id,
    v_name,
    v_email,
    nullif(p_phone, '')
  )
  on conflict (business_id, user_id)
  do update set
    customer_id = excluded.customer_id,
    display_name = coalesce(excluded.display_name, customer_business_profiles.display_name),
    email = coalesce(excluded.email, customer_business_profiles.email),
    phone = coalesce(excluded.phone, customer_business_profiles.phone),
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.join_business_as_customer(uuid, text) from public;
grant execute on function public.join_business_as_customer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Safe store-specific appointment history RPC
-- ---------------------------------------------------------------------------

create or replace function public.get_my_business_appointments(
  p_business_id uuid
)
returns table (
  appointment_id uuid,
  booking_reference text,
  start_time timestamptz,
  end_time timestamptz,
  status public.appointment_status,
  payment_status public.payment_status,
  total_price numeric,
  total_duration integer,
  employee_id uuid,
  employee_name text,
  services jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    coalesce(a.booking_reference, upper(substr(a.id::text, 1, 8))),
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.total_price,
    a.total_duration,
    e.id,
    e.name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'price', aps.price,
          'duration', aps.duration,
          'image_url', s.image_url
        )
        order by s.name
      ) filter (where aps.id is not null),
      '[]'::jsonb
    )
  from public.appointments a
  join public.customers c on c.id = a.customer_id
  left join public.employees e on e.id = a.employee_id
  left join public.appointment_services aps on aps.appointment_id = a.id
  left join public.services s on s.id = aps.service_id
  where a.business_id = p_business_id
    and c.user_id = auth.uid()
    and exists (
      select 1
      from public.customer_business_profiles cbp
      where cbp.business_id = p_business_id
        and cbp.user_id = auth.uid()
    )
  group by a.id, e.id, e.name
  order by a.start_time desc;
$$;

revoke all on function public.get_my_business_appointments(uuid) from public;
grant execute on function public.get_my_business_appointments(uuid) to authenticated;

commit;
