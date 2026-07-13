-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'appointment_status'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'confirmed',
    'arrived',
    'in_progress',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_business',
    'no_show',
    'rescheduled'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'business_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."business_role" AS ENUM (
    'Owner',
    'Manager',
    'Employee'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'payment_status'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."payment_status" AS ENUM (
    'unpaid',
    'deposit_paid',
    'paid',
    'refunded'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."user_role" AS ENUM (
    'Platform Admin',
    'Business Owner',
    'Manager',
    'Employee',
    'Registered Customer'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: check_availability("uuid", "uuid", "date", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."check_availability"("p_business_id" "uuid", "p_employee_id" "uuid", "p_date" "date", "p_duration" integer) RETURNS TABLE("available_time" time without time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_day_of_week int;
  v_start_time time;
  v_end_time time;
  v_is_closed boolean;
  v_interval int;
  v_current_time time;
  v_conflict_exists boolean;
begin
  -- Get day of week (0 = Sunday, 1 = Monday, ...)
  v_day_of_week := extract(dow from p_date);
  
  -- Get booking interval
  select booking_interval into v_interval
  from business_settings
  where business_id = p_business_id;
  
  if v_interval is null then
    v_interval := 30; -- default
  end if;

  -- Get working hours for employee or business
  select start_time, end_time, is_closed
  into v_start_time, v_end_time, v_is_closed
  from working_hours
  where business_id = p_business_id
    and (employee_id = p_employee_id or employee_id is null)
    and day_of_week = v_day_of_week
  order by employee_id nulls last
  limit 1;
  
  if not found or v_is_closed then
    return; -- No availability
  end if;

  -- Initialize current time to start of working hours
  v_current_time := v_start_time;

  -- Loop through time slots
  while v_current_time + (p_duration || ' minutes')::interval <= v_end_time loop
    
    -- Check for conflicts with existing appointments
    select exists (
      select 1
      from appointments a
      where a.business_id = p_business_id
        and a.employee_id = p_employee_id
        and a.status not in ('cancelled_by_customer', 'cancelled_by_business', 'no_show')
        and a.start_time::date = p_date
        and (
          (v_current_time >= a.start_time::time and v_current_time < a.end_time::time) or
          (v_current_time + (p_duration || ' minutes')::interval > a.start_time::time and v_current_time + (p_duration || ' minutes')::interval <= a.end_time::time) or
          (v_current_time <= a.start_time::time and v_current_time + (p_duration || ' minutes')::interval >= a.end_time::time)
        )
    ) into v_conflict_exists;

    -- Check for conflicts with breaks
    if not v_conflict_exists then
      select exists (
        select 1
        from breaks b
        where b.employee_id = p_employee_id
          and b.day_of_week = v_day_of_week
          and (
            (v_current_time >= b.start_time and v_current_time < b.end_time) or
            (v_current_time + (p_duration || ' minutes')::interval > b.start_time and v_current_time + (p_duration || ' minutes')::interval <= b.end_time) or
            (v_current_time <= b.start_time and v_current_time + (p_duration || ' minutes')::interval >= b.end_time)
          )
      ) into v_conflict_exists;
    end if;

    -- If no conflict, add to results
    if not v_conflict_exists then
      available_time := v_current_time;
      return next;
    end if;

    -- Increment by interval
    v_current_time := v_current_time + (v_interval || ' minutes')::interval;
  end loop;

  return;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, coalesce(new.raw_user_meta_data->>'role', 'Registered Customer')::user_role);
  return new;
end;
$$;


--
-- Name: has_business_access("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."has_business_access"("business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: is_business_owner("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."is_business_owner"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: appointment_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."appointment_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_service_id" "uuid" NOT NULL,
    "addon_id" "uuid",
    "price" numeric(10,2) NOT NULL
);


--
-- Name: appointment_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."appointment_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "price" numeric(10,2) NOT NULL,
    "duration" integer NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "employee_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'pending'::"public"."appointment_status",
    "payment_status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status",
    "total_duration" integer NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "deposit_amount" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "guest_token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: breaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."breaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    CONSTRAINT "breaks_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


--
-- Name: business_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."business_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."business_role" DEFAULT 'Employee'::"public"."business_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."business_settings" (
    "business_id" "uuid" NOT NULL,
    "booking_interval" integer DEFAULT 30,
    "min_booking_notice" integer DEFAULT 2,
    "max_booking_period" integer DEFAULT 60,
    "cancellation_policy" "text",
    "terms_conditions" "text",
    "email_reminders_enabled" boolean DEFAULT true,
    "sms_reminders_enabled" boolean DEFAULT false,
    "primary_color" "text" DEFAULT '#0B0F19'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "cover_image_url" "text",
    "description" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "country" "text" DEFAULT 'US'::"text",
    "currency" "text" DEFAULT 'USD'::"text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "photos" "text"[] DEFAULT '{}'::"text"[],
    "map_url" "text"
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: employee_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."employee_services" (
    "employee_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "photo_url" "text",
    "bio" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "inactive_start_date" "date",
    "inactive_end_date" "date"
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "supplier" "text",
    "amount" numeric(10,2) NOT NULL,
    "date" "date" NOT NULL,
    "receipt_url" "text",
    "payment_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "sku" "text",
    "cost_price" numeric(10,2) DEFAULT 0,
    "selling_price" numeric(10,2) NOT NULL,
    "current_stock" integer DEFAULT 0,
    "min_stock" integer DEFAULT 5,
    "supplier" "text",
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'Registered Customer'::"public"."user_role" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "preferred_language" "text" DEFAULT 'en'::"text"
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "type" "text" NOT NULL,
    "payment_method" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: service_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."service_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "duration" integer NOT NULL,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "online_booking_enabled" boolean DEFAULT true,
    "deposit_required" boolean DEFAULT false,
    "deposit_amount" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan_id" "text" DEFAULT 'free_trial'::"text" NOT NULL,
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: time_off; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."time_off" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'approved'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: working_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."working_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_closed" boolean DEFAULT false,
    CONSTRAINT "working_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


--
-- Name: appointment_addons appointment_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointment_addons_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointment_addons"
    ADD CONSTRAINT "appointment_addons_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_services appointment_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointment_services_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments appointments_guest_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointments_guest_token_key'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_guest_token_key" UNIQUE ("guest_token");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointments_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'audit_logs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: breaks breaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'breaks_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'breaks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."breaks"
    ADD CONSTRAINT "breaks_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members business_members_business_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'business_members_business_id_user_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_user_id_key" UNIQUE ("business_id", "user_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members business_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'business_members_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_settings business_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'business_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'business_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_pkey" PRIMARY KEY ("business_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'businesses_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'businesses'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'businesses_slug_key'
      AND n.nspname = 'public'
      AND c.relname = 'businesses'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers customers_business_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'customers_business_id_email_key'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_email_key" UNIQUE ("business_id", "email");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'customers_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employee_services employee_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employee_services_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'employee_services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employee_services"
    ADD CONSTRAINT "employee_services_pkey" PRIMARY KEY ("employee_id", "service_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'expenses_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'expenses'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'products_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sales_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'sales'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_addons service_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'service_addons_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'service_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."service_addons"
    ADD CONSTRAINT "service_addons_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'service_categories_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'service_categories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'services_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_movements_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'stock_movements'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscriptions subscriptions_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'subscriptions_business_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_business_id_key" UNIQUE ("business_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'subscriptions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: time_off time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'time_off_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'time_off'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."time_off"
    ADD CONSTRAINT "time_off_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: working_hours working_hours_business_id_employee_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'working_hours_business_id_employee_id_day_of_week_key'
      AND n.nspname = 'public'
      AND c.relname = 'working_hours'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_business_id_employee_id_day_of_week_key" UNIQUE ("business_id", "employee_id", "day_of_week");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: working_hours working_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'working_hours_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'working_hours'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_addons appointment_addons_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointment_addons_addon_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointment_addons"
    ADD CONSTRAINT "appointment_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_addons appointment_addons_appointment_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointment_addons_appointment_service_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointment_addons"
    ADD CONSTRAINT "appointment_addons_appointment_service_id_fkey" FOREIGN KEY ("appointment_service_id") REFERENCES "public"."appointment_services"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_services appointment_services_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointment_services_appointment_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_services appointment_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointment_services_service_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments appointments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointments_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointments_customer_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments appointments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'appointments_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: audit_logs audit_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'audit_logs_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'audit_logs_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: breaks breaks_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'breaks_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'breaks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."breaks"
    ADD CONSTRAINT "breaks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members business_members_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'business_members_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members business_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'business_members_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_settings business_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'business_settings_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'business_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'customers_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'customers_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employee_services employee_services_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employee_services_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'employee_services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employee_services"
    ADD CONSTRAINT "employee_services_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employee_services employee_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employee_services_service_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'employee_services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employee_services"
    ADD CONSTRAINT "employee_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: expenses expenses_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'expenses_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'expenses'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'products_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales sales_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sales_appointment_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'sales'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales sales_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sales_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'sales'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_addons service_addons_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'service_addons_service_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'service_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."service_addons"
    ADD CONSTRAINT "service_addons_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_categories service_categories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'service_categories_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'service_categories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'services_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'services_category_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'services'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_movements_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'stock_movements'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_movements_product_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'stock_movements'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscriptions subscriptions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'subscriptions_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: time_off time_off_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'time_off_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'time_off'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."time_off"
    ADD CONSTRAINT "time_off_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: working_hours working_hours_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'working_hours_business_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'working_hours'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: working_hours working_hours_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'working_hours_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'working_hours'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Authenticated users can view profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can view profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can view profiles" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: businesses Business members can insert business; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Business members can insert business'
      AND n.nspname = 'public'
      AND c.relname = 'businesses'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Business members can insert business" ON "public"."businesses" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: businesses Business members can update business; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Business members can update business'
      AND n.nspname = 'public'
      AND c.relname = 'businesses'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Business members can update business" ON "public"."businesses" FOR UPDATE USING ("public"."has_business_access"("id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Customers can update their own record; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Customers can update their own record'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Customers can update their own record" ON "public"."customers" FOR UPDATE USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments Customers can view own appointments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Customers can view own appointments'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Customers can view own appointments" ON "public"."appointments" FOR SELECT USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Customers can view their own record; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Customers can view their own record'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Customers can view their own record" ON "public"."customers" FOR SELECT USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Members can delete customers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can delete customers'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can delete customers" ON "public"."customers" FOR DELETE USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Members can insert customers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can insert customers'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can insert customers" ON "public"."customers" FOR INSERT WITH CHECK ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_addons Members can manage addons; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage addons'
      AND n.nspname = 'public'
      AND c.relname = 'service_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage addons" ON "public"."service_addons" USING ("public"."has_business_access"(( SELECT "services"."business_id"
   FROM "public"."services"
  WHERE ("services"."id" = "service_addons"."service_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_addons Members can manage appointment_addons; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage appointment_addons'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage appointment_addons" ON "public"."appointment_addons" USING ("public"."has_business_access"(( SELECT "a"."business_id"
   FROM ("public"."appointments" "a"
     JOIN "public"."appointment_services" "aps" ON (("a"."id" = "aps"."appointment_id")))
  WHERE ("aps"."id" = "appointment_addons"."appointment_service_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_services Members can manage appointment_services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage appointment_services'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage appointment_services" ON "public"."appointment_services" USING ("public"."has_business_access"(( SELECT "appointments"."business_id"
   FROM "public"."appointments"
  WHERE ("appointments"."id" = "appointment_services"."appointment_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments Members can manage appointments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage appointments'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage appointments" ON "public"."appointments" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: audit_logs Members can manage audit_logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage audit_logs'
      AND n.nspname = 'public'
      AND c.relname = 'audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage audit_logs" ON "public"."audit_logs" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: breaks Members can manage breaks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage breaks'
      AND n.nspname = 'public'
      AND c.relname = 'breaks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage breaks" ON "public"."breaks" USING ("public"."has_business_access"(( SELECT "employees"."business_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "breaks"."employee_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_settings Members can manage business_settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage business_settings'
      AND n.nspname = 'public'
      AND c.relname = 'business_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage business_settings" ON "public"."business_settings" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_categories Members can manage categories; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage categories'
      AND n.nspname = 'public'
      AND c.relname = 'service_categories'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage categories" ON "public"."service_categories" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employee_services Members can manage employee_services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage employee_services'
      AND n.nspname = 'public'
      AND c.relname = 'employee_services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage employee_services" ON "public"."employee_services" USING ("public"."has_business_access"(( SELECT "employees"."business_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "employee_services"."employee_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees Members can manage employees; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage employees'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage employees" ON "public"."employees" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: expenses Members can manage expenses; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage expenses'
      AND n.nspname = 'public'
      AND c.relname = 'expenses'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage expenses" ON "public"."expenses" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Members can manage notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage notifications" ON "public"."notifications" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products Members can manage products; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage products'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage products" ON "public"."products" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales Members can manage sales; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage sales'
      AND n.nspname = 'public'
      AND c.relname = 'sales'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage sales" ON "public"."sales" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: services Members can manage services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage services'
      AND n.nspname = 'public'
      AND c.relname = 'services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage services" ON "public"."services" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_movements Members can manage stock_movements; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage stock_movements'
      AND n.nspname = 'public'
      AND c.relname = 'stock_movements'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage stock_movements" ON "public"."stock_movements" USING ("public"."has_business_access"(( SELECT "products"."business_id"
   FROM "public"."products"
  WHERE ("products"."id" = "stock_movements"."product_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: time_off Members can manage time_off; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage time_off'
      AND n.nspname = 'public'
      AND c.relname = 'time_off'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage time_off" ON "public"."time_off" USING ("public"."has_business_access"(( SELECT "employees"."business_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "time_off"."employee_id"))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: working_hours Members can manage working_hours; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can manage working_hours'
      AND n.nspname = 'public'
      AND c.relname = 'working_hours'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can manage working_hours" ON "public"."working_hours" USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Members can update customers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can update customers'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can update customers" ON "public"."customers" FOR UPDATE USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members Members can view business_members; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can view business_members'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can view business_members" ON "public"."business_members" FOR SELECT USING (("public"."has_business_access"("business_id") OR ("user_id" = "auth"."uid"())));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Members can view customers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can view customers'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can view customers" ON "public"."customers" FOR SELECT USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscriptions Members can view subscriptions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Members can view subscriptions'
      AND n.nspname = 'public'
      AND c.relname = 'subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Members can view subscriptions" ON "public"."subscriptions" FOR SELECT USING ("public"."has_business_access"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members Owners can manage members; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Owners can manage members'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Owners can manage members" ON "public"."business_members" USING ("public"."is_business_owner"("business_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments Public can insert appointment; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can insert appointment'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can insert appointment" ON "public"."appointments" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_addons Public can insert appointment_addons; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can insert appointment_addons'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can insert appointment_addons" ON "public"."appointment_addons" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_services Public can insert appointment_services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can insert appointment_services'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can insert appointment_services" ON "public"."appointment_services" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers Public can insert customer during booking; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can insert customer during booking'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can insert customer during booking" ON "public"."customers" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_addons Public can view addons; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view addons'
      AND n.nspname = 'public'
      AND c.relname = 'service_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view addons" ON "public"."service_addons" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments Public can view appointment via guest_token; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view appointment via guest_token'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view appointment via guest_token" ON "public"."appointments" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_addons Public can view appointment_addons; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view appointment_addons'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_addons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view appointment_addons" ON "public"."appointment_addons" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_services Public can view appointment_services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view appointment_services'
      AND n.nspname = 'public'
      AND c.relname = 'appointment_services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view appointment_services" ON "public"."appointment_services" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: breaks Public can view breaks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view breaks'
      AND n.nspname = 'public'
      AND c.relname = 'breaks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view breaks" ON "public"."breaks" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_settings Public can view business_settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view business_settings'
      AND n.nspname = 'public'
      AND c.relname = 'business_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view business_settings" ON "public"."business_settings" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: businesses Public can view businesses; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view businesses'
      AND n.nspname = 'public'
      AND c.relname = 'businesses'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view businesses" ON "public"."businesses" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: service_categories Public can view categories; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view categories'
      AND n.nspname = 'public'
      AND c.relname = 'service_categories'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view categories" ON "public"."service_categories" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employee_services Public can view employee_services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view employee_services'
      AND n.nspname = 'public'
      AND c.relname = 'employee_services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view employee_services" ON "public"."employee_services" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees Public can view employees; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view employees'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view employees" ON "public"."employees" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: services Public can view services; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view services'
      AND n.nspname = 'public'
      AND c.relname = 'services'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view services" ON "public"."services" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: time_off Public can view time_off; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view time_off'
      AND n.nspname = 'public'
      AND c.relname = 'time_off'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view time_off" ON "public"."time_off" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: working_hours Public can view working_hours; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view working_hours'
      AND n.nspname = 'public'
      AND c.relname = 'working_hours'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view working_hours" ON "public"."working_hours" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointments Service role can do anything on appointments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Service role can do anything on appointments'
      AND n.nspname = 'public'
      AND c.relname = 'appointments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Service role can do anything on appointments" ON "public"."appointments" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: businesses Service role can do anything on businesses; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Service role can do anything on businesses'
      AND n.nspname = 'public'
      AND c.relname = 'businesses'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Service role can do anything on businesses" ON "public"."businesses" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscriptions Service role can do anything on subscriptions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Service role can do anything on subscriptions'
      AND n.nspname = 'public'
      AND c.relname = 'subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Service role can do anything on subscriptions" ON "public"."subscriptions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: business_members Users can insert themselves during onboarding; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can insert themselves during onboarding'
      AND n.nspname = 'public'
      AND c.relname = 'business_members'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can insert themselves during onboarding" ON "public"."business_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: appointment_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."appointment_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."appointment_services" ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: breaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."breaks" ENABLE ROW LEVEL SECURITY;

--
-- Name: business_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."business_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: business_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."business_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."employee_services" ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;

--
-- Name: service_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."service_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: service_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: time_off; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."time_off" ENABLE ROW LEVEL SECURITY;

--
-- Name: working_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."working_hours" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- auth.users trigger: on_auth_user_created
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can delete images" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete images'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can delete images" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING (((bucket_id = ''images''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can delete own uploads" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete own uploads'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can delete own uploads" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = owner));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can read own receipts" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can read own receipts'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can read own receipts" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING (((bucket_id = ''receipts''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can update images" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update images'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update images" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC WITH CHECK (((bucket_id = ''images''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can update own uploads" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update own uploads'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update own uploads" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = owner));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload avatars" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''avatars''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload covers" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload covers'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload covers" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''covers''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload images" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload images'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload images" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''images''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload logos" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload logos'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload logos" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''logos''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload products" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload products'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload products" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''products''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload receipts" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload receipts'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload receipts" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''receipts''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated users can upload services" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can upload services'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload services" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = ''services''::text) AND (auth.role() = ''authenticated''::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public Access to avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public Access to avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public Access to avatars" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''avatars''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public Access to covers" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public Access to covers'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public Access to covers" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''covers''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public Access to logos" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public Access to logos'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public Access to logos" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''logos''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public Access to products" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public Access to products'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public Access to products" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''products''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public Access to services" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public Access to services'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public Access to services" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''services''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public Access" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public Access'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public Access" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''images''::text));';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('avatars', 'avatars', NULL, '2026-07-13 08:57:47.007234+00', '2026-07-13 08:57:47.007234+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('covers', 'covers', NULL, '2026-07-13 08:57:47.007234+00', '2026-07-13 08:57:47.007234+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('images', 'images', NULL, '2026-07-13 11:45:13.580969+00', '2026-07-13 11:45:13.580969+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('logos', 'logos', NULL, '2026-07-13 08:57:47.007234+00', '2026-07-13 08:57:47.007234+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('products', 'products', NULL, '2026-07-13 08:57:47.007234+00', '2026-07-13 08:57:47.007234+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('receipts', 'receipts', NULL, '2026-07-13 08:57:47.007234+00', '2026-07-13 08:57:47.007234+00', 'false', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('services', 'services', NULL, '2026-07-13 08:57:47.007234+00', '2026-07-13 08:57:47.007234+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
