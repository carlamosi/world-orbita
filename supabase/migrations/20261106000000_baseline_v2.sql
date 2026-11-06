-- =============================================================================
-- World Orbita baseline v2 (2026-11-06)
--
-- Replaces every earlier migration (kept unapplied in supabase/migrations_archive).
-- Applied to an EMPTY database: no compatibility with v1 data.
--
-- Contract (see .superpowers/sdd/2026-11-06-world-orbita-supabase-v2/task-7-report.md):
--   * Every date in sync_push payloads and in sync_pull/canonical rows is a JSON
--     number of epoch milliseconds. Anything else -> rejected 'invalid_payload'.
--   * Each mutation is applied in its own sub-transaction; one bad item never
--     aborts the batch. Reasons: invalid_op_id | invalid_payload | unknown_entity
--     | stale_review.
--   * sync_pull pages each entity by (updated_at, pk) with an opaque cursor
--     "<epoch_ms>|<pk>".
--   * Audit findings fixed here: SQL-1..SQL-14 (SQL-4 only partially, see report), FSRS-1.
--
-- Grants are explicit and minimal; nothing is granted to anon.
-- =============================================================================

-- ============================ ROLES =========================================
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
create policy "user_roles select own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============================ HELPERS =======================================
-- Epoch ms (JSON number) -> timestamptz. JSON null / missing -> null unless required.
-- Anything else raises 'invalid_payload' (SQL-1, SQL-14).
create function public.orbita_ms(v jsonb, required boolean default true)
returns timestamptz language plpgsql immutable set search_path = public as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then raise exception 'invalid_payload'; end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'number' then raise exception 'invalid_payload'; end if;
  return to_timestamp(v::numeric / 1000.0);
end $$;

-- JSON number -> int (rounded). JSON null / missing -> dflt. Anything else raises.
create function public.orbita_int(v jsonb, dflt int default 0)
returns int language plpgsql immutable set search_path = public as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then return dflt; end if;
  if jsonb_typeof(v) <> 'number' then raise exception 'invalid_payload'; end if;
  return round(v::numeric)::int;
end $$;

-- JSON number -> numeric. JSON null / missing -> null. Anything else raises.
create function public.orbita_num(v jsonb)
returns numeric language plpgsql immutable set search_path = public as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  if jsonb_typeof(v) <> 'number' then raise exception 'invalid_payload'; end if;
  return v::numeric;
end $$;

-- timestamptz -> epoch ms (bigint), null-safe.
create function public.orbita_epoch_ms(ts timestamptz)
returns bigint language sql immutable set search_path = public as $$
  select (extract(epoch from ts) * 1000)::bigint
$$;

-- Server-owned updated_at with millisecond precision, so the pull cursor
-- "<epoch_ms>|<pk>" round-trips exactly.
create function public.orbita_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := date_trunc('milliseconds', now());
  return new;
end $$;

-- ============================ PROFILES ======================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_flag text,
  client_id text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create index profiles_pull_idx on public.profiles (id, updated_at);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================ COUNTRY PROGRESS ==============================
create table public.country_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null check (country_code <> ''),
  skills jsonb not null default '{}'::jsonb check (jsonb_typeof(skills) = 'object'),
  skill_versions jsonb not null default '{}'::jsonb check (jsonb_typeof(skill_versions) = 'object'),
  last_seen_at timestamptz,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, country_code)
);
alter table public.country_progress enable row level security;
create policy "country_progress own select" on public.country_progress for select to authenticated using (auth.uid() = user_id);
create policy "country_progress own insert" on public.country_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "country_progress own update" on public.country_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index country_progress_pull_idx on public.country_progress (user_id, updated_at, country_code);

