-- =========================================================================
-- NL VIP CLUB - Migration 2: Missing RPC Functions
-- 20260412000002_missing_functions.sql
-- SAFE: CREATE OR REPLACE only. No data loss.
-- =========================================================================

-- =========================================================================
-- PART 1: FOOD TRACKER RPCs
-- (from FOOD-TRACKER.sql — missing from current migrations)
-- =========================================================================

CREATE OR REPLACE FUNCTION rpc_get_daily_macros_summary(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_assigned  jsonb;
  v_consumed  jsonb;
BEGIN
  v_member_id := (SELECT auth.uid());

  SELECT jsonb_build_object(
    'calories',  COALESCE(dt.calories, 0),
    'protein_g', COALESCE(dt.protein_g, 0),
    'carbs_g',   COALESCE(dt.carbs_g, 0),
    'fat_g',     COALESCE(dt.fat_g, 0)
  ) INTO v_assigned
  FROM member_diets md
  JOIN diet_templates dt ON dt.id = md.diet_template_id
  WHERE md.member_id = v_member_id;

  IF v_assigned IS NULL THEN
    v_assigned := jsonb_build_object('calories', 2000, 'protein_g', 150, 'carbs_g', 200, 'fat_g', 65);
  END IF;

  SELECT jsonb_build_object(
    'calories',  COALESCE(SUM(calories), 0),
    'protein_g', COALESCE(SUM(protein_g), 0),
    'carbs_g',   COALESCE(SUM(carbs_g), 0),
    'fat_g',     COALESCE(SUM(fat_g), 0)
  ) INTO v_consumed
  FROM food_logs
  WHERE member_id = v_member_id AND log_date = p_date;

  RETURN jsonb_build_object(
    'assigned', v_assigned,
    'consumed', v_consumed,
    'remaining', jsonb_build_object(
      'calories',  (v_assigned->>'calories')::int  - (v_consumed->>'calories')::int,
      'protein_g', (v_assigned->>'protein_g')::numeric - (v_consumed->>'protein_g')::numeric,
      'carbs_g',   (v_assigned->>'carbs_g')::numeric   - (v_consumed->>'carbs_g')::numeric,
      'fat_g',     (v_assigned->>'fat_g')::numeric     - (v_consumed->>'fat_g')::numeric
    ),
    'date', p_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION rpc_get_daily_food_logs(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          id,
        'food_name',   food_name,
        'description', description,
        'photo_url',   photo_url,
        'calories',    calories,
        'protein_g',   protein_g,
        'carbs_g',     carbs_g,
        'fat_g',       fat_g,
        'meal_type',   meal_type,
        'logged_at',   logged_at
      ) ORDER BY logged_at DESC
    ), '[]'::jsonb)
    FROM food_logs
    WHERE member_id = (SELECT auth.uid()) AND log_date = p_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION rpc_log_food(
  p_food_name   TEXT,
  p_calories    INT,
  p_protein_g   NUMERIC,
  p_carbs_g     NUMERIC,
  p_fat_g       NUMERIC,
  p_meal_type   TEXT    DEFAULT 'other',
  p_photo_url   TEXT    DEFAULT NULL,
  p_description TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO food_logs (member_id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, photo_url, description)
  VALUES ((SELECT auth.uid()), p_food_name, p_calories, p_protein_g, p_carbs_g, p_fat_g, p_meal_type, p_photo_url, p_description)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_delete_food_log(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM food_logs WHERE id = p_id AND member_id = (SELECT auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================================================
-- PART 2: ACTIVITY TRACKER RPCs
-- (rpc_get_activity_history and rpc_get_member_activity — not defined anywhere)
-- =========================================================================

CREATE OR REPLACE FUNCTION rpc_get_activity_history(p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id  uuid;
  v_steps_goal int;
BEGIN
  v_member_id  := (SELECT auth.uid());
  SELECT COALESCE(steps_goal, 8000) INTO v_steps_goal FROM profiles WHERE id = v_member_id;

  RETURN jsonb_build_object(
    'history', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date',           activity_date,
          'steps',          steps,
          'distance_km',    COALESCE(distance_km, 0),
          'calories_kcal',  COALESCE(calories_kcal, 0),
          'goal_reached',   steps >= v_steps_goal
        ) ORDER BY activity_date DESC
      )
      FROM daily_activity
      WHERE member_id = v_member_id
        AND activity_date >= CURRENT_DATE - (p_days - 1)
    ), '[]'::jsonb),
    'steps_goal', v_steps_goal
  );
