-- 00053_velliqo_support_control_plane_and_discovery_live_search.sql
-- Platform support inbox, owner Help Center, admin broadcasts, per-owner cost attribution,
-- stricter fixed-term offer windows and live discovery search support.

begin;

-- ---------------------------------------------------------------------------
-- Support requests and conversation thread
-- ---------------------------------------------------------------------------
create table if not exists public.platform_support_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  priority text not null default 'urgent',
  status text not null default 'sent',
  admin_assignee_id uuid references public.profiles(id) on delete set null,
  admin_unread boolean not null default true,
  owner_unread boolean not null default false,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_support_subject_check check (char_length(trim(subject)) between 3 and 160),
  constraint platform_support_priority_check check (priority in ('normal','urgent')),
  constraint platform_support_status_check check (status in ('sent','pending','completed','cancelled'))
);

create table if not exists public.platform_support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.platform_support_requests(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint platform_support_sender_role_check check (sender_role in ('owner','admin')),
  constraint platform_support_message_check check (char_length(trim(body)) between 1 and 5000)
);

create index if not exists platform_support_requests_business_idx
  on public.platform_support_requests(business_id, last_message_at desc);
create index if not exists platform_support_requests_admin_inbox_idx
  on public.platform_support_requests(admin_unread, status, last_message_at desc);
create index if not exists platform_support_messages_request_idx
  on public.platform_support_messages(request_id, created_at asc);

alter table public.platform_support_requests enable row level security;
alter table public.platform_support_messages enable row level security;

drop policy if exists "Owners read own support requests" on public.platform_support_requests;
create policy "Owners read own support requests"
  on public.platform_support_requests for select to authenticated
  using (owner_id = auth.uid() and public.has_business_access(business_id));

drop policy if exists "Platform admins manage support requests" on public.platform_support_requests;
create policy "Platform admins manage support requests"
  on public.platform_support_requests for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "Owners read own support messages" on public.platform_support_messages;
create policy "Owners read own support messages"
  on public.platform_support_messages for select to authenticated
  using (exists (
    select 1 from public.platform_support_requests r
    where r.id = request_id and r.owner_id = auth.uid() and public.has_business_access(r.business_id)
  ));

drop policy if exists "Platform admins manage support messages" on public.platform_support_messages;
create policy "Platform admins manage support messages"
  on public.platform_support_messages for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select on public.platform_support_requests, public.platform_support_messages to authenticated;
grant all on public.platform_support_requests, public.platform_support_messages to service_role;

-- ---------------------------------------------------------------------------
-- Platform broadcasts delivered through the existing Owner notification centre
-- ---------------------------------------------------------------------------
create table if not exists public.platform_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'info',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_broadcast_title_check check (char_length(trim(title)) between 3 and 120),
  constraint platform_broadcast_message_check check (char_length(trim(message)) between 3 and 2000),
  constraint platform_broadcast_severity_check check (severity in ('info','important','critical'))
);

alter table public.platform_broadcasts enable row level security;
drop policy if exists "Platform admins manage broadcasts" on public.platform_broadcasts;
create policy "Platform admins manage broadcasts"
  on public.platform_broadcasts for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert on public.platform_broadcasts to authenticated;
grant all on public.platform_broadcasts to service_role;

-- Extend owner notification types with platform support and announcements.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_appointment','new_customer','ai_briefing','ai_alert',
    'platform_announcement','support_reply','support_status'
  ));

-- ---------------------------------------------------------------------------
-- Owner support RPCs. Browser clients never choose the sender role/status.
-- ---------------------------------------------------------------------------
create or replace function public.owner_create_support_request(
  p_business_id uuid,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.user_id = auth.uid() and bm.role = 'Owner'
  ) then
    raise exception using errcode='42501', message='OWNER_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_subject,''))) not between 3 and 160 then
    raise exception using errcode='22023', message='INVALID_SUBJECT';
  end if;
  if char_length(trim(coalesce(p_message,''))) not between 1 and 5000 then
    raise exception using errcode='22023', message='INVALID_MESSAGE';
  end if;

  insert into public.platform_support_requests(
    business_id, owner_id, subject, priority, status, admin_unread, owner_unread,
    last_message_at, created_at, updated_at
  ) values (
    p_business_id, auth.uid(), trim(p_subject), 'urgent', 'sent', true, false,
    now(), now(), now()
  ) returning id into v_request_id;

  insert into public.platform_support_messages(request_id, sender_id, sender_role, body)
  values(v_request_id, auth.uid(), 'owner', trim(p_message));

  return v_request_id;