-- ============================ CONCEPT PROGRESS (FSRS) =======================
create table public.concept_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null check (concept_id <> ''),
  iso3 text not null,
  skill text not null,
  fsrs_state smallint not null check (fsrs_state between 0 and 3),
  fsrs_stability real,
  fsrs_difficulty real,
  fsrs_due timestamptz not null check (fsrs_due > '2000-01-01'::timestamptz),
  fsrs_reps int not null default 0,
  fsrs_lapses int not null default 0,
  fsrs_last_review timestamptz not null check (fsrs_last_review > '2000-01-01'::timestamptz),
  fsrs_elapsed_days int not null default 0,
  fsrs_scheduled_days int not null default 0,
  fsrs_learning_steps int not null default 0,
  version int not null default 1,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);
alter table public.concept_progress enable row level security;
create policy "concept_progress own select" on public.concept_progress for select to authenticated using (auth.uid() = user_id);
create policy "concept_progress own insert" on public.concept_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "concept_progress own update" on public.concept_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index concept_progress_pull_idx on public.concept_progress (user_id, updated_at, concept_id);

-- ============================ QUESTION HISTORY (append-only) ================
create table public.question_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id uuid not null,
  concept_id text not null,
  session_id text not null,
  grade int not null,
  response_ms int not null default 0,
  correct boolean not null,
  answered_at timestamptz not null,
  mode text,
  direction text,
  fsrs_log text,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, op_id)
);
alter table public.question_history enable row level security;
create policy "question_history own select" on public.question_history for select to authenticated using (auth.uid() = user_id);
create policy "question_history own insert" on public.question_history for insert to authenticated with check (auth.uid() = user_id);
create index question_history_pull_idx on public.question_history (user_id, updated_at, op_id);
create index question_history_user_answered_idx on public.question_history (user_id, answered_at desc);
create index question_history_user_concept_idx on public.question_history (user_id, concept_id);

-- ============================ DAILY SUMMARY =================================
create table public.daily_summary (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null check (date_key <> ''),
  reviews_count int not null default 0,
  correct_count int not null default 0,
  time_spent_ms int not null default 0,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);
alter table public.daily_summary enable row level security;
create policy "daily_summary own select" on public.daily_summary for select to authenticated using (auth.uid() = user_id);
create policy "daily_summary own insert" on public.daily_summary for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_summary own update" on public.daily_summary for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index daily_summary_pull_idx on public.daily_summary (user_id, updated_at, date_key);

-- ============================ SESSIONS LOG (append-only) ====================
create table public.sessions_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id uuid not null,
  mode text not null,
  skill text,
  score int not null default 0,
  total_questions int not null default 0,
  correct int not null default 0,
  wrong int not null default 0,
  best_combo int not null default 0,
  duration_ms int not null default 0,
  period_key text,
  meta jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  client_id text,
  updated_at timestamptz not null default now(),
  unique (user_id, op_id)
);
alter table public.sessions_log enable row level security;
create policy "sessions_log own select" on public.sessions_log for select to authenticated using (auth.uid() = user_id);
create policy "sessions_log own insert" on public.sessions_log for insert to authenticated with check (auth.uid() = user_id);
create index sessions_log_pull_idx on public.sessions_log (user_id, updated_at, id);

-- ============================ CHALLENGE ATTEMPTS (append-only) ==============
create table public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id uuid not null,
  kind text not null,
  period_key text not null,
  question_index int not null,
  correct boolean not null,
  ms int not null default 0,
  client_id text,
  updated_at timestamptz not null default now(),
  unique (user_id, op_id),
  unique (user_id, kind, period_key, question_index)
);
alter table public.challenge_attempts enable row level security;
create policy "challenge_attempts own select" on public.challenge_attempts for select to authenticated using (auth.uid() = user_id);
create policy "challenge_attempts own insert" on public.challenge_attempts for insert to authenticated with check (auth.uid() = user_id);
create index challenge_attempts_pull_idx on public.challenge_attempts (user_id, updated_at, id);

-- ============================ UNLOCKS =======================================
create table public.unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key <> ''),
  progress numeric not null default 0,
  unlocked_at timestamptz,
  meta jsonb,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.unlocks enable row level security;
