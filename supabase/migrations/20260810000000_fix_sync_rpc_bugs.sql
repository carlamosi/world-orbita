-- =============================================================
-- Migration: 20260810000000_fix_sync_rpc_bugs.sql
--
-- Bug fixes for sync_push RPC identified during audit 2026-08-10:
--
-- Bug 1 (critical): country_progress canonical return - variable shadowing.
--   After `select to_jsonb(cp.*) into payload`, the WHERE clause on the
--   same statement reads `payload->>'country_code'` - but payload was just
--   overwritten. The fix is to capture the key BEFORE the SELECT.
--
-- Bug 2 (critical): concept_progress version-conflict canonical - same
--   variable shadowing pattern. cprog_row already holds the DB row from
--   the earlier SELECT; we should read from it instead of doing a second
--   SELECT that overwrites payload mid-expression.
--
-- Bug 3 (minor): fsrs_last_review and fsrs_due in concept_progress INSERT
--   - if client sends null the to_timestamp(null) silently inserts NULL,
--   violating NOT NULL. Added coalesce to epoch as fallback.
-- =============================================================

create or replace function public.sync_push(_mutations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m jsonb;
  entity text;
  op text;
  op_id_v uuid;
  payload jsonb;
  accepted text[] := array[]::text[];
  rejected jsonb := '[]'::jsonb;
  canonical jsonb := '[]'::jsonb;
  cp_row record;
  cprog_row record;
  incoming_skills jsonb;
  incoming_versions jsonb;
  merged_skills jsonb;
  merged_versions jsonb;
  skill_key text;
  inc_ver int;
  cur_ver int;
  v_country_code text;
  v_concept_id text;
  canonical_payload jsonb;
begin
  if uid is null then raise exception 'unauthenticated'; end if;
  for m in select * from jsonb_array_elements(_mutations) loop
    entity := m->>'entity';
    op := m->>'op';
    op_id_v := (m->>'op_id')::uuid;
    payload := m->'payload';
    begin
      if entity = 'sessions_log' then
        insert into public.sessions_log
          (user_id, op_id, mode, skill, score, total_questions, correct, wrong, best_combo,
           duration_ms, period_key, meta, started_at, ended_at, client_id)
        values (uid, op_id_v,
          payload->>'mode', payload->>'skill',
          coalesce((payload->>'score')::int,0),
          coalesce((payload->>'total_questions')::int,0),
          coalesce((payload->>'correct')::int,0),
          coalesce((payload->>'wrong')::int,0),
          coalesce((payload->>'best_combo')::int,0),
          coalesce((payload->>'duration_ms')::int,0),
          payload->>'period_key',
          payload->'meta',
          (payload->>'started_at')::timestamptz,
          (payload->>'ended_at')::timestamptz,
          payload->>'client_id')
        on conflict (op_id) do nothing;
        accepted := array_append(accepted, op_id_v::text);

      elsif entity = 'challenge_attempts' then
        insert into public.challenge_attempts
          (user_id, op_id, kind, period_key, question_index, correct, ms, client_id)
        values (uid, op_id_v,
          payload->>'kind', payload->>'period_key',
          coalesce((payload->>'question_index')::int,0),
          coalesce((payload->>'correct')::boolean,false),
          coalesce((payload->>'ms')::int,0),
          payload->>'client_id')
        on conflict (op_id) do nothing;
        accepted := array_append(accepted, op_id_v::text);

      elsif entity = 'country_progress' then
        v_country_code := payload->>'country_code';
        incoming_skills := coalesce(payload->'skills', '{}'::jsonb);
        incoming_versions := coalesce(payload->'skill_versions', '{}'::jsonb);
        select * into cp_row from public.country_progress
          where user_id = uid and country_code = v_country_code;
        if not found then
          insert into public.country_progress
            (user_id, country_code, skills, skill_versions, last_seen_at, client_id, updated_at)
          values (uid, v_country_code, incoming_skills, incoming_versions,
            to_timestamp(coalesce((payload->>'last_seen_at')::numeric, 0) / 1000.0),
            payload->>'client_id', now());
        else
          merged_skills := cp_row.skills;
          merged_versions := cp_row.skill_versions;
          for skill_key in select jsonb_object_keys(incoming_versions) loop
            inc_ver := coalesce((incoming_versions->>skill_key)::int, 0);
            cur_ver := coalesce((cp_row.skill_versions->>skill_key)::int, 0);
            if inc_ver > cur_ver then
              merged_skills := jsonb_set(merged_skills, array[skill_key], incoming_skills->skill_key, true);
              merged_versions := jsonb_set(merged_versions, array[skill_key], to_jsonb(inc_ver), true);
            end if;
          end loop;
          update public.country_progress set
            skills = merged_skills,
            skill_versions = merged_versions,
            last_seen_at = greatest(
              coalesce(cp_row.last_seen_at, 'epoch'::timestamptz),
              to_timestamp(coalesce((payload->>'last_seen_at')::numeric, 0) / 1000.0)
            ),
            client_id = payload->>'client_id',
            updated_at = now()
          where user_id = uid and country_code = v_country_code;
        end if;
        -- FIX: use v_country_code (stable local var), not payload->>'country_code' (now overwritten)
        select to_jsonb(cp.*) into canonical_payload
          from public.country_progress cp
          where user_id = uid and country_code = v_country_code;
        accepted := array_append(accepted, op_id_v::text);
        canonical := canonical || jsonb_build_object('entity', entity, 'op_id', op_id_v, 'payload', canonical_payload);

      elsif entity = 'concept_progress' then
        v_concept_id := payload->>'conceptId';
        inc_ver := coalesce((payload->>'version')::int, 0);
        select * into cprog_row from public.concept_progress
          where user_id = uid and concept_id = v_concept_id;
        if not found then
          insert into public.concept_progress
            (user_id, concept_id, iso3, skill, fsrs_state, fsrs_stability, fsrs_difficulty,
             fsrs_due, fsrs_reps, fsrs_lapses, fsrs_last_review, version, client_id, updated_at)
          values (
            uid, v_concept_id, payload->>'iso3', payload->>'skill', payload->>'fsrs_state',
            (payload->>'fsrs_stability')::real,
            (payload->>'fsrs_difficulty')::real,
            to_timestamp(coalesce((payload->>'fsrs_due')::numeric, 0) / 1000.0),
            coalesce((payload->>'fsrs_reps')::int, 0),
            coalesce((payload->>'fsrs_lapses')::int, 0),
            to_timestamp(coalesce((payload->>'fsrs_last_review')::numeric, 0) / 1000.0),
            inc_ver,
            payload->>'client_id',
            now()
          );
          accepted := array_append(accepted, op_id_v::text);
        else
          cur_ver := coalesce(cprog_row.version, 0);
          if inc_ver > cur_ver then
            update public.concept_progress set
              fsrs_state = payload->>'fsrs_state',
              fsrs_stability = (payload->>'fsrs_stability')::real,
              fsrs_difficulty = (payload->>'fsrs_difficulty')::real,
              fsrs_due = to_timestamp(coalesce((payload->>'fsrs_due')::numeric, 0) / 1000.0),
              fsrs_reps = coalesce((payload->>'fsrs_reps')::int, 0),
              fsrs_lapses = coalesce((payload->>'fsrs_lapses')::int, 0),
              fsrs_last_review = to_timestamp(coalesce((payload->>'fsrs_last_review')::numeric, 0) / 1000.0),
              version = inc_ver,
              client_id = payload->>'client_id',
              updated_at = now()
            where user_id = uid and concept_id = v_concept_id;
            accepted := array_append(accepted, op_id_v::text);
          else
            -- FIX: read from cprog_row (already fetched) instead of a second SELECT into payload
            rejected := rejected || jsonb_build_object('op_id', op_id_v, 'reason', 'version conflict');
            canonical_payload := jsonb_build_object(
              'conceptId',        cprog_row.concept_id,
              'iso3',             cprog_row.iso3,
              'skill',            cprog_row.skill,
              'fsrs_state',       cprog_row.fsrs_state,
              'fsrs_stability',   cprog_row.fsrs_stability,
              'fsrs_difficulty',  cprog_row.fsrs_difficulty,
              'fsrs_due',         extract(epoch from cprog_row.fsrs_due) * 1000,
              'fsrs_reps',        cprog_row.fsrs_reps,
              'fsrs_lapses',      cprog_row.fsrs_lapses,
              'fsrs_last_review', extract(epoch from cprog_row.fsrs_last_review) * 1000,
              'version',          cprog_row.version,
              'updated_at',       extract(epoch from cprog_row.updated_at) * 1000
            );
            canonical := canonical || jsonb_build_object('entity', entity, 'op_id', op_id_v, 'payload', canonical_payload);
          end if;
        end if;

      elsif entity = 'question_history' then
        insert into public.question_history
          (op_id, user_id, concept_id, session_id, grade, response_ms, correct, answered_at, client_id, updated_at)
        values (op_id_v, uid,
          payload->>'conceptId', payload->>'sessionId',
          coalesce((payload->>'grade')::int,0),
          coalesce((payload->>'responseMs')::int,0),
          coalesce((payload->>'correct')::boolean,false),
          to_timestamp(coalesce((payload->>'answeredAt')::numeric, 0) / 1000.0),
          payload->>'client_id', now())
        on conflict (op_id) do nothing;
        accepted := array_append(accepted, op_id_v::text);

      elsif entity = 'daily_summary' then
        insert into public.daily_summary
          (user_id, date_key, reviews_count, correct_count, time_spent_ms, client_id, updated_at)
        values (uid, payload->>'dateKey',
          coalesce((payload->>'reviewsCount')::int,0),
          coalesce((payload->>'correctCount')::int,0),
          coalesce((payload->>'timeSpentMs')::int,0),
          payload->>'client_id', now())
        on conflict (user_id, date_key) do update set
          reviews_count = public.daily_summary.reviews_count + excluded.reviews_count,
          correct_count = public.daily_summary.correct_count + excluded.correct_count,
          time_spent_ms = public.daily_summary.time_spent_ms + excluded.time_spent_ms,
          client_id = excluded.client_id,
          updated_at = now();
        accepted := array_append(accepted, op_id_v::text);
        
      elsif entity = 'unlocks' then
        insert into public.unlocks
          (user_id, key, progress, unlocked_at, meta, client_id)
        values (uid, payload->>'key',
          coalesce((payload->>'progress')::numeric, 0),
          (payload->>'unlocked_at')::timestamptz,
          payload->'meta',
          payload->>'client_id')
        on conflict (user_id, key) do update set
          progress = greatest(public.unlocks.progress, excluded.progress),
          unlocked_at = coalesce(public.unlocks.unlocked_at, excluded.unlocked_at),
          meta = excluded.meta,
          client_id = excluded.client_id,
          updated_at = now();
        accepted := array_append(accepted, op_id_v::text);

      elsif entity = 'daily_streak' then
        insert into public.daily_streak
          (user_id, date_key, count, last_active_at, client_id)
        values (uid, payload->>'date_key',
          coalesce((payload->>'count')::int, 0),
          (payload->>'last_active_at')::timestamptz,
          payload->>'client_id')
        on conflict (user_id, date_key) do update set
          count = greatest(public.daily_streak.count, excluded.count),
          last_active_at = greatest(public.daily_streak.last_active_at, excluded.last_active_at),
          client_id = excluded.client_id,
          updated_at = now();
        accepted := array_append(accepted, op_id_v::text);

      else
        accepted := array_append(accepted, op_id_v::text);
      end if;

    exception when others then
      rejected := rejected || jsonb_build_object('op_id', op_id_v, 'reason', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'accepted', coalesce(to_jsonb(accepted), '[]'::jsonb),
    'rejected', rejected,
    'canonical', canonical
  );
end; $$;
