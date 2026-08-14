-- 00054_velliqo_training_video_financial_intelligence.sql
-- Detailed platform economics and AI cost exports for the Velliqo Platform Admin.

begin;

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
  v_revenue numeric := 0;
  v_invoice_count bigint := 0;
  v_charged_invoice_count bigint := 0;
  v_ai_requests bigint := 0;
  v_ai_tokens bigint := 0;
  v_ai_cost numeric := 0;
  v_email_count bigint := 0;
  v_sms_count bigint := 0;
  v_payment_cost numeric := 0;
  v_fixed_cost numeric := 0;
  v_total_cost numeric := 0;
  v_profit numeric := 0;
  v_month_fraction numeric := 0;
  v_mrr numeric := 0;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_from >= p_to then raise exception 'INVALID_PERIOD'; end if;

  select * into v_cost from public.platform_cost_settings where id = true;

  select
    coalesce(sum(amount_paid),0)::numeric / 100.0,
    count(*),
    count(*) filter (where amount_paid > 0)
  into v_revenue, v_invoice_count, v_charged_invoice_count
  from public.billing_invoices
  where status = 'paid'
    and coalesce(paid_at, created_at) >= p_from
    and coalesce(paid_at, created_at) < p_to;

  select
    count(*),
    coalesce(sum(input_tokens + output_tokens),0),
    coalesce(sum(estimated_cost),0)
  into v_ai_requests, v_ai_tokens, v_ai_cost
  from public.ai_usage_events
  where success = true and created_at >= p_from and created_at < p_to;

  select
    count(*) filter (where channel='email' and status in ('sent','delivered')),
    count(*) filter (where channel='sms' and status in ('sent','delivered'))
  into v_email_count, v_sms_count
  from public.notification_deliveries
  where created_at >= p_from and created_at < p_to;

  select coalesce(sum(
    case when s.status in ('active','past_due') then
      coalesce(s.unit_amount,bp.monthly_price_cents,0)::numeric / 100.0 * (1-coalesce(o.percent_off,0)::numeric/100.0)
    else 0 end
  ),0)
  into v_mrr
  from public.subscriptions s
  left join public.billing_plans bp on bp.plan_id=s.plan_id
  left join public.billing_offer_codes o on o.id=s.offer_code_id;

  v_month_fraction := greatest(0, extract(epoch from (p_to-p_from)) / 2629800.0);
  v_fixed_cost := coalesce(v_cost.fixed_monthly_cost_eur,0) * v_month_fraction;
  v_payment_cost := v_revenue * coalesce(v_cost.payment_fee_percent,0) / 100.0
    + v_charged_invoice_count * coalesce(v_cost.payment_fee_fixed_eur,0);
  v_total_cost := v_ai_cost
    + v_email_count * coalesce(v_cost.email_unit_cost_eur,0)
    + v_sms_count * coalesce(v_cost.sms_unit_cost_eur,0)
    + v_payment_cost
    + v_fixed_cost;
  v_profit := v_revenue - v_total_cost;

  return jsonb_build_object(
    'period', jsonb_build_object('from',p_from,'to',p_to,'month_fraction',round(v_month_fraction,4)),
    'actual_paid_revenue_eur', round(v_revenue,2),
    'paid_invoice_count', v_invoice_count,
    'current_mrr_eur', round(v_mrr,2),
    'ai_requests', v_ai_requests,
    'ai_tokens', v_ai_tokens,
    'ai_cost_eur', round(v_ai_cost,6),
    'email_count', v_email_count,
    'email_cost_eur', round(v_email_count*coalesce(v_cost.email_unit_cost_eur,0),6),
    'sms_count', v_sms_count,
    'sms_cost_eur', round(v_sms_count*coalesce(v_cost.sms_unit_cost_eur,0),6),
    'payment_cost_eur', round(v_payment_cost,4),
    'fixed_infrastructure_cost_eur', round(v_fixed_cost,4),
    'total_operating_cost_eur', round(v_total_cost,4),
    'estimated_operating_contribution_eur', round(v_profit,4),
    'operating_margin_percent', case when v_revenue > 0 then round(v_profit/v_revenue*100,2) else 0 end,
    'cost_model', jsonb_build_object(
      'fixed_monthly_cost_eur',coalesce(v_cost.fixed_monthly_cost_eur,0),
      'email_unit_cost_eur',coalesce(v_cost.email_unit_cost_eur,0),
      'sms_unit_cost_eur',coalesce(v_cost.sms_unit_cost_eur,0),
      'payment_fee_percent',coalesce(v_cost.payment_fee_percent,0),
      'payment_fee_fixed_eur',coalesce(v_cost.payment_fee_fixed_eur,0)
    )
  );
