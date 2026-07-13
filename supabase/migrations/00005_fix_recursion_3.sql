create or replace function has_business_access(business_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_has_access boolean;
begin
  select exists (
    select 1
    from business_members bm
    where bm.business_id = has_business_access.business_id
    and bm.user_id = auth.uid()
  ) into v_has_access;
  
  return v_has_access;
end;
$$;

alter table profiles add column if not exists preferred_language text default 'en';