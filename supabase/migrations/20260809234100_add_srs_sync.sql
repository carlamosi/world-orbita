-- ============= CONCEPT PROGRESS =============
create table public.concept_progress (
  concept_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  iso3 text not null,
  skill text not null,
  fsrs_state text not null,
  fsrs_stability real,
  fsrs_difficulty real,
  fsrs_due timestamptz not null,
  fsrs_reps int not null default 0,
  fsrs_lapses int not null default 0,
  fsrs_last_review timestamptz not null,
  version int not null default 0,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);
grant select, insert, update, delete on public.concept_progress to authenticated;
grant all on public.concept_progress to service_role;
alter table public.concept_progress enable row level security;
create policy "cp own all" on public.concept_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index concept_progress_user_updated_idx on public.concept_progress (user_id, updated_at desc);

-- ============= QUESTION HISTORY =============
create table public.question_history (
  op_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  session_id text not null,
  grade int not null,
  response_ms int not null,
  correct boolean not null,
  answered_at timestamptz not null,
  client_id text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.question_history to authenticated;
grant all on public.question_history to service_role;
alter table public.question_history enable row level security;
create policy "qh own all" on public.question_history for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index question_history_user_updated_idx on public.question_history (user_id, updated_at desc);

-- ============= DAILY SUMMARY =============
create table public.daily_summary (
  date_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviews_count int not null default 0,
  correct_count int not null default 0,
  time_spent_ms int not null default 0,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);
grant select, insert, update, delete on public.daily_summary to authenticated;
grant all on public.daily_summary to service_role;
alter table public.daily_summary enable row level security;
create policy "dsum own all" on public.daily_summary for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index daily_summary_user_updated_idx on public.daily_summary (user_id, updated_at desc);

-- ============= UPDATE DELETE ACCOUNT RPC =============
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthenticated'; end if;
  delete from public.country_progress where user_id = uid;
  delete from public.sessions_log where user_id = uid;
  delete from public.challenge_attempts where user_id = uid;
  delete from public.unlocks where user_id = uid;
  delete from public.daily_streak where user_id = uid;
  delete from public.concept_progress where user_id = uid;
  delete from public.question_history where user_id = uid;
  delete from public.daily_summary where user_id = uid;
  delete from public.user_roles where user_id = uid;
  delete from public.profiles where id = uid;
end; $$;

-- ============= UPDATE SYNC_PUSH RPC =============
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
        incoming_skills := coalesce(payload->'skills', '{}'::jsonb);
        incoming_versions := coalesce(payload->'skill_versions', '{}'::jsonb);
        select * into cp_row from public.country_progress
          where user_id = uid and country_code = payload->>'country_code';
        if not found then
          insert into public.country_progress
            (user_id, country_code, skills, skill_versions, last_seen_at, client_id, updated_at)
          values (uid, payload->>'country_code', incoming_skills, incoming_versions,
            to_timestamp((payload->>'last_seen_at')::numeric / 1000.0), payload->>'client_id', now());
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
            last_seen_at = greatest(coalesce(cp_row.last_seen_at, 'epoch'::timestamptz), to_timestamp((payload->>'last_seen_at')::numeric / 1000.0)),
            client_id = payload->>'client_id',
            updated_at = now()
          where user_id = uid and country_code = payload->>'country_code';
        end if;
        select to_jsonb(cp.*) into payload from public.country_progress cp
          where user_id = uid and country_code = payload->>'country_code';
        accepted := array_append(accepted, op_id_v::text);
        canonical := canonical || jsonb_build_object('entity', entity, 'op_id', op_id_v, 'payload', payload);

      elsif entity = 'concept_progress' then
        inc_ver := coalesce((payload->>'version')::int, 0);
        select * into cprog_row from public.concept_progress
          where user_id = uid and concept_id = payload->>'conceptId';
        if not found then
          insert into public.concept_progress
            (user_id, concept_id, iso3, skill, fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_due, fsrs_reps, fsrs_lapses, fsrs_last_review, version, client_id, updated_at)
          values (uid, payload->>'conceptId', payload->>'iso3', payload->>'skill', payload->>'fsrs_state', 
            (payload->>'fsrs_stability')::real, (payload->>'fsrs_difficulty')::real, 
            to_timestamp((payload->>'fsrs_due')::numeric / 1000.0), (payload->>'fsrs_reps')::int, (payload->>'fsrs_lapses')::int, 
            to_timestamp((payload->>'fsrs_last_review')::numeric / 1000.0), inc_ver, payload->>'client_id', now());
          accepted := array_append(accepted, op_id_v::text);
        else
          cur_ver := coalesce(cprog_row.version, 0);
          if inc_ver > cur_ver then
            update public.concept_progress set
              fsrs_state = payload->>'fsrs_state',
              fsrs_stability = (payload->>'fsrs_stability')::real,
              fsrs_difficulty = (payload->>'fsrs_difficulty')::real,
              fsrs_due = to_timestamp((payload->>'fsrs_due')::numeric / 1000.0),
              fsrs_reps = (payload->>'fsrs_reps')::int,
              fsrs_lapses = (payload->>'fsrs_lapses')::int,
              fsrs_last_review = to_timestamp((payload->>'fsrs_last_review')::numeric / 1000.0),
              version = inc_ver,
              client_id = payload->>'client_id',
              updated_at = now()
            where user_id = uid and concept_id = payload->>'conceptId';
            accepted := array_append(accepted, op_id_v::text);
          else
            -- incoming is older or same version; reject it and return our canonical
            rejected := rejected || jsonb_build_object('op_id', op_id_v, 'reason', 'version conflict');
            select to_jsonb(cp.*) into payload from public.concept_progress cp
              where user_id = uid and concept_id = payload->>'conceptId';
            -- Frontend expects camelCase properties to match local Dexie tables, we must map them from DB snake_case to camelCase
            payload := jsonb_build_object(
              'conceptId', payload->'concept_id',
              'iso3', payload->'iso3',
              'skill', payload->'skill',
              'fsrs_state', payload->'fsrs_state',
              'fsrs_stability', payload->'fsrs_stability',
              'fsrs_difficulty', payload->'fsrs_difficulty',
              'fsrs_due', extract(epoch from (payload->>'fsrs_due')::timestamptz) * 1000,
              'fsrs_reps', payload->'fsrs_reps',
              'fsrs_lapses', payload->'fsrs_lapses',
              'fsrs_last_review', extract(epoch from (payload->>'fsrs_last_review')::timestamptz) * 1000,
              'version', payload->'version',
              'updated_at', extract(epoch from (payload->>'updated_at')::timestamptz) * 1000
            );
            canonical := canonical || jsonb_build_object('entity', entity, 'op_id', op_id_v, 'payload', payload);
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
          to_timestamp((payload->>'answeredAt')::numeric / 1000.0),
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
        -- unknown entity, just accept to unblock queue
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

-- ============= UPDATE SYNC_PULL RPC =============
create or replace function public.sync_pull(_cursors jsonb, _limit int default 500)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '{}'::jsonb;
  cur timestamptz;
  rows_json jsonb;
  new_cursor timestamptz;
begin
  if uid is null then raise exception 'unauthenticated'; end if;

  -- country_progress
  cur := coalesce((_cursors->>'country_progress')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.updated_at asc), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.country_progress where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('country_progress', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- concept_progress
  cur := coalesce((_cursors->>'concept_progress')::timestamptz, 'epoch'::timestamptz);
  -- Map to camelCase to match what the frontend expects
  select coalesce(jsonb_agg(
      jsonb_build_object(
        'conceptId', t.concept_id,
        'iso3', t.iso3,
        'skill', t.skill,
        'fsrs_state', t.fsrs_state,
        'fsrs_stability', t.fsrs_stability,
        'fsrs_difficulty', t.fsrs_difficulty,
        'fsrs_due', extract(epoch from t.fsrs_due) * 1000,
        'fsrs_reps', t.fsrs_reps,
        'fsrs_lapses', t.fsrs_lapses,
        'fsrs_last_review', extract(epoch from t.fsrs_last_review) * 1000,
        'version', t.version,
        'updated_at', extract(epoch from t.updated_at) * 1000
      ) order by t.updated_at asc
    ), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.concept_progress where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('concept_progress', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- daily_summary
  cur := coalesce((_cursors->>'daily_summary')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(
      jsonb_build_object(
        'dateKey', t.date_key,
        'reviewsCount', t.reviews_count,
        'correctCount', t.correct_count,
        'timeSpentMs', t.time_spent_ms,
        'updated_at', extract(epoch from t.updated_at) * 1000
      ) order by t.updated_at asc
    ), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.daily_summary where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('daily_summary', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- sessions_log
  cur := coalesce((_cursors->>'sessions_log')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.updated_at asc), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.sessions_log where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('sessions_log', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- challenge_attempts
  cur := coalesce((_cursors->>'challenge_attempts')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.updated_at asc), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.challenge_attempts where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('challenge_attempts', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- unlocks
  cur := coalesce((_cursors->>'unlocks')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.updated_at asc), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.unlocks where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('unlocks', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- daily_streak
  cur := coalesce((_cursors->>'daily_streak')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.updated_at asc), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.daily_streak where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('daily_streak', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  -- profiles
  cur := coalesce((_cursors->>'profiles')::timestamptz, 'epoch'::timestamptz);
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.updated_at asc), '[]'::jsonb), max(updated_at)
    into rows_json, new_cursor
    from (select * from public.profiles where id = uid and updated_at > cur order by updated_at asc limit _limit) t;
  result := result || jsonb_build_object('profiles', jsonb_build_object('rows', rows_json, 'cursor', coalesce(new_cursor, cur)));

  return result;
end; $$;
