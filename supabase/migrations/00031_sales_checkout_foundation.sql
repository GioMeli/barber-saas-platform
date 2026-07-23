-- 00031_sales_checkout_foundation.sql
-- Production-grade in-store checkout foundation for Velliqo.
-- Keeps the legacy public.sales table intact for backwards compatibility.

begin;

create table if not exists public.sale_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  receipt_number text not null,
  status text not null default 'completed',
  currency text not null default 'EUR',
  subtotal numeric(12,2) not null default 0,
  item_discount_amount numeric(12,2) not null default 0,
  order_discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  tip_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sale_transactions_status_check
    check (status in ('completed', 'voided', 'partially_refunded', 'refunded')),
  constraint sale_transactions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint sale_transactions_amounts_check
    check (
      subtotal >= 0
      and item_discount_amount >= 0
      and order_discount_amount >= 0
      and tax_amount >= 0
      and tip_amount >= 0
      and total_amount >= 0
      and paid_amount >= 0
    ),
  constraint sale_transactions_receipt_unique
    unique (business_id, receipt_number)
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sale_transactions(id) on delete cascade,
  item_type text not null,
  service_id uuid references public.services(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate numeric(6,3) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint sale_items_type_check
    check (item_type in ('service', 'product', 'custom')),
  constraint sale_items_quantity_check
    check (quantity > 0),
  constraint sale_items_amounts_check
    check (
      unit_price >= 0
      and unit_cost >= 0
      and discount_amount >= 0
      and tax_rate >= 0
      and tax_rate <= 100
      and tax_amount >= 0
      and line_total >= 0
    ),
  constraint sale_items_source_check
    check (
      (item_type = 'service' and service_id is not null and product_id is null)
      or (item_type = 'product' and product_id is not null and service_id is null)
      or (item_type = 'custom' and service_id is null and product_id is null)
    )
);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sale_transactions(id) on delete cascade,
  payment_method text not null,
  amount numeric(12,2) not null,
  status text not null default 'completed',
  provider text,
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint sale_payments_method_check
    check (
      payment_method in (
        'cash',
        'card',
        'bank_transfer',
        'online',
        'gift_card',
        'other'
      )
    ),
  constraint sale_payments_status_check
    check (status in ('completed', 'refunded', 'failed', 'cancelled')),
  constraint sale_payments_amount_check
    check (amount > 0)
);

create table if not exists public.sale_voids (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sale_transactions(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reason text not null,
  amount numeric(12,2) not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint sale_voids_amount_check check (amount >= 0)
);

create index if not exists sale_transactions_business_completed_idx
  on public.sale_transactions (business_id, completed_at desc);

create index if not exists sale_transactions_business_status_idx
  on public.sale_transactions (business_id, status, completed_at desc);

create index if not exists sale_transactions_customer_idx
  on public.sale_transactions (customer_id, completed_at desc)
  where customer_id is not null;

create index if not exists sale_transactions_appointment_idx
  on public.sale_transactions (appointment_id, completed_at desc)
  where appointment_id is not null;

create index if not exists sale_items_sale_idx
  on public.sale_items (sale_id);

create index if not exists sale_items_product_idx
  on public.sale_items (product_id, created_at desc)
  where product_id is not null;

create index if not exists sale_payments_sale_idx
  on public.sale_payments (sale_id);

create index if not exists sale_voids_sale_idx
  on public.sale_voids (sale_id);

create or replace function public.set_sale_transaction_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sale_transactions_set_updated_at
  on public.sale_transactions;

create trigger sale_transactions_set_updated_at
before update on public.sale_transactions
for each row
execute function public.set_sale_transaction_updated_at();

alter table public.sale_transactions enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.sale_voids enable row level security;

drop policy if exists "Business members can view sale transactions"
  on public.sale_transactions;
create policy "Business members can view sale transactions"
  on public.sale_transactions
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Business members can view sale items"
  on public.sale_items;
create policy "Business members can view sale items"
  on public.sale_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sale_transactions st
      where st.id = sale_items.sale_id
        and public.has_business_access(st.business_id)
    )
  );

