-- S1: a device with a clock far in the future could pin concept_progress forever, since the
-- newest fsrs_last_review wins. Clamp the incoming value; everything else is the baseline function.
create or replace function public.sync_push(_mutations jsonb)
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
        v_cp.fsrs_last_review := least(public.orbita_ms(p->'fsrs_last_review'), now() + interval '5 minutes');
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
