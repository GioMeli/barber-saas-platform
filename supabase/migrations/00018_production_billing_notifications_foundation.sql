-- 00018_production_billing_notifications_foundation.sql
-- Production billing, invoice history, Stripe webhook idempotency,
-- and appointment reminder queue.
--
-- This migration is based on the linked remote public schema dump.
-- It intentionally does NOT change the existing booking RPCs or appointment logic.

begin;

-- ---------------------------------------------------------------------------
-- 1. Subscription hardening
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists last_payment_status text,
  add column if not exists last_payment_at timestamptz;

create unique index if not exists subscriptions_stripe_customer_uidx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists subscriptions_stripe_subscription_uidx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_plan_id_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_plan_id_check
      check (plan_id in ('free_trial', 'professional'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_status_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_status_check
      check (
        status in (
          'trialing',
          'active',
          'past_due',
          'unpaid',
          'incomplete',
          'incomplete_expired',
          'canceled',
          'paused'
        )
      )
      not valid;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Stripe invoice history
-- Amounts are stored in the smallest currency unit, e.g. cents.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,

  stripe_invoice_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  invoice_number text,

  status text not null default 'draft',
  currency text not null default 'eur',
  amount_due bigint not null default 0,
  amount_paid bigint not null default 0,
  amount_remaining bigint not null default 0,

  hosted_invoice_url text,
  invoice_pdf_url text,

  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_invoices_status_check
    check (
      status in (
        'draft',
        'open',
        'paid',
        'void',
        'uncollectible',
        'deleted'
      )
    ),

  constraint billing_invoices_amounts_check
    check (
      amount_due >= 0
      and amount_paid >= 0
      and amount_remaining >= 0
    )
);

create index if not exists billing_invoices_business_created_idx
  on public.billing_invoices (business_id, created_at desc);

create index if not exists billing_invoices_subscription_idx
  on public.billing_invoices (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists billing_invoices_status_idx
  on public.billing_invoices (business_id, status);

alter table public.billing_invoices enable row level security;

drop policy if exists "Business members can view billing invoices"
  on public.billing_invoices;

create policy "Business members can view billing invoices"
  on public.billing_invoices
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Service role can manage billing invoices"
  on public.billing_invoices;

create policy "Service role can manage billing invoices"
  on public.billing_invoices
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.billing_invoices to authenticated;
grant all on public.billing_invoices to service_role;

-- ---------------------------------------------------------------------------
-- 3. Stripe webhook event idempotency
-- The Stripe event id is the primary key, so the same event cannot be processed
-- twice.
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  payload jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_idx
  on public.stripe_webhook_events (created_at desc);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (event_type, created_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "Service role can manage stripe webhook events"
  on public.stripe_webhook_events;

create policy "Service role can manage stripe webhook events"
  on public.stripe_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

grant all on public.stripe_webhook_events to service_role;

-- ---------------------------------------------------------------------------
-- 4. Appointment reminder queue
-- ---------------------------------------------------------------------------

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  appointment_id uuid not null
    references public.appointments(id) on delete cascade,

  channel text not null,
  reminder_type text not null,
  scheduled_for timestamptz not null,

  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,

  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminder_jobs_channel_check
    check (channel in ('email', 'sms')),

  constraint reminder_jobs_type_check
    check (reminder_type in ('24_hour', '2_hour')),

  constraint reminder_jobs_status_check
    check (
      status in (
        'queued',
        'processing',
        'sent',
        'failed',
        'cancelled'
      )
    ),

  constraint reminder_jobs_attempts_check
    check (
      attempt_count >= 0
      and max_attempts > 0
      and attempt_count <= max_attempts
    ),

  constraint reminder_jobs_unique
    unique (appointment_id, channel, reminder_type)
);

create index if not exists reminder_jobs_due_idx
  on public.reminder_jobs (scheduled_for)
  where status = 'queued';

create index if not exists reminder_jobs_business_idx
  on public.reminder_jobs (business_id, scheduled_for desc);

create index if not exists reminder_jobs_appointment_idx
  on public.reminder_jobs (appointment_id);

alter table public.reminder_jobs enable row level security;

drop policy if exists "Business members can view reminder jobs"
  on public.reminder_jobs;

create policy "Business members can view reminder jobs"
  on public.reminder_jobs
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Service role can manage reminder jobs"
  on public.reminder_jobs;

create policy "Service role can manage reminder jobs"
  on public.reminder_jobs
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.reminder_jobs to authenticated;
grant all on public.reminder_jobs to service_role;

-- ---------------------------------------------------------------------------
-- 5. Notification delivery audit
-- ---------------------------------------------------------------------------

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  appointment_id uuid
    references public.appointments(id) on delete set null,
  reminder_job_id uuid
    references public.reminder_jobs(id) on delete set null,

  channel text not null,
  provider text not null,
  recipient text not null,
  subject text,
  message text,

  status text not null default 'queued',
  provider_message_id text,
  failure_reason text,

  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notification_deliveries_channel_check
    check (channel in ('email', 'sms')),

  constraint notification_deliveries_status_check
    check (
      status in (
        'queued',
        'sent',
        'delivered',
        'failed',
        'bounced',
        'cancelled'
      )
    )
);

create index if not exists notification_deliveries_business_created_idx
  on public.notification_deliveries (business_id, created_at desc);

create index if not exists notification_deliveries_appointment_idx
  on public.notification_deliveries (appointment_id)
  where appointment_id is not null;

create index if not exists notification_deliveries_provider_message_idx
  on public.notification_deliveries (provider_message_id)
  where provider_message_id is not null;

alter table public.notification_deliveries enable row level security;

drop policy if exists "Business members can view notification deliveries"
  on public.notification_deliveries;

create policy "Business members can view notification deliveries"
  on public.notification_deliveries
  for select
  to authenticated
  using (public.has_business_access(business_id));

drop policy if exists "Service role can manage notification deliveries"
  on public.notification_deliveries;

create policy "Service role can manage notification deliveries"
  on public.notification_deliveries
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.notification_deliveries to authenticated;
grant all on public.notification_deliveries to service_role;

-- ---------------------------------------------------------------------------
-- 6. Reminder synchronization trigger
-- Creates or updates 24-hour and 2-hour reminder jobs whenever an appointment
-- is created, rescheduled, confirmed, or otherwise updated.
-- ---------------------------------------------------------------------------

create or replace function public.sync_appointment_reminder_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_enabled boolean := false;
  v_sms_enabled boolean := false;
  v_cancelled boolean;
begin
  select
    coalesce(bs.email_reminders_enabled, true),
    coalesce(bs.sms_reminders_enabled, false)
  into
    v_email_enabled,
    v_sms_enabled
  from public.business_settings bs
  where bs.business_id = new.business_id;

  if not found then
    v_email_enabled := true;
    v_sms_enabled := false;
  end if;

  v_cancelled :=
    new.status in (
      'cancelled_by_customer',
      'cancelled_by_business',
      'no_show',
      'rescheduled'
    );

  if v_cancelled then
    update public.reminder_jobs
    set
      status = 'cancelled',
      updated_at = now()
    where appointment_id = new.id
      and status in ('queued', 'processing');

    return new;
  end if;

  -- EMAIL: 24 hours before
  if v_email_enabled and new.start_time - interval '24 hours' > now() then
    insert into public.reminder_jobs (
      business_id,
      appointment_id,
      channel,
      reminder_type,
      scheduled_for,
      status,
      updated_at
    )
    values (
      new.business_id,
      new.id,
      'email',
      '24_hour',
      new.start_time - interval '24 hours',
      'queued',
      now()
    )
    on conflict (appointment_id, channel, reminder_type)
    do update set
      business_id = excluded.business_id,
      scheduled_for = excluded.scheduled_for,
      status = case
        when public.reminder_jobs.status = 'sent'
          then public.reminder_jobs.status
        else 'queued'
      end,
      last_error = null,
      locked_at = null,
      updated_at = now();
  else
    update public.reminder_jobs
    set status = 'cancelled', updated_at = now()
    where appointment_id = new.id
      and channel = 'email'
      and reminder_type = '24_hour'
      and status <> 'sent';
  end if;

  -- EMAIL: 2 hours before
  if v_email_enabled and new.start_time - interval '2 hours' > now() then
    insert into public.reminder_jobs (
      business_id,
      appointment_id,
      channel,
      reminder_type,
      scheduled_for,
      status,
      updated_at
    )
    values (
      new.business_id,
      new.id,
      'email',
      '2_hour',
      new.start_time - interval '2 hours',
      'queued',
      now()
    )
    on conflict (appointment_id, channel, reminder_type)
    do update set
      business_id = excluded.business_id,
      scheduled_for = excluded.scheduled_for,
      status = case
        when public.reminder_jobs.status = 'sent'
          then public.reminder_jobs.status
        else 'queued'
      end,
      last_error = null,
      locked_at = null,
      updated_at = now();
  else
    update public.reminder_jobs
    set status = 'cancelled', updated_at = now()
    where appointment_id = new.id
      and channel = 'email'
      and reminder_type = '2_hour'
      and status <> 'sent';
  end if;

  -- SMS: 24 hours before
  if v_sms_enabled and new.start_time - interval '24 hours' > now() then
    insert into public.reminder_jobs (
      business_id,
      appointment_id,
      channel,
      reminder_type,
      scheduled_for,
      status,
      updated_at
    )
    values (
      new.business_id,
      new.id,
      'sms',
      '24_hour',
      new.start_time - interval '24 hours',
      'queued',
      now()
    )
    on conflict (appointment_id, channel, reminder_type)
    do update set
      business_id = excluded.business_id,
      scheduled_for = excluded.scheduled_for,
      status = case
        when public.reminder_jobs.status = 'sent'
          then public.reminder_jobs.status
        else 'queued'
      end,
      last_error = null,
      locked_at = null,
      updated_at = now();
  else
    update public.reminder_jobs
    set status = 'cancelled', updated_at = now()
    where appointment_id = new.id
      and channel = 'sms'
      and reminder_type = '24_hour'
      and status <> 'sent';
  end if;

  -- SMS: 2 hours before
  if v_sms_enabled and new.start_time - interval '2 hours' > now() then
    insert into public.reminder_jobs (
      business_id,
      appointment_id,
      channel,
      reminder_type,
      scheduled_for,
      status,
      updated_at
    )
    values (
      new.business_id,
      new.id,
      'sms',
      '2_hour',
      new.start_time - interval '2 hours',
      'queued',
      now()
    )
    on conflict (appointment_id, channel, reminder_type)
    do update set
      business_id = excluded.business_id,
      scheduled_for = excluded.scheduled_for,
      status = case
        when public.reminder_jobs.status = 'sent'
          then public.reminder_jobs.status
        else 'queued'
      end,
      last_error = null,
      locked_at = null,
      updated_at = now();
  else
    update public.reminder_jobs
    set status = 'cancelled', updated_at = now()
    where appointment_id = new.id
      and channel = 'sms'
      and reminder_type = '2_hour'
      and status <> 'sent';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_sync_reminder_jobs
  on public.appointments;

create trigger appointments_sync_reminder_jobs
after insert or update of
  start_time,
  status,
  business_id,
  customer_id
on public.appointments
for each row
execute function public.sync_appointment_reminder_jobs();

-- Backfill reminder jobs for existing future appointments.
-- Existing sent records are not affected because the tables are new.
insert into public.reminder_jobs (
  business_id,
  appointment_id,
  channel,
  reminder_type,
  scheduled_for
)
select
  a.business_id,
  a.id,
  reminder.channel,
  reminder.reminder_type,
  reminder.scheduled_for
from public.appointments a
join public.business_settings bs
  on bs.business_id = a.business_id
cross join lateral (
  values
    (
      'email'::text,
      '24_hour'::text,
      a.start_time - interval '24 hours',
      coalesce(bs.email_reminders_enabled, true)
    ),
    (
      'email'::text,
      '2_hour'::text,
      a.start_time - interval '2 hours',
      coalesce(bs.email_reminders_enabled, true)
    ),
    (
      'sms'::text,
      '24_hour'::text,
      a.start_time - interval '24 hours',
      coalesce(bs.sms_reminders_enabled, false)
    ),
    (
      'sms'::text,
      '2_hour'::text,
      a.start_time - interval '2 hours',
      coalesce(bs.sms_reminders_enabled, false)
    )
) as reminder(channel, reminder_type, scheduled_for, enabled)
where reminder.enabled = true
  and reminder.scheduled_for > now()
  and a.status not in (
    'cancelled_by_customer',
    'cancelled_by_business',
    'no_show',
    'rescheduled'
  )
on conflict (appointment_id, channel, reminder_type)
do nothing;

commit;
