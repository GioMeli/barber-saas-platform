-- 00044_velliqo_public_discovery_marketplace.sql
-- Public marketplace discovery, safe business search, map coordinates and popularity ranking.

create extension if not exists postgis with schema extensions;

begin;

alter table public.businesses
  add column if not exists discovery_enabled boolean not null default true,
  add column if not exists discovery_location extensions.geography(Point, 4326);

comment on column public.businesses.discovery_enabled is
  'Controls whether an active public storefront appears in Velliqo marketplace discovery.';
comment on column public.businesses.discovery_location is
  'Tenant-owned public storefront location derived from latitude and longitude for geo discovery.';

create or replace function public.sync_business_discovery_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.latitude is not null
     and new.longitude is not null
     and new.latitude between -90 and 90
     and new.longitude between -180 and 180 then
    new.discovery_location := extensions.st_setsrid(
      extensions.st_makepoint(new.longitude::double precision, new.latitude::double precision),
      4326
    )::extensions.geography;
  else
    new.discovery_location := null;
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_sync_discovery_location on public.businesses;
create trigger businesses_sync_discovery_location
before insert or update of latitude, longitude
on public.businesses
for each row
execute function public.sync_business_discovery_location();

update public.businesses
set discovery_location = case
  when latitude is not null
    and longitude is not null
    and latitude between -90 and 90
    and longitude between -180 and 180
  then extensions.st_setsrid(
    extensions.st_makepoint(longitude::double precision, latitude::double precision),
    4326
  )::extensions.geography
  else null
end;

create index if not exists businesses_discovery_status_idx
  on public.businesses (status, discovery_enabled, industry_key);
create index if not exists businesses_discovery_city_idx
  on public.businesses (city, district, country);
create index if not exists businesses_discovery_location_gix
  on public.businesses using gist (discovery_location);

create or replace function public.get_public_discovery_facets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('value', location_value, 'label', location_value) order by location_value)
      from (
        select distinct location_value
        from (
          select nullif(btrim(city), '') as location_value
          from public.businesses
          where status = 'active' and discovery_enabled = true
          union all
          select nullif(btrim(district), '')
          from public.businesses
          where status = 'active' and discovery_enabled = true
          union all
          select nullif(btrim(country), '')
          from public.businesses
          where status = 'active' and discovery_enabled = true
        ) raw_locations
        where location_value is not null
        order by location_value
        limit 200
      ) locations
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('value', service_value, 'label', service_value, 'kind', service_kind) order by service_value)
      from (
        select distinct on (lower(service_value)) service_value, service_kind
        from (
          select nullif(btrim(s.name), '') as service_value, 'service'::text as service_kind
          from public.services s
          join public.businesses b on b.id = s.business_id
          where b.status = 'active'
            and b.discovery_enabled = true
            and s.is_active = true
            and s.online_booking_enabled = true
          union all
          select nullif(btrim(sc.name), ''), 'category'::text
          from public.service_categories sc
          join public.businesses b on b.id = sc.business_id
          where b.status = 'active'
            and b.discovery_enabled = true
            and exists (
              select 1
              from public.services category_service
              where category_service.category_id = sc.id
                and category_service.is_active = true
                and category_service.online_booking_enabled = true
            )
          union all
          select initcap(replace(b.industry_key, '_', ' ')), 'industry'::text
          from public.businesses b
          where b.status = 'active'
            and b.discovery_enabled = true
        ) raw_services
        where service_value is not null
        order by lower(service_value), service_value
        limit 300
      ) services
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_discovery_facets() from public;
grant execute on function public.get_public_discovery_facets() to anon, authenticated;

create or replace function public.search_public_business_suggestions(
  p_query text default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  slug text,
  name text,
  logo_url text,
  city text,
  district text,
  industry_key text,
  average_rating numeric,
  review_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with review_stats as (
    select
      r.business_id,
      round(avg(r.rating)::numeric, 2) as average_rating,
      count(*)::integer as review_count
    from public.business_reviews r
    where r.status = 'published'
    group by r.business_id
  )
  select
    b.id,
    b.slug,
    b.name,
    b.logo_url,
    b.city,
    b.district,
    b.industry_key,
    coalesce(rs.average_rating, 0::numeric),
    coalesce(rs.review_count, 0)
  from public.businesses b
  left join review_stats rs on rs.business_id = b.id
  where b.status = 'active'
    and b.discovery_enabled = true
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or b.name ilike '%' || btrim(p_query) || '%'
    )
  order by
    case
      when nullif(btrim(coalesce(p_query, '')), '') is not null
        and lower(b.name) = lower(btrim(p_query)) then 0
      when nullif(btrim(coalesce(p_query, '')), '') is not null
        and lower(b.name) like lower(btrim(p_query)) || '%' then 1
      else 2
    end,
    coalesce(rs.review_count, 0) desc,
    coalesce(rs.average_rating, 0) desc,
    b.name
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

revoke all on function public.search_public_business_suggestions(text, integer) from public;
grant execute on function public.search_public_business_suggestions(text, integer) to anon, authenticated;

