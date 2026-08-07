-- 00051_velliqo_subscription_billing_entitlements.sql
-- Three-plan Stripe billing, 14-day payment-method-backed trials, fixed-term
-- Velliqo offer codes, usage entitlements, and billing-aware staff PWA access.

begin;

-- ---------------------------------------------------------------------------
-- 1. Launch plan catalogue. This is the server-side source of truth for limits.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_plans (
  plan_id text primary key,
  name text not null,
  display_order integer not null,
  monthly_price_cents integer not null,
  currency text not null default 'eur',
  staff_limit integer not null,
  staff_app_install_enabled boolean not null default false,
  ai_requests_monthly integer not null,
  ai_tokens_monthly bigint not null,
  email_monthly integer not null,
  sms_monthly integer not null,
  advanced_reports_enabled boolean not null default false,
  ai_automations_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_price_check check (monthly_price_cents > 0),
  constraint billing_plans_limits_check check (
    staff_limit > 0 and ai_requests_monthly > 0 and ai_tokens_monthly > 0
    and email_monthly >= 0 and sms_monthly >= 0
  )
);

insert into public.billing_plans (
  plan_id, name, display_order, monthly_price_cents, currency, staff_limit,
  staff_app_install_enabled, ai_requests_monthly, ai_tokens_monthly,
  email_monthly, sms_monthly, advanced_reports_enabled, ai_automations_enabled
) values
  ('standard', 'Standard', 1, 2999, 'eur', 3, false, 100, 250000, 250, 25, false, false),
  ('pro', 'Pro', 2, 4999, 'eur', 10, true, 500, 1500000, 1000, 150, true, true),
  ('premium', 'Premium', 3, 8999, 'eur', 30, true, 1500, 5000000, 3000, 500, true, true)
on conflict (plan_id) do update set
  name = excluded.name,
  display_order = excluded.display_order,
  monthly_price_cents = excluded.monthly_price_cents,
  currency = excluded.currency,
  staff_limit = excluded.staff_limit,
  staff_app_install_enabled = excluded.staff_app_install_enabled,
  ai_requests_monthly = excluded.ai_requests_monthly,
  ai_tokens_monthly = excluded.ai_tokens_monthly,
  email_monthly = excluded.email_monthly,
  sms_monthly = excluded.sms_monthly,
  advanced_reports_enabled = excluded.advanced_reports_enabled,
  ai_automations_enabled = excluded.ai_automations_enabled,
  active = true,
  updated_at = now();

alter table public.billing_plans enable row level security;
drop policy if exists "Anyone can read active billing plans" on public.billing_plans;
create policy "Anyone can read active billing plans"
  on public.billing_plans for select
  to anon, authenticated
  using (active = true);
grant select on public.billing_plans to anon, authenticated;
grant all on public.billing_plans to service_role;

-- ---------------------------------------------------------------------------
-- 2. Subscription state and backwards-compatible launch migration.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists stripe_schedule_id text,
  add column if not exists billing_mode text not null default 'auto_renew',
  add column if not exists fixed_term_months integer,
  add column if not exists fixed_term_ends_at timestamptz,
  add column if not exists offer_code_id uuid,
  add column if not exists payment_method_collected boolean not null default false,
  add column if not exists checkout_completed_at timestamptz,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists checkout_session_expires_at timestamptz,
  add column if not exists scheduled_plan_id text,
  add column if not exists grace_until timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_plan_id_check;
alter table public.subscriptions
  add constraint subscriptions_plan_id_check
  check (plan_id in ('standard', 'pro', 'premium')) not valid;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'trialing','active','past_due','unpaid','incomplete','incomplete_expired',
    'canceled','paused'
  )) not valid;

alter table public.subscriptions drop constraint if exists subscriptions_billing_mode_check;
alter table public.subscriptions
  add constraint subscriptions_billing_mode_check
  check (billing_mode in ('auto_renew','fixed_term'));

alter table public.subscriptions drop constraint if exists subscriptions_fixed_term_months_check;
alter table public.subscriptions
  add constraint subscriptions_fixed_term_months_check
  check (fixed_term_months is null or fixed_term_months between 1 and 36);

update public.subscriptions
set
  plan_id = case
    when plan_id = 'premium' then 'premium'
    else 'pro'
  end,
  currency = 'eur',
  unit_amount = case when plan_id = 'premium' then 8999 else 4999 end,
  billing_interval = 'month',
  updated_at = now()
