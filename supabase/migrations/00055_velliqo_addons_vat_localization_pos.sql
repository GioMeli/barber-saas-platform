-- 00055_velliqo_addons_vat_localization_pos.sql
-- Phase 15A: revised VAT-inclusive plan catalogue, consumable/recurring add-ons,
-- POS Suite entitlement, and owner quota alerts.

begin;

-- ---------------------------------------------------------------------------
-- 1. Revised launch pricing and allowances. Prices are presented VAT-inclusive
-- in the Velliqo UI; Stripe Tax determines the tax treatment by customer.
-- ---------------------------------------------------------------------------
update public.billing_plans set
  name = 'Standard', monthly_price_cents = 3499, sms_monthly = 25, updated_at = now()
where plan_id = 'standard';
update public.billing_plans set
  name = 'Professional', monthly_price_cents = 5999, sms_monthly = 150, updated_at = now()
where plan_id = 'pro';
update public.billing_plans set
  name = 'Premium', monthly_price_cents = 10099, sms_monthly = 250, updated_at = now()
where plan_id = 'premium';

-- ---------------------------------------------------------------------------
-- 2. Add-on catalogue. Consumable packs can be bought for the current billing
-- cycle or as a monthly recurring add-on. POS is recurring only.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_addon_catalog (
  addon_id text primary key,
  category text not null check (category in ('sms','email','ai','pos')),
  name text not null,
  description text,
  units integer not null default 0 check (units >= 0),
  token_units bigint not null default 0 check (token_units >= 0),
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  currency text not null default 'eur',
  allows_cycle_purchase boolean not null default true,
  allows_recurring_purchase boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_addon_catalog
(addon_id,category,name,description,units,token_units,monthly_price_cents,allows_cycle_purchase,allows_recurring_purchase,sort_order,metadata)
values
  ('sms_100','sms','100 SMS','100 additional SMS messages',100,0,1499,true,true,10,'{"margin_note":"Destination carrier fees vary by country"}'),
  ('sms_250','sms','250 SMS','250 additional SMS messages',250,0,3499,true,true,20,'{"margin_note":"Destination carrier fees vary by country"}'),
  ('sms_500','sms','500 SMS','500 additional SMS messages',500,0,6499,true,true,30,'{"margin_note":"Destination carrier fees vary by country"}'),
  ('sms_1000','sms','1,000 SMS','1,000 additional SMS messages',1000,0,11999,true,true,40,'{"margin_note":"Destination carrier fees vary by country"}'),
  ('email_1000','email','1,000 emails','1,000 additional transactional or marketing emails',1000,0,499,true,true,50,'{}'),
  ('email_5000','email','5,000 emails','5,000 additional transactional or marketing emails',5000,0,1499,true,true,60,'{}'),
  ('email_10000','email','10,000 emails','10,000 additional transactional or marketing emails',10000,0,2499,true,true,70,'{}'),
  ('ai_100','ai','100 AI requests','100 additional AI requests with 350K extra token allowance',100,350000,999,true,true,80,'{}'),
  ('ai_500','ai','500 AI requests','500 additional AI requests with 1.75M extra token allowance',500,1750000,3999,true,true,90,'{}'),
  ('ai_1000','ai','1,000 AI requests','1,000 additional AI requests with 3.5M extra token allowance',1000,3500000,6999,true,true,100,'{}'),
  ('pos_suite','pos','Velliqo POS Suite','Connected payments and POS operating suite',0,0,4599,false,true,200,
   '{"features":["tap_to_pay","appointment_payments","online_payments","deposits","no_show_charges","cancellation_charges","tips","refunds","payment_links","daily_close","payment_history","wallet_loyalty","ai_financial_analysis","payment_reports"],"processing_fees_paid_by_owner":true}')
on conflict (addon_id) do update set
  category=excluded.category,name=excluded.name,description=excluded.description,
  units=excluded.units,token_units=excluded.token_units,monthly_price_cents=excluded.monthly_price_cents,
  allows_cycle_purchase=excluded.allows_cycle_purchase,allows_recurring_purchase=excluded.allows_recurring_purchase,
  sort_order=excluded.sort_order,metadata=excluded.metadata,active=true,updated_at=now();

alter table public.billing_addon_catalog enable row level security;
drop policy if exists "Anyone can read active add-ons" on public.billing_addon_catalog;
create policy "Anyone can read active add-ons" on public.billing_addon_catalog
  for select to anon, authenticated using (active=true);
grant select on public.billing_addon_catalog to anon, authenticated;
grant all on public.billing_addon_catalog to service_role;

alter table public.billing_invoices
  add column if not exists invoice_kind text not null default 'plan',
  add column if not exists addon_id text;

create table if not exists public.business_addon_entitlements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  addon_id text not null references public.billing_addon_catalog(addon_id),
  purchase_mode text not null check (purchase_mode in ('cycle','recurring')),
  status text not null default 'pending' check (status in ('pending','active','past_due','canceled','expired')),
  units integer not null default 0,
  token_units bigint not null default 0,
  stripe_checkout_session_id text,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stripe_checkout_session_id)
);
create index if not exists business_addon_entitlements_business_idx on public.business_addon_entitlements(business_id,status,ends_at);
alter table public.business_addon_entitlements enable row level security;
drop policy if exists "Owners read business add-ons" on public.business_addon_entitlements;
create policy "Owners read business add-ons" on public.business_addon_entitlements
  for select to authenticated using (public.has_business_access(business_id));
