-- 00036_velliqo_ai_manager_foundation.sql
-- Zero-external-provider, read-only and tenant-isolated intelligence foundation for Velliqo AI.

begin;

alter table public.ai_settings
  add column if not exists proactive_insights boolean not null default true,
  add column if not exists daily_request_limit integer not null default 50,
  add column if not exists allow_write_actions boolean not null default false;

do $$
begin
  alter table public.ai_settings
    add constraint ai_settings_daily_request_limit_check
    check (daily_request_limit between 1 and 500);
exception
  when duplicate_object then null;
end;
$$;

-- The free engine operates only on aggregate data and never performs write actions.
update public.ai_settings
set allow_customer_data = false,
    allow_write_actions = false,
    updated_at = now();

alter table public.ai_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  agent_key text not null,
  category text not null check (
    category in ('business_health', 'finance', 'customers', 'scheduling', 'staff', 'services', 'inventory', 'marketing')
  ),
  severity text not null default 'info' check (severity in ('info', 'opportunity', 'warning', 'critical')),
  title text not null,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'reviewed', 'dismissed')),
  generated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists ai_insights_business_generated_idx
  on public.ai_insights (business_id, generated_at desc);

create index if not exists ai_insights_business_status_idx
  on public.ai_insights (business_id, status, generated_at desc);

alter table public.ai_insights enable row level security;

drop policy if exists "Business members can read AI insights" on public.ai_insights;
create policy "Business members can read AI insights"
  on public.ai_insights
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Business members can update AI insight status" on public.ai_insights;
create policy "Business members can update AI insight status"
  on public.ai_insights
  for update
  to authenticated
  using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

revoke all on public.ai_insights from anon;
grant select, update on public.ai_insights to authenticated;
grant all on public.ai_insights to service_role;