where plan_id not in ('standard','pro','premium');

-- ---------------------------------------------------------------------------
-- 3. Operator-managed Velliqo offer codes.
-- These are intentionally different from generic Stripe promotion codes:
-- every Velliqo offer has a fixed plan and a fixed 1-36 month access term.
-- The resulting Stripe subscription receives a cancel_at date and therefore
-- cannot silently renew after the promised offer period.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_offer_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  plan_id text not null references public.billing_plans(plan_id),
  duration_months integer not null,
  percent_off numeric(5,2) not null default 0,
  trial_days integer not null default 14,
  max_redemptions integer,
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  stripe_coupon_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_offer_code_format_check check (code = upper(code) and code ~ '^[A-Z0-9_-]{4,32}$'),
  constraint billing_offer_duration_check check (duration_months between 1 and 36),
  constraint billing_offer_percent_check check (percent_off between 0 and 100),
  constraint billing_offer_trial_check check (trial_days between 0 and 60),
  constraint billing_offer_max_check check (max_redemptions is null or max_redemptions > 0)
);

create table if not exists public.billing_offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  offer_code_id uuid not null references public.billing_offer_codes(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'reserved',
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz not null default now() + interval '24 hours',
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_offer_redemption_status_check check (status in ('reserved','redeemed','released')),
  unique (offer_code_id, business_id)
);

create index if not exists billing_offer_redemptions_offer_status_idx
  on public.billing_offer_redemptions (offer_code_id, status);
create index if not exists billing_offer_redemptions_business_idx
  on public.billing_offer_redemptions (business_id, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'Platform Admin'
  );
$$;

alter table public.billing_offer_codes enable row level security;
alter table public.billing_offer_redemptions enable row level security;

drop policy if exists "Platform admins manage offer codes" on public.billing_offer_codes;
create policy "Platform admins manage offer codes"
  on public.billing_offer_codes for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Business owners view own offer redemptions" on public.billing_offer_redemptions;
create policy "Business owners view own offer redemptions"
  on public.billing_offer_redemptions for select to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Platform admins manage offer redemptions" on public.billing_offer_redemptions;
create policy "Platform admins manage offer redemptions"
  on public.billing_offer_redemptions for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.billing_offer_codes to authenticated;
grant select on public.billing_offer_redemptions to authenticated;
grant all on public.billing_offer_codes, public.billing_offer_redemptions to service_role;

alter table public.subscriptions
  drop constraint if exists subscriptions_offer_code_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_offer_code_id_fkey
  foreign key (offer_code_id) references public.billing_offer_codes(id) on delete set null;

-- Atomic reservation protects max-redemption limits while Checkout is open.
create or replace function public.reserve_billing_offer_code(
  p_code text,
  p_business_id uuid,
  p_plan_id text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.billing_offer_codes%rowtype;
  v_redemption public.billing_offer_redemptions%rowtype;
  v_used integer;
begin
  if not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.user_id = p_user_id and bm.role = 'Owner'
  ) then
    raise exception using errcode = '42501', message = 'Only the business owner can use an offer code.';
  end if;

  select * into v_offer
  from public.billing_offer_codes
  where code = upper(trim(p_code))
  for update;

  if v_offer.id is null or not v_offer.active then
    raise exception using errcode = '22023', message = 'This offer code is invalid or inactive.';
  end if;
  if v_offer.plan_id <> p_plan_id then
    raise exception using errcode = '22023', message = 'This offer code is not valid for the selected plan.';
  end if;
  if v_offer.starts_at is not null and now() < v_offer.starts_at then
    raise exception using errcode = '22023', message = 'This offer has not started yet.';
  end if;
  if v_offer.expires_at is not null and now() >= v_offer.expires_at then
    raise exception using errcode = '22023', message = 'This offer code has expired.';
  end if;

  update public.billing_offer_redemptions
  set status = 'released', released_at = now()
  where offer_code_id = v_offer.id
    and status = 'reserved'
    and reservation_expires_at <= now();

  select count(*)::integer into v_used
  from public.billing_offer_redemptions r
  where r.offer_code_id = v_offer.id
    and r.status in ('reserved','redeemed')
    and r.business_id <> p_business_id;

  if v_offer.max_redemptions is not null and v_used >= v_offer.max_redemptions then
    raise exception using errcode = '22023', message = 'This offer has reached its redemption limit.';
  end if;

  select * into v_redemption
  from public.billing_offer_redemptions
  where offer_code_id = v_offer.id and business_id = p_business_id;

  if v_redemption.id is not null and v_redemption.status = 'redeemed' then
    raise exception using errcode = '22023', message = 'This business has already redeemed this offer.';
  end if;

  insert into public.billing_offer_redemptions (
    offer_code_id, business_id, user_id, status, reserved_at, reservation_expires_at,
    released_at, redeemed_at, stripe_checkout_session_id, stripe_subscription_id
  ) values (
    v_offer.id, p_business_id, p_user_id, 'reserved', now(), now() + interval '24 hours',
    null, null, null, null
  )
  on conflict (offer_code_id, business_id) do update set
    user_id = excluded.user_id,
    status = 'reserved',
    reserved_at = now(),
    reservation_expires_at = now() + interval '24 hours',
    released_at = null,
    redeemed_at = null,
    stripe_checkout_session_id = null,
    stripe_subscription_id = null
  returning * into v_redemption;

  return jsonb_build_object(
    'offer_id', v_offer.id,
    'redemption_id', v_redemption.id,
    'code', v_offer.code,
    'plan_id', v_offer.plan_id,
    'duration_months', v_offer.duration_months,
    'percent_off', v_offer.percent_off,
    'trial_days', v_offer.trial_days,
    'stripe_coupon_id', v_offer.stripe_coupon_id,
    'description', v_offer.description
  );