create policy "unlocks own select" on public.unlocks for select to authenticated using (auth.uid() = user_id);
create policy "unlocks own insert" on public.unlocks for insert to authenticated with check (auth.uid() = user_id);
create policy "unlocks own update" on public.unlocks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index unlocks_pull_idx on public.unlocks (user_id, updated_at, key);

-- ============================ DAILY STREAK ==================================
create table public.daily_streak (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null check (date_key <> ''),
  count int not null default 0,
  last_active_at timestamptz not null,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);
alter table public.daily_streak enable row level security;
create policy "daily_streak own select" on public.daily_streak for select to authenticated using (auth.uid() = user_id);
create policy "daily_streak own insert" on public.daily_streak for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_streak own update" on public.daily_streak for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index daily_streak_pull_idx on public.daily_streak (user_id, updated_at, date_key);

-- ============================ HARDCORE EXAM PROGRESS (direct table API) =====
-- PK is per user (SQL-13): another user can no longer occupy someone's id.
-- Not synced through sync_push/pull; the client writes it with PostgREST, so
-- its timestamps stay client-provided timestamptz.
create table public.hardcore_exam_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  continent text not null,
  current_index int not null default 0,
  total_questions int not null,
  score int not null default 0,
  correct int not null default 0,
  wrong int not null default 0,
  best_combo int not null default 0,
  combo int not null default 0,
  queue jsonb not null,
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, id)
);
alter table public.hardcore_exam_progress enable row level security;
create policy "hardcore own select" on public.hardcore_exam_progress for select to authenticated using (auth.uid() = user_id);
create policy "hardcore own insert" on public.hardcore_exam_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "hardcore own update" on public.hardcore_exam_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "hardcore own delete" on public.hardcore_exam_progress for delete to authenticated using (auth.uid() = user_id);

-- ============================ updated_at TRIGGERS ===========================
create trigger touch_updated_at before insert or update on public.profiles
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.country_progress
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.concept_progress
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.question_history
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.daily_summary
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.sessions_log
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.challenge_attempts
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.unlocks
  for each row execute function public.orbita_touch_updated_at();
create trigger touch_updated_at before insert or update on public.daily_streak
  for each row execute function public.orbita_touch_updated_at();

-- ============================ ROW -> WIRE JSON ==============================
-- Field names follow Ruling 3: snake_case rows except the camelCase mapping of
-- concept_progress, daily_summary and question_history. Dates are epoch ms.
create function public.orbita_concept_json(t public.concept_progress)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'conceptId', t.concept_id,
    'iso3', t.iso3,
    'skill', t.skill,
    'fsrs_state', t.fsrs_state,
    'fsrs_stability', t.fsrs_stability,
    'fsrs_difficulty', t.fsrs_difficulty,
    'fsrs_due', public.orbita_epoch_ms(t.fsrs_due),
    'fsrs_reps', t.fsrs_reps,
    'fsrs_lapses', t.fsrs_lapses,
    'fsrs_last_review', public.orbita_epoch_ms(t.fsrs_last_review),
    'fsrs_elapsed_days', t.fsrs_elapsed_days,
    'fsrs_scheduled_days', t.fsrs_scheduled_days,
    'fsrs_learning_steps', t.fsrs_learning_steps,
    'version', t.version,
    'updated_at', public.orbita_epoch_ms(t.updated_at)
  )
$$;

create function public.orbita_country_json(t public.country_progress)
returns jsonb language sql stable set search_path = public as $$
  select to_jsonb(t) || jsonb_build_object(
    'last_seen_at', public.orbita_epoch_ms(t.last_seen_at),
    'updated_at', public.orbita_epoch_ms(t.updated_at))
$$;

