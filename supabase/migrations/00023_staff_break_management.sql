-- 00023_staff_break_management.sql
-- Optional recurring staff breaks, protected by RLS and overlap validation.
-- Existing booking/reschedule/resize RPCs already read public.breaks.

begin;

alter table public.breaks
  add column if not exists business_id uuid references public.businesses(id) on delete cascade,
  add column if not exists label text not null default 'Break',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.breaks br
set business_id = e.business_id
from public.employees e
where e.id = br.employee_id
  and br.business_id is null;

alter table public.breaks
  alter column business_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'breaks_valid_time_range'
      and conrelid = 'public.breaks'::regclass
  ) then
    alter table public.breaks
      add constraint breaks_valid_time_range
      check (start_time < end_time);
  end if;
end $$;

create index if not exists breaks_business_day_idx
  on public.breaks (business_id, day_of_week);

create index if not exists breaks_employee_day_time_idx
  on public.breaks (employee_id, day_of_week, start_time, end_time);

create or replace function public.validate_staff_break()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_business_id uuid;
  v_work_start time;
  v_work_end time;
  v_is_closed boolean;
begin
  select e.business_id
  into v_employee_business_id
  from public.employees e
  where e.id = new.employee_id;

  if v_employee_business_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected staff member does not exist.';
  end if;

  if new.business_id <> v_employee_business_id then
    raise exception using
      errcode = '23514',
      message = 'The break and staff member must belong to the same business.';
  end if;

  if new.start_time >= new.end_time then
    raise exception using
      errcode = '22023',
      message = 'Break end time must be after its start time.';
  end if;

  select wh.start_time, wh.end_time, wh.is_closed
  into v_work_start, v_work_end, v_is_closed
  from public.working_hours wh
  where wh.business_id = new.business_id
    and wh.day_of_week = new.day_of_week
    and (wh.employee_id = new.employee_id or wh.employee_id is null)
  order by (wh.employee_id is not null) desc
  limit 1;

  if found then
    if coalesce(v_is_closed, false) then
      raise exception using
        errcode = '22023',
        message = 'A break cannot be added on a closed working day.';
    end if;

    if new.start_time < v_work_start or new.end_time > v_work_end then
      raise exception using
        errcode = '22023',
        message = 'The break must be inside the staff working hours.';
    end if;
  end if;

  if exists (
    select 1
    from public.breaks br
    where br.employee_id = new.employee_id
      and br.day_of_week = new.day_of_week
      and br.id <> coalesce(new.id, gen_random_uuid())
      and new.start_time < br.end_time
      and new.end_time > br.start_time
  ) then
    raise exception using
      errcode = '23P01',
      message = 'This break overlaps another break for the same staff member.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_staff_break_trigger on public.breaks;
create trigger validate_staff_break_trigger
before insert or update on public.breaks
for each row execute function public.validate_staff_break();

alter table public.breaks enable row level security;

drop policy if exists "Public can view breaks" on public.breaks;
drop policy if exists "Members can manage breaks" on public.breaks;
drop policy if exists "Public can read staff breaks" on public.breaks;
drop policy if exists "Business members can manage staff breaks" on public.breaks;

create policy "Public can read staff breaks"
on public.breaks
for select
using (true);

create policy "Business members can manage staff breaks"
on public.breaks
for all
to authenticated
using (public.has_business_access(business_id))
with check (
  public.has_business_access(business_id)
  and exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and e.business_id = business_id
  )
);

grant select on public.breaks to anon, authenticated;
grant insert, update, delete on public.breaks to authenticated;

commit;