end;
$$;

revoke all on function public.reserve_billing_offer_code(text,uuid,text,uuid) from public;
grant execute on function public.reserve_billing_offer_code(text,uuid,text,uuid) to service_role;

-- Secure bootstrap used by onboarding before staff rows are created. This
-- makes the selected plan available to database entitlement triggers without
-- granting direct subscription writes to browser clients.
create or replace function public.initialize_business_billing(
  p_business_id uuid,
  p_plan_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.billing_plans%rowtype;
  v_subscription public.subscriptions%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.user_id = auth.uid() and bm.role = 'Owner'
  ) then
    raise exception using errcode = '42501', message = 'Only the business owner can initialise billing.';
  end if;

  select * into v_plan from public.billing_plans where plan_id = p_plan_id and active = true;
  if v_plan.plan_id is null then
    raise exception using errcode = '22023', message = 'The selected billing plan is unavailable.';
  end if;

  insert into public.subscriptions (
    business_id, plan_id, status, trial_days, currency, unit_amount,
    billing_interval, billing_mode, payment_method_collected, updated_at
  ) values (
    p_business_id, v_plan.plan_id, 'incomplete', 14, v_plan.currency,
    v_plan.monthly_price_cents, 'month', 'auto_renew', false, now()
  )
  on conflict (business_id) do update set
    plan_id = case
      when public.subscriptions.stripe_subscription_id is null then excluded.plan_id
      else public.subscriptions.plan_id
    end,
    unit_amount = case
      when public.subscriptions.stripe_subscription_id is null then excluded.unit_amount
      else public.subscriptions.unit_amount
    end,
    currency = case
      when public.subscriptions.stripe_subscription_id is null then excluded.currency
      else public.subscriptions.currency
    end,
    updated_at = now()
  returning * into v_subscription;

  return to_jsonb(v_subscription);
end;
$$;

revoke all on function public.initialize_business_billing(uuid,text) from public;
grant execute on function public.initialize_business_billing(uuid,text) to authenticated;

-- Platform administrators need a read-only global billing view for operating
-- offers and monitoring launch revenue. Billing mutation remains server-side.
drop policy if exists "Platform admins view all subscriptions" on public.subscriptions;
create policy "Platform admins view all subscriptions"
  on public.subscriptions for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins view all billing invoices" on public.billing_invoices;
create policy "Platform admins view all billing invoices"
  on public.billing_invoices for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 4. Entitlements and usage summaries.
