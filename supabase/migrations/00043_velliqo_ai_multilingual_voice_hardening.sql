-- 00043_velliqo_ai_multilingual_voice_hardening.sql
-- Keeps Velliqo AI conversations, proactive briefings and alerts isolated by
-- the owner's currently selected supported language.

begin;

alter table public.ai_manager_alerts
  add column if not exists language text;

update public.ai_manager_alerts alerts
set language = coalesce(
  (
    select case
      when lower(split_part(coalesce(settings.default_language, 'en'), '-', 1)) in ('en', 'el', 'de', 'es', 'tr')
        then lower(split_part(coalesce(settings.default_language, 'en'), '-', 1))
      else 'en'
    end
    from public.ai_settings settings
    where settings.business_id = alerts.business_id
    limit 1
  ),
  'en'
)
where alerts.language is null
   or alerts.language not in ('en', 'el', 'de', 'es', 'tr');

alter table public.ai_manager_alerts
  alter column language set default 'en',
  alter column language set not null;

alter table public.ai_manager_alerts
  drop constraint if exists ai_manager_alerts_language_check;

alter table public.ai_manager_alerts
  add constraint ai_manager_alerts_language_check
  check (language in ('en', 'el', 'de', 'es', 'tr'));

alter table public.ai_manager_briefings
  drop constraint if exists ai_manager_briefings_business_id_briefing_date_key;

alter table public.ai_manager_briefings
  drop constraint if exists ai_manager_briefings_business_date_language_key;

alter table public.ai_manager_briefings
  add constraint ai_manager_briefings_business_date_language_key
  unique (business_id, briefing_date, language);

alter table public.ai_manager_alerts
  drop constraint if exists ai_manager_alerts_business_id_dedupe_key_key;

alter table public.ai_manager_alerts
  drop constraint if exists ai_manager_alerts_business_dedupe_language_key;

alter table public.ai_manager_alerts
  add constraint ai_manager_alerts_business_dedupe_language_key
  unique (business_id, dedupe_key, language);

create index if not exists ai_manager_briefings_business_language_date_idx
  on public.ai_manager_briefings (business_id, language, briefing_date desc);

create index if not exists ai_manager_alerts_business_language_status_idx
  on public.ai_manager_alerts (business_id, language, status, severity, last_seen_at desc);

create index if not exists ai_conversations_business_user_language_idx
  on public.ai_conversations (business_id, user_id, language, updated_at desc);

commit;
