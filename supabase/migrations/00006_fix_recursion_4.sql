drop policy if exists "Owners can manage members" on business_members;

create or replace function is_business_owner(p_business_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_is_owner boolean;
begin
  select exists (
    select 1
    from business_members bm
    where bm.business_id = p_business_id
    and bm.user_id = auth.uid()
    and bm.role = 'Owner'
  ) into v_is_owner;
  
  return v_is_owner;
end;
$$;

create policy "Owners can manage members" on business_members for all using (
  is_business_owner(business_id)
);