-- ---------------------------------------------------------------------------
create or replace function public.business_staff_count(p_business_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.employees e
  where e.business_id = p_business_id
    and coalesce(e.is_active, true) = true
    and not exists (
      select 1 from public.business_members bm
      where bm.business_id = e.business_id
        and bm.user_id = e.user_id
        and bm.role = 'Owner'
    );
$$;

revoke all on function public.business_staff_count(uuid) from public;
grant execute on function public.business_staff_count(uuid) to service_role;

create or replace function public.get_business_billing_summary(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_plan public.billing_plans%rowtype;
  v_staff integer := 0;
  v_ai_requests integer := 0;
  v_ai_tokens bigint := 0;
  v_emails integer := 0;
  v_sms integer := 0;
  v_usage_start timestamptz;
begin
  if auth.role() <> 'service_role' and not public.has_business_access(p_business_id) then
    raise exception using errcode = '42501', message = 'Business access is required.';
  end if;

  select * into v_subscription from public.subscriptions where business_id = p_business_id;
  select * into v_plan from public.billing_plans where plan_id = coalesce(v_subscription.plan_id, 'pro');
  v_staff := public.business_staff_count(p_business_id);
  -- Allowances reset with the Stripe billing period rather than at calendar
  -- month boundaries. This keeps a customer who subscribed mid-month from
  -- receiving an unintended early reset (or an unfairly short first period).
  v_usage_start := coalesce(v_subscription.current_period_start, v_subscription.trial_started_at, date_trunc('month', now()));

  select count(*)::integer,
         coalesce(sum(coalesce(input_tokens,0) + coalesce(output_tokens,0)),0)::bigint
  into v_ai_requests, v_ai_tokens
  from public.ai_usage_events
  where business_id = p_business_id and created_at >= v_usage_start and success = true;

  select count(*) filter (where channel = 'email')::integer,
         count(*) filter (where channel = 'sms')::integer
  into v_emails, v_sms
  from public.notification_deliveries
  where business_id = p_business_id
    and created_at >= v_usage_start
    and status in ('sent','delivered');

  -- Marketing deliveries consume the same provider allowance as operational
  -- notifications, so both count toward the plan's communication budget.
  select
    v_emails + count(*) filter (where channel = 'email')::integer,
    v_sms + count(*) filter (where channel = 'sms')::integer
  into v_emails, v_sms
  from public.marketing_deliveries
  where business_id = p_business_id
    and created_at >= v_usage_start
    and status in ('sent','delivered');

  return jsonb_build_object(
    'subscription', coalesce(to_jsonb(v_subscription), '{}'::jsonb),
    'plan', coalesce(to_jsonb(v_plan), '{}'::jsonb),
    'usage', jsonb_build_object(
      'staff', v_staff,
      'ai_requests', v_ai_requests,
      'ai_tokens', v_ai_tokens,
      'email', v_emails,
      'sms', v_sms
    ),
    'access_allowed', coalesce(
      v_subscription.status in ('trialing','active')
      or (v_subscription.status = 'past_due' and v_subscription.grace_until is not null and v_subscription.grace_until > now()),
      false
    ),
    'billing_required', v_subscription.id is null
      or v_subscription.status in ('incomplete','incomplete_expired','unpaid','canceled','paused')
      or (v_subscription.status = 'past_due' and (v_subscription.grace_until is null or v_subscription.grace_until <= now()))
  );
end;
$$;

revoke all on function public.get_business_billing_summary(uuid) from public;
grant execute on function public.get_business_billing_summary(uuid) to authenticated, service_role;

create or replace function public.billing_can_send_communication(p_business_id uuid, p_channel text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
  v_limit integer;
  v_used integer;
begin
  if p_channel not in ('email','sms') then
    return jsonb_build_object('allowed', true, 'limit', null, 'used', 0);
  end if;
  v_summary := public.get_business_billing_summary(p_business_id);
  if coalesce((v_summary ->> 'access_allowed')::boolean, false) = false then
    return jsonb_build_object('allowed', false, 'reason', 'billing_inactive', 'limit', 0, 'used', 0);
  end if;
  v_limit := case p_channel
    when 'email' then coalesce((v_summary #>> '{plan,email_monthly}')::integer, 0)
    else coalesce((v_summary #>> '{plan,sms_monthly}')::integer, 0)
  end;
  v_used := coalesce((v_summary #>> array['usage', p_channel])::integer, 0);
  return jsonb_build_object('allowed', v_used < v_limit, 'limit', v_limit, 'used', v_used);
end;
$$;

revoke all on function public.billing_can_send_communication(uuid,text) from public;
grant execute on function public.billing_can_send_communication(uuid,text) to service_role;

-- Staff limit is enforced in the database, not only in the UI.
create or replace function public.enforce_employee_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id text;
  v_limit integer;
  v_count integer;
  v_is_owner boolean;
  v_existing_id uuid;
begin
  if coalesce(new.is_active, true) = false then return new; end if;
  v_existing_id := case when tg_op = 'UPDATE' then old.id else null end;

  v_is_owner := new.user_id is not null and exists (
    select 1 from public.business_members bm
    where bm.business_id = new.business_id and bm.user_id = new.user_id and bm.role = 'Owner'
  );
  if v_is_owner then return new; end if;

  select coalesce(s.plan_id, 'pro') into v_plan_id
  from public.subscriptions s where s.business_id = new.business_id;
  v_plan_id := coalesce(v_plan_id, 'pro');
  select staff_limit into v_limit from public.billing_plans where plan_id = v_plan_id;
  v_limit := coalesce(v_limit, 10);

  select count(*)::integer into v_count
  from public.employees e
  where e.business_id = new.business_id
    and coalesce(e.is_active, true) = true
    and (v_existing_id is null or e.id <> v_existing_id)
    and not exists (
      select 1 from public.business_members bm
      where bm.business_id = e.business_id and bm.user_id = e.user_id and bm.role = 'Owner'
    );

  if v_count >= v_limit then
    raise exception using errcode = 'P0001', message = format('Your %s plan allows up to %s staff members.', initcap(v_plan_id), v_limit);
  end if;
  return new;
end;
$$;

drop trigger if exists employees_plan_limit_guard on public.employees;
create trigger employees_plan_limit_guard
before insert or update of business_id, is_active on public.employees
for each row execute function public.enforce_employee_plan_limit();

-- New appointments are a core paid operation. This database guard prevents
-- browser/API bypass when a trial has ended, a fixed-term offer has expired,
-- or a failed payment has exhausted its short grace period.
create or replace function public.enforce_appointment_billing_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_grace_until timestamptz;
begin
  select status, grace_until into v_status, v_grace_until
  from public.subscriptions
  where business_id = new.business_id;

  if v_status in ('trialing','active') then
    return new;
  end if;
  if v_status = 'past_due' and v_grace_until is not null and v_grace_until > now() then
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'Billing access is required before new appointments can be created.';
end;
$$;

revoke all on function public.enforce_appointment_billing_access() from public;

drop trigger if exists appointments_billing_access_guard on public.appointments;
create trigger appointments_billing_access_guard
before insert on public.appointments
for each row execute function public.enforce_appointment_billing_access();

-- ---------------------------------------------------------------------------
-- 5. Staff workspace includes install entitlement; browser Staff Portal remains
-- available on Standard, but its PWA manifest becomes non-installable.
-- ---------------------------------------------------------------------------
create or replace function public.staff_get_workspace(p_business_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_business public.businesses%rowtype;
  v_services jsonb;
  v_customers jsonb;
  v_appointments jsonb;
  v_plan_id text := 'pro';
  v_staff_app_install boolean := true;
  v_subscription_status text;
  v_grace_until timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select e.* into v_employee
  from public.employees e
  join public.businesses b on b.id = e.business_id
  where b.slug = lower(trim(p_business_slug))
    and b.status = 'active'
    and e.user_id = auth.uid()
    and e.personal_access_enabled = true
    and e.personal_access_status in ('invited', 'active')
    and e.is_active = true
  limit 1;

  if v_employee.id is not null then
    select b.* into v_business from public.businesses b where b.id = v_employee.business_id;
  end if;
  if v_employee.id is null then
    raise exception using errcode = '42501', message = 'Staff access is unavailable or has been revoked.';
  end if;

  select s.status, s.grace_until into v_subscription_status, v_grace_until
  from public.subscriptions s where s.business_id = v_employee.business_id;
  if coalesce(
    v_subscription_status in ('trialing','active')
    or (v_subscription_status = 'past_due' and v_grace_until is not null and v_grace_until > now()),
    false
  ) = false then
    raise exception using errcode = '42501', message = 'This business subscription is not currently active.';
  end if;

  select coalesce(s.plan_id, 'pro') into v_plan_id from public.subscriptions s where s.business_id = v_employee.business_id;
  v_plan_id := coalesce(v_plan_id, 'pro');
  select coalesce(staff_app_install_enabled, false) into v_staff_app_install from public.billing_plans where plan_id = v_plan_id;

  update public.employees set
    personal_access_status = 'active',
    staff_app_activated_at = coalesce(staff_app_activated_at, now()),
    staff_app_last_seen_at = now(), updated_at = now()
  where id = v_employee.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'duration', s.duration, 'price', s.price, 'image_url', s.image_url
  ) order by s.name), '[]'::jsonb)
  into v_services
  from public.employee_services es join public.services s on s.id = es.service_id
  where es.employee_id = v_employee.id and s.business_id = v_employee.business_id and s.is_active = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'email', c.email, 'phone', c.phone
  ) order by lower(c.full_name), c.created_at desc), '[]'::jsonb)
  into v_customers from public.customers c where c.business_id = v_employee.business_id;

  select coalesce(jsonb_agg(rows.payload order by rows.start_time), '[]'::jsonb)
  into v_appointments
  from (
    select a.start_time, jsonb_build_object(
      'id', a.id, 'business_id', a.business_id, 'employee_id', a.employee_id,
      'customer_id', a.customer_id, 'start_time', a.start_time, 'end_time', a.end_time,
      'status', a.status, 'total_duration', a.total_duration, 'total_price', a.total_price,
      'notes', a.notes, 'booking_reference', a.booking_reference,
      'customer', jsonb_build_object('full_name', coalesce(c.full_name, 'Walk-in customer'), 'phone', c.phone, 'email', c.email),
      'services', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration', aps.duration, 'price', aps.price
      ) order by s.name)
      from public.appointment_services aps left join public.services s on s.id = aps.service_id
      where aps.appointment_id = a.id), '[]'::jsonb)
    ) payload
    from public.appointments a left join public.customers c on c.id = a.customer_id
    where a.business_id = v_employee.business_id and a.employee_id = v_employee.id
      and a.start_time >= now() - interval '30 days' and a.start_time < now() + interval '180 days'
  ) rows;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id, 'slug', v_business.slug, 'name', v_business.name,
      'logo_url', v_business.logo_url, 'address', v_business.address, 'phone', v_business.phone,
      'email', v_business.email, 'timezone', v_business.timezone, 'currency', v_business.currency
    ),
    'employee', jsonb_build_object(
      'id', v_employee.id, 'business_id', v_employee.business_id, 'name', v_employee.name,
      'email', v_employee.email, 'phone', v_employee.phone, 'photo_url', v_employee.photo_url,
      'bio', v_employee.bio, 'personal_access_status', 'active', 'staff_access_version', v_employee.staff_access_version
    ),
    'entitlements', jsonb_build_object('plan_id', v_plan_id, 'staff_app_install_enabled', v_staff_app_install),
    'services', v_services, 'customers', v_customers, 'appointments', v_appointments
  );
