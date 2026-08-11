-- 00052_velliqo_platform_admin_control_center.sql
-- Platform operator control center, support audit trail, usage/profit analytics.

begin;

create table if not exists public.platform_cost_settings (
  id boolean primary key default true check (id = true),
  fixed_monthly_cost_eur numeric(12,2) not null default 0,
  email_unit_cost_eur numeric(12,6) not null default 0,
  sms_unit_cost_eur numeric(12,6) not null default 0,
  payment_fee_percent numeric(6,3) not null default 0,
  payment_fee_fixed_eur numeric(12,4) not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint platform_cost_nonnegative check (
    fixed_monthly_cost_eur >= 0 and email_unit_cost_eur >= 0 and sms_unit_cost_eur >= 0
    and payment_fee_percent >= 0 and payment_fee_fixed_eur >= 0
  )
);

insert into public.platform_cost_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.platform_support_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  note text not null check (char_length(trim(note)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists platform_support_notes_business_idx
  on public.platform_support_notes(business_id, created_at desc);

create table if not exists public.platform_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_admin_audit_business_idx
  on public.platform_admin_audit_logs(business_id, created_at desc);

alter table public.platform_cost_settings enable row level security;
alter table public.platform_support_notes enable row level security;
alter table public.platform_admin_audit_logs enable row level security;

create policy "Platform admins manage platform cost settings"
  on public.platform_cost_settings for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Platform admins manage support notes"
  on public.platform_support_notes for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Platform admins read audit logs"
  on public.platform_admin_audit_logs for select to authenticated
  using (public.is_platform_admin());

grant select, insert, update on public.platform_cost_settings to authenticated;
grant select, insert, update, delete on public.platform_support_notes to authenticated;
grant select on public.platform_admin_audit_logs to authenticated;
grant all on public.platform_cost_settings, public.platform_support_notes, public.platform_admin_audit_logs to service_role;

create or replace function public.platform_admin_dashboard(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_cost public.platform_cost_settings%rowtype;
  v_mrr numeric := 0;
  v_ai_cost numeric := 0;
  v_email_count bigint := 0;
  v_sms_count bigint := 0;
  v_paid_subscriptions bigint := 0;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select * into v_cost from public.platform_cost_settings where id = true;

  select coalesce(sum(
    case when s.status in ('active','past_due') then
      coalesce(s.unit_amount, bp.monthly_price_cents, 0) *
      (1 - coalesce(o.percent_off, 0)::numeric / 100)
    else 0 end
  ),0) / 100.0,
  count(*) filter (where s.status in ('active','past_due'))
  into v_mrr, v_paid_subscriptions
  from public.subscriptions s
  left join public.billing_plans bp on bp.plan_id = s.plan_id
  left join public.billing_offer_codes o on o.id = s.offer_code_id;

  select coalesce(sum(estimated_cost),0)
  into v_ai_cost
  from public.ai_usage_events
  where created_at >= p_from and created_at < p_to and success = true;

  select
    count(*) filter (where channel = 'email' and status in ('sent','delivered')),
    count(*) filter (where channel = 'sms' and status in ('sent','delivered'))
  into v_email_count, v_sms_count
  from public.notification_deliveries
  where created_at >= p_from and created_at < p_to;

  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'businesses', (select count(*) from public.businesses),
    'active_businesses', (select count(*) from public.businesses where coalesce(status,'active') = 'active'),
    'subscriptions', jsonb_build_object(
      'trialing', (select count(*) from public.subscriptions where status = 'trialing'),
      'active', (select count(*) from public.subscriptions where status = 'active'),
      'past_due', (select count(*) from public.subscriptions where status = 'past_due'),
      'canceled', (select count(*) from public.subscriptions where status = 'canceled'),
      'standard', (select count(*) from public.subscriptions where plan_id = 'standard' and status in ('trialing','active','past_due')),
      'pro', (select count(*) from public.subscriptions where plan_id = 'pro' and status in ('trialing','active','past_due')),
      'premium', (select count(*) from public.subscriptions where plan_id = 'premium' and status in ('trialing','active','past_due'))
    ),
    'mrr_eur', round(v_mrr, 2),
    'usage', jsonb_build_object(
      'ai_requests', (select count(*) from public.ai_usage_events where created_at >= p_from and created_at < p_to and success = true),
      'ai_tokens', (select coalesce(sum(input_tokens + output_tokens),0) from public.ai_usage_events where created_at >= p_from and created_at < p_to and success = true),
      'ai_estimated_cost_eur', round(v_ai_cost, 4),
      'emails', v_email_count,
      'sms', v_sms_count,
      'appointments', (select count(*) from public.appointments where created_at >= p_from and created_at < p_to),
      'customers', (select count(*) from public.customers where created_at >= p_from and created_at < p_to),
      'staff', (select count(*) from public.employees where created_at < p_to and is_active = true)
    ),
    'delivery_health', jsonb_build_object(
      'failed', (select count(*) from public.notification_deliveries where created_at >= p_from and created_at < p_to and status in ('failed','bounced','complained')),
      'delivered', (select count(*) from public.notification_deliveries where created_at >= p_from and created_at < p_to and status = 'delivered'),
      'stripe_webhook_errors', (select count(*) from public.stripe_webhook_events where created_at >= p_from and created_at < p_to and processing_error is not null)
    ),
    'cost_model', jsonb_build_object(
      'fixed_monthly_cost_eur', coalesce(v_cost.fixed_monthly_cost_eur,0),
      'email_unit_cost_eur', coalesce(v_cost.email_unit_cost_eur,0),
      'sms_unit_cost_eur', coalesce(v_cost.sms_unit_cost_eur,0),
      'payment_fee_percent', coalesce(v_cost.payment_fee_percent,0),
      'payment_fee_fixed_eur', coalesce(v_cost.payment_fee_fixed_eur,0)
    ),
    'estimated_monthly_cost_eur', round(
      coalesce(v_cost.fixed_monthly_cost_eur,0)
      + v_ai_cost
      + v_email_count * coalesce(v_cost.email_unit_cost_eur,0)
      + v_sms_count * coalesce(v_cost.sms_unit_cost_eur,0)
      + v_mrr * coalesce(v_cost.payment_fee_percent,0) / 100
      + v_paid_subscriptions * coalesce(v_cost.payment_fee_fixed_eur,0), 2
    ),
    'estimated_monthly_profit_eur', round(
      v_mrr - (
        coalesce(v_cost.fixed_monthly_cost_eur,0)
        + v_ai_cost
        + v_email_count * coalesce(v_cost.email_unit_cost_eur,0)
        + v_sms_count * coalesce(v_cost.sms_unit_cost_eur,0)
        + v_mrr * coalesce(v_cost.payment_fee_percent,0) / 100
        + v_paid_subscriptions * coalesce(v_cost.payment_fee_fixed_eur,0)
      ), 2
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.platform_admin_business_rows(p_search text default null)
returns table (
  business_id uuid,
  business_name text,
  slug text,
  status text,
  business_email text,
  business_phone text,
  country text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  owner_phone text,
  plan_id text,
  subscription_status text,
  billing_mode text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  staff_count bigint,
  customer_count bigint,
  appointment_count bigint,
  ai_requests_period bigint,
  ai_tokens_period bigint,
  ai_cost_period numeric,
  email_period bigint,
  sms_period bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id, b.name, b.slug, b.status, b.email, b.phone, b.country,
    owner_member.user_id, p.full_name, p.email, p.phone,
    s.plan_id, s.status, s.billing_mode, s.trial_ends_at, s.current_period_end,
    s.stripe_customer_id, s.stripe_subscription_id,
    (select count(*) from public.employees e where e.business_id = b.id and e.is_active = true),
    (select count(*) from public.customers c where c.business_id = b.id),
    (select count(*) from public.appointments a where a.business_id = b.id),
    (select count(*) from public.ai_usage_events au where au.business_id = b.id and au.created_at >= coalesce(s.current_period_start, date_trunc('month',now())) and au.success = true),
    (select coalesce(sum(au.input_tokens + au.output_tokens),0) from public.ai_usage_events au where au.business_id = b.id and au.created_at >= coalesce(s.current_period_start, date_trunc('month',now())) and au.success = true),
    (select coalesce(sum(au.estimated_cost),0) from public.ai_usage_events au where au.business_id = b.id and au.created_at >= coalesce(s.current_period_start, date_trunc('month',now())) and au.success = true),
    (select count(*) from public.notification_deliveries nd where nd.business_id = b.id and nd.channel='email' and nd.created_at >= coalesce(s.current_period_start, date_trunc('month',now())) and nd.status in ('sent','delivered')),
    (select count(*) from public.notification_deliveries nd where nd.business_id = b.id and nd.channel='sms' and nd.created_at >= coalesce(s.current_period_start, date_trunc('month',now())) and nd.status in ('sent','delivered')),
    b.created_at
  from public.businesses b
  left join lateral (
    select bm.user_id from public.business_members bm where bm.business_id=b.id and bm.role='Owner' order by bm.created_at asc limit 1
  ) owner_member on true
  left join public.profiles p on p.id=owner_member.user_id
  left join public.subscriptions s on s.business_id=b.id
  where public.is_platform_admin()
    and (p_search is null or trim(p_search) = '' or b.name ilike '%'||trim(p_search)||'%' or b.slug ilike '%'||trim(p_search)||'%' or p.email ilike '%'||trim(p_search)||'%')
  order by b.created_at desc;
$$;

grant execute on function public.platform_admin_dashboard(timestamptz,timestamptz) to authenticated;
grant execute on function public.platform_admin_business_rows(text) to authenticated;

create or replace function public.platform_admin_update_business(
  p_business_id uuid,
  p_name text default null,
  p_status text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_country text default null,
  p_timezone text default null,
  p_owner_name text default null,
  p_owner_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_owner uuid;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select to_jsonb(b) into v_before from public.businesses b where b.id=p_business_id;
  if v_before is null then raise exception 'BUSINESS_NOT_FOUND'; end if;
  if p_status is not null and p_status not in ('active','inactive','suspended') then raise exception 'INVALID_STATUS'; end if;

  update public.businesses set
    name=coalesce(nullif(trim(p_name),''),name), status=coalesce(p_status,status),
    email=case when p_email is null then email else nullif(trim(p_email),'') end,
    phone=case when p_phone is null then phone else nullif(trim(p_phone),'') end,
    address=case when p_address is null then address else nullif(trim(p_address),'') end,
    country=case when p_country is null then country else nullif(trim(p_country),'') end,
    timezone=case when p_timezone is null then timezone else nullif(trim(p_timezone),'') end,
    updated_at=now()
  where id=p_business_id;

  select bm.user_id into v_owner from public.business_members bm where bm.business_id=p_business_id and bm.role='Owner' order by bm.created_at limit 1;
  if v_owner is not null then
    update public.profiles set
      full_name=case when p_owner_name is null then full_name else nullif(trim(p_owner_name),'') end,
      phone=case when p_owner_phone is null then phone else nullif(trim(p_owner_phone),'') end,
      updated_at=now()
    where id=v_owner;
  end if;

  select to_jsonb(b) into v_after from public.businesses b where b.id=p_business_id;
  insert into public.platform_admin_audit_logs(actor_id,business_id,action,target_type,target_id,before_state,after_state)
  values(auth.uid(),p_business_id,'business_support_update','business',p_business_id::text,v_before,v_after);
  return v_after;
end;
$$;

grant execute on function public.platform_admin_update_business(uuid,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.platform_admin_save_cost_settings(
  p_fixed_monthly_cost_eur numeric,
  p_email_unit_cost_eur numeric,
  p_sms_unit_cost_eur numeric,
  p_payment_fee_percent numeric,
  p_payment_fee_fixed_eur numeric
)
returns public.platform_cost_settings
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.platform_cost_settings;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  update public.platform_cost_settings set
    fixed_monthly_cost_eur=greatest(0,p_fixed_monthly_cost_eur),
    email_unit_cost_eur=greatest(0,p_email_unit_cost_eur),
    sms_unit_cost_eur=greatest(0,p_sms_unit_cost_eur),
    payment_fee_percent=greatest(0,p_payment_fee_percent),
    payment_fee_fixed_eur=greatest(0,p_payment_fee_fixed_eur),
    updated_by=auth.uid(), updated_at=now()
  where id=true returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.platform_admin_save_cost_settings(numeric,numeric,numeric,numeric,numeric) to authenticated;

commit;