end;
$$;
revoke all on function public.owner_create_support_request(uuid,text,text) from public;
grant execute on function public.owner_create_support_request(uuid,text,text) to authenticated;

create or replace function public.support_add_message(
  p_request_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.platform_support_requests%rowtype;
  v_role text;
  v_message_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_message,''))) not between 1 and 5000 then
    raise exception using errcode='22023', message='INVALID_MESSAGE';
  end if;

  select * into v_request from public.platform_support_requests where id = p_request_id for update;
  if v_request.id is null then raise exception using errcode='P0002', message='REQUEST_NOT_FOUND'; end if;

  if public.is_platform_admin() then
    v_role := 'admin';
  elsif v_request.owner_id = auth.uid() and public.has_business_access(v_request.business_id) then
    v_role := 'owner';
  else
    raise exception using errcode='42501', message='REQUEST_ACCESS_DENIED';
  end if;

  if v_request.status in ('completed','cancelled') then
    raise exception using errcode='22023', message='REQUEST_CLOSED';
  end if;

  insert into public.platform_support_messages(request_id,sender_id,sender_role,body)
  values(p_request_id, auth.uid(), v_role, trim(p_message)) returning id into v_message_id;

  if v_role = 'admin' then
    update public.platform_support_requests set
      status = case when status='sent' then 'pending' else status end,
      admin_assignee_id = auth.uid(),
      admin_unread = false,
      owner_unread = true,
      last_message_at = now(), updated_at = now()
    where id = p_request_id;

    insert into public.notifications(business_id,user_id,title,message,type,is_read,metadata,created_at)
    values(
      v_request.business_id, v_request.owner_id,
      'Velliqo Support replied',
      'A new reply is available for “' || left(v_request.subject, 90) || '”.',
      'support_reply', false,
      jsonb_build_object('request_id',p_request_id,'status',case when v_request.status='sent' then 'pending' else v_request.status end),
      now()
    );
  else
    update public.platform_support_requests set
      admin_unread = true,
      owner_unread = false,
      last_message_at = now(), updated_at = now()
    where id = p_request_id;
  end if;

  return v_message_id;
end;
$$;
revoke all on function public.support_add_message(uuid,text) from public;
grant execute on function public.support_add_message(uuid,text) to authenticated;