-- ============================ sync_push =====================================
create function public.sync_push(_mutations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m jsonb;
  raw_op text;
  op_id_v uuid;
  entity text;
  p jsonb;
  accepted jsonb := '[]'::jsonb;
  rejected jsonb := '[]'::jsonb;
  canonical jsonb := '[]'::jsonb;
  item_canonical jsonb;
  item_rejected text;
  -- concept_progress
  v_concept text;
  v_cp public.concept_progress;
  v_cur public.concept_progress;
  -- country_progress
  v_country text;
  v_skills jsonb;
  v_versions jsonb;
  v_seen timestamptz;
  v_row public.country_progress;
  v_merged_skills jsonb;
  v_merged_versions jsonb;
  k text;
  inc_ver int;
  inserted boolean;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if _mutations is null or jsonb_typeof(_mutations) <> 'array' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  for m in select value from jsonb_array_elements(_mutations) loop
    raw_op := case when jsonb_typeof(m) = 'object' then m->>'op_id' end;
    item_canonical := null;
    item_rejected := null;
    begin
      -- SQL-2: the op_id check and cast live inside the per-item block.
      if raw_op is null
         or raw_op !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'invalid_op_id';
      end if;
      op_id_v := raw_op::uuid;
      entity := m->>'entity';
      p := m->'payload';
      if p is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid_payload'; end if;

      if entity = 'concept_progress' then
        -- SQL-6/SQL-5: latest fsrs_last_review wins; ties keep the stored row;
        -- the server assigns version; the row is locked before comparing.
        v_concept := p->>'conceptId';
        v_cp.user_id := uid;
        v_cp.concept_id := v_concept;
        v_cp.iso3 := p->>'iso3';
        v_cp.skill := p->>'skill';
        v_cp.fsrs_state := public.orbita_int(p->'fsrs_state', null);
        v_cp.fsrs_stability := public.orbita_num(p->'fsrs_stability');
        v_cp.fsrs_difficulty := public.orbita_num(p->'fsrs_difficulty');
        v_cp.fsrs_due := public.orbita_ms(p->'fsrs_due');
        v_cp.fsrs_reps := public.orbita_int(p->'fsrs_reps');
        v_cp.fsrs_lapses := public.orbita_int(p->'fsrs_lapses');
        v_cp.fsrs_last_review := public.orbita_ms(p->'fsrs_last_review');
        v_cp.fsrs_elapsed_days := public.orbita_int(p->'fsrs_elapsed_days');
        v_cp.fsrs_scheduled_days := public.orbita_int(p->'fsrs_scheduled_days');
        v_cp.fsrs_learning_steps := public.orbita_int(p->'fsrs_learning_steps');
        v_cp.client_id := p->>'client_id';

        insert into public.concept_progress
          (user_id, concept_id, iso3, skill, fsrs_state, fsrs_stability, fsrs_difficulty,
           fsrs_due, fsrs_reps, fsrs_lapses, fsrs_last_review, fsrs_elapsed_days,
           fsrs_scheduled_days, fsrs_learning_steps, version, client_id)
        values
          (uid, v_cp.concept_id, v_cp.iso3, v_cp.skill, v_cp.fsrs_state, v_cp.fsrs_stability,
           v_cp.fsrs_difficulty, v_cp.fsrs_due, v_cp.fsrs_reps, v_cp.fsrs_lapses,
           v_cp.fsrs_last_review, v_cp.fsrs_elapsed_days, v_cp.fsrs_scheduled_days,
           v_cp.fsrs_learning_steps, 1, v_cp.client_id)
        on conflict (user_id, concept_id) do nothing;
        inserted := found;

        if not inserted then
          select * into v_cur from public.concept_progress
            where user_id = uid and concept_id = v_concept
            for update;
          if v_cp.fsrs_last_review > v_cur.fsrs_last_review then
            update public.concept_progress set
              iso3 = v_cp.iso3,
              skill = v_cp.skill,
              fsrs_state = v_cp.fsrs_state,
              fsrs_stability = v_cp.fsrs_stability,
              fsrs_difficulty = v_cp.fsrs_difficulty,
              fsrs_due = v_cp.fsrs_due,
              fsrs_reps = v_cp.fsrs_reps,
              fsrs_lapses = v_cp.fsrs_lapses,
              fsrs_last_review = v_cp.fsrs_last_review,
              fsrs_elapsed_days = v_cp.fsrs_elapsed_days,
              fsrs_scheduled_days = v_cp.fsrs_scheduled_days,
              fsrs_learning_steps = v_cp.fsrs_learning_steps,
              version = v_cur.version + 1,
              client_id = v_cp.client_id
            where user_id = uid and concept_id = v_concept;
          else
            item_rejected := 'stale_review';
            item_canonical := public.orbita_concept_json(v_cur);
          end if;
        end if;

      elsif entity = 'country_progress' then
        -- Per-skill merge: the higher skill_versions entry wins; row locked first.
        v_country := p->>'country_code';
        v_skills := coalesce(p->'skills', '{}'::jsonb);
        v_versions := coalesce(p->'skill_versions', '{}'::jsonb);
        if jsonb_typeof(v_skills) <> 'object' or jsonb_typeof(v_versions) <> 'object' then
          raise exception 'invalid_payload';
        end if;
        for k in select jsonb_object_keys(v_versions) loop
          perform public.orbita_int(v_versions->k, null);
        end loop;
        v_seen := public.orbita_ms(p->'last_seen_at', false);

        insert into public.country_progress
          (user_id, country_code, skills, skill_versions, last_seen_at, client_id)
        values (uid, v_country, v_skills, v_versions, v_seen, p->>'client_id')
        on conflict (user_id, country_code) do nothing;
        inserted := found;

        if not inserted then
          select * into v_row from public.country_progress
            where user_id = uid and country_code = v_country
            for update;
          v_merged_skills := v_row.skills;
          v_merged_versions := v_row.skill_versions;
          for k in select jsonb_object_keys(v_versions) loop
            inc_ver := public.orbita_int(v_versions->k, 0);
            if inc_ver > coalesce(public.orbita_int(v_merged_versions->k, 0), 0) then
              v_merged_skills := jsonb_set(v_merged_skills, array[k], coalesce(v_skills->k, 'null'::jsonb), true);
              v_merged_versions := jsonb_set(v_merged_versions, array[k], to_jsonb(inc_ver), true);
            end if;
          end loop;
          update public.country_progress set
            skills = v_merged_skills,
            skill_versions = v_merged_versions,
            last_seen_at = greatest(v_row.last_seen_at, v_seen),
            client_id = p->>'client_id'
          where user_id = uid and country_code = v_country;
        end if;
        select * into v_row from public.country_progress
          where user_id = uid and country_code = v_country;
        item_canonical := public.orbita_country_json(v_row);

      elsif entity = 'question_history' then
        insert into public.question_history
          (user_id, op_id, concept_id, session_id, grade, response_ms, correct, answered_at,
           mode, direction, fsrs_log, client_id)
        values (uid, op_id_v, p->>'conceptId', p->>'sessionId',
          public.orbita_int(p->'grade', null),
          public.orbita_int(p->'responseMs'),
          (p->>'correct')::boolean,
          public.orbita_ms(p->'answeredAt'),
          p->>'mode', p->>'direction', p->>'fsrs_log', p->>'client_id')
        on conflict (user_id, op_id) do nothing;

      elsif entity = 'daily_summary' then
        -- SQL-9: the client sends day totals; greatest() makes retries idempotent.
        insert into public.daily_summary
          (user_id, date_key, reviews_count, correct_count, time_spent_ms, client_id)
        values (uid, p->>'dateKey',
          public.orbita_int(p->'reviewsCount'),
          public.orbita_int(p->'correctCount'),
          public.orbita_int(p->'timeSpentMs'),
          p->>'client_id')
        on conflict (user_id, date_key) do update set
          reviews_count = greatest(public.daily_summary.reviews_count, excluded.reviews_count),
          correct_count = greatest(public.daily_summary.correct_count, excluded.correct_count),
          time_spent_ms = greatest(public.daily_summary.time_spent_ms, excluded.time_spent_ms),
          client_id = excluded.client_id;

      elsif entity = 'sessions_log' then
        insert into public.sessions_log
          (user_id, op_id, mode, skill, score, total_questions, correct, wrong, best_combo,
           duration_ms, period_key, meta, started_at, ended_at, client_id)
        values (uid, op_id_v, p->>'mode', p->>'skill',
          public.orbita_int(p->'score'),
          public.orbita_int(p->'total_questions'),
          public.orbita_int(p->'correct'),
          public.orbita_int(p->'wrong'),
          public.orbita_int(p->'best_combo'),
          public.orbita_int(p->'duration_ms'),
          p->>'period_key',
          p->'meta',
          public.orbita_ms(p->'started_at', false),
          public.orbita_ms(p->'ended_at', false),
          p->>'client_id')
        on conflict (user_id, op_id) do nothing;

      elsif entity = 'challenge_attempts' then
        -- SQL-12: no conflict target, so both op_id and the natural key are covered.
        insert into public.challenge_attempts
          (user_id, op_id, kind, period_key, question_index, correct, ms, client_id)
        values (uid, op_id_v, p->>'kind', p->>'period_key',
          public.orbita_int(p->'question_index', null),
          (p->>'correct')::boolean,
          public.orbita_int(p->'ms'),
          p->>'client_id')
        on conflict do nothing;

      elsif entity = 'unlocks' then
        insert into public.unlocks (user_id, key, progress, unlocked_at, meta, client_id)
        values (uid, p->>'key',
          coalesce(public.orbita_num(p->'progress'), 0),
          public.orbita_ms(p->'unlocked_at', false),
          p->'meta', p->>'client_id')
        on conflict (user_id, key) do update set
          progress = greatest(public.unlocks.progress, excluded.progress),
          unlocked_at = least(public.unlocks.unlocked_at, excluded.unlocked_at),
          meta = coalesce(excluded.meta, public.unlocks.meta),
          client_id = excluded.client_id;

      elsif entity = 'daily_streak' then
        insert into public.daily_streak (user_id, date_key, count, last_active_at, client_id)
        values (uid, p->>'date_key',
          public.orbita_int(p->'count'),
          public.orbita_ms(p->'last_active_at'),
          p->>'client_id')
        on conflict (user_id, date_key) do update set
          count = greatest(public.daily_streak.count, excluded.count),
          last_active_at = greatest(public.daily_streak.last_active_at, excluded.last_active_at),
          client_id = excluded.client_id;

      elsif entity = 'profiles' then
        -- SQL-10: profiles branch restored.
        insert into public.profiles (id, display_name, avatar_flag, client_id)
        values (uid, p->>'display_name', p->>'avatar_flag', p->>'client_id')
        on conflict (id) do update set
          display_name = excluded.display_name,
          avatar_flag = excluded.avatar_flag,
          client_id = excluded.client_id;

      else
        item_rejected := 'unknown_entity';
      end if;

      -- Collections are only touched once the item has fully succeeded.
      if item_rejected is null then
        accepted := accepted || to_jsonb(raw_op);
      else
        rejected := rejected || jsonb_build_array(jsonb_build_object('op_id', raw_op, 'reason', item_rejected));
      end if;
      if item_canonical is not null then
        canonical := canonical || jsonb_build_array(
          jsonb_build_object('entity', entity, 'op_id', raw_op, 'payload', item_canonical));
      end if;

    exception when others then
      rejected := rejected || jsonb_build_array(jsonb_build_object(
        'op_id', raw_op,
        'reason', case
          when sqlerrm in ('invalid_op_id', 'invalid_payload') then sqlerrm
          when sqlstate like '22%' or sqlstate in ('23502', '23514') then 'invalid_payload'
          else sqlerrm
        end));
    end;
  end loop;

  return jsonb_build_object('accepted', accepted, 'rejected', rejected, 'canonical', canonical);
end $$;

-- ============================ sync_pull =====================================
-- _cursors: { "<entity>": "<epoch_ms>|<pk>" | null }. A missing, null or
-- unparseable cursor starts from the beginning. Each entity returns
-- { rows, cursor, has_more }; cursor is the last row's position (or the
-- incoming cursor when the page is empty).
create function public.sync_pull(_cursors jsonb, _limit int default 500)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim int := least(greatest(coalesce(_limit, 500), 1), 1000);
  result jsonb := '{}'::jsonb;
  ent text;
  tbl text;
  owner_col text;
  pk_col text;
  pk_type text;
  row_json text;
  cur_raw text;
  cur_ts timestamptz;
  cur_pk text;
  sep int;
  rows_json jsonb;
  n int;
  last_cursor text;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;

  foreach ent in array array['country_progress', 'concept_progress', 'question_history',
    'daily_summary', 'sessions_log', 'challenge_attempts', 'unlocks', 'daily_streak', 'profiles']
  loop
    -- Fixed whitelist: nothing from the caller is interpolated into SQL.
    owner_col := 'user_id';
    case ent
      when 'country_progress' then
        pk_col := 'country_code'; pk_type := 'text';
        row_json := 'public.orbita_country_json(t)';
      when 'concept_progress' then
        pk_col := 'concept_id'; pk_type := 'text';
        row_json := 'public.orbita_concept_json(t)';
      when 'question_history' then
        pk_col := 'op_id'; pk_type := 'uuid';
        row_json := $j$jsonb_build_object(
          'op_id', t.op_id, 'conceptId', t.concept_id, 'sessionId', t.session_id,
          'grade', t.grade, 'mode', t.mode, 'direction', t.direction, 'fsrs_log', t.fsrs_log,
          'responseMs', t.response_ms, 'correct', t.correct,
          'answeredAt', public.orbita_epoch_ms(t.answered_at),
          'updated_at', public.orbita_epoch_ms(t.updated_at))$j$;
      when 'daily_summary' then
        pk_col := 'date_key'; pk_type := 'text';
        row_json := $j$jsonb_build_object(
          'dateKey', t.date_key, 'reviewsCount', t.reviews_count,
          'correctCount', t.correct_count, 'timeSpentMs', t.time_spent_ms,
          'updated_at', public.orbita_epoch_ms(t.updated_at))$j$;
      when 'sessions_log' then
        pk_col := 'id'; pk_type := 'uuid';
        row_json := $j$to_jsonb(t) || jsonb_build_object(
          'started_at', public.orbita_epoch_ms(t.started_at),
          'ended_at', public.orbita_epoch_ms(t.ended_at),
          'updated_at', public.orbita_epoch_ms(t.updated_at))$j$;
      when 'challenge_attempts' then
        pk_col := 'id'; pk_type := 'uuid';
        row_json := $j$to_jsonb(t) || jsonb_build_object(
          'updated_at', public.orbita_epoch_ms(t.updated_at))$j$;
      when 'unlocks' then
        pk_col := 'key'; pk_type := 'text';
        row_json := $j$to_jsonb(t) || jsonb_build_object(
          'unlocked_at', public.orbita_epoch_ms(t.unlocked_at),
          'updated_at', public.orbita_epoch_ms(t.updated_at))$j$;
      when 'daily_streak' then
        pk_col := 'date_key'; pk_type := 'text';
        row_json := $j$to_jsonb(t) || jsonb_build_object(
          'last_active_at', public.orbita_epoch_ms(t.last_active_at),
          'updated_at', public.orbita_epoch_ms(t.updated_at))$j$;
      when 'profiles' then
        owner_col := 'id'; pk_col := 'id'; pk_type := 'uuid';
        row_json := $j$to_jsonb(t) || jsonb_build_object(
          'updated_at', public.orbita_epoch_ms(t.updated_at),
          'created_at', public.orbita_epoch_ms(t.created_at))$j$;
    end case;

    -- Parse "<epoch_ms>|<pk>".
    cur_raw := case when jsonb_typeof(_cursors->ent) = 'string' then _cursors->>ent end;
    cur_ts := null;
    cur_pk := null;
    if cur_raw is not null then
      sep := position('|' in cur_raw);
      if sep > 1 and substr(cur_raw, 1, sep - 1) ~ '^[0-9]{1,15}$' and length(cur_raw) > sep then
        cur_ts := to_timestamp(substr(cur_raw, 1, sep - 1)::numeric / 1000.0);
        cur_pk := substr(cur_raw, sep + 1);
        if pk_type = 'uuid'
           and cur_pk !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          cur_ts := null;
          cur_pk := null;
        end if;
      end if;
      if cur_ts is null then cur_raw := null; end if;
    end if;

    execute format($q$
      with page as (
        select %1$s as j, t.updated_at as u, t.%2$I as k
        from public.%3$I t
        where t.%4$I = $1
          and ($2::timestamptz is null or (t.updated_at, t.%2$I) > ($2::timestamptz, $3::%5$s))
        order by t.updated_at, t.%2$I
        limit $4 + 1
      ), numbered as (
        select j, u, k, row_number() over (order by u, k) as rn from page
      )
      select coalesce(jsonb_agg(j order by rn) filter (where rn <= $4), '[]'::jsonb),
             count(*)::int,
             (array_agg(public.orbita_epoch_ms(u)::text || '|' || k::text order by rn desc)
                filter (where rn <= $4))[1]
      from numbered
    $q$, row_json, pk_col, ent, owner_col, pk_type)
    into rows_json, n, last_cursor
    using uid, cur_ts, cur_pk, lim;

    result := result || jsonb_build_object(ent, jsonb_build_object(
      'rows', rows_json,
      'cursor', coalesce(last_cursor, cur_raw),
      'has_more', n > lim));
  end loop;

  return result;
