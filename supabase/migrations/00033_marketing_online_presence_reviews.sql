-- 00033_marketing_online_presence_reviews.sql
-- Marketing workspace, configurable online presence and verified customer reviews.

begin;

-- ---------------------------------------------------------------------------
-- 1. Marketing campaigns (drafting and scheduling foundation)
-- Delivery providers are intentionally not invoked from the browser.
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'in_app')),
  objective text not null default 'custom'
    check (objective in (
      'announcement',
      'promotion',
      'win_back',
      'birthday',
      'review_request',
      'last_minute',
      'custom'
    )),
  audience_segment text not null default 'all'
    check (audience_segment in (
      'all',
      'active',
      'at_risk',
      'vip',
      'new',
      'registered',
      'guests'
    )),
  subject text,
  message text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'paused', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  estimated_recipients integer not null default 0 check (estimated_recipients >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  converted_count integer not null default 0 check (converted_count >= 0),
  attributed_revenue numeric(12,2) not null default 0 check (attributed_revenue >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_business_created_idx
  on public.marketing_campaigns (business_id, created_at desc);

create index if not exists marketing_campaigns_business_status_idx
  on public.marketing_campaigns (business_id, status, scheduled_at);

create or replace function public.set_marketing_campaign_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_campaigns_set_audit_fields
  on public.marketing_campaigns;
create trigger marketing_campaigns_set_audit_fields
before insert or update on public.marketing_campaigns
for each row
execute function public.set_marketing_campaign_audit_fields();

alter table public.marketing_campaigns enable row level security;

drop policy if exists "Business members can manage marketing campaigns"
  on public.marketing_campaigns;
create policy "Business members can manage marketing campaigns"
on public.marketing_campaigns
for all
to authenticated
using (public.has_business_access(business_id))
with check (public.has_business_access(business_id));

revoke all on public.marketing_campaigns from anon;
grant select, insert, update, delete on public.marketing_campaigns to authenticated;
grant all on public.marketing_campaigns to service_role;

-- ---------------------------------------------------------------------------
-- 2. Marketing automation configuration.
-- These rows configure workflows. A trusted worker/provider performs delivery.
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  automation_key text not null
    check (automation_key in (
      'birthday',
      'win_back',
      'review_request',
      'no_show_recovery',
      'last_minute_availability'
    )),
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'in_app')),
  is_enabled boolean not null default false,
  delay_hours integer not null default 0 check (delay_hours between 0 and 8760),
  audience_filter jsonb not null default '{}'::jsonb,
  message_template text not null default '',
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, automation_key)
);

create index if not exists marketing_automations_business_idx
  on public.marketing_automations (business_id, is_enabled);

create or replace function public.set_marketing_automation_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_automations_set_audit_fields
  on public.marketing_automations;
create trigger marketing_automations_set_audit_fields
before insert or update on public.marketing_automations
for each row
execute function public.set_marketing_automation_audit_fields();

alter table public.marketing_automations enable row level security;

drop policy if exists "Business members can manage marketing automations"
  on public.marketing_automations;
create policy "Business members can manage marketing automations"
on public.marketing_automations
for all
to authenticated
using (public.has_business_access(business_id))
with check (public.has_business_access(business_id));

revoke all on public.marketing_automations from anon;
grant select, insert, update, delete on public.marketing_automations to authenticated;
grant all on public.marketing_automations to service_role;

-- ---------------------------------------------------------------------------
-- 3. Public business-page configuration.
-- ---------------------------------------------------------------------------

create table if not exists public.business_online_presence (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  seo_title text,
  seo_description text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  website_url text,
  booking_cta_label text,
  show_team boolean not null default true,
  show_products boolean not null default true,
  show_gallery boolean not null default true,
  show_reviews boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_business_online_presence_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_online_presence_set_updated_at
  on public.business_online_presence;
create trigger business_online_presence_set_updated_at
before update on public.business_online_presence
for each row
execute function public.set_business_online_presence_updated_at();

alter table public.business_online_presence enable row level security;

drop policy if exists "Public can view active business online presence"
  on public.business_online_presence;
create policy "Public can view active business online presence"
on public.business_online_presence
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_online_presence.business_id
      and b.status = 'active'
  )
);

drop policy if exists "Business members can manage online presence"
  on public.business_online_presence;
create policy "Business members can manage online presence"
on public.business_online_presence
for all
to authenticated
using (public.has_business_access(business_id))
with check (public.has_business_access(business_id));

revoke all on public.business_online_presence from anon, authenticated;
grant select on public.business_online_presence to anon, authenticated;
grant insert, update, delete on public.business_online_presence to authenticated;
grant all on public.business_online_presence to service_role;

-- ---------------------------------------------------------------------------
-- 4. Verified appointment reviews.
-- ---------------------------------------------------------------------------

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_display_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'hidden')),
  owner_response text,
  owner_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists business_reviews_public_idx
  on public.business_reviews (business_id, status, created_at desc);