end;
$$;

revoke all on function public.staff_get_workspace(text) from public;
grant execute on function public.staff_get_workspace(text) to authenticated;

-- Anonymous Vercel manifest endpoint can retrieve only non-sensitive branding
-- and whether the selected plan is installable.
create or replace function public.staff_manifest_meta(p_business_slug text, p_employee_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_install boolean := false;
  v_plan_id text := 'pro';
  v_subscription_status text;
  v_grace_until timestamptz;
begin
  select b.* into v_business
  from public.businesses b
  join public.employees e on e.business_id = b.id
  where b.slug = lower(trim(p_business_slug)) and b.status = 'active'
    and e.id = p_employee_id and e.is_active = true and e.personal_access_enabled = true
  limit 1;
  if v_business.id is null then return null; end if;
  select coalesce(s.plan_id, 'pro'), s.status, s.grace_until
  into v_plan_id, v_subscription_status, v_grace_until
  from public.subscriptions s where s.business_id = v_business.id;
  v_plan_id := coalesce(v_plan_id, 'pro');
  select coalesce(staff_app_install_enabled, false) into v_install from public.billing_plans where plan_id = v_plan_id;
  if coalesce(
    v_subscription_status in ('trialing','active')
    or (v_subscription_status = 'past_due' and v_grace_until is not null and v_grace_until > now()),
    false
  ) = false then
    v_install := false;
  end if;
  return jsonb_build_object(
    'id', v_business.id, 'name', v_business.name, 'slug', v_business.slug,
    'logo_url', v_business.logo_url, 'updated_at', v_business.updated_at,
    'staff_app_install_enabled', v_install, 'plan_id', v_plan_id
  );
end;
$$;

revoke all on function public.staff_manifest_meta(text,uuid) from public;
grant execute on function public.staff_manifest_meta(text,uuid) to anon, authenticated, service_role;

commit;
