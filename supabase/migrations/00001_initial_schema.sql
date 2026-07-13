-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Enums
create type user_role as enum ('Platform Admin', 'Business Owner', 'Manager', 'Employee', 'Registered Customer');
create type appointment_status as enum ('pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled_by_customer', 'cancelled_by_business', 'no_show', 'rescheduled');
create type payment_status as enum ('unpaid', 'deposit_paid', 'paid', 'refunded');

-- 1. Profiles (for all users: owners, staff, customers, admin)
create table profiles (
  id uuid references auth.users(id) primary key,
  role user_role not null default 'Registered Customer',
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  cover_image_url text,
  description text,
  address text,
  phone text,
  email text,
  country text default 'US',
  currency text default 'USD',
  timezone text default 'UTC',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Business Members (linking profiles to businesses with a specific business role)
create type business_role as enum ('Owner', 'Manager', 'Employee');

create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role business_role not null default 'Employee',
  created_at timestamptz default now(),
  unique (business_id, user_id)
);

-- 4. Subscriptions
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text not null default 'free_trial',
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Business Settings
create table business_settings (
  business_id uuid references businesses(id) on delete cascade primary key,
  booking_interval int default 30, -- minutes
  min_booking_notice int default 2, -- hours
  max_booking_period int default 60, -- days
  cancellation_policy text,
  terms_conditions text,
  email_reminders_enabled boolean default true,
  sms_reminders_enabled boolean default false,
  primary_color text default '#0B0F19',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Service Categories
create table service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- 7. Services
create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  duration int not null, -- minutes
  image_url text,
  is_active boolean default true,
  online_booking_enabled boolean default true,
  deposit_required boolean default false,
  deposit_amount numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Service Add-ons
create table service_addons (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete cascade not null,
  name text not null,
  price numeric(10,2) not null,
  duration int not null default 0, -- minutes
  created_at timestamptz default now()
);

-- 9. Employees (Staff detailed info)
create table employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  photo_url text,
  bio text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 10. Employee Services
create table employee_services (
  employee_id uuid references employees(id) on delete cascade not null,
  service_id uuid references services(id) on delete cascade not null,
  primary key (employee_id, service_id)
);

-- 11. Working Hours
create table working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  employee_id uuid references employees(id) on delete cascade, -- null means business general hours
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sunday
  start_time time not null,
  end_time time not null,
  is_closed boolean default false,
  unique (business_id, employee_id, day_of_week)
);

-- 12. Breaks
create table breaks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null
);

-- 13. Time Off
create table time_off (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text default 'approved',
  created_at timestamptz default now()
);

-- 14. Customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (business_id, email)
);

-- 15. Appointments
create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null, -- null for some guests before link? Better require customer
  employee_id uuid references employees(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status appointment_status default 'pending',
  payment_status payment_status default 'unpaid',
  total_duration int not null,
  total_price numeric(10,2) not null,
  deposit_amount numeric(10,2) default 0,
  notes text,
  guest_token text unique default gen_random_uuid()::text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 16. Appointment Services
create table appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete cascade not null,
  service_id uuid references services(id) on delete set null,
  price numeric(10,2) not null,
  duration int not null
);

-- 17. Appointment Add-ons
create table appointment_addons (
  id uuid primary key default gen_random_uuid(),
  appointment_service_id uuid references appointment_services(id) on delete cascade not null,
  addon_id uuid references service_addons(id) on delete set null,
  price numeric(10,2) not null
);

-- 18. Products
create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  category text,
  sku text,
  cost_price numeric(10,2) default 0,
  selling_price numeric(10,2) not null,
  current_stock int default 0,
  min_stock int default 5,
  supplier text,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 19. Stock Movements
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  quantity int not null,
  type text not null, -- 'purchase', 'sale', 'damage', 'return', 'correction'
  reason text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 20. Sales
create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  appointment_id uuid references appointments(id) on delete set null,
  amount numeric(10,2) not null,
  type text not null, -- 'service', 'product', 'tip', 'refund'
  payment_method text,
  date timestamptz default now(),
  created_at timestamptz default now()
);

-- 21. Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  category text not null,
  description text,
  supplier text,
  amount numeric(10,2) not null,
  date date not null,
  receipt_url text,
  payment_method text,
  created_at timestamptz default now()
);

-- 22. Notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 23. Audit Logs
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- 24. Triggers & Security Definer Functions

-- Handle new user signup -> automatically create profile
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, coalesce(new.raw_user_meta_data->>'role', 'Registered Customer')::user_role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper to check if a user belongs to a business
create or replace function has_business_access(business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = $1
    and bm.user_id = auth.uid()
  );
$$;

-- RLS Enablement
alter table profiles enable row level security;
alter table businesses enable row level security;
alter table business_members enable row level security;
alter table subscriptions enable row level security;
alter table business_settings enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table service_addons enable row level security;
alter table employees enable row level security;
alter table employee_services enable row level security;
alter table working_hours enable row level security;
alter table breaks enable row level security;
alter table time_off enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table appointment_addons enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- Policies

