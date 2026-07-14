-- 00016_public_business_settings_grant.sql
-- Allow anonymous storefront visitors to read rows permitted by RLS.

begin;

grant select on table public.business_settings to anon, authenticated;

commit;
