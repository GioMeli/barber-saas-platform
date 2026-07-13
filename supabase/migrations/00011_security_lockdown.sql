-- Production security lockdown for the MeDo export.
-- This migration intentionally disables direct anonymous writes to customer and booking tables.
-- Public bookings will be re-enabled only through a validated SECURITY DEFINER RPC/Edge Function.

begin;

-- Remove unsafe anonymous customer access.
drop policy if exists "Public can insert customer during booking" on public.customers;

-- Remove unsafe anonymous appointment access.
drop policy if exists "Public can view appointment via guest_token" on public.appointments;
drop policy if exists "Public can insert appointment" on public.appointments;

-- Remove unsafe anonymous appointment item access.
drop policy if exists "Public can insert appointment_services" on public.appointment_services;
drop policy if exists "Public can view appointment_services" on public.appointment_services;
drop policy if exists "Public can insert appointment_addons" on public.appointment_addons;
drop policy if exists "Public can view appointment_addons" on public.appointment_addons;

-- Staff leave and break details must not be publicly readable.
drop policy if exists "Public can view breaks" on public.breaks;
drop policy if exists "Public can view time_off" on public.time_off;

-- Restrict public business settings to business members. Public booking configuration
-- will later be exposed through a safe RPC/view containing only required fields.
drop policy if exists "Public can view business_settings" on public.business_settings;

-- A customer may create or update only their own business-scoped customer profile
-- after authentication. Guest creation is handled by a secure booking RPC later.
drop policy if exists "Customers can insert their own record" on public.customers;
create policy "Customers can insert their own record"
on public.customers
for insert
to authenticated
with check (user_id = auth.uid());

-- Ensure updates cannot change a customer record to another authenticated user.
drop policy if exists "Customers can update their own record" on public.customers;
create policy "Customers can update their own record"
on public.customers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Tighten member write policies with explicit WITH CHECK clauses.
drop policy if exists "Members can manage appointments" on public.appointments;
create policy "Members can view appointments"
on public.appointments
for select
to authenticated
using (public.has_business_access(business_id));

create policy "Members can insert appointments"
on public.appointments
for insert
to authenticated
with check (public.has_business_access(business_id));

create policy "Members can update appointments"
on public.appointments
for update
to authenticated
using (public.has_business_access(business_id))
with check (public.has_business_access(business_id));

create policy "Members can delete appointments"
on public.appointments
for delete
to authenticated
using (public.has_business_access(business_id));

-- Customers can read only appointments connected to their own customer records.
drop policy if exists "Customers can view own appointments" on public.appointments;
create policy "Customers can view own appointments"
on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = appointments.customer_id
      and c.user_id = auth.uid()
  )
);

-- Appointment service rows inherit access from the parent appointment.
drop policy if exists "Members can manage appointment_services" on public.appointment_services;
create policy "Authorized users can view appointment services"
on public.appointment_services
for select
to authenticated
using (
  exists (
    select 1
    from public.appointments a
    left join public.customers c on c.id = a.customer_id
    where a.id = appointment_services.appointment_id
      and (
        public.has_business_access(a.business_id)
        or c.user_id = auth.uid()
      )
  )
);

create policy "Members can insert appointment services"
on public.appointment_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.appointments a
    where a.id = appointment_services.appointment_id
      and public.has_business_access(a.business_id)
  )
);

create policy "Members can update appointment services"
on public.appointment_services
for update
to authenticated
using (
  exists (
    select 1
    from public.appointments a
    where a.id = appointment_services.appointment_id
      and public.has_business_access(a.business_id)
  )
)
with check (
  exists (
    select 1
    from public.appointments a
    where a.id = appointment_services.appointment_id
      and public.has_business_access(a.business_id)
  )
);

create policy "Members can delete appointment services"
on public.appointment_services
for delete
to authenticated
using (
  exists (
    select 1
    from public.appointments a
    where a.id = appointment_services.appointment_id
      and public.has_business_access(a.business_id)
  )
);

-- Appointment add-ons inherit access from the parent appointment.
drop policy if exists "Members can manage appointment_addons" on public.appointment_addons;
create policy "Authorized users can view appointment addons"
on public.appointment_addons
for select
to authenticated
using (
  exists (
    select 1
    from public.appointment_services aps
    join public.appointments a on a.id = aps.appointment_id
    left join public.customers c on c.id = a.customer_id
    where aps.id = appointment_addons.appointment_service_id
      and (
        public.has_business_access(a.business_id)
        or c.user_id = auth.uid()
      )
  )
);

create policy "Members can insert appointment addons"
on public.appointment_addons
for insert
to authenticated
with check (
  exists (
    select 1
    from public.appointment_services aps
    join public.appointments a on a.id = aps.appointment_id
    where aps.id = appointment_addons.appointment_service_id
      and public.has_business_access(a.business_id)
  )
);

create policy "Members can update appointment addons"
on public.appointment_addons
for update
to authenticated
using (
  exists (
    select 1
    from public.appointment_services aps
    join public.appointments a on a.id = aps.appointment_id
    where aps.id = appointment_addons.appointment_service_id
      and public.has_business_access(a.business_id)
  )
)
with check (
  exists (
    select 1
    from public.appointment_services aps
    join public.appointments a on a.id = aps.appointment_id
    where aps.id = appointment_addons.appointment_service_id
      and public.has_business_access(a.business_id)
  )
);

create policy "Members can delete appointment addons"
on public.appointment_addons
for delete
to authenticated
using (
  exists (
    select 1
    from public.appointment_services aps
    join public.appointments a on a.id = aps.appointment_id
    where aps.id = appointment_addons.appointment_service_id
      and public.has_business_access(a.business_id)
  )
);

-- Explicitly remove anonymous DML privileges from sensitive tables.
revoke insert, update, delete on public.customers from anon;
revoke select, insert, update, delete on public.appointments from anon;
revoke select, insert, update, delete on public.appointment_services from anon;
revoke select, insert, update, delete on public.appointment_addons from anon;
revoke select on public.breaks from anon;
revoke select on public.time_off from anon;
revoke select on public.business_settings from anon;

commit;