create or replace function public.owner_mark_support_request_read(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.platform_support_requests set owner_unread=false, updated_at=now()
  where id=p_request_id and owner_id=auth.uid() and public.has_business_access(business_id);
end;
$$;
revoke all on function public.owner_mark_support_request_read(uuid) from public;
grant execute on function public.owner_mark_support_request_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Platform Admin request/broadcast controls
-- ---------------------------------------------------------------------------
create or replace function public.platform_admin_mark_request_read(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  update public.platform_support_requests set admin_unread=false, admin_assignee_id=coalesce(admin_assignee_id,auth.uid()), updated_at=now()
  where id=p_request_id;
end;
$$;
grant execute on function public.platform_admin_mark_request_read(uuid) to authenticated;

create or replace function public.platform_admin_set_request_status(
  p_request_id uuid,
  p_status text
)
returns public.platform_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.platform_support_requests%rowtype;
  v_after public.platform_support_requests%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_status not in ('sent','pending','completed','cancelled') then raise exception 'INVALID_REQUEST_STATUS'; end if;

  select * into v_before from public.platform_support_requests where id=p_request_id for update;
  if v_before.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;

  update public.platform_support_requests set
    status=p_status,
    admin_assignee_id=auth.uid(),
    admin_unread=false,
    owner_unread=true,
    closed_at=case when p_status in ('completed','cancelled') then now() else null end,
    updated_at=now()
  where id=p_request_id returning * into v_after;

  if v_before.status is distinct from p_status then
    insert into public.notifications(business_id,user_id,title,message,type,is_read,metadata,created_at)
    values(
      v_after.business_id, v_after.owner_id,
      'Support request status updated',
      'Your request “' || left(v_after.subject,90) || '” is now ' || initcap(p_status) || '.',
      'support_status', false,
      jsonb_build_object('request_id',p_request_id,'status',p_status),
      now()
    );
  end if;

  insert into public.platform_admin_audit_logs(actor_id,business_id,action,target_type,target_id,before_state,after_state)
  values(auth.uid(),v_after.business_id,'support_request_status','support_request',p_request_id::text,to_jsonb(v_before),to_jsonb(v_after));
  return v_after;
end;
$$;
grant execute on function public.platform_admin_set_request_status(uuid,text) to authenticated;

create or replace function public.platform_admin_create_broadcast(
  p_title text,
  p_message text,
  p_severity text default 'info'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_severity not in ('info','important','critical') then raise exception 'INVALID_SEVERITY'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 120 then raise exception 'INVALID_TITLE'; end if;
  if char_length(trim(coalesce(p_message,''))) not between 3 and 2000 then raise exception 'INVALID_MESSAGE'; end if;

  insert into public.platform_broadcasts(title,message,severity,created_by)
  values(trim(p_title),trim(p_message),p_severity,auth.uid()) returning id into v_id;

  insert into public.notifications(business_id,user_id,title,message,type,is_read,metadata,created_at)
  select bm.business_id,bm.user_id,trim(p_title),trim(p_message),'platform_announcement',false,
    jsonb_build_object('broadcast_id',v_id,'severity',p_severity),now()
  from public.business_members bm
  join public.businesses b on b.id=bm.business_id
  where bm.role='Owner' and coalesce(b.status,'active')='active';

  insert into public.platform_admin_audit_logs(actor_id,action,target_type,target_id,after_state)
  values(auth.uid(),'platform_broadcast','broadcast',v_id::text,jsonb_build_object('title',trim(p_title),'severity',p_severity));
  return v_id;
end;
$$;
grant execute on function public.platform_admin_create_broadcast(text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-owner cost attribution for the current Stripe billing period.
-- Shared fixed cost is allocated equally across active/trialing/past_due tenants.
-- Provider-specific AI cost is taken from recorded ai_usage_events.
-- ---------------------------------------------------------------------------
create or replace function public.platform_admin_owner_cost_rows()
returns table (
  business_id uuid,
  business_name text,
  owner_name text,
  owner_email text,
  plan_id text,
  subscription_status text,
  period_start timestamptz,
  period_end timestamptz,
  estimated_revenue_eur numeric,
  ai_requests bigint,
  ai_tokens bigint,
  ai_cost_eur numeric,
  email_count bigint,
  email_cost_eur numeric,
  sms_count bigint,
  sms_cost_eur numeric,
  payment_cost_eur numeric,
  allocated_fixed_cost_eur numeric,
  total_estimated_cost_eur numeric,
  estimated_contribution_eur numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with settings as (
    select * from public.platform_cost_settings where id=true
  ), tenant_count as (
    select greatest(1,count(*))::numeric as count
    from public.subscriptions
    where status in ('trialing','active','past_due')
  ), base as (
    select b.id business_id,b.name business_name,p.full_name owner_name,p.email owner_email,
      s.plan_id,s.status subscription_status,
      coalesce(s.current_period_start,date_trunc('month',now())) period_start,
      coalesce(s.current_period_end,date_trunc('month',now())+interval '1 month') period_end,
      case when s.status in ('active','past_due') then
        (coalesce(s.unit_amount,bp.monthly_price_cents,0)::numeric / 100.0) * (1-coalesce(o.percent_off,0)::numeric/100.0)
      else 0::numeric end estimated_revenue_eur
    from public.businesses b
    left join lateral (
      select bm.user_id from public.business_members bm where bm.business_id=b.id and bm.role='Owner' order by bm.created_at limit 1
    ) om on true
    left join public.profiles p on p.id=om.user_id
    left join public.subscriptions s on s.business_id=b.id
    left join public.billing_plans bp on bp.plan_id=s.plan_id
    left join public.billing_offer_codes o on o.id=s.offer_code_id
    where public.is_platform_admin()
  ), usage as (
    select x.*,
      (select count(*) from public.ai_usage_events a where a.business_id=x.business_id and a.created_at>=x.period_start and a.created_at<x.period_end and a.success=true) ai_requests,
      (select coalesce(sum(a.input_tokens+a.output_tokens),0) from public.ai_usage_events a where a.business_id=x.business_id and a.created_at>=x.period_start and a.created_at<x.period_end and a.success=true) ai_tokens,
      (select coalesce(sum(a.estimated_cost),0) from public.ai_usage_events a where a.business_id=x.business_id and a.created_at>=x.period_start and a.created_at<x.period_end and a.success=true) ai_cost_eur,
      (select count(*) from public.notification_deliveries n where n.business_id=x.business_id and n.channel='email' and n.created_at>=x.period_start and n.created_at<x.period_end and n.status in ('sent','delivered')) email_count,
      (select count(*) from public.notification_deliveries n where n.business_id=x.business_id and n.channel='sms' and n.created_at>=x.period_start and n.created_at<x.period_end and n.status in ('sent','delivered')) sms_count
    from base x
  )
  select u.business_id,u.business_name,u.owner_name,u.owner_email,u.plan_id,u.subscription_status,u.period_start,u.period_end,
    round(u.estimated_revenue_eur,2),u.ai_requests,u.ai_tokens,round(u.ai_cost_eur,6),u.email_count,
    round(u.email_count*coalesce(s.email_unit_cost_eur,0),6),u.sms_count,
    round(u.sms_count*coalesce(s.sms_unit_cost_eur,0),6),
    round(case when u.estimated_revenue_eur>0 then u.estimated_revenue_eur*coalesce(s.payment_fee_percent,0)/100+coalesce(s.payment_fee_fixed_eur,0) else 0 end,4),
    round(coalesce(s.fixed_monthly_cost_eur,0)/tc.count,4),
    round(u.ai_cost_eur + u.email_count*coalesce(s.email_unit_cost_eur,0) + u.sms_count*coalesce(s.sms_unit_cost_eur,0)
      + case when u.estimated_revenue_eur>0 then u.estimated_revenue_eur*coalesce(s.payment_fee_percent,0)/100+coalesce(s.payment_fee_fixed_eur,0) else 0 end
      + coalesce(s.fixed_monthly_cost_eur,0)/tc.count,4),
    round(u.estimated_revenue_eur - (u.ai_cost_eur + u.email_count*coalesce(s.email_unit_cost_eur,0) + u.sms_count*coalesce(s.sms_unit_cost_eur,0)
      + case when u.estimated_revenue_eur>0 then u.estimated_revenue_eur*coalesce(s.payment_fee_percent,0)/100+coalesce(s.payment_fee_fixed_eur,0) else 0 end
      + coalesce(s.fixed_monthly_cost_eur,0)/tc.count),4)
  from usage u cross join settings s cross join tenant_count tc
  order by u.business_name;
$$;
grant execute on function public.platform_admin_owner_cost_rows() to authenticated;


create or replace function public.platform_admin_business_detail(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select jsonb_build_object(
    'business', to_jsonb(b),
    'owner', (select to_jsonb(p) from public.business_members bm join public.profiles p on p.id=bm.user_id where bm.business_id=b.id and bm.role='Owner' order by bm.created_at limit 1),
    'subscription', (select to_jsonb(s) from public.subscriptions s where s.business_id=b.id),
    'support_notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select * from public.platform_support_notes where business_id=b.id order by created_at desc limit 30) n),'[]'::jsonb),
    'audit', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.platform_admin_audit_logs where business_id=b.id order by created_at desc limit 30) a),'[]'::jsonb)
  ) into v_result
  from public.businesses b where b.id=p_business_id;
  if v_result is null then raise exception 'BUSINESS_NOT_FOUND'; end if;
  return v_result;
end;
$$;
grant execute on function public.platform_admin_business_detail(uuid) to authenticated;


-- More complete support correction surface without exposing arbitrary SQL.
create or replace function public.platform_admin_update_business_v2(
  p_business_id uuid,
  p_name text default null,
  p_slug text default null,
  p_status text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_country text default null,
  p_currency text default null,
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
  if p_slug is not null and trim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG'; end if;

  update public.businesses set
    name=coalesce(nullif(trim(p_name),''),name),
    slug=coalesce(nullif(trim(p_slug),''),slug),
    status=coalesce(p_status,status),
    email=case when p_email is null then email else nullif(trim(p_email),'') end,
    phone=case when p_phone is null then phone else nullif(trim(p_phone),'') end,
    address=case when p_address is null then address else nullif(trim(p_address),'') end,
    country=case when p_country is null then country else nullif(trim(p_country),'') end,
    currency=case when p_currency is null then currency else upper(nullif(trim(p_currency),'')) end,
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
  values(auth.uid(),p_business_id,'business_support_update_v2','business',p_business_id::text,v_before,v_after);
  return v_after;
end;
$$;
grant execute on function public.platform_admin_update_business_v2(uuid,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

-- Offer codes are redeemable only inside a coherent time window.
alter table public.billing_offer_codes drop constraint if exists billing_offer_window_check;
alter table public.billing_offer_codes add constraint billing_offer_window_check
  check (starts_at is null or expires_at is null or expires_at > starts_at);
create index if not exists billing_offer_window_idx on public.billing_offer_codes(active,starts_at,expires_at);



create or replace function public.preview_billing_offer_code(p_code text, p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_offer public.billing_offer_codes%rowtype;
  v_used integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=auth.uid() and bm.role='Owner'
  ) then raise exception using errcode='42501',message='OWNER_REQUIRED'; end if;

  select * into v_offer from public.billing_offer_codes where code=upper(trim(p_code));
  if v_offer.id is null or not v_offer.active then raise exception using errcode='22023',message='This offer code is invalid or inactive.'; end if;
  if v_offer.starts_at is not null and now()<v_offer.starts_at then raise exception using errcode='22023',message='This offer has not started yet.'; end if;
  if v_offer.expires_at is not null and now()>=v_offer.expires_at then raise exception using errcode='22023',message='This offer code has expired.'; end if;
  if exists(select 1 from public.billing_offer_redemptions r where r.offer_code_id=v_offer.id and r.business_id=p_business_id and r.status='redeemed') then
    raise exception using errcode='22023',message='This business has already redeemed this offer.';
  end if;
  select count(*)::integer into v_used from public.billing_offer_redemptions r
  where r.offer_code_id=v_offer.id and r.status in ('reserved','redeemed') and r.business_id<>p_business_id
    and (r.status='redeemed' or r.reservation_expires_at>now());
  if v_offer.max_redemptions is not null and v_used>=v_offer.max_redemptions then raise exception using errcode='22023',message='This offer has reached its redemption limit.'; end if;

  return jsonb_build_object('code',v_offer.code,'plan_id',v_offer.plan_id,'duration_months',v_offer.duration_months,'percent_off',v_offer.percent_off,'trial_days',v_offer.trial_days,'starts_at',v_offer.starts_at,'expires_at',v_offer.expires_at,'description',v_offer.description);
end;
$$;
revoke all on function public.preview_billing_offer_code(text,uuid) from public;
grant execute on function public.preview_billing_offer_code(text,uuid) to authenticated;


-- Realtime keeps Owner/Admin support conversations live without polling.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_support_requests') then
      execute 'alter publication supabase_realtime add table public.platform_support_requests';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_support_messages') then
      execute 'alter publication supabase_realtime add table public.platform_support_messages';
    end if;
  end if;
end $$;

commit;