drop policy if exists "Business members can view sale payments"
  on public.sale_payments;
create policy "Business members can view sale payments"
  on public.sale_payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sale_transactions st
      where st.id = sale_payments.sale_id
        and public.has_business_access(st.business_id)
    )
  );

drop policy if exists "Business members can view sale voids"
  on public.sale_voids;
create policy "Business members can view sale voids"
  on public.sale_voids
  for select
  to authenticated
  using (public.has_business_access(business_id));

revoke all on public.sale_transactions from anon, authenticated;
revoke all on public.sale_items from anon, authenticated;
revoke all on public.sale_payments from anon, authenticated;
revoke all on public.sale_voids from anon, authenticated;

grant select on public.sale_transactions to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.sale_payments to authenticated;
grant select on public.sale_voids to authenticated;

grant all on public.sale_transactions to service_role;
grant all on public.sale_items to service_role;
grant all on public.sale_payments to service_role;
grant all on public.sale_voids to service_role;

create or replace function public.complete_business_sale(
  p_business_id uuid,
  p_customer_id uuid default null,
  p_appointment_id uuid default null,
  p_employee_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_payments jsonb default '[]'::jsonb,
  p_order_discount_amount numeric default 0,
  p_tip_amount numeric default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale_id uuid;
  v_receipt_number text;
  v_daily_sequence integer;
  v_subtotal numeric(12,2) := 0;
  v_item_discount_total numeric(12,2) := 0;
  v_order_discount numeric(12,2) := greatest(coalesce(p_order_discount_amount, 0), 0);
  v_tax_total numeric(12,2) := 0;
  v_taxable_base numeric(12,2) := 0;
  v_order_discount_ratio numeric := 0;
  v_allocated_order_discount numeric(12,2) := 0;
  v_tip numeric(12,2) := greatest(coalesce(p_tip_amount, 0), 0);
  v_total numeric(12,2) := 0;
  v_paid_total numeric(12,2) := 0;
  v_item jsonb;
  v_payment jsonb;
  v_item_type text;
  v_source_id uuid;
  v_item_employee_id uuid;
  v_description text;
  v_quantity numeric(10,2);
  v_unit_price numeric(12,2);
  v_unit_cost numeric(12,2);
  v_line_discount numeric(12,2);
  v_tax_rate numeric(6,3);
  v_line_subtotal numeric(12,2);
  v_line_tax numeric(12,2);
  v_line_total numeric(12,2);
  v_payment_method text;
  v_payment_amount numeric(12,2);
  v_product_stock integer;
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_business_access(p_business_id) then
    raise exception 'You do not have access to this business';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one sale item is required';
  end if;

  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'At least one payment is required';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers
    where id = p_customer_id and business_id = p_business_id
  ) then
    raise exception 'The selected customer does not belong to this business';
  end if;

  if p_employee_id is not null and not exists (
    select 1 from public.employees
    where id = p_employee_id and business_id = p_business_id
  ) then
    raise exception 'The selected professional does not belong to this business';
  end if;

  if p_appointment_id is not null then
    perform 1
    from public.appointments
    where id = p_appointment_id
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'The selected appointment does not belong to this business';
    end if;

    if exists (
      select 1
      from public.appointments
      where id = p_appointment_id
        and business_id = p_business_id
        and payment_status = 'paid'
    ) or exists (
      select 1
      from public.sale_transactions
      where appointment_id = p_appointment_id
        and business_id = p_business_id
        and status = 'completed'
    ) then
      raise exception 'The selected appointment has already been paid';
    end if;
  end if;

  -- Lock receipt generation for this business and day.
  perform pg_advisory_xact_lock(
    hashtext(p_business_id::text),
    hashtext(current_date::text)
  );

  select count(*) + 1
  into v_daily_sequence
  from public.sale_transactions
  where business_id = p_business_id
    and completed_at >= current_date
    and completed_at < current_date + interval '1 day';

  v_receipt_number :=
    'VQ-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_daily_sequence::text, 4, '0');

  -- Validate and calculate the full basket with server-side prices.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_type := lower(coalesce(v_item->>'item_type', ''));
    v_quantity := round(coalesce((v_item->>'quantity')::numeric, 1), 2);
    v_line_discount := round(greatest(coalesce((v_item->>'discount_amount')::numeric, 0), 0), 2);
    v_tax_rate := round(greatest(coalesce((v_item->>'tax_rate')::numeric, 0), 0), 3);

    if v_item_type not in ('service', 'product', 'custom') then
      raise exception 'Unsupported sale item type: %', v_item_type;
    end if;

    if v_quantity <= 0 then
      raise exception 'Sale item quantity must be greater than zero';
    end if;

    if v_tax_rate > 100 then
      raise exception 'Tax rate cannot exceed 100 percent';
    end if;

    v_item_employee_id := nullif(v_item->>'employee_id', '')::uuid;
    if v_item_employee_id is not null and not exists (
      select 1
      from public.employees
      where id = v_item_employee_id
        and business_id = p_business_id
    ) then
      raise exception 'A selected item professional does not belong to this business';
    end if;

    if v_item_type = 'service' then
      v_source_id := nullif(v_item->>'source_id', '')::uuid;
      select service.name, service.price, 0
      into v_description, v_unit_price, v_unit_cost
      from public.services service
      where service.id = v_source_id
        and service.business_id = p_business_id;

      if not found then
        raise exception 'Selected service is unavailable';
      end if;
    elsif v_item_type = 'product' then
      v_source_id := nullif(v_item->>'source_id', '')::uuid;
      select product.name, product.selling_price, product.cost_price, product.current_stock
      into v_description, v_unit_price, v_unit_cost, v_product_stock
      from public.products product
      where product.id = v_source_id
        and product.business_id = p_business_id
        and product.is_active = true
      for update;

      if not found then
        raise exception 'Selected product is unavailable';
      end if;

      if v_quantity <> trunc(v_quantity) then
        raise exception 'Product quantities must be whole numbers';
      end if;

      if v_product_stock < v_quantity then
        raise exception 'Insufficient stock for %', v_description;
      end if;
    else
      v_source_id := null;
      v_description := btrim(coalesce(v_item->>'description', ''));
      v_unit_price := round(greatest(coalesce((v_item->>'unit_price')::numeric, 0), 0), 2);
      v_unit_cost := 0;

      if v_description = '' then
        raise exception 'Custom sale items require a description';
      end if;
    end if;

    v_line_subtotal := round(v_quantity * v_unit_price, 2);

    if v_line_discount > v_line_subtotal then
      raise exception 'Item discount cannot exceed the item subtotal';
    end if;

    v_line_tax := round((v_line_subtotal - v_line_discount) * v_tax_rate / 100, 2);
    v_line_total := round(v_line_subtotal - v_line_discount + v_line_tax, 2);

    v_subtotal := v_subtotal + v_line_subtotal;
    v_item_discount_total := v_item_discount_total + v_line_discount;
    v_taxable_base := v_taxable_base + (v_line_subtotal - v_line_discount);
    v_tax_total := v_tax_total + v_line_tax;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_item_discount_total := round(v_item_discount_total, 2);
  v_taxable_base := round(v_taxable_base, 2);
  v_tax_total := round(v_tax_total, 2);

  if v_order_discount > v_taxable_base then
    raise exception 'Order discount cannot exceed the basket subtotal';
  end if;

  if v_taxable_base > 0 then
    v_order_discount_ratio := least(v_order_discount / v_taxable_base, 1);
    v_tax_total := round(v_tax_total * (1 - v_order_discount_ratio), 2);
  else
    v_tax_total := 0;
  end if;

  v_total := round(
    v_taxable_base - v_order_discount + v_tax_total + v_tip,
    2
  );

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_payment_method := lower(coalesce(v_payment->>'payment_method', ''));
    v_payment_amount := round(coalesce((v_payment->>'amount')::numeric, 0), 2);

    if v_payment_method not in (
      'cash', 'card', 'bank_transfer', 'online', 'gift_card', 'other'
    ) then
      raise exception 'Unsupported payment method: %', v_payment_method;
    end if;

    if v_payment_amount <= 0 then
      raise exception 'Payment amounts must be greater than zero';
    end if;

    v_paid_total := v_paid_total + v_payment_amount;
  end loop;

  v_paid_total := round(v_paid_total, 2);

  if abs(v_paid_total - v_total) > 0.01 then
    raise exception 'Payment total (%) must equal sale total (%)', v_paid_total, v_total;
  end if;

  insert into public.sale_transactions (
    business_id,
    customer_id,
    appointment_id,
    employee_id,
    receipt_number,
    status,
    currency,
    subtotal,
    item_discount_amount,
    order_discount_amount,
    tax_amount,
    tip_amount,
    total_amount,
    paid_amount,
    notes,
    created_by
  ) values (
    p_business_id,
    p_customer_id,
    p_appointment_id,
    p_employee_id,
    v_receipt_number,
    'completed',
    'EUR',
    v_subtotal,
    v_item_discount_total,
    v_order_discount,
    v_tax_total,
    v_tip,
    v_total,
    v_paid_total,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_profile_id
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_type := lower(coalesce(v_item->>'item_type', ''));
    v_quantity := round(coalesce((v_item->>'quantity')::numeric, 1), 2);
    v_line_discount := round(greatest(coalesce((v_item->>'discount_amount')::numeric, 0), 0), 2);
    v_tax_rate := round(greatest(coalesce((v_item->>'tax_rate')::numeric, 0), 0), 3);
    v_item_employee_id := nullif(v_item->>'employee_id', '')::uuid;

    if v_item_type = 'service' then
      v_source_id := nullif(v_item->>'source_id', '')::uuid;
      select service.name, service.price, 0
      into v_description, v_unit_price, v_unit_cost
      from public.services service
      where service.id = v_source_id
        and service.business_id = p_business_id;
    elsif v_item_type = 'product' then
      v_source_id := nullif(v_item->>'source_id', '')::uuid;
      select product.name, product.selling_price, product.cost_price
      into v_description, v_unit_price, v_unit_cost
      from public.products product
      where product.id = v_source_id
        and product.business_id = p_business_id;
    else
      v_source_id := null;
      v_description := btrim(coalesce(v_item->>'description', ''));
      v_unit_price := round(greatest(coalesce((v_item->>'unit_price')::numeric, 0), 0), 2);
      v_unit_cost := 0;
    end if;

    v_line_subtotal := round(v_quantity * v_unit_price, 2);
    v_allocated_order_discount := case
      when v_taxable_base > 0
        then round(v_order_discount * ((v_line_subtotal - v_line_discount) / v_taxable_base), 2)
      else 0
    end;
    v_line_tax := round(
      greatest(v_line_subtotal - v_line_discount - v_allocated_order_discount, 0)
        * v_tax_rate / 100,
      2
    );
    v_line_total := round(
      v_line_subtotal - v_line_discount - v_allocated_order_discount + v_line_tax,
      2
    );

    insert into public.sale_items (
      sale_id,
      item_type,
      service_id,
      product_id,
      employee_id,
      description,
      quantity,
      unit_price,
      unit_cost,
      discount_amount,
      tax_rate,
      tax_amount,
      line_total,
      metadata
    ) values (
      v_sale_id,
      v_item_type,
      case when v_item_type = 'service' then v_source_id else null end,
      case when v_item_type = 'product' then v_source_id else null end,
      coalesce(v_item_employee_id, p_employee_id),
      v_description,
      v_quantity,
      v_unit_price,
      v_unit_cost,
      v_line_discount,
      v_tax_rate,
      v_line_tax,
      v_line_total,
      coalesce(v_item->'metadata', '{}'::jsonb)
        || jsonb_build_object('allocated_order_discount', v_allocated_order_discount)
    );

    if v_item_type = 'product' then
      update public.products
      set current_stock = current_stock - v_quantity::integer,
          updated_at = now()
      where id = v_source_id
        and business_id = p_business_id;

      insert into public.stock_movements (
        product_id,
        quantity,
        type,
        reason,
        notes,
        created_by
      ) values (
        v_source_id,
        -(v_quantity::integer),
        'sale',
        'Checkout ' || v_receipt_number,
        nullif(btrim(coalesce(p_notes, '')), ''),
        v_profile_id
      );
    end if;
  end loop;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_payment_method := lower(coalesce(v_payment->>'payment_method', ''));
    v_payment_amount := round(coalesce((v_payment->>'amount')::numeric, 0), 2);

    insert into public.sale_payments (
      sale_id,
      payment_method,
      amount,
      status,
      provider,
      reference
    ) values (
      v_sale_id,
      v_payment_method,
      v_payment_amount,
      'completed',
      nullif(btrim(coalesce(v_payment->>'provider', '')), ''),
      nullif(btrim(coalesce(v_payment->>'reference', '')), '')
    );
  end loop;

  -- Maintain the original table for backwards-compatible exports and integrations.
  insert into public.sales (
    business_id,
    appointment_id,
    amount,
    type,
    payment_method,
    date
  ) values (
    p_business_id,
    p_appointment_id,
    v_total,
    'checkout',
    coalesce(p_payments->0->>'payment_method', 'other'),
    now()
  );

  if p_appointment_id is not null then
    update public.appointments
    set payment_status = 'paid',
        updated_at = now()
    where id = p_appointment_id
      and business_id = p_business_id;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'receipt_number', v_receipt_number,
    'subtotal', v_subtotal,
    'discount_amount', v_item_discount_total + v_order_discount,
    'tax_amount', v_tax_total,
    'tip_amount', v_tip,
    'total_amount', v_total,
    'paid_amount', v_paid_total
  );