-- profiles
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Public can view employee profiles via business" on profiles for select using (
  exists (select 1 from business_members where user_id = profiles.id)
);

-- businesses
create policy "Public can view businesses" on businesses for select using (true);
create policy "Business members can update business" on businesses for update using (has_business_access(id));
create policy "Business members can insert business" on businesses for insert with check (true);

-- business_members
create policy "Members can view business_members" on business_members for select using (has_business_access(business_id) or user_id = auth.uid());
create policy "Owners can manage members" on business_members for all using (
  exists (select 1 from business_members bm where bm.business_id = business_members.business_id and bm.user_id = auth.uid() and bm.role = 'Owner')
);
create policy "Users can insert themselves during onboarding" on business_members for insert with check (user_id = auth.uid());

-- subscriptions
create policy "Members can view subscriptions" on subscriptions for select using (has_business_access(business_id));

-- business_settings
create policy "Public can view business_settings" on business_settings for select using (true);
create policy "Members can manage business_settings" on business_settings for all using (has_business_access(business_id));

-- service_categories
create policy "Public can view categories" on service_categories for select using (true);
create policy "Members can manage categories" on service_categories for all using (has_business_access(business_id));

-- services
create policy "Public can view services" on services for select using (true);
create policy "Members can manage services" on services for all using (has_business_access(business_id));

-- service_addons
create policy "Public can view addons" on service_addons for select using (true);
create policy "Members can manage addons" on service_addons for all using (
  has_business_access((select business_id from services where id = service_id))
);

-- employees
create policy "Public can view employees" on employees for select using (true);
create policy "Members can manage employees" on employees for all using (has_business_access(business_id));

-- employee_services
create policy "Public can view employee_services" on employee_services for select using (true);
create policy "Members can manage employee_services" on employee_services for all using (
  has_business_access((select business_id from employees where id = employee_id))
);

-- working_hours
create policy "Public can view working_hours" on working_hours for select using (true);
create policy "Members can manage working_hours" on working_hours for all using (has_business_access(business_id));

-- breaks
create policy "Public can view breaks" on breaks for select using (true);
create policy "Members can manage breaks" on breaks for all using (
  has_business_access((select business_id from employees where id = employee_id))
);

-- time_off
create policy "Public can view time_off" on time_off for select using (true);
create policy "Members can manage time_off" on time_off for all using (
  has_business_access((select business_id from employees where id = employee_id))
);

-- customers
create policy "Members can view customers" on customers for select using (has_business_access(business_id));
create policy "Members can insert customers" on customers for insert with check (has_business_access(business_id));
create policy "Members can update customers" on customers for update using (has_business_access(business_id));
create policy "Members can delete customers" on customers for delete using (has_business_access(business_id));
create policy "Customers can view their own record" on customers for select using (user_id = auth.uid());
create policy "Customers can update their own record" on customers for update using (user_id = auth.uid());

-- Public can insert customers when booking as guest
create policy "Public can insert customer during booking" on customers for insert with check (user_id is null);

-- appointments
create policy "Members can manage appointments" on appointments for all using (has_business_access(business_id));
create policy "Customers can view own appointments" on appointments for select using (
  customer_id in (select id from customers where user_id = auth.uid())
);
create policy "Public can view appointment via guest_token" on appointments for select using (true); -- guest token filter is checked in app
create policy "Public can insert appointment" on appointments for insert with check (true);

-- appointment_services
create policy "Members can manage appointment_services" on appointment_services for all using (
  has_business_access((select business_id from appointments where id = appointment_id))
);
create policy "Public can insert appointment_services" on appointment_services for insert with check (true);
create policy "Public can view appointment_services" on appointment_services for select using (true);

-- appointment_addons
create policy "Members can manage appointment_addons" on appointment_addons for all using (
  has_business_access((select business_id from appointments a join appointment_services aps on a.id = aps.appointment_id where aps.id = appointment_service_id))
);
create policy "Public can insert appointment_addons" on appointment_addons for insert with check (true);
create policy "Public can view appointment_addons" on appointment_addons for select using (true);

-- products
create policy "Members can manage products" on products for all using (has_business_access(business_id));

-- stock_movements
create policy "Members can manage stock_movements" on stock_movements for all using (
  has_business_access((select business_id from products where id = product_id))
);

-- sales
create policy "Members can manage sales" on sales for all using (has_business_access(business_id));

-- expenses
create policy "Members can manage expenses" on expenses for all using (has_business_access(business_id));

-- notifications
create policy "Users can view own notifications" on notifications for select using (user_id = auth.uid());
create policy "Members can manage notifications" on notifications for all using (has_business_access(business_id));

-- audit_logs
create policy "Members can manage audit_logs" on audit_logs for all using (has_business_access(business_id));

-- Edge Function execution helper
create policy "Service role can do anything on businesses" on businesses for all using (auth.jwt()->>'role' = 'service_role');
create policy "Service role can do anything on subscriptions" on subscriptions for all using (auth.jwt()->>'role' = 'service_role');
create policy "Service role can do anything on appointments" on appointments for all using (auth.jwt()->>'role' = 'service_role');
