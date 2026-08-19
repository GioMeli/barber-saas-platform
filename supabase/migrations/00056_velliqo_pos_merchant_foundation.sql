begin;

-- ---------------------------------------------------------------------------
-- Velliqo POS Merchant Foundation
--
-- 1. Store Stripe Connect onboarding state per business.
-- 2. Restrict merchant-account visibility to the business Owner only.
-- 3. Prevent browser clients from marking card/online payments as completed
--    until the provider-backed payment flow is introduced.
-- 4. Prevent provider-backed sales from being locally voided without a real
--    provider refund.
-- ---------------------------------------------------------------------------

alter table public.business_payment_accounts
  add column if not exists account_type text,
  add column if not exists country text,
  add column if not exists default_currency text,
  add column if not exists disabled_reason text,
  add column if not exists requirements_currently_due jsonb not null default '[]'::jsonb,
  add column if not exists requirements_eventually_due jsonb not null default '[]'::jsonb,
  add column if not exists requirements_past_due jsonb not null default '[]'::jsonb,
  add column if not exists requirements_pending_verification jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists connected_at timestamptz,
  add column if not exists last_synced_at timestamptz;

create unique index if not exists business_payment_accounts_provider_account_uidx
  on public.business_payment_accounts(provider, provider_account_id)
  where provider_account_id is not null;

-- Merchant account identifiers and verification state are Owner-only data.
drop policy if exists "Owners read payment account" on public.business_payment_accounts;
create policy "Owners read payment account"
  on public.business_payment_accounts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = business_payment_accounts.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'Owner'
    )
  );

revoke all on public.business_payment_accounts from anon, authenticated;
grant select on public.business_payment_accounts to authenticated;
grant all on public.business_payment_accounts to service_role;

-- ---------------------------------------------------------------------------
-- Harden the original manual checkout RPC.
-- The existing implementation remains private so the basket, stock, receipt,
-- appointment and ledger logic does not need to be duplicated.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.complete_business_sale(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,numeric,text)') is not null
     and to_regprocedure('public.complete_business_sale_legacy_impl(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,numeric,text)') is null then
    alter function public.complete_business_sale(
      uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
    ) rename to complete_business_sale_legacy_impl;
  end if;
end $$;

revoke all on function public.complete_business_sale_legacy_impl(
  uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
) from public, authenticated;
grant execute on function public.complete_business_sale_legacy_impl(
  uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
) to service_role;

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
  v_payment jsonb;
  v_payment_method text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_business_access(p_business_id) then
    raise exception 'You do not have access to this business';
  end if;

  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'At least one payment is required';
  end if;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_payment_method := lower(coalesce(v_payment->>'payment_method', ''));

    if v_payment_method in ('card', 'online') then
      raise exception using
        errcode = 'P0001',
        message = 'Card and online payments must be completed through the secure Velliqo payment-provider flow.';
    end if;
  end loop;

  return public.complete_business_sale_legacy_impl(
    p_business_id,
    p_customer_id,
    p_appointment_id,
    p_employee_id,
    p_items,
    p_payments,
    p_order_discount_amount,
    p_tip_amount,
    p_notes
  );
end;
$$;

revoke all on function public.complete_business_sale(
  uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
) from public;
grant execute on function public.complete_business_sale(
  uuid, uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Harden voids. Manual/test transactions can still be voided. Once a payment
-- has a Stripe provider reference, it must use the future provider refund flow
-- instead of pretending that a local void returned money to the customer.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.void_business_sale(uuid,text)') is not null
     and to_regprocedure('public.void_business_sale_legacy_impl(uuid,text)') is null then
    alter function public.void_business_sale(uuid, text)
      rename to void_business_sale_legacy_impl;
  end if;
end $$;

revoke all on function public.void_business_sale_legacy_impl(uuid, text)
  from public, authenticated;
grant execute on function public.void_business_sale_legacy_impl(uuid, text)
  to service_role;

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
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select st.business_id
  into v_business_id
  from public.sale_transactions st
  where st.id = p_sale_id;

  if v_business_id is null or not public.has_business_access(v_business_id) then
    raise exception 'Sale not found or access denied';
  end if;

  if exists (
    select 1
    from public.sale_payments sp
    where sp.sale_id = p_sale_id
      and lower(coalesce(sp.provider, '')) = 'stripe'
      and nullif(btrim(coalesce(sp.reference, '')), '') is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stripe-backed payments must be refunded through the secure provider refund flow.';
  end if;

  return public.void_business_sale_legacy_impl(p_sale_id, p_reason);
end;
$$;

revoke all on function public.void_business_sale(uuid, text) from public;
grant execute on function public.void_business_sale(uuid, text) to authenticated;

commit;