end;
$$;

grant execute on function public.platform_admin_financial_summary(timestamptz,timestamptz) to authenticated;

create or replace function public.platform_admin_financial_owner_rows(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
)
returns table (
  business_id uuid,
  business_name text,
  owner_name text,
  owner_email text,
  plan_id text,
  subscription_status text,
  paid_revenue_eur numeric,
  paid_invoice_count bigint,
  ai_requests bigint,
  ai_tokens bigint,
  ai_cost_eur numeric,
  email_count bigint,
  email_cost_eur numeric,
  sms_count bigint,
  sms_cost_eur numeric,
  payment_cost_eur numeric,
  allocated_infrastructure_cost_eur numeric,
  total_cost_eur numeric,
  estimated_contribution_eur numeric,
  margin_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with settings as (
    select * from public.platform_cost_settings where id=true
  ), tenant_count as (
    select greatest(1,count(*))::numeric n
    from public.businesses b
    where coalesce(b.status,'active')='active'
  ), base as (
    select b.id business_id,b.name business_name,p.full_name owner_name,p.email owner_email,s.plan_id,s.status subscription_status
    from public.businesses b
    left join lateral (
      select bm.user_id from public.business_members bm where bm.business_id=b.id and bm.role='Owner' order by bm.created_at limit 1
    ) om on true
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
      coalesce(s.fixed_monthly_cost_eur,0) * greatest(0,extract(epoch from (p_to-p_from))/2629800.0) / tc.n allocated_fixed,
      u.paid_revenue*coalesce(s.payment_fee_percent,0)/100.0 + u.charged_invoice_count*coalesce(s.payment_fee_fixed_eur,0) payment_cost
    from usage u cross join settings s cross join tenant_count tc
  )
  select c.business_id,c.business_name,c.owner_name,c.owner_email,c.plan_id,c.subscription_status,
    round(c.paid_revenue,2),c.invoice_count,c.ai_requests,c.ai_tokens,round(c.ai_cost,6),c.emails,
    round(c.emails*coalesce(c.email_unit_cost_eur,0),6),c.sms,
    round(c.sms*coalesce(c.sms_unit_cost_eur,0),6),round(c.payment_cost,4),round(c.allocated_fixed,4),
    round(c.ai_cost + c.emails*coalesce(c.email_unit_cost_eur,0) + c.sms*coalesce(c.sms_unit_cost_eur,0) + c.payment_cost + c.allocated_fixed,4),
    round(c.paid_revenue - (c.ai_cost + c.emails*coalesce(c.email_unit_cost_eur,0) + c.sms*coalesce(c.sms_unit_cost_eur,0) + c.payment_cost + c.allocated_fixed),4),
    case when c.paid_revenue>0 then round((c.paid_revenue - (c.ai_cost + c.emails*coalesce(c.email_unit_cost_eur,0) + c.sms*coalesce(c.sms_unit_cost_eur,0) + c.payment_cost + c.allocated_fixed))/c.paid_revenue*100,2) else 0 end
  from calculated c
  order by c.paid_revenue desc,c.business_name;
$$;

grant execute on function public.platform_admin_financial_owner_rows(timestamptz,timestamptz) to authenticated;

create or replace function public.platform_admin_ai_usage_rows(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
)
returns table (
  created_at timestamptz,
  business_id uuid,
  business_name text,
  owner_email text,
  plan_id text,
  agent_key text,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  total_tokens bigint,
  estimated_cost_eur numeric,
  success boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.created_at,a.business_id,b.name,p.email,s.plan_id,a.agent_key,a.provider,a.model,a.input_tokens,a.output_tokens,
    (a.input_tokens+a.output_tokens)::bigint,round(a.estimated_cost,6),a.success
  from public.ai_usage_events a
  join public.businesses b on b.id=a.business_id
  left join lateral (
    select bm.user_id from public.business_members bm where bm.business_id=b.id and bm.role='Owner' order by bm.created_at limit 1
  ) om on true
  left join public.profiles p on p.id=om.user_id
  left join public.subscriptions s on s.business_id=b.id
  where public.is_platform_admin() and a.created_at>=p_from and a.created_at<p_to
  order by a.created_at desc;
$$;

grant execute on function public.platform_admin_ai_usage_rows(timestamptz,timestamptz) to authenticated;

commit;