create index if not exists business_reviews_user_idx
  on public.business_reviews (user_id, created_at desc);

create or replace function public.set_business_review_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_reviews_set_updated_at
  on public.business_reviews;
create trigger business_reviews_set_updated_at
before update on public.business_reviews
for each row
execute function public.set_business_review_updated_at();

alter table public.business_reviews enable row level security;

drop policy if exists "Public can view published business reviews"
  on public.business_reviews;

drop policy if exists "Customers can view their own reviews"
  on public.business_reviews;
create policy "Customers can view their own reviews"
on public.business_reviews
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Business members can view business reviews"
  on public.business_reviews;
create policy "Business members can view business reviews"
on public.business_reviews
for select
to authenticated
using (public.has_business_access(business_id));

-- Review writes are intentionally restricted to the security-definer RPCs below.
-- Business members receive read access, but cannot rewrite customer ratings directly.
revoke all on public.business_reviews from anon, authenticated;
grant select on public.business_reviews to authenticated;
grant all on public.business_reviews to service_role;

create or replace function public.get_public_business_reviews(
  p_business_id uuid
)
returns table (
  id uuid,
  business_id uuid,
  customer_display_name text,
  rating integer,
  title text,
  comment text,
  owner_response text,
  owner_responded_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.business_id,
    r.customer_display_name,
    r.rating,
    r.title,
    r.comment,
    r.owner_response,
    r.owner_responded_at,
    r.created_at
  from public.business_reviews r
  join public.businesses b on b.id = r.business_id
  where r.business_id = p_business_id
    and r.status = 'published'
    and b.status = 'active'
  order by r.created_at desc;
$$;

revoke all on function public.get_public_business_reviews(uuid) from public;
grant execute on function public.get_public_business_reviews(uuid) to anon, authenticated;

create or replace function public.submit_business_review(
  p_business_id uuid,
  p_appointment_id uuid,
  p_rating integer,
  p_title text default null,
  p_comment text default null
)
returns public.business_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_customer_name text;
  v_review public.business_reviews;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select a.customer_id, c.full_name
  into v_customer_id, v_customer_name
  from public.appointments a
  join public.customers c on c.id = a.customer_id
  where a.id = p_appointment_id
    and a.business_id = p_business_id
    and a.status = 'completed'
    and (
      c.user_id = v_user_id
      or exists (
        select 1
        from public.customer_business_profiles cbp
        where cbp.business_id = p_business_id
          and cbp.customer_id = c.id
          and cbp.user_id = v_user_id
      )
    );

  if v_customer_id is null then
    raise exception 'A completed appointment belonging to this customer is required';
  end if;

  insert into public.business_reviews (
    business_id,
    customer_id,
    appointment_id,
    user_id,
    customer_display_name,
    rating,
    title,
    comment,
    status,
    updated_at
  ) values (
    p_business_id,
    v_customer_id,
    p_appointment_id,
    v_user_id,
    coalesce(nullif(btrim(v_customer_name), ''), 'Verified customer'),
    p_rating,
    nullif(btrim(coalesce(p_title, '')), ''),
    nullif(btrim(coalesce(p_comment, '')), ''),
    'pending',
    now()
  )
  on conflict (appointment_id)
  do update set
    customer_display_name = excluded.customer_display_name,
    rating = excluded.rating,
    title = excluded.title,
    comment = excluded.comment,
    status = 'pending',
    updated_at = now()
  where business_reviews.user_id = v_user_id
  returning * into v_review;

  if v_review.id is null then
    raise exception 'This appointment review belongs to another account';
  end if;

  return v_review;
end;
$$;

revoke all on function public.submit_business_review(uuid, uuid, integer, text, text) from public;
grant execute on function public.submit_business_review(uuid, uuid, integer, text, text) to authenticated;

create or replace function public.owner_moderate_business_review(
  p_review_id uuid,
  p_status text,
  p_owner_response text default null
)
returns public.business_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.business_reviews;
begin
  if p_status not in ('pending', 'published', 'hidden') then
    raise exception 'Invalid review status';
  end if;

  select * into v_review
  from public.business_reviews
  where id = p_review_id;

  if v_review.id is null or not public.has_business_access(v_review.business_id) then
    raise exception 'Review not found or access denied';
  end if;

  update public.business_reviews
  set
    status = p_status,
    owner_response = nullif(btrim(coalesce(p_owner_response, '')), ''),
    owner_responded_at = case
      when nullif(btrim(coalesce(p_owner_response, '')), '') is null then null
      else now()
    end,
    updated_at = now()
  where id = p_review_id
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.owner_moderate_business_review(uuid, text, text) from public;
grant execute on function public.owner_moderate_business_review(uuid, text, text) to authenticated;

commit;