create or replace function public.get_ai_business_snapshot(
  p_business_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_days integer := greatest(7, least(coalesce(p_days, 30), 90));
  v_period_end date := current_date;
  v_period_start date;
  v_previous_start date;
  v_previous_end date;
  v_business jsonb := '{}'::jsonb;
  v_appointments jsonb := '{}'::jsonb;
  v_customers jsonb := '{}'::jsonb;
  v_staff jsonb := '[]'::jsonb;
  v_services jsonb := '[]'::jsonb;
  v_inventory jsonb := '{}'::jsonb;
  v_marketing jsonb := '{}'::jsonb;
  v_finance jsonb := '{}'::jsonb;
  v_previous_finance jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_business_id is null or not public.has_business_access(p_business_id) then
    raise exception 'You do not have access to this business';
  end if;

  v_period_start := v_period_end - (v_days - 1);
  v_previous_end := v_period_start - 1;
  v_previous_start := v_previous_end - (v_days - 1);

  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'industryKey', b.industry_key,
    'currency', coalesce(b.currency, 'EUR'),
    'timezone', coalesce(b.timezone, 'UTC'),
    'country', b.country
  )
  into v_business
  from public.businesses b
  where b.id = p_business_id;

  with period_appointments as (
    select a.*
    from public.appointments a
    where a.business_id = p_business_id
      and a.start_time >= v_period_start::timestamptz
      and a.start_time < (v_period_end + 1)::timestamptz
  ),
  upcoming as (
    select count(*)::integer as total
    from public.appointments a
    where a.business_id = p_business_id
      and a.start_time >= now()
      and a.start_time < now() + interval '7 days'
      and a.status::text not in ('cancelled_by_customer', 'cancelled_by_business', 'no_show')
  )
  select jsonb_build_object(
    'periodDays', v_days,
    'total', count(*)::integer,
    'completed', count(*) filter (where status::text = 'completed')::integer,
    'confirmed', count(*) filter (where status::text in ('confirmed', 'arrived', 'in_progress'))::integer,
    'cancelled', count(*) filter (where status::text in ('cancelled_by_customer', 'cancelled_by_business'))::integer,
    'noShows', count(*) filter (where status::text = 'no_show')::integer,
    'bookedMinutes', coalesce(sum(total_duration), 0)::integer,
    'appointmentValue', round(coalesce(sum(total_price), 0), 2),
    'completionRate', round(
      case when count(*) > 0
        then 100.0 * count(*) filter (where status::text = 'completed') / count(*)
        else 0 end,
      2
    ),
    'cancellationRate', round(
      case when count(*) > 0
        then 100.0 * count(*) filter (where status::text in ('cancelled_by_customer', 'cancelled_by_business')) / count(*)
        else 0 end,
      2
    ),
    'noShowRate', round(
      case when count(*) > 0
        then 100.0 * count(*) filter (where status::text = 'no_show') / count(*)
        else 0 end,
      2
    ),
    'nextSevenDays', (select total from upcoming)
  )
  into v_appointments
  from period_appointments;

  with customer_last_visit as (
    select
      c.id,
      c.user_id,
      c.created_at,
      max(a.start_time) filter (where a.status::text = 'completed') as last_completed_visit,
      count(a.id) filter (where a.status::text = 'completed')::integer as completed_visits,
      count(a.id) filter (where a.status::text = 'no_show')::integer as no_shows
    from public.customers c
    left join public.appointments a
      on a.customer_id = c.id
     and a.business_id = p_business_id
    where c.business_id = p_business_id
    group by c.id, c.user_id, c.created_at
  )
  select jsonb_build_object(
    'total', count(*)::integer,
    'registered', count(*) filter (where user_id is not null)::integer,
    'guests', count(*) filter (where user_id is null)::integer,
    'newInPeriod', count(*) filter (where created_at >= v_period_start::timestamptz)::integer,
    'active', count(*) filter (where last_completed_visit >= now() - interval '60 days')::integer,
    'atRisk', count(*) filter (
      where last_completed_visit < now() - interval '60 days'
        and last_completed_visit >= now() - interval '180 days'
    )::integer,
    'dormant', count(*) filter (where last_completed_visit < now() - interval '180 days')::integer,
    'customersWithNoShows', count(*) filter (where no_shows > 0)::integer,
    'returning', count(*) filter (where completed_visits >= 2)::integer,
    'returningRate', round(
      case when count(*) > 0
        then 100.0 * count(*) filter (where completed_visits >= 2) / count(*)
        else 0 end,
      2
    )
  )
  into v_customers
  from customer_last_visit;

  select coalesce(jsonb_agg(row_data order by booked_count desc, name), '[]'::jsonb)
  into v_staff
  from (
    select
      e.name,
      count(a.id)::integer as booked_count,
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'appointments', count(a.id)::integer,
        'completed', count(a.id) filter (where a.status::text = 'completed')::integer,
        'bookedMinutes', coalesce(sum(a.total_duration), 0)::integer,
        'appointmentValue', round(coalesce(sum(a.total_price), 0), 2),
        'completionRate', round(
          case when count(a.id) > 0
            then 100.0 * count(a.id) filter (where a.status::text = 'completed') / count(a.id)
            else 0 end,
          2
        )
      ) as row_data
    from public.employees e
    left join public.appointments a
      on a.employee_id = e.id
     and a.start_time >= v_period_start::timestamptz
     and a.start_time < (v_period_end + 1)::timestamptz
    where e.business_id = p_business_id
      and e.is_active = true
    group by e.id, e.name
    order by booked_count desc, e.name
    limit 20
  ) staff_rows;

  select coalesce(jsonb_agg(row_data order by bookings desc, name), '[]'::jsonb)
  into v_services
  from (
    select
      s.name,
      count(a.id)::integer as bookings,
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'bookings', count(a.id)::integer,
        'revenue', round(coalesce(sum(aps.price) filter (where a.id is not null), 0), 2),
        'minutes', coalesce(sum(aps.duration) filter (where a.id is not null), 0)::integer,
        'averageValue', round(
          case when count(a.id) > 0 then coalesce(sum(aps.price) filter (where a.id is not null), 0) / count(a.id) else 0 end,
          2
        )
      ) as row_data
    from public.services s
    left join public.appointment_services aps on aps.service_id = s.id
    left join public.appointments a
      on a.id = aps.appointment_id
     and a.business_id = p_business_id
     and a.start_time >= v_period_start::timestamptz
     and a.start_time < (v_period_end + 1)::timestamptz
    where s.business_id = p_business_id
      and s.is_active = true
    group by s.id, s.name
    order by bookings desc, s.name
    limit 10
  ) service_rows;

  select jsonb_build_object(
    'activeProducts', count(*) filter (where is_active = true)::integer,
    'lowStock', count(*) filter (where is_active = true and current_stock <= min_stock)::integer,
    'outOfStock', count(*) filter (where is_active = true and current_stock <= 0)::integer,
    'stockCostValue', round(coalesce(sum(cost_price * current_stock) filter (where is_active = true), 0), 2),
    'stockRetailValue', round(coalesce(sum(selling_price * current_stock) filter (where is_active = true), 0), 2),
    'lowStockItems', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', low.id,
          'name', low.name,
          'currentStock', low.current_stock,
          'minimumStock', low.min_stock
        ) order by low.current_stock asc, low.name)
        from (
          select id, name, current_stock, min_stock
          from public.products
          where business_id = p_business_id
            and is_active = true
            and current_stock <= min_stock
          order by current_stock asc, name
          limit 10
        ) low
      ),
      '[]'::jsonb
    )
  )
  into v_inventory
  from public.products
  where business_id = p_business_id;

  select jsonb_build_object(
    'campaignsInPeriod', count(*) filter (where created_at >= v_period_start::timestamptz)::integer,
    'scheduled', count(*) filter (where status = 'scheduled')::integer,
    'completed', count(*) filter (where status = 'completed')::integer,
    'sent', coalesce(sum(sent_count), 0)::integer,
    'delivered', coalesce(sum(delivered_count), 0)::integer,
    'converted', coalesce(sum(converted_count), 0)::integer,
    'attributedRevenue', round(coalesce(sum(attributed_revenue), 0), 2)
  )
  into v_marketing
  from public.marketing_campaigns
  where business_id = p_business_id;

  v_finance := public.get_finance_intelligence(p_business_id, v_period_start, v_period_end);
  v_previous_finance := public.get_finance_intelligence(p_business_id, v_previous_start, v_previous_end);

  return jsonb_build_object(
    'generatedAt', now(),
    'period', jsonb_build_object(
      'days', v_days,
      'startDate', v_period_start,
      'endDate', v_period_end,
      'previousStartDate', v_previous_start,
      'previousEndDate', v_previous_end
    ),
    'business', v_business,
    'appointments', v_appointments,
    'customers', v_customers,
    'staff', v_staff,
    'services', v_services,
    'inventory', v_inventory,
    'marketing', v_marketing,
    'finance', v_finance,
    'previousFinance', v_previous_finance,
    'privacy', jsonb_build_object(
      'containsCustomerNames', false,
      'containsCustomerContacts', false,
      'aggregationOnly', true
    )
  );
end;
$$;

comment on function public.get_ai_business_snapshot(uuid, integer)
is 'Returns tenant-isolated aggregate business intelligence for Velliqo AI. No customer names or contact details are included.';

revoke all on function public.get_ai_business_snapshot(uuid, integer) from public, anon;
grant execute on function public.get_ai_business_snapshot(uuid, integer) to authenticated;
grant execute on function public.get_ai_business_snapshot(uuid, integer) to service_role;

commit;
