-- Fix any remaining policy issues
drop policy if exists "Service role can do anything on businesses" on businesses;
drop policy if exists "Service role can do anything on subscriptions" on subscriptions;
drop policy if exists "Service role can do anything on appointments" on appointments;

create policy "Service role can do anything on businesses" on businesses for all using (auth.jwt()->>'role' = 'service_role');
create policy "Service role can do anything on subscriptions" on subscriptions for all using (auth.jwt()->>'role' = 'service_role');
create policy "Service role can do anything on appointments" on appointments for all using (auth.jwt()->>'role' = 'service_role');

-- Allow all authenticated users to read profiles
drop policy if exists "Public can view employee profiles via business" on profiles;
create policy "Authenticated users can view profiles" on profiles for select using (auth.role() = 'authenticated');
