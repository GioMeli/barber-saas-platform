-- Velliqo Phase 8 hardening
-- Persists the automatic marketing worker invocation in source control.
--
-- Required Vault secrets (values are configured in Supabase Dashboard, never here):
--   velliqo_marketing_worker_url
--   velliqo_marketing_worker_secret
--
-- The worker remains governed by marketing_delivery_settings. Keep businesses in
-- Test mode until a verified sending domain and final production approval exist.

create or replace function public.invoke_velliqo_marketing_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_worker_url text;
  v_worker_secret text;
begin
  select btrim(decrypted_secret)
    into v_worker_url
  from vault.decrypted_secrets
  where name = 'velliqo_marketing_worker_url'
  limit 1;

  select btrim(decrypted_secret)
    into v_worker_secret
  from vault.decrypted_secrets
  where name = 'velliqo_marketing_worker_secret'
  limit 1;

  if v_worker_url is null or v_worker_url = '' then
    raise exception 'Missing velliqo_marketing_worker_url in Supabase Vault';
  end if;

  if v_worker_url !~ '^https://.+/functions/v1/process_marketing_deliveries$' then
    raise exception 'Invalid velliqo_marketing_worker_url in Supabase Vault';
  end if;

  if v_worker_secret is null or length(v_worker_secret) < 32 then
    raise exception 'Missing or invalid velliqo_marketing_worker_secret in Supabase Vault';
  end if;

  return net.http_post(
    url := v_worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-marketing-secret', v_worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$function$;

comment on function public.invoke_velliqo_marketing_worker()
is 'Invokes the Velliqo marketing delivery Edge Function using Vault-backed configuration.';

revoke all
on function public.invoke_velliqo_marketing_worker()
from public, anon, authenticated;

-- Keep exactly one scheduled marketing worker job.
do $cleanup$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where
      jobname = 'process-marketing-deliveries'
      or command ilike '%process_marketing_deliveries%'
      or command ilike '%invoke_velliqo_marketing_worker%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$cleanup$;

select cron.schedule(
  'process-marketing-deliveries',
  '* * * * *',
  $cron$
    select public.invoke_velliqo_marketing_worker();
  $cron$
);