create or replace function public.search_public_businesses(
  p_business_query text default null,
  p_location_query text default null,
  p_service_query text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  slug text,
  name text,
  logo_url text,
  cover_image_url text,
  description text,
  address text,
  city text,
  district text,
  country text,
  currency text,
  industry_key text,
  latitude numeric,
  longitude numeric,
  average_rating numeric,
  review_count integer,
  popularity_score integer,
  distance_meters double precision,
  service_names text[],
  price_from numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with input as (
    select
      nullif(btrim(coalesce(p_business_query, '')), '') as business_query,
      nullif(btrim(coalesce(p_location_query, '')), '') as location_query,
      nullif(btrim(coalesce(p_service_query, '')), '') as service_query,
      case
        when p_latitude between -90 and 90 and p_longitude between -180 and 180
        then extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
        else null::extensions.geography
      end as user_location
  ),
  review_stats as (
    select
      r.business_id,
      round(avg(r.rating)::numeric, 2) as average_rating,
      count(*)::integer as review_count
    from public.business_reviews r
    where r.status = 'published'
    group by r.business_id
  ),
  booking_stats as (
    select
      a.business_id,
      least(
        100,
        round(ln(count(distinct a.id)::numeric + 1) * 20)::integer
      ) as popularity_score
    from public.appointments a
    join public.businesses b on b.id = a.business_id
    cross join input i
    left join public.appointment_services aps on aps.appointment_id = a.id
    left join public.services s on s.id = aps.service_id
    left join public.service_categories sc on sc.id = s.category_id
    where a.created_at >= now() - interval '90 days'
      and a.status in ('confirmed', 'arrived', 'in_progress', 'completed', 'rescheduled')
      and (
        i.service_query is null
        or replace(b.industry_key, '_', ' ') ilike '%' || i.service_query || '%'
        or coalesce(s.name, '') ilike '%' || i.service_query || '%'
        or coalesce(sc.name, '') ilike '%' || i.service_query || '%'
      )
    group by a.business_id
  ),
  candidates as (
    select
      b.*,
      i.business_query,
      i.location_query,
      i.service_query,
      i.user_location,
      coalesce(rs.average_rating, 0::numeric) as average_rating_value,
      coalesce(rs.review_count, 0) as review_count_value,
      coalesce(bs.popularity_score, 0) as popularity_score_value,
      case
        when i.user_location is not null and b.discovery_location is not null
        then extensions.st_distance(b.discovery_location, i.user_location)
        else null
      end as distance_value
    from public.businesses b
    cross join input i
    left join review_stats rs on rs.business_id = b.id
    left join booking_stats bs on bs.business_id = b.id
    where b.status = 'active'
      and b.discovery_enabled = true
      and (
        i.business_query is null
        or b.name ilike '%' || i.business_query || '%'
      )
      and (
        i.location_query is null
        or concat_ws(' ', b.address, b.address_line_1, b.address_line_2, b.city, b.district, b.postal_code, b.country)
          ilike '%' || i.location_query || '%'
      )
      and (
        i.service_query is null
        or replace(b.industry_key, '_', ' ') ilike '%' || i.service_query || '%'
        or exists (
          select 1
          from public.services s
          left join public.service_categories sc on sc.id = s.category_id
          where s.business_id = b.id
            and s.is_active = true
            and s.online_booking_enabled = true
            and (
              s.name ilike '%' || i.service_query || '%'
              or coalesce(sc.name, '') ilike '%' || i.service_query || '%'
            )
        )
      )
  )
  select
    c.id,
    c.slug,
    c.name,
    c.logo_url,
    c.cover_image_url,
    c.description,
    coalesce(nullif(c.address, ''), nullif(c.address_line_1, '')) as address,
    c.city,
    c.district,
    c.country,
    c.currency,
    c.industry_key,
    c.latitude,
    c.longitude,
    c.average_rating_value,
    c.review_count_value,
    c.popularity_score_value,
    c.distance_value,
    coalesce((
      select array_agg(service_rows.name order by service_rows.match_rank, service_rows.name)
      from (
        select
          s.name,
          min(case
            when c.service_query is not null and (
              s.name ilike '%' || c.service_query || '%'
              or coalesce(sc.name, '') ilike '%' || c.service_query || '%'
            ) then 0
            else 1
          end) as match_rank
        from public.services s
        left join public.service_categories sc on sc.id = s.category_id
        where s.business_id = c.id
          and s.is_active = true
          and s.online_booking_enabled = true
        group by s.name
        order by match_rank, s.name
        limit 4
      ) service_rows
    ), '{}'::text[]) as service_names,
    (
      select min(s.price)
      from public.services s
      where s.business_id = c.id
        and s.is_active = true
        and s.online_booking_enabled = true
    ) as price_from
  from candidates c
  order by
    case
      when c.business_query is not null and lower(c.name) = lower(c.business_query) then 0
      when c.business_query is not null and lower(c.name) like lower(c.business_query) || '%' then 1
      else 2
    end,
    case
      when c.location_query is not null and (
        lower(coalesce(c.city, '')) = lower(c.location_query)
        or lower(coalesce(c.district, '')) = lower(c.location_query)
      ) then 0
      else 1
    end,
    case when c.user_location is not null then c.distance_value else null end asc nulls last,
    c.popularity_score_value desc,
    c.average_rating_value desc,
    c.review_count_value desc,
    c.name
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.search_public_businesses(text, text, text, double precision, double precision, integer) from public;
grant execute on function public.search_public_businesses(text, text, text, double precision, double precision, integer) to anon, authenticated;

commit;
