-- =============================================================================
-- World Orbita: production reset for the v2 baseline (2026-11-06)
--
-- DESTRUCTIVE. Deletes ALL users and ALL app data, then removes every object
-- created by supabase/migrations_archive/*. Run it in the Supabase SQL editor
-- and apply supabase/migrations/20261106000000_baseline_v2.sql right after
-- (ideally in the same query, so the database is never left without schema).
-- Safe to run more than once. See docs/runbooks/supabase-v2-reset.md.
-- =============================================================================

-- 1. Users (cascades into every table that references auth.users)
delete from auth.users;

-- 2. Trigger on auth.users created by v1 (lives outside public, so the
--    drop of public.handle_new_user() below would fail without this).
drop trigger if exists on_auth_user_created on auth.users;

-- 3. Tables (cascade removes policies, indexes and touch_updated_at triggers)
drop table if exists public.hardcore_exam_progress cascade;
drop table if exists public.daily_summary cascade;
drop table if exists public.question_history cascade;
drop table if exists public.concept_progress cascade;
drop table if exists public.challenge_attempts cascade;
drop table if exists public.sessions_log cascade;
drop table if exists public.unlocks cascade;
drop table if exists public.daily_streak cascade;
drop table if exists public.country_progress cascade;
drop table if exists public.profiles cascade;
drop table if exists public.user_roles cascade;

-- 4. Functions: v1 ones and v2 ones, so the baseline can be re-applied
drop function if exists public.sync_push(jsonb) cascade;
drop function if exists public.sync_pull(jsonb, int) cascade;
drop function if exists public.delete_account() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.orbita_touch_updated_at() cascade;
drop function if exists public.orbita_ms(jsonb, boolean) cascade;
drop function if exists public.orbita_int(jsonb, int) cascade;
drop function if exists public.orbita_num(jsonb) cascade;
drop function if exists public.orbita_epoch_ms(timestamptz) cascade;

-- 5. Types
drop type if exists public.app_role cascade;

-- 6. Migration history, so `supabase db push` sees an empty remote.
--    Guarded: the schema does not exist outside Supabase (or in PGlite).
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'delete from supabase_migrations.schema_migrations';
  end if;
end $$;
