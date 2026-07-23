-- 00032_finance_intelligence.sql
-- Adds professional expense controls and a secure transaction-based finance intelligence RPC.

begin;

alter table public.expenses
  add column if not exists status text not null default 'paid',
  add column if not exists tax_amount numeric(10,2) not null default 0,
  add column if not exists currency text not null default 'EUR',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.expenses
    add constraint expenses_status_check
    check (status in ('paid', 'pending', 'cancelled'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.expenses
    add constraint expenses_tax_amount_check
    check (tax_amount >= 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.expenses
    add constraint expenses_currency_check
    check (currency ~ '^[A-Z]{3}$');
exception
  when duplicate_object then null;
end;
$$;

create index if not exists expenses_business_date_idx
  on public.expenses (business_id, date desc);

create index if not exists expenses_business_status_date_idx
  on public.expenses (business_id, status, date desc);

create or replace function public.set_expense_audit_fields()
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

drop trigger if exists expenses_set_updated_at on public.expenses;
drop trigger if exists expenses_set_audit_fields on public.expenses;
create trigger expenses_set_audit_fields
before insert or update on public.expenses
for each row
execute function public.set_expense_audit_fields();

alter table public.expenses enable row level security;

drop policy if exists "Members can manage expenses" on public.expenses;
drop policy if exists "Business members can manage expenses" on public.expenses;
create policy "Business members can manage expenses"
  on public.expenses
  for all
  to authenticated
  using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

revoke all on public.expenses from anon;
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

create or replace function public.get_finance_intelligence(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_transaction_count integer := 0;
  v_gross_sales numeric(14,2) := 0;
  v_item_discounts numeric(14,2) := 0;
  v_order_discounts numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_tips numeric(14,2) := 0;
  v_collected numeric(14,2) := 0;
  v_cogs numeric(14,2) := 0;
  v_paid_expenses numeric(14,2) := 0;
  v_pending_expenses numeric(14,2) := 0;
  v_voided_total numeric(14,2) := 0;
  v_net_sales numeric(14,2) := 0;
  v_gross_profit numeric(14,2) := 0;
  v_operating_profit numeric(14,2) := 0;
  v_average_ticket numeric(14,2) := 0;
  v_gross_margin numeric(10,2) := 0;
  v_payment_methods jsonb := '[]'::jsonb;
  v_daily_performance jsonb := '[]'::jsonb;
  v_item_mix jsonb := '[]'::jsonb;
  v_top_services jsonb := '[]'::jsonb;
  v_top_products jsonb := '[]'::jsonb;
  v_staff_performance jsonb := '[]'::jsonb;
  v_expense_categories jsonb := '[]'::jsonb;
  v_recent_expenses jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_business_access(p_business_id) then
    raise exception 'You do not have access to this business';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'A start date and an end date are required';
  end if;

  if p_end_date < p_start_date then
    raise exception 'The end date cannot be before the start date';
  end if;

  if p_end_date - p_start_date > 731 then
    raise exception 'The selected reporting period cannot exceed 732 days';
  end if;

  v_start := p_start_date::timestamptz;
  v_end := (p_end_date + 1)::timestamptz;

  select
    count(*)::integer,
    coalesce(sum(st.subtotal), 0),
    coalesce(sum(st.item_discount_amount), 0),
    coalesce(sum(st.order_discount_amount), 0),
    coalesce(sum(st.tax_amount), 0),
    coalesce(sum(st.tip_amount), 0),
    coalesce(sum(st.total_amount), 0)
  into
    v_transaction_count,
    v_gross_sales,
    v_item_discounts,
    v_order_discounts,
    v_tax,
    v_tips,
    v_collected
  from public.sale_transactions st
  where st.business_id = p_business_id
    and st.status = 'completed'
    and st.completed_at >= v_start
    and st.completed_at < v_end;

  select coalesce(sum(si.unit_cost * si.quantity), 0)
  into v_cogs
  from public.sale_items si
  join public.sale_transactions st on st.id = si.sale_id
  where st.business_id = p_business_id
    and st.status = 'completed'
    and st.completed_at >= v_start
    and st.completed_at < v_end;

  select
    coalesce(sum(case when e.status = 'paid' then e.amount else 0 end), 0),
    coalesce(sum(case when e.status = 'pending' then e.amount else 0 end), 0)
  into v_paid_expenses, v_pending_expenses
  from public.expenses e
  where e.business_id = p_business_id
    and e.date >= p_start_date
    and e.date <= p_end_date
    and e.status <> 'cancelled';

  select coalesce(sum(st.total_amount), 0)
  into v_voided_total
  from public.sale_transactions st
  where st.business_id = p_business_id
    and st.status = 'voided'
    and st.voided_at >= v_start
    and st.voided_at < v_end;

  v_net_sales := greatest(v_gross_sales - v_item_discounts - v_order_discounts, 0);
  v_gross_profit := v_net_sales - v_cogs;
  v_operating_profit := v_gross_profit - v_paid_expenses;
  v_average_ticket := case when v_transaction_count > 0 then v_collected / v_transaction_count else 0 end;
  v_gross_margin := case when v_net_sales > 0 then (v_gross_profit / v_net_sales) * 100 else 0 end;

  select coalesce(jsonb_agg(row_data order by total desc), '[]'::jsonb)
  into v_payment_methods
  from (
    select jsonb_build_object(
      'paymentMethod', sp.payment_method,
      'total', round(sum(sp.amount), 2),
      'transactions', count(distinct sp.sale_id)
    ) as row_data,
    sum(sp.amount) as total
    from public.sale_payments sp
    join public.sale_transactions st on st.id = sp.sale_id
    where st.business_id = p_business_id
      and st.status = 'completed'
      and sp.status = 'completed'
      and st.completed_at >= v_start
      and st.completed_at < v_end
    group by sp.payment_method
  ) payment_rows;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'revenue', round(coalesce(sales.total, 0), 2),
      'transactions', coalesce(sales.transactions, 0),
      'expenses', round(coalesce(expense_totals.total, 0), 2),
      'profit', round(coalesce(sales.net_sales, 0) - coalesce(sales.cogs, 0) - coalesce(expense_totals.total, 0), 2)
    ) order by days.day
  ), '[]'::jsonb)
  into v_daily_performance
  from generate_series(p_start_date, p_end_date, interval '1 day') as days(day)
  left join (
    select
      st.completed_at::date as day,
      sum(st.total_amount) as total,
      sum(st.subtotal - st.item_discount_amount - st.order_discount_amount) as net_sales,
      count(*)::integer as transactions,
      coalesce(sum(item_costs.cogs), 0) as cogs
    from public.sale_transactions st
    left join (
      select sale_id, sum(unit_cost * quantity) as cogs
      from public.sale_items
      group by sale_id
    ) item_costs on item_costs.sale_id = st.id
    where st.business_id = p_business_id
      and st.status = 'completed'
      and st.completed_at >= v_start
      and st.completed_at < v_end
    group by st.completed_at::date
  ) sales on sales.day = days.day::date
  left join (
    select e.date as day, sum(e.amount) as total
    from public.expenses e
    where e.business_id = p_business_id
      and e.status = 'paid'
      and e.date >= p_start_date
      and e.date <= p_end_date
    group by e.date
  ) expense_totals on expense_totals.day = days.day::date;

  select coalesce(jsonb_agg(row_data order by total desc), '[]'::jsonb)
  into v_item_mix
  from (
    select jsonb_build_object(
      'itemType', si.item_type,
      'total', round(sum(si.line_total), 2),
      'quantity', round(sum(si.quantity), 2)
    ) as row_data,
    sum(si.line_total) as total
    from public.sale_items si
    join public.sale_transactions st on st.id = si.sale_id
    where st.business_id = p_business_id
      and st.status = 'completed'
      and st.completed_at >= v_start
      and st.completed_at < v_end
    group by si.item_type
  ) item_rows;

  select coalesce(jsonb_agg(row_data order by total desc), '[]'::jsonb)
  into v_top_services
  from (
    select jsonb_build_object(
      'id', si.service_id,
      'name', max(si.description),
      'quantity', round(sum(si.quantity), 2),
      'revenue', round(sum(si.line_total), 2),
      'profit', round(sum(si.line_total - si.tax_amount - (si.unit_cost * si.quantity)), 2)
    ) as row_data,
    sum(si.line_total) as total
    from public.sale_items si
    join public.sale_transactions st on st.id = si.sale_id
    where st.business_id = p_business_id
      and st.status = 'completed'
      and si.item_type = 'service'
      and st.completed_at >= v_start
      and st.completed_at < v_end
    group by si.service_id
    order by total desc
    limit 10
  ) service_rows;

  select coalesce(jsonb_agg(row_data order by total desc), '[]'::jsonb)
  into v_top_products
  from (
    select jsonb_build_object(
      'id', si.product_id,
      'name', max(si.description),
      'quantity', round(sum(si.quantity), 2),
      'revenue', round(sum(si.line_total), 2),
      'cost', round(sum(si.unit_cost * si.quantity), 2),
      'profit', round(sum(si.line_total - si.tax_amount - (si.unit_cost * si.quantity)), 2)
    ) as row_data,
    sum(si.line_total) as total
    from public.sale_items si
    join public.sale_transactions st on st.id = si.sale_id
    where st.business_id = p_business_id
      and st.status = 'completed'
      and si.item_type = 'product'
      and st.completed_at >= v_start
      and st.completed_at < v_end
    group by si.product_id
    order by total desc
    limit 10
  ) product_rows;

  select coalesce(jsonb_agg(row_data order by total desc), '[]'::jsonb)
  into v_staff_performance
  from (
    select jsonb_build_object(
      'id', coalesce(si.employee_id, st.employee_id),
      'name', coalesce(max(emp.name), 'Unassigned'),
      'transactions', count(distinct st.id),
      'items', round(sum(si.quantity), 2),
      'revenue', round(sum(si.line_total), 2)
    ) as row_data,
    sum(si.line_total) as total
    from public.sale_items si
    join public.sale_transactions st on st.id = si.sale_id
    left join public.employees emp on emp.id = coalesce(si.employee_id, st.employee_id)
    where st.business_id = p_business_id
      and st.status = 'completed'
      and st.completed_at >= v_start
      and st.completed_at < v_end
    group by coalesce(si.employee_id, st.employee_id)
    order by total desc
    limit 20
  ) staff_rows;

  select coalesce(jsonb_agg(row_data order by total desc), '[]'::jsonb)
  into v_expense_categories
  from (
    select jsonb_build_object(
      'category', e.category,
      'total', round(sum(e.amount), 2),
      'count', count(*)
    ) as row_data,
    sum(e.amount) as total
    from public.expenses e
    where e.business_id = p_business_id
      and e.status = 'paid'
      and e.date >= p_start_date
      and e.date <= p_end_date
    group by e.category
  ) expense_rows;

  select coalesce(jsonb_agg(row_data order by expense_date desc, created_at desc), '[]'::jsonb)
  into v_recent_expenses
  from (
    select
      jsonb_build_object(
        'id', e.id,
        'category', e.category,
        'description', e.description,
        'supplier', e.supplier,
        'amount', e.amount,
        'taxAmount', e.tax_amount,
        'date', e.date,
        'receiptUrl', e.receipt_url,
        'paymentMethod', e.payment_method,
        'status', e.status,
        'currency', e.currency,
        'createdAt', e.created_at
      ) as row_data,
      e.date as expense_date,
      e.created_at
    from public.expenses e
    where e.business_id = p_business_id
      and e.date >= p_start_date
      and e.date <= p_end_date
    order by e.date desc, e.created_at desc
    limit 100
  ) recent_rows;

  return jsonb_build_object(
    'period', jsonb_build_object(
      'startDate', p_start_date,
      'endDate', p_end_date,
      'currency', 'EUR'
    ),
    'summary', jsonb_build_object(
      'transactionCount', v_transaction_count,
      'grossSales', round(v_gross_sales, 2),
      'discounts', round(v_item_discounts + v_order_discounts, 2),
      'netSales', round(v_net_sales, 2),
      'taxCollected', round(v_tax, 2),
      'tipsCollected', round(v_tips, 2),
      'collectedRevenue', round(v_collected, 2),
      'costOfGoods', round(v_cogs, 2),
      'grossProfit', round(v_gross_profit, 2),
      'paidExpenses', round(v_paid_expenses, 2),
      'pendingExpenses', round(v_pending_expenses, 2),
      'operatingProfit', round(v_operating_profit, 2),
      'averageTicket', round(v_average_ticket, 2),
      'grossMargin', round(v_gross_margin, 2),
      'voidedTotal', round(v_voided_total, 2)
    ),
    'paymentMethods', v_payment_methods,
    'dailyPerformance', v_daily_performance,
    'itemMix', v_item_mix,
    'topServices', v_top_services,
    'topProducts', v_top_products,
    'staffPerformance', v_staff_performance,
    'expenseCategories', v_expense_categories,
    'recentExpenses', v_recent_expenses
  );
end;
$$;

revoke all on function public.get_finance_intelligence(uuid, date, date) from public;
grant execute on function public.get_finance_intelligence(uuid, date, date) to authenticated;

commit;
