-- 00020_business_closures.sql
-- Whole-business closure periods and server-side availability blocking.
-- No service buffers are introduced.

begin;

create table if not exists public.business_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,

  title text not null,
  description text,
  start_date date not null,
  end_date date not null,

  audience text not null default 'registered_customers',
  linked_post_id uuid
    references public.business_posts(id) on delete set null,

  is_active boolean not null default true,
  created_by uuid
    references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_closures_date_check
    check (end_date >= start_date),

  constraint business_closures_audience_check
    check (
      audience in (
        'registered_customers',
        'public',
        'both'
      )
    )
);

create index if not exists business_closures_business_dates_idx
  on public.business_closures (
    business_id,
    start_date,
    end_date
  )
  where is_active = true;

create index if not exists business_closures_linked_post_idx
  on public.business_closures (linked_post_id)
  where linked_post_id is not null;

alter table public.business_closures enable row level security;

drop policy if exists "Business members can manage closures"
  on public.business_closures;

create policy "Business members can manage closures"
  on public.business_closures
  for all
  to authenticated
  using (public.has_business_access(business_id))
  with check (
    public.has_business_access(business_id)
    and (
      created_by is null
      or created_by = auth.uid()
    )
  );

drop policy if exists "Public can view active closures"
  on public.business_closures;

create policy "Public can view active closures"
  on public.business_closures
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.businesses b
      where b.id = business_closures.business_id
        and b.status = 'active'
    )
  );

grant select on public.business_closures to anon;
grant select, insert, update, delete on public.business_closures to authenticated;
grant all on public.business_closures to service_role;

create or replace function public.get_public_availability(
  p_business_id uuid,
  p_employee_id uuid,
  p_date date,
  p_service_ids uuid[]
)
returns table(
  employee_id uuid,
  available_time time without time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_timezone text;
  v_interval integer;
  v_min_notice integer;
  v_max_booking_period integer;
  v_duration integer;
  v_requested_service_count integer;
  v_valid_service_count integer;
  v_day_of_week integer;
  v_employee record;
  v_start_time time;
  v_end_time time;
  v_is_closed boolean;
  v_current_time time;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
begin
  if p_business_id is null
     or p_date is null
     or p_service_ids is null
     or cardinality(p_service_ids) = 0 then
    return;
  end if;

  -- A whole-business closure blocks all generated availability.
  if exists (
    select 1
    from public.business_closures bc
    where bc.business_id = p_business_id
      and bc.is_active = true
      and p_date between bc.start_date and bc.end_date
  ) then
    return;
  end if;

  select
    b.timezone,
    coalesce(bs.booking_interval, 30),
    coalesce(bs.min_booking_notice, 2),
    coalesce(bs.max_booking_period, 60)
  into
    v_timezone,
    v_interval,
    v_min_notice,
    v_max_booking_period
  from public.businesses b
  left join public.business_settings bs
    on bs.business_id = b.id
  where b.id = p_business_id
    and b.status = 'active';

  if not found then
    return;
  end if;

  v_timezone := coalesce(nullif(v_timezone, ''), 'UTC');
  v_requested_service_count := cardinality(p_service_ids);

  select
    count(distinct s.id),
    coalesce(sum(s.duration), 0)
  into
    v_valid_service_count,
    v_duration
  from public.services s
  where s.business_id = p_business_id
    and s.id = any(p_service_ids)
    and s.is_active = true
    and s.online_booking_enabled = true;

  if v_valid_service_count <> v_requested_service_count
     or v_duration <= 0 then
    return;
  end if;

  if p_date >
       ((now() at time zone v_timezone)::date + v_max_booking_period)
     or p_date < (now() at time zone v_timezone)::date then
    return;
  end if;

  v_day_of_week := extract(dow from p_date);

  for v_employee in
    select e.id
    from public.employees e
    where e.business_id = p_business_id
      and e.is_active = true
      and (
        p_employee_id is null
        or e.id = p_employee_id
      )
      and not (
        e.inactive_start_date is not null
        and e.inactive_end_date is not null
        and p_date between
          e.inactive_start_date
          and e.inactive_end_date
      )
      and not exists (
        select 1
        from unnest(p_service_ids) requested_service_id
        where not exists (
          select 1
          from public.employee_services es
          where es.employee_id = e.id
            and es.service_id = requested_service_id
        )
      )
      and not exists (
        select 1
        from public.time_off t
        where t.employee_id = e.id
          and t.status = 'approved'
          and p_date between t.start_date and t.end_date
      )
    order by e.id
  loop
    select
      wh.start_time,
      wh.end_time,
      wh.is_closed
    into
      v_start_time,
      v_end_time,
      v_is_closed
    from public.working_hours wh
    where wh.business_id = p_business_id
      and wh.day_of_week = v_day_of_week
      and (
        wh.employee_id = v_employee.id
        or wh.employee_id is null
      )
    order by (wh.employee_id is not null) desc
    limit 1;

    if not found or coalesce(v_is_closed, false) then
      continue;
    end if;

    v_current_time := v_start_time;

    while
      v_current_time + make_interval(mins => v_duration)
      <= v_end_time
    loop
      v_slot_start :=
        ((p_date + v_current_time) at time zone v_timezone);

      v_slot_end :=
        v_slot_start + make_interval(mins => v_duration);

      if
        v_slot_start >=
          now() + make_interval(hours => v_min_notice)
        and not exists (
          select 1
          from public.breaks br
          where br.employee_id = v_employee.id
            and br.day_of_week = v_day_of_week
            and v_current_time < br.end_time
            and (
              v_current_time
              + make_interval(mins => v_duration)
            ) > br.start_time
        )
        and not exists (
          select 1
          from public.appointments a
          where a.business_id = p_business_id
            and a.employee_id = v_employee.id
            and a.status not in (
              'cancelled_by_customer',
              'cancelled_by_business',
              'no_show',
              'rescheduled'
            )
            and a.start_time < v_slot_end
            and a.end_time > v_slot_start
        )
      then
        employee_id := v_employee.id;
        available_time := v_current_time;
        return next;
      end if;

      v_current_time :=
        v_current_time + make_interval(mins => v_interval);
    end loop;
  end loop;
end;
$$;

revoke all on function public.get_public_availability(
  uuid,
  uuid,
  date,
  uuid[]
) from public;

grant execute on function public.get_public_availability(
  uuid,
  uuid,
  date,
  uuid[]
) to anon, authenticated, service_role;

commit;