end $$;

-- ============================ delete_account ================================
-- SQL-11: one transaction removes the caller's data AND the auth.users row.
-- The client must NOT call auth.admin.deleteUser afterwards.
create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  delete from public.question_history where user_id = uid;
  delete from public.concept_progress where user_id = uid;
  delete from public.daily_summary where user_id = uid;
  delete from public.country_progress where user_id = uid;
  delete from public.sessions_log where user_id = uid;
  delete from public.challenge_attempts where user_id = uid;
  delete from public.unlocks where user_id = uid;
  delete from public.daily_streak where user_id = uid;
  delete from public.hardcore_exam_progress where user_id = uid;
  delete from public.user_roles where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end $$;

-- ============================ GRANTS ========================================
-- Start from nothing (Supabase's default privileges would otherwise open every
-- object to anon), then grant exactly what the app uses.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.user_roles to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.country_progress to authenticated;
grant select, insert, update on public.concept_progress to authenticated;
grant select, insert on public.question_history to authenticated;
grant select, insert, update on public.daily_summary to authenticated;
grant select, insert on public.sessions_log to authenticated;
grant select, insert on public.challenge_attempts to authenticated;
grant select, insert, update on public.unlocks to authenticated;
grant select, insert, update on public.daily_streak to authenticated;
grant select, insert, update, delete on public.hardcore_exam_progress to authenticated;
grant all on all tables in schema public to service_role;

grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(jsonb, int) to authenticated;
grant execute on function public.delete_account() to authenticated;
-- Helpers run inside the SECURITY INVOKER RPCs, so the caller needs them.
grant execute on function public.orbita_ms(jsonb, boolean) to authenticated;
grant execute on function public.orbita_int(jsonb, int) to authenticated;
grant execute on function public.orbita_num(jsonb) to authenticated;
grant execute on function public.orbita_epoch_ms(timestamptz) to authenticated;
grant execute on function public.orbita_concept_json(public.concept_progress) to authenticated;
grant execute on function public.orbita_country_json(public.country_progress) to authenticated;
-- Same as v1: has_role and handle_new_user are only for service_role.
grant execute on function public.has_role(uuid, public.app_role) to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.orbita_touch_updated_at() to service_role;