END;
$$;

CREATE OR REPLACE FUNCTION rpc_get_member_activity(p_member_id UUID, p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_steps_goal int;
BEGIN
  -- Only staff (trainer assigned to member or admin) can call this
  IF NOT (
    is_admin() OR
    EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = p_member_id)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(steps_goal, 8000) INTO v_steps_goal FROM profiles WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'history', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date',          activity_date,
          'steps',         steps,
          'distance_km',   COALESCE(distance_km, 0),
          'calories_kcal', COALESCE(calories_kcal, 0),
          'goal_reached',  steps >= v_steps_goal
        ) ORDER BY activity_date DESC
      )
      FROM daily_activity
      WHERE member_id = p_member_id
        AND activity_date >= CURRENT_DATE - (p_days - 1)
    ), '[]'::jsonb),
    'steps_goal', v_steps_goal
  );
END;
$$;

-- =========================================================================
-- PART 3: ADMIN ASSISTANT RPCs
-- (from FASE5-ADMIN-ASSISTANT.sql — missing from current migrations)
-- =========================================================================

CREATE OR REPLACE FUNCTION rpc_find_member(p_search TEXT)
RETURNS TABLE (id UUID, name TEXT, email TEXT, trainer_name TEXT, has_diet BOOLEAN, has_workout BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  RETURN QUERY
  SELECT
    p.id, p.name, p.email,
    t.name AS trainer_name,
    EXISTS(SELECT 1 FROM member_diets   md WHERE md.member_id = p.id) AS has_diet,
    EXISTS(SELECT 1 FROM member_workouts mw WHERE mw.member_id = p.id) AS has_workout
  FROM profiles p
  LEFT JOIN trainer_members tm ON tm.member_id = p.id
  LEFT JOIN profiles t ON t.id = tm.trainer_id
  WHERE p.role = 'member'
    AND (p.name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
  LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_get_member_summary(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT jsonb_build_object(
    'member',   jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'created_at', p.created_at),
    'trainer',  CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('id', t.id, 'name', t.name) ELSE NULL END,
    'diet',     CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('name', d.name, 'calories', d.calories, 'protein_g', d.protein_g, 'carbs_g', d.carbs_g, 'fat_g', d.fat_g) ELSE NULL END,
    'workout',  CASE WHEN w.id IS NOT NULL THEN jsonb_build_object('name', w.name) ELSE NULL END,
    'latest_weight',    (SELECT pr.weight_kg  FROM progress_records pr WHERE pr.member_id = p.id AND pr.weight_kg IS NOT NULL ORDER BY pr.date DESC LIMIT 1),
    'total_checkins',   (SELECT COUNT(*)       FROM workout_checkins  wc WHERE wc.member_id = p.id),
    'active_challenges',(SELECT COUNT(*) FROM challenge_participants cp JOIN challenges c ON c.id = cp.challenge_id WHERE cp.member_id = p.id AND c.is_active = true)
  ) INTO result
  FROM profiles p
  LEFT JOIN trainer_members tm ON tm.member_id = p.id
  LEFT JOIN profiles t ON t.id = tm.trainer_id
  LEFT JOIN member_diets md ON md.member_id = p.id
  LEFT JOIN diet_templates d ON d.id = md.diet_template_id
  LEFT JOIN member_workouts mw ON mw.member_id = p.id
  LEFT JOIN workout_templates w ON w.id = mw.workout_template_id
  WHERE p.id = p_member_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_assign_diet_to_member(p_member_id UUID, p_diet_template_id UUID, p_assigned_by UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_diet_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT name INTO v_diet_name FROM diet_templates WHERE id = p_diet_template_id;
  IF v_diet_name IS NULL THEN RAISE EXCEPTION 'Dieta no encontrada'; END IF;
  INSERT INTO member_diets (member_id, diet_template_id, assigned_by, assigned_at)
  VALUES (p_member_id, p_diet_template_id, COALESCE(p_assigned_by, auth.uid()), NOW())
  ON CONFLICT (member_id) DO UPDATE SET diet_template_id = EXCLUDED.diet_template_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW();
  RETURN jsonb_build_object('success', true, 'diet_name', v_diet_name);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_assign_workout_to_member(p_member_id UUID, p_workout_template_id UUID, p_assigned_by UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_workout_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT name INTO v_workout_name FROM workout_templates WHERE id = p_workout_template_id;
  IF v_workout_name IS NULL THEN RAISE EXCEPTION 'Rutina no encontrada'; END IF;
  INSERT INTO member_workouts (member_id, workout_template_id, assigned_by, assigned_at)
  VALUES (p_member_id, p_workout_template_id, COALESCE(p_assigned_by, auth.uid()), NOW())
  ON CONFLICT (member_id) DO UPDATE SET workout_template_id = EXCLUDED.workout_template_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW();
  RETURN jsonb_build_object('success', true, 'workout_name', v_workout_name);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_assign_trainer_to_member(p_member_id UUID, p_trainer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_trainer_name TEXT; v_member_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT name INTO v_trainer_name FROM profiles WHERE id = p_trainer_id AND role = 'trainer';
  IF v_trainer_name IS NULL THEN RAISE EXCEPTION 'Entrenador no encontrado'; END IF;
  SELECT name INTO v_member_name FROM profiles WHERE id = p_member_id AND role = 'member';
  IF v_member_name IS NULL THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;
  INSERT INTO trainer_members (trainer_id, member_id) VALUES (p_trainer_id, p_member_id)
  ON CONFLICT (trainer_id, member_id) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'trainer_name', v_trainer_name, 'member_name', v_member_name);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_create_invitation_code(p_trainer_id UUID, p_max_uses INT DEFAULT 10, p_expire_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_code TEXT; v_trainer_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT name INTO v_trainer_name FROM profiles WHERE id = p_trainer_id AND role = 'trainer';
  IF v_trainer_name IS NULL THEN RAISE EXCEPTION 'Entrenador no encontrado'; END IF;
  v_code := 'NLVIP-' || upper(substr(md5(random()::text), 1, 8));
  INSERT INTO invitation_codes (code, trainer_id, max_uses, expires_at, is_active)
  VALUES (v_code, p_trainer_id, p_max_uses, NOW() + (p_expire_days || ' days')::interval, true);
  RETURN jsonb_build_object('success', true, 'code', v_code, 'trainer_name', v_trainer_name, 'max_uses', p_max_uses, 'expires_in_days', p_expire_days);
END;
$$;

-- The real column in trainer_notices is "message"; superseded by
-- 20260502000001_fix_rpc_create_notice.sql which fixes the body.
CREATE OR REPLACE FUNCTION rpc_create_notice(p_title TEXT, p_message TEXT, p_priority TEXT DEFAULT 'normal', p_member_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_notice_id UUID;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  INSERT INTO trainer_notices (trainer_id, member_id, title, message, priority)
  VALUES (auth.uid(), p_member_id, p_title, p_message, p_priority)
  RETURNING id INTO v_notice_id;
  RETURN jsonb_build_object('success', true, 'notice_id', v_notice_id, 'is_global', p_member_id IS NULL, 'title', p_title);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_hide_post(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_author_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  UPDATE feed_posts SET is_hidden = true WHERE id = p_post_id;
  SELECT name INTO v_author_name FROM profiles WHERE id = (SELECT author_id FROM feed_posts WHERE id = p_post_id);
  IF v_author_name IS NULL THEN RAISE EXCEPTION 'Post no encontrado'; END IF;
  RETURN jsonb_build_object('success', true, 'post_id', p_post_id, 'author', v_author_name);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_unhide_post(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  UPDATE feed_posts SET is_hidden = false WHERE id = p_post_id;
  RETURN jsonb_build_object('success', true, 'post_id', p_post_id);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_get_gym_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT jsonb_build_object(
    'total_members',          (SELECT COUNT(*) FROM profiles WHERE role = 'member'),
    'total_trainers',         (SELECT COUNT(*) FROM profiles WHERE role = 'trainer'),
    'new_members_this_month', (SELECT COUNT(*) FROM profiles WHERE role = 'member' AND created_at >= date_trunc('month', CURRENT_DATE)),
    'active_challenges',      (SELECT COUNT(*) FROM challenges WHERE is_active = true),
    'total_checkins_this_week',(SELECT COUNT(*) FROM workout_checkins WHERE checked_in_at >= date_trunc('week', CURRENT_DATE)),
    'posts_today',            (SELECT COUNT(*) FROM feed_posts WHERE created_at >= CURRENT_DATE AND is_hidden = false),
    'reported_posts',         (SELECT COUNT(DISTINCT post_id) FROM feed_reports)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_list_trainers()
RETURNS TABLE (id UUID, name TEXT, email TEXT, member_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  RETURN QUERY
  SELECT p.id, p.name, p.email, COUNT(tm.member_id)::bigint AS member_count
  FROM profiles p
  LEFT JOIN trainer_members tm ON tm.trainer_id = p.id
  WHERE p.role = 'trainer'
  GROUP BY p.id ORDER BY p.name;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_list_diets()
RETURNS TABLE (id UUID, name TEXT, calories INT, goal_tag TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  RETURN QUERY SELECT dt.id, dt.name, dt.calories, dt.goal_tag FROM diet_templates dt ORDER BY dt.name;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_list_workouts()
RETURNS TABLE (id UUID, name TEXT, goal_tag TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  RETURN QUERY SELECT wt.id, wt.name, wt.goal_tag FROM workout_templates wt ORDER BY wt.name;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_apply_full_member_plan(
  p_member_id          UUID,
  p_goal               TEXT    DEFAULT 'fat_loss',
  p_diet_template_id   UUID    DEFAULT NULL,
  p_workout_template_id UUID   DEFAULT NULL,
  p_weight_kg          NUMERIC DEFAULT NULL,
  p_notes              TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_diet_id    UUID; v_workout_id UUID;
  v_diet_name  TEXT; v_workout_name TEXT; v_member_name TEXT;
  v_weight     NUMERIC;
  v_calories   INT; v_protein INT; v_carbs INT; v_fat INT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT name INTO v_member_name FROM profiles WHERE id = p_member_id AND role = 'member';
  IF v_member_name IS NULL THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  v_weight := COALESCE(p_weight_kg, (SELECT weight_kg FROM progress_records WHERE member_id = p_member_id AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1), 70);

  IF    p_goal = 'fat_loss'    THEN v_calories := (v_weight * 24 * 0.85)::INT;
  ELSIF p_goal = 'muscle_gain' THEN v_calories := (v_weight * 24 * 1.15)::INT;
  ELSE                               v_calories := (v_weight * 24)::INT;
  END IF;
  v_protein := (v_weight * 2)::INT;
  v_fat     := (v_weight * 0.8)::INT;
  v_carbs   := ((v_calories - (v_protein * 4) - (v_fat * 9)) / 4)::INT;

  v_diet_id    := COALESCE(p_diet_template_id,    (SELECT id FROM diet_templates    WHERE goal_tag = p_goal ORDER BY created_at DESC LIMIT 1));
  v_workout_id := COALESCE(p_workout_template_id, (SELECT id FROM workout_templates WHERE goal_tag = p_goal ORDER BY created_at DESC LIMIT 1));

  IF v_diet_id IS NOT NULL THEN
    SELECT name INTO v_diet_name FROM diet_templates WHERE id = v_diet_id;
    INSERT INTO member_diets (member_id, diet_template_id, assigned_by)
    VALUES (p_member_id, v_diet_id, auth.uid())
    ON CONFLICT (member_id) DO UPDATE SET diet_template_id = EXCLUDED.diet_template_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW();
  END IF;

  IF v_workout_id IS NOT NULL THEN
    SELECT name INTO v_workout_name FROM workout_templates WHERE id = v_workout_id;
    INSERT INTO member_workouts (member_id, workout_template_id, assigned_by)
    VALUES (p_member_id, v_workout_id, auth.uid())
    ON CONFLICT (member_id) DO UPDATE SET workout_template_id = EXCLUDED.workout_template_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW();
  END IF;

  -- Audit log
  INSERT INTO admin_assistant_action_logs (admin_id, action_type, action_params, target_entities, result, success)
  VALUES (auth.uid(), 'apply_full_member_plan',
    jsonb_build_object('goal', p_goal, 'weight_kg', v_weight, 'notes', p_notes),
    jsonb_build_object('member_id', p_member_id),
    jsonb_build_object('diet_id', v_diet_id, 'workout_id', v_workout_id, 'calories', v_calories),
    true);

  RETURN jsonb_build_object(
    'success', true, 'member_name', v_member_name, 'goal', p_goal,
    'macros', jsonb_build_object('calories', v_calories, 'protein_g', v_protein, 'carbs_g', v_carbs, 'fat_g', v_fat),
    'diet', v_diet_name, 'workout', v_workout_name, 'weight_used', v_weight
  );
END;
$$;

-- =========================================================================
-- PART 4: DIET ONBOARDING RPC
-- (complete_diet_onboarding — not defined anywhere)
-- =========================================================================

CREATE OR REPLACE FUNCTION complete_diet_onboarding(
  p_member_id  UUID,
  p_request_id UUID,
  p_diet_name  TEXT,
  p_calories   INT,
  p_protein_g  INT,
  p_carbs_g    INT,
  p_fat_g      INT,
  p_content    TEXT,
  p_admin_id   UUID,
  p_responses  JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template_id UUID;
  v_assigner    UUID;
BEGIN
  v_assigner := COALESCE(p_admin_id, auth.uid());

  -- 1. Create diet template
  INSERT INTO diet_templates (trainer_id, name, content, calories, protein_g, carbs_g, fat_g)
  VALUES (v_assigner, p_diet_name, p_content, p_calories, p_protein_g, p_carbs_g, p_fat_g)
  RETURNING id INTO v_template_id;

  -- 2. Assign diet to member
  INSERT INTO member_diets (member_id, diet_template_id, assigned_by, assigned_at)
  VALUES (p_member_id, v_template_id, v_assigner, NOW())
  ON CONFLICT (member_id) DO UPDATE SET
    diet_template_id = EXCLUDED.diet_template_id,
    assigned_by      = EXCLUDED.assigned_by,
    assigned_at      = NOW();

  -- 3. Mark request as completed
  UPDATE diet_onboarding_requests
  SET status = 'completed', generated_diet_id = v_template_id, completed_at = NOW()
  WHERE id = p_request_id;

  RETURN v_template_id;
END;
$$;

-- =========================================================================
-- PART 5: CHAT CONVERSATION RPC
-- (start_conversation — not defined anywhere)
-- =========================================================================

CREATE OR REPLACE FUNCTION start_conversation(p_type TEXT, p_participant_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conv_id UUID;
  v_uid     UUID;
BEGIN
  -- Create conversation
  INSERT INTO conversations (type, created_by) VALUES (p_type, auth.uid())
  RETURNING id INTO v_conv_id;

  -- Add all participants
  FOREACH v_uid IN ARRAY p_participant_ids LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_uid)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_conv_id;
END;
$$;