end;
$$;

create or replace function public.void_business_sale(
  p_sale_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sale_transactions%rowtype;
  v_item record;
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into v_sale
  from public.sale_transactions
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale was not found';
  end if;

  if not public.has_business_access(v_sale.business_id) then
    raise exception 'You do not have access to this sale';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Only completed sales can be voided';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A void reason is required';
  end if;

  for v_item in
    select product_id, quantity, description
    from public.sale_items
    where sale_id = p_sale_id
      and item_type = 'product'
      and product_id is not null
  loop
    update public.products
    set current_stock = current_stock + v_item.quantity::integer,
        updated_at = now()
    where id = v_item.product_id
      and business_id = v_sale.business_id;

    insert into public.stock_movements (
      product_id,
      quantity,
      type,
      reason,
      created_by
    ) values (
      v_item.product_id,
      v_item.quantity::integer,
      'return',
      'Voided checkout ' || v_sale.receipt_number,
      v_profile_id
    );
  end loop;

  update public.sale_transactions
  set status = 'voided',
      voided_at = now(),
      voided_by = v_profile_id,
      void_reason = btrim(p_reason),
      updated_at = now()
  where id = p_sale_id;

  insert into public.sale_voids (
    sale_id,
    business_id,
    reason,
    amount,
    created_by
  ) values (
    p_sale_id,
    v_sale.business_id,
    btrim(p_reason),
    v_sale.total_amount,
    v_profile_id
  );

  insert into public.sales (
    business_id,
    appointment_id,
    amount,
    type,
    payment_method,
    date
  ) values (
    v_sale.business_id,
    v_sale.appointment_id,
    -v_sale.total_amount,
    'refund',
    'void',
    now()
  );

  if v_sale.appointment_id is not null
     and not exists (
       select 1
       from public.sale_transactions other_sale
       where other_sale.appointment_id = v_sale.appointment_id
         and other_sale.id <> p_sale_id
         and other_sale.status = 'completed'
     ) then
    update public.appointments
    set payment_status = 'unpaid',
        updated_at = now()
    where id = v_sale.appointment_id
      and business_id = v_sale.business_id;
  end if;

  return jsonb_build_object(
    'sale_id', p_sale_id,
    'receipt_number', v_sale.receipt_number,
    'status', 'voided',
    'restored_amount', v_sale.total_amount
  );
end;
$$;

revoke all on function public.complete_business_sale(
  uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
) from public;

grant execute on function public.complete_business_sale(
  uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
) to authenticated;

revoke all on function public.void_business_sale(uuid, text) from public;
grant execute on function public.void_business_sale(uuid, text) to authenticated;

commit;
