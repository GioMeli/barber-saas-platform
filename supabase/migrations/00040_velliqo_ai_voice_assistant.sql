-- 00040_velliqo_ai_voice_assistant.sql
-- Phase 9E: browser voice layer for Velliqo AI.
--
-- Voice never bypasses the existing Action Engine. Final transcripts are sent
-- through the same AI conversation endpoint, and action execution continues to
-- use the confirmation-based RPCs introduced in migration 00037.

begin;

alter table public.ai_settings
  add column if not exists voice_enabled boolean not null default false,
  add column if not exists voice_auto_play boolean not null default true,
  add column if not exists voice_continuous_mode boolean not null default true,
  add column if not exists voice_allow_low_risk_confirmation boolean not null default false,
  add column if not exists voice_rate numeric(3,2) not null default 1.00,
  add column if not exists voice_pitch numeric(3,2) not null default 1.00;

do $$
begin
  alter table public.ai_settings
    add constraint ai_settings_voice_rate_check
    check (voice_rate between 0.50 and 2.00);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.ai_settings
    add constraint ai_settings_voice_pitch_check
    check (voice_pitch between 0.50 and 2.00);
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.ai_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  language text not null default 'en' check (language in ('en', 'el', 'de', 'es', 'tr')),
  status text not null default 'active' check (status in ('active', 'completed', 'interrupted', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ai_voice_sessions_business_started_idx
  on public.ai_voice_sessions (business_id, started_at desc);

create index if not exists ai_voice_sessions_user_status_idx
  on public.ai_voice_sessions (user_id, status, started_at desc);

create unique index if not exists ai_voice_sessions_active_user_uidx
  on public.ai_voice_sessions (business_id, user_id)
  where status = 'active';

create table if not exists public.ai_voice_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_voice_sessions(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  message_id uuid references public.ai_messages(id) on delete set null,
  action_request_id uuid references public.ai_action_requests(id) on delete set null,
  event_type text not null check (event_type in (
    'session_started',
    'input_started',
    'input_final',
    'request_sent',
    'response_received',
    'speech_started',
    'speech_interrupted',
    'speech_completed',
    'confirmation_prompted',
    'confirmation_accepted',
    'confirmation_rejected',
    'confirmation_blocked',
    'error',
    'session_ended'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_voice_events_session_created_idx
  on public.ai_voice_events (session_id, created_at);

create index if not exists ai_voice_events_business_created_idx
  on public.ai_voice_events (business_id, created_at desc);

alter table public.ai_voice_sessions enable row level security;
alter table public.ai_voice_events enable row level security;

drop policy if exists "Users read authorised AI voice sessions" on public.ai_voice_sessions;
create policy "Users read authorised AI voice sessions"
  on public.ai_voice_sessions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.business_members bm
      where bm.business_id = ai_voice_sessions.business_id
        and bm.user_id = auth.uid()
        and bm.role::text in ('Owner', 'Manager')
    )
  );

drop policy if exists "Users read authorised AI voice events" on public.ai_voice_events;
create policy "Users read authorised AI voice events"
  on public.ai_voice_events
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.business_members bm
      where bm.business_id = ai_voice_events.business_id
        and bm.user_id = auth.uid()
        and bm.role::text in ('Owner', 'Manager')
    )
  );

revoke insert, update, delete on public.ai_voice_sessions from authenticated;
revoke insert, update, delete on public.ai_voice_events from authenticated;
grant select on public.ai_voice_sessions to authenticated;
grant select on public.ai_voice_events to authenticated;
grant all on public.ai_voice_sessions to service_role;
grant all on public.ai_voice_events to service_role;

create or replace function public.start_ai_voice_session(
  p_business_id uuid,
  p_language text default 'en',
  p_conversation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_ai_enabled boolean;
  v_voice_enabled boolean;
  v_language text := case when p_language in ('en', 'el', 'de', 'es', 'tr') then p_language else 'en' end;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_business_id is null or not public.has_business_access(p_business_id) then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;

  select enabled, voice_enabled
    into v_ai_enabled, v_voice_enabled
  from public.ai_settings
  where business_id = p_business_id;

  if not found or coalesce(v_ai_enabled, false) is false then
    raise exception using errcode = '42501', message = 'Velliqo AI is disabled for this business.';
  end if;

  if coalesce(v_voice_enabled, false) is false then
    raise exception using errcode = '42501', message = 'The Velliqo Voice Assistant is disabled in AI settings.';
  end if;

  if p_conversation_id is not null and not exists (
    select 1
    from public.ai_conversations c
    where c.id = p_conversation_id
      and c.business_id = p_business_id
      and c.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'The conversation does not belong to this voice session.';
  end if;

  update public.ai_voice_sessions
  set status = 'interrupted',
      ended_at = now(),
      updated_at = now()
  where business_id = p_business_id
    and user_id = v_user_id
    and status = 'active';

  insert into public.ai_voice_sessions (
    business_id,
    user_id,
    conversation_id,
    language
  ) values (
    p_business_id,
    v_user_id,
    p_conversation_id,
    v_language
  )
  returning id into v_session_id;

  insert into public.ai_voice_events (
    session_id,
    business_id,
    user_id,
    conversation_id,
    event_type,
    metadata
  ) values (
    v_session_id,
    p_business_id,
    v_user_id,
    p_conversation_id,
    'session_started',
    jsonb_build_object('language', v_language)
  );

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    p_business_id,
    v_user_id,
    'ai_voice_session_started',
    jsonb_build_object('session_id', v_session_id, 'language', v_language)
  );

  return v_session_id;
end;
$$;

create or replace function public.log_ai_voice_event(
  p_business_id uuid,
  p_session_id uuid,
  p_event_type text,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_action_request_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_metadata jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_event_type not in (
    'input_started',
    'input_final',
    'request_sent',
    'response_received',
    'speech_started',
    'speech_interrupted',
    'speech_completed',
    'confirmation_prompted',
    'confirmation_accepted',
    'confirmation_rejected',
    'confirmation_blocked',
    'error'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported voice event type.';
  end if;

  if not exists (
    select 1
    from public.ai_voice_sessions s
    where s.id = p_session_id
      and s.business_id = p_business_id
      and s.user_id = v_user_id
      and s.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'The voice session is not active or does not belong to this user.';
  end if;

  if p_conversation_id is not null and not exists (
    select 1
    from public.ai_conversations c
    where c.id = p_conversation_id
      and c.business_id = p_business_id
      and c.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'The conversation does not belong to this voice session.';
  end if;

  if p_message_id is not null and not exists (
    select 1
    from public.ai_messages m
    where m.id = p_message_id
      and m.business_id = p_business_id
  ) then
    raise exception using errcode = '42501', message = 'The message does not belong to this business.';
  end if;

  if p_action_request_id is not null and not exists (
    select 1
    from public.ai_action_requests a
    where a.id = p_action_request_id
      and a.business_id = p_business_id
      and a.requested_by = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'The action does not belong to this voice session.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb)
    - 'transcript'
    - 'content'
    - 'message'
    - 'answer'
    - 'customer_name'
    - 'email'
    - 'phone';

  if octet_length(v_metadata::text) > 4096 then
    raise exception using errcode = '22023', message = 'Voice event metadata is too large.';
  end if;

  if p_conversation_id is not null then
    update public.ai_voice_sessions
    set conversation_id = p_conversation_id,
        updated_at = now()
    where id = p_session_id;
  end if;

  insert into public.ai_voice_events (
    session_id,
    business_id,
    user_id,
    conversation_id,
    message_id,
    action_request_id,
    event_type,
    metadata
  ) values (
    p_session_id,
    p_business_id,
    v_user_id,
    p_conversation_id,
    p_message_id,
    p_action_request_id,
    p_event_type,
    v_metadata
  )
  returning id into v_event_id;

  if p_event_type in ('confirmation_accepted', 'confirmation_rejected', 'confirmation_blocked') then
    insert into public.audit_logs (business_id, user_id, action, details)
    values (
      p_business_id,
      v_user_id,
      'ai_voice_' || p_event_type,
      jsonb_build_object(
        'session_id', p_session_id,
        'action_request_id', p_action_request_id,
        'metadata', v_metadata
      )
    );
  end if;

  return v_event_id;
end;
$$;

create or replace function public.finish_ai_voice_session(
  p_business_id uuid,
  p_session_id uuid,
  p_status text default 'completed'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := case when p_status in ('completed', 'interrupted', 'failed') then p_status else 'completed' end;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  update public.ai_voice_sessions
  set status = v_status,
      ended_at = now(),
      updated_at = now()
  where id = p_session_id
    and business_id = p_business_id
    and user_id = v_user_id
    and status = 'active';

  if not found then
    return false;
  end if;

  insert into public.ai_voice_events (
    session_id,
    business_id,
    user_id,
    conversation_id,
    event_type,
    metadata
  )
  select
    s.id,
    s.business_id,
    s.user_id,
    s.conversation_id,
    'session_ended',
    jsonb_build_object('status', v_status)
  from public.ai_voice_sessions s
  where s.id = p_session_id;

  insert into public.audit_logs (business_id, user_id, action, details)
  values (
    p_business_id,
    v_user_id,
    'ai_voice_session_ended',
    jsonb_build_object('session_id', p_session_id, 'status', v_status)
  );

  return true;
end;
$$;

revoke all on function public.start_ai_voice_session(uuid, text, uuid) from public;
revoke all on function public.log_ai_voice_event(uuid, uuid, text, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.finish_ai_voice_session(uuid, uuid, text) from public;

grant execute on function public.start_ai_voice_session(uuid, text, uuid) to authenticated;
grant execute on function public.log_ai_voice_event(uuid, uuid, text, uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.finish_ai_voice_session(uuid, uuid, text) to authenticated;

grant execute on function public.start_ai_voice_session(uuid, text, uuid) to service_role;
grant execute on function public.log_ai_voice_event(uuid, uuid, text, uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.finish_ai_voice_session(uuid, uuid, text) to service_role;

commit;