grant select on public.business_addon_entitlements to authenticated;
grant all on public.business_addon_entitlements to service_role;

create table if not exists public.billing_quota_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quota_type text not null check (quota_type in ('sms','email','ai_requests','ai_tokens')),
  period_start timestamptz not null,
  period_end timestamptz,
  used_amount bigint not null,
  limit_amount bigint not null,
  popup_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(business_id,quota_type,period_start,limit_amount)
);
alter table public.billing_quota_alerts enable row level security;
drop policy if exists "Owners read quota alerts" on public.billing_quota_alerts;
create policy "Owners read quota alerts" on public.billing_quota_alerts
  for select to authenticated using (public.has_business_access(business_id));
drop policy if exists "Owners mark quota alerts seen" on public.billing_quota_alerts;
create policy "Owners mark quota alerts seen" on public.billing_quota_alerts
  for update to authenticated using (public.has_business_access(business_id)) with check (public.has_business_access(business_id));
grant select,update on public.billing_quota_alerts to authenticated;
grant all on public.billing_quota_alerts to service_role;

-- Notifications gain a dedicated billing quota type.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_appointment','new_customer','ai_briefing','ai_alert','platform_announcement',
  'support_reply','support_status','billing_quota'
));

-- ---------------------------------------------------------------------------
-- 3. Effective allowances combine plan capacity with active add-ons.
-- ---------------------------------------------------------------------------
create or replace function public.get_business_addon_allowances(p_business_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with active_rows as (
    select c.category, e.units, e.token_units,
           (c.addon_id='pos_suite') as is_pos
    from public.business_addon_entitlements e
    join public.billing_addon_catalog c on c.addon_id=e.addon_id
    where e.business_id=p_business_id and e.status='active'
      and (e.ends_at is null or e.ends_at>now())
  )
  select jsonb_build_object(
    'sms',coalesce(sum(units) filter(where category='sms'),0),
    'email',coalesce(sum(units) filter(where category='email'),0),
    'ai_requests',coalesce(sum(units) filter(where category='ai'),0),
    'ai_tokens',coalesce(sum(token_units) filter(where category='ai'),0),
    'pos_active',coalesce(bool_or(is_pos),false)
  ) from active_rows;
$$;
revoke all on function public.get_business_addon_allowances(uuid) from public;
grant execute on function public.get_business_addon_allowances(uuid) to authenticated,service_role;

create or replace function public.get_business_billing_summary(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_subscription public.subscriptions%rowtype; v_plan public.billing_plans%rowtype;
  v_staff integer:=0; v_ai_requests integer:=0; v_ai_tokens bigint:=0; v_emails integer:=0; v_sms integer:=0;
  v_usage_start timestamptz; v_addons jsonb; v_effective jsonb;
begin
  if auth.role()<>'service_role' and not public.has_business_access(p_business_id) then
    raise exception using errcode='42501',message='Business access is required.';
  end if;
  select * into v_subscription from public.subscriptions where business_id=p_business_id;
  select * into v_plan from public.billing_plans where plan_id=coalesce(v_subscription.plan_id,'pro');
  v_staff:=public.business_staff_count(p_business_id);
  v_usage_start:=coalesce(v_subscription.current_period_start,v_subscription.trial_started_at,date_trunc('month',now()));
  select count(*)::integer,coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)),0)::bigint
    into v_ai_requests,v_ai_tokens from public.ai_usage_events where business_id=p_business_id and created_at>=v_usage_start and success=true;
  select count(*) filter(where channel='email')::integer,count(*) filter(where channel='sms')::integer into v_emails,v_sms
    from public.notification_deliveries where business_id=p_business_id and created_at>=v_usage_start and status in ('sent','delivered');
  select v_emails+count(*) filter(where channel='email')::integer,v_sms+count(*) filter(where channel='sms')::integer into v_emails,v_sms
    from public.marketing_deliveries where business_id=p_business_id and created_at>=v_usage_start and status in ('sent','delivered');
  v_addons:=public.get_business_addon_allowances(p_business_id);
  v_effective:=jsonb_build_object(
    'email',coalesce(v_plan.email_monthly,0)+coalesce((v_addons->>'email')::integer,0),
    'sms',coalesce(v_plan.sms_monthly,0)+coalesce((v_addons->>'sms')::integer,0),
    'ai_requests',coalesce(v_plan.ai_requests_monthly,0)+coalesce((v_addons->>'ai_requests')::integer,0),
    'ai_tokens',coalesce(v_plan.ai_tokens_monthly,0)+coalesce((v_addons->>'ai_tokens')::bigint,0)
  );
  return jsonb_build_object(
    'subscription',coalesce(to_jsonb(v_subscription),'{}'::jsonb),'plan',coalesce(to_jsonb(v_plan),'{}'::jsonb),
    'addons',v_addons,'effective_limits',v_effective,
    'usage',jsonb_build_object('staff',v_staff,'ai_requests',v_ai_requests,'ai_tokens',v_ai_tokens,'email',v_emails,'sms',v_sms),
    'usage_period',jsonb_build_object('start',v_usage_start,'end',v_subscription.current_period_end),
    'access_allowed',coalesce(v_subscription.status in ('trialing','active') or (v_subscription.status='past_due' and v_subscription.grace_until is not null and v_subscription.grace_until>now()),false),
    'billing_required',v_subscription.id is null or v_subscription.status in ('incomplete','incomplete_expired','unpaid','canceled','paused') or (v_subscription.status='past_due' and (v_subscription.grace_until is null or v_subscription.grace_until<=now()))
  );
