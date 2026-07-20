-- 00027_billing_professional_plan.sql
-- Finalise the initial commercial model:
--   14-day full-feature free trial
--   Professional Plan at €24.99/month
--   Premium reserved for a future release

begin;

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_id_check;

alter table public.subscriptions
  add constraint subscriptions_plan_id_check
  check (plan_id in ('free_trial', 'professional', 'premium'))
  not valid;

alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_days integer not null default 14,
  add column if not exists currency text not null default 'eur',
  add column if not exists unit_amount bigint,
  add column if not exists billing_interval text not null default 'month';

alter table public.subscriptions
  drop constraint if exists subscriptions_trial_days_check;

alter table public.subscriptions
  add constraint subscriptions_trial_days_check
  check (trial_days between 0 and 365);

alter table public.subscriptions
  drop constraint if exists subscriptions_currency_check;

alter table public.subscriptions
  add constraint subscriptions_currency_check
  check (currency = lower(currency) and char_length(currency) = 3);

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_interval_check;

alter table public.subscriptions
  add constraint subscriptions_billing_interval_check
  check (billing_interval in ('month', 'year'));

alter table public.subscriptions
  drop constraint if exists subscriptions_unit_amount_check;

alter table public.subscriptions
  add constraint subscriptions_unit_amount_check
  check (unit_amount is null or unit_amount >= 0);

update public.subscriptions
set
  plan_id = case
    when status = 'trialing' then 'free_trial'
    else 'professional'
  end,
  trial_days = 14,
  currency = 'eur',
  unit_amount = case
    when status = 'trialing' then null
    else 2499
  end,
  billing_interval = 'month',
  trial_started_at = coalesce(
    trial_started_at,
    case
      when trial_ends_at is not null
        then trial_ends_at - interval '14 days'
      else created_at
    end
  )
where plan_id is null
   or plan_id not in ('free_trial', 'professional', 'premium')
   or unit_amount is null;

comment on column public.subscriptions.unit_amount is
  'Subscription amount in the smallest currency unit. Professional monthly price is 2499 EUR cents.';

comment on column public.subscriptions.trial_days is
  'Initial full-feature trial duration. Current product configuration is 14 days.';

commit;
