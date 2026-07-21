begin;
create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id) on delete cascade,
  enabled boolean not null default true, default_language text not null default 'en' check (default_language in ('en','el','de','es','tr')),
  response_style text not null default 'balanced' check (response_style in ('concise','balanced','detailed')),
  retain_history boolean not null default true, allow_customer_data boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, agent_key text not null, title text,
  language text not null default 'en' check (language in ('en','el','de','es','tr')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade, user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user','assistant','system','tool')), content text not null, model text,
  input_tokens integer, output_tokens integer, created_at timestamptz not null default now()
);
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, agent_key text not null, provider text, model text,
  input_tokens integer not null default 0, output_tokens integer not null default 0, estimated_cost numeric(12,6) not null default 0,
  success boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  message_id uuid references public.ai_messages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint check (rating in (-1,1)), comment text, created_at timestamptz not null default now(), unique(message_id,user_id)
);
create table if not exists public.ai_action_requests (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade, agent_key text not null, action_type text not null,
  payload jsonb not null default '{}'::jsonb, status text not null default 'pending' check (status in ('pending','approved','rejected','executed','failed')),
  approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz, executed_at timestamptz, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_business_idx on public.ai_conversations(business_id,created_at desc);
create index if not exists ai_messages_conversation_idx on public.ai_messages(conversation_id,created_at);
create index if not exists ai_usage_business_idx on public.ai_usage_events(business_id,created_at desc);
create index if not exists ai_actions_business_idx on public.ai_action_requests(business_id,status,created_at desc);
alter table public.ai_settings enable row level security; alter table public.ai_conversations enable row level security; alter table public.ai_messages enable row level security; alter table public.ai_usage_events enable row level security; alter table public.ai_feedback enable row level security; alter table public.ai_action_requests enable row level security;
create policy "Members read AI settings" on public.ai_settings for select using (public.has_business_access(business_id));
create policy "Owners manage AI settings" on public.ai_settings for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy "Members manage own AI conversations" on public.ai_conversations for all using (public.has_business_access(business_id) and user_id=auth.uid()) with check (public.has_business_access(business_id) and user_id=auth.uid());
create policy "Members read own AI messages" on public.ai_messages for select using (public.has_business_access(business_id) and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy "Members insert own AI messages" on public.ai_messages for insert with check (public.has_business_access(business_id) and (user_id=auth.uid() or user_id is null) and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy "Owners read AI usage" on public.ai_usage_events for select using (public.is_business_owner(business_id));
create policy "Users manage own AI feedback" on public.ai_feedback for all using (user_id=auth.uid() and public.has_business_access(business_id)) with check (user_id=auth.uid() and public.has_business_access(business_id));
create policy "Members read AI action requests" on public.ai_action_requests for select using (public.has_business_access(business_id));
create policy "Members create AI action requests" on public.ai_action_requests for insert with check (public.has_business_access(business_id) and requested_by=auth.uid());
create policy "Owners approve AI action requests" on public.ai_action_requests for update using (public.is_business_owner(business_id));
insert into public.ai_settings (business_id, default_language) select id, 'en' from public.businesses on conflict (business_id) do nothing;
commit;