end; $$;
revoke all on function public.get_business_billing_summary(uuid) from public;
grant execute on function public.get_business_billing_summary(uuid) to authenticated,service_role;

-- Record a quota alert once per billing period/type and notify all owners.
create or replace function public.billing_create_quota_alert(p_business_id uuid,p_quota_type text,p_used bigint,p_limit bigint,p_period_start timestamptz,p_period_end timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_limit<=0 or p_used<p_limit or p_quota_type not in ('sms','email','ai_requests','ai_tokens') then return; end if;
  insert into public.billing_quota_alerts(business_id,quota_type,period_start,period_end,used_amount,limit_amount)
  values(p_business_id,p_quota_type,p_period_start,p_period_end,p_used,p_limit)
  on conflict(business_id,quota_type,period_start,limit_amount) do update set used_amount=greatest(public.billing_quota_alerts.used_amount,excluded.used_amount)
  returning id into v_id;
  if not exists(select 1 from public.notifications where business_id=p_business_id and type='billing_quota' and metadata->>'quota_alert_id'=v_id::text) then
    insert into public.notifications(business_id,user_id,title,message,type,is_read,metadata)
    select p_business_id,bm.user_id,'Monthly allowance reached',
      case p_quota_type when 'sms' then 'Your SMS allowance is fully used.' when 'email' then 'Your email allowance is fully used.' when 'ai_requests' then 'Your Velliqo AI request allowance is fully used.' else 'Your Velliqo AI token allowance is fully used.' end,
      'billing_quota',false,jsonb_build_object('quota_alert_id',v_id,'quota_type',p_quota_type,'used',p_used,'limit',p_limit,'route','/dashboard/addons')
    from public.business_members bm where bm.business_id=p_business_id and bm.role='Owner';
  end if;
end; $$;
revoke all on function public.billing_create_quota_alert(uuid,text,bigint,bigint,timestamptz,timestamptz) from public;
grant execute on function public.billing_create_quota_alert(uuid,text,bigint,bigint,timestamptz,timestamptz) to service_role;


create or replace function public.billing_can_send_communication(p_business_id uuid,p_channel text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_summary jsonb; v_limit integer; v_used integer; v_start timestamptz; v_end timestamptz;
begin
  if p_channel not in ('email','sms') then return jsonb_build_object('allowed',true,'limit',null,'used',0); end if;
  v_summary:=public.get_business_billing_summary(p_business_id);
  if coalesce((v_summary->>'access_allowed')::boolean,false)=false then return jsonb_build_object('allowed',false,'reason','billing_inactive','limit',0,'used',0); end if;
  v_limit:=coalesce((v_summary #>> array['effective_limits',p_channel])::integer,0);
  v_used:=coalesce((v_summary #>> array['usage',p_channel])::integer,0);
  if v_limit > 0 and v_used >= v_limit then
    v_start:=coalesce((v_summary #>> '{usage_period,start}')::timestamptz,date_trunc('month',now()));
    v_end:=nullif(v_summary #>> '{usage_period,end}','')::timestamptz;
    perform public.billing_create_quota_alert(p_business_id,p_channel,v_used,v_limit,v_start,v_end);
  end if;
  return jsonb_build_object('allowed',v_used<v_limit,'limit',v_limit,'used',v_used);
end; $$;
revoke all on function public.billing_can_send_communication(uuid,text) from public;
grant execute on function public.billing_can_send_communication(uuid,text) to service_role;

-- Owner-callable catalogue/status summary.
create or replace function public.get_owner_addons(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.business_members where business_id=p_business_id and user_id=auth.uid() and role='Owner') then
    raise exception using errcode='42501',message='Owner access is required.';
  end if;
  return jsonb_build_object(
    'catalog',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb) from public.billing_addon_catalog c where c.active=true),
    'entitlements',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) from public.business_addon_entitlements e where e.business_id=p_business_id),
    'billing',public.get_business_billing_summary(p_business_id)
  );
end; $$;
revoke all on function public.get_owner_addons(uuid) from public;
grant execute on function public.get_owner_addons(uuid) to authenticated;

create or replace function public.owner_check_quota_alerts(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_summary jsonb; v_start timestamptz; v_end timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.business_members where business_id=p_business_id and user_id=auth.uid() and role='Owner') then
    raise exception using errcode='42501',message='Owner access is required.';
  end if;
  v_summary:=public.get_business_billing_summary(p_business_id);
  v_start:=coalesce((v_summary #>> '{usage_period,start}')::timestamptz,date_trunc('month',now()));
  v_end:=nullif(v_summary #>> '{usage_period,end}','')::timestamptz;
  perform public.billing_create_quota_alert(p_business_id,'sms',coalesce((v_summary #>> '{usage,sms}')::bigint,0),coalesce((v_summary #>> '{effective_limits,sms}')::bigint,0),v_start,v_end);
  perform public.billing_create_quota_alert(p_business_id,'email',coalesce((v_summary #>> '{usage,email}')::bigint,0),coalesce((v_summary #>> '{effective_limits,email}')::bigint,0),v_start,v_end);
  perform public.billing_create_quota_alert(p_business_id,'ai_requests',coalesce((v_summary #>> '{usage,ai_requests}')::bigint,0),coalesce((v_summary #>> '{effective_limits,ai_requests}')::bigint,0),v_start,v_end);
  perform public.billing_create_quota_alert(p_business_id,'ai_tokens',coalesce((v_summary #>> '{usage,ai_tokens}')::bigint,0),coalesce((v_summary #>> '{effective_limits,ai_tokens}')::bigint,0),v_start,v_end);
  return jsonb_build_object('summary',v_summary,'alerts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) from public.billing_quota_alerts a where a.business_id=p_business_id and a.popup_seen_at is null));
end; $$;
revoke all on function public.owner_check_quota_alerts(uuid) from public;
grant execute on function public.owner_check_quota_alerts(uuid) to authenticated;

create or replace function public.owner_mark_quota_alert_seen(p_alert_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.billing_quota_alerts a set popup_seen_at=coalesce(a.popup_seen_at,now())
  where a.id=p_alert_id and exists(select 1 from public.business_members bm where bm.business_id=a.business_id and bm.user_id=auth.uid() and bm.role='Owner');
end; $$;
revoke all on function public.owner_mark_quota_alert_seen(uuid) from public;
grant execute on function public.owner_mark_quota_alert_seen(uuid) to authenticated;

-- POS provider connection state; actual payment processing is performed only
-- after the owner connects their own merchant account. Velliqo never absorbs
-- the merchant's card-processing fees.
create table if not exists public.business_payment_accounts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  provider text not null default 'stripe',
  provider_account_id text,
  onboarding_status text not null default 'not_started' check(onboarding_status in ('not_started','pending','restricted','ready')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  processing_fees_paid_by_owner boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.business_payment_accounts enable row level security;
drop policy if exists "Owners read payment account" on public.business_payment_accounts;
create policy "Owners read payment account" on public.business_payment_accounts for select to authenticated using(public.has_business_access(business_id));
grant select on public.business_payment_accounts to authenticated;
grant all on public.business_payment_accounts to service_role;


-- ---------------------------------------------------------------------------
-- 4. Detailed recurring platform cost ledger. This lets the Platform Admin
-- keep Supabase/Vercel/Resend/domain/monitoring/etc. as separate cost lines
-- instead of hiding every fixed expense inside one aggregate number.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_fixed_cost_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  category text not null default 'infrastructure' check (category in ('infrastructure','email','sms','ai','monitoring','domain','support','legal','other')),
  monthly_cost_eur numeric(12,4) not null default 0 check (monthly_cost_eur >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_fixed_cost_items enable row level security;
drop policy if exists "Platform admin manages fixed cost items" on public.platform_fixed_cost_items;
create policy "Platform admin manages fixed cost items" on public.platform_fixed_cost_items
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select,insert,update,delete on public.platform_fixed_cost_items to authenticated;
grant all on public.platform_fixed_cost_items to service_role;

-- ---------------------------------------------------------------------------
-- 5. Platform economics includes recurring add-on MRR and separates plan/add-on
-- paid revenue while preserving the existing total revenue fields.
-- ---------------------------------------------------------------------------
create or replace function public.platform_admin_financial_summary(
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
  v_cost public.platform_cost_settings%rowtype;
  v_revenue numeric := 0; v_plan_revenue numeric := 0; v_addon_revenue numeric := 0;
  v_invoice_count bigint := 0; v_charged_invoice_count bigint := 0;
  v_ai_requests bigint := 0; v_ai_tokens bigint := 0; v_ai_cost numeric := 0;
  v_email_count bigint := 0; v_sms_count bigint := 0;
  v_payment_cost numeric := 0; v_fixed_cost numeric := 0; v_total_cost numeric := 0; v_profit numeric := 0;
  v_month_fraction numeric := 0; v_plan_mrr numeric := 0; v_addon_mrr numeric := 0; v_fixed_items_monthly numeric := 0;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_from >= p_to then raise exception 'INVALID_PERIOD'; end if;
  select * into v_cost from public.platform_cost_settings where id = true;

  select coalesce(sum(amount_paid),0)::numeric/100.0,
         coalesce(sum(amount_paid) filter(where coalesce(invoice_kind,'plan')='plan'),0)::numeric/100.0,
         coalesce(sum(amount_paid) filter(where invoice_kind='addon'),0)::numeric/100.0,
         count(*),count(*) filter(where amount_paid>0)
  into v_revenue,v_plan_revenue,v_addon_revenue,v_invoice_count,v_charged_invoice_count
  from public.billing_invoices
  where status='paid' and coalesce(paid_at,created_at)>=p_from and coalesce(paid_at,created_at)<p_to;

  select count(*),coalesce(sum(input_tokens+output_tokens),0),coalesce(sum(estimated_cost),0)
  into v_ai_requests,v_ai_tokens,v_ai_cost from public.ai_usage_events
  where success=true and created_at>=p_from and created_at<p_to;

  select count(*) filter(where channel='email' and status in ('sent','delivered')),
         count(*) filter(where channel='sms' and status in ('sent','delivered'))
  into v_email_count,v_sms_count from public.notification_deliveries
  where created_at>=p_from and created_at<p_to;

  select coalesce(sum(case when s.status in ('active','past_due') then
    coalesce(s.unit_amount,bp.monthly_price_cents,0)::numeric/100.0 * (1-coalesce(o.percent_off,0)::numeric/100.0) else 0 end),0)
  into v_plan_mrr from public.subscriptions s
  left join public.billing_plans bp on bp.plan_id=s.plan_id
  left join public.billing_offer_codes o on o.id=s.offer_code_id;

  select coalesce(sum(c.monthly_price_cents),0)::numeric/100.0 into v_addon_mrr
  from public.business_addon_entitlements e join public.billing_addon_catalog c on c.addon_id=e.addon_id
  where e.purchase_mode='recurring' and e.status in ('active','past_due') and (e.ends_at is null or e.ends_at>now());

  select coalesce(sum(monthly_cost_eur),0) into v_fixed_items_monthly from public.platform_fixed_cost_items where active=true;
  v_month_fraction:=greatest(0,extract(epoch from (p_to-p_from))/2629800.0);
  v_fixed_cost:=(coalesce(v_cost.fixed_monthly_cost_eur,0)+v_fixed_items_monthly)*v_month_fraction;
  v_payment_cost:=v_revenue*coalesce(v_cost.payment_fee_percent,0)/100.0 + v_charged_invoice_count*coalesce(v_cost.payment_fee_fixed_eur,0);
  v_total_cost:=v_ai_cost + v_email_count*coalesce(v_cost.email_unit_cost_eur,0) + v_sms_count*coalesce(v_cost.sms_unit_cost_eur,0) + v_payment_cost + v_fixed_cost;
  v_profit:=v_revenue-v_total_cost;

  return jsonb_build_object(
    'period',jsonb_build_object('from',p_from,'to',p_to,'month_fraction',round(v_month_fraction,4)),
    'actual_paid_revenue_eur',round(v_revenue,2),'plan_paid_revenue_eur',round(v_plan_revenue,2),'addon_paid_revenue_eur',round(v_addon_revenue,2),
    'paid_invoice_count',v_invoice_count,'current_mrr_eur',round(v_plan_mrr+v_addon_mrr,2),'plan_mrr_eur',round(v_plan_mrr,2),'addon_mrr_eur',round(v_addon_mrr,2),
    'ai_requests',v_ai_requests,'ai_tokens',v_ai_tokens,'ai_cost_eur',round(v_ai_cost,6),
    'email_count',v_email_count,'email_cost_eur',round(v_email_count*coalesce(v_cost.email_unit_cost_eur,0),6),
    'sms_count',v_sms_count,'sms_cost_eur',round(v_sms_count*coalesce(v_cost.sms_unit_cost_eur,0),6),
    'payment_cost_eur',round(v_payment_cost,4),'fixed_infrastructure_cost_eur',round(v_fixed_cost,4),'fixed_cost_items_monthly_eur',round(v_fixed_items_monthly,4),'total_operating_cost_eur',round(v_total_cost,4),
    'estimated_operating_contribution_eur',round(v_profit,4),'operating_margin_percent',case when v_revenue>0 then round(v_profit/v_revenue*100,2) else 0 end,
    'fixed_cost_items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,'monthly_cost_eur',monthly_cost_eur,'notes',notes,'active',active) order by category,name),'[]'::jsonb) from public.platform_fixed_cost_items where active=true),
    'cost_model',jsonb_build_object('fixed_monthly_cost_eur',coalesce(v_cost.fixed_monthly_cost_eur,0),'email_unit_cost_eur',coalesce(v_cost.email_unit_cost_eur,0),'sms_unit_cost_eur',coalesce(v_cost.sms_unit_cost_eur,0),'payment_fee_percent',coalesce(v_cost.payment_fee_percent,0),'payment_fee_fixed_eur',coalesce(v_cost.payment_fee_fixed_eur,0))
  );
end;
$$;
grant execute on function public.platform_admin_financial_summary(timestamptz,timestamptz) to authenticated;

create or replace function public.platform_admin_financial_owner_rows(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
)
returns table (
  business_id uuid,business_name text,owner_name text,owner_email text,plan_id text,subscription_status text,
  paid_revenue_eur numeric,paid_invoice_count bigint,ai_requests bigint,ai_tokens bigint,ai_cost_eur numeric,
  email_count bigint,email_cost_eur numeric,sms_count bigint,sms_cost_eur numeric,payment_cost_eur numeric,
  allocated_infrastructure_cost_eur numeric,total_cost_eur numeric,estimated_contribution_eur numeric,margin_percent numeric
)
language sql stable security definer set search_path=public as $$
  with settings as (
    select * from public.platform_cost_settings where id=true
  ), fixed_items as (
    select coalesce(sum(monthly_cost_eur),0)::numeric monthly_total from public.platform_fixed_cost_items where active=true
  ), tenant_count as (
    select greatest(1,count(*))::numeric n from public.businesses b where coalesce(b.status,'active')='active'
  ), base as (
    select b.id business_id,b.name business_name,p.full_name owner_name,p.email owner_email,s.plan_id,s.status subscription_status
    from public.businesses b
    left join lateral (select bm.user_id from public.business_members bm where bm.business_id=b.id and bm.role='Owner' order by bm.created_at limit 1) om on true
    left join public.profiles p on p.id=om.user_id
    left join public.subscriptions s on s.business_id=b.id
    where public.is_platform_admin()
  ), usage as (
    select x.*,
      (select coalesce(sum(i.amount_paid),0)::numeric/100.0 from public.billing_invoices i where i.business_id=x.business_id and i.status='paid' and coalesce(i.paid_at,i.created_at)>=p_from and coalesce(i.paid_at,i.created_at)<p_to) paid_revenue,
      (select count(*) from public.billing_invoices i where i.business_id=x.business_id and i.status='paid' and coalesce(i.paid_at,i.created_at)>=p_from and coalesce(i.paid_at,i.created_at)<p_to) invoice_count,
      (select count(*) from public.billing_invoices i where i.business_id=x.business_id and i.status='paid' and i.amount_paid>0 and coalesce(i.paid_at,i.created_at)>=p_from and coalesce(i.paid_at,i.created_at)<p_to) charged_invoice_count,
      (select count(*) from public.ai_usage_events a where a.business_id=x.business_id and a.success=true and a.created_at>=p_from and a.created_at<p_to) ai_requests,
      (select coalesce(sum(a.input_tokens+a.output_tokens),0) from public.ai_usage_events a where a.business_id=x.business_id and a.success=true and a.created_at>=p_from and a.created_at<p_to) ai_tokens,
      (select coalesce(sum(a.estimated_cost),0) from public.ai_usage_events a where a.business_id=x.business_id and a.success=true and a.created_at>=p_from and a.created_at<p_to) ai_cost,
      (select count(*) from public.notification_deliveries n where n.business_id=x.business_id and n.channel='email' and n.status in ('sent','delivered') and n.created_at>=p_from and n.created_at<p_to) emails,
      (select count(*) from public.notification_deliveries n where n.business_id=x.business_id and n.channel='sms' and n.status in ('sent','delivered') and n.created_at>=p_from and n.created_at<p_to) sms
    from base x
  ), calculated as (
    select u.*,s.email_unit_cost_eur,s.sms_unit_cost_eur,s.payment_fee_percent,s.payment_fee_fixed_eur,
      (coalesce(s.fixed_monthly_cost_eur,0)+fi.monthly_total) * greatest(0,extract(epoch from (p_to-p_from))/2629800.0) / tc.n allocated_fixed,
      u.paid_revenue*coalesce(s.payment_fee_percent,0)/100.0 + u.charged_invoice_count*coalesce(s.payment_fee_fixed_eur,0) payment_cost
    from usage u cross join settings s cross join fixed_items fi cross join tenant_count tc
  )
  select c.business_id,c.business_name,c.owner_name,c.owner_email,c.plan_id,c.subscription_status,
    round(c.paid_revenue,2),c.invoice_count,c.ai_requests,c.ai_tokens,round(c.ai_cost,6),c.emails,
    round(c.emails*coalesce(c.email_unit_cost_eur,0),6),c.sms,round(c.sms*coalesce(c.sms_unit_cost_eur,0),6),
    round(c.payment_cost,4),round(c.allocated_fixed,4),
    round(c.ai_cost+c.emails*coalesce(c.email_unit_cost_eur,0)+c.sms*coalesce(c.sms_unit_cost_eur,0)+c.payment_cost+c.allocated_fixed,4),
    round(c.paid_revenue-(c.ai_cost+c.emails*coalesce(c.email_unit_cost_eur,0)+c.sms*coalesce(c.sms_unit_cost_eur,0)+c.payment_cost+c.allocated_fixed),4),
    case when c.paid_revenue>0 then round((c.paid_revenue-(c.ai_cost+c.emails*coalesce(c.email_unit_cost_eur,0)+c.sms*coalesce(c.sms_unit_cost_eur,0)+c.payment_cost+c.allocated_fixed))/c.paid_revenue*100,2) else 0 end
  from calculated c order by c.paid_revenue desc,c.business_name;
$$;
grant execute on function public.platform_admin_financial_owner_rows(timestamptz,timestamptz) to authenticated;

commit;
