-- =========================================================================
-- Port activity tracker tables + functions into active migrations
-- 20260513000001_port_activity_tracker.sql
--
-- Background: rpc_get_today_activity, calculate_activity_metrics and the
-- daily_activity table were only defined in legacy_migrations/CUENTA-PASOS.sql
-- (already applied in production) but missing from the canonical
-- supabase/migrations/ tree. A fresh DB created from migrations alone would
-- fail when the app calls these. This migration is fully idempotent.
-- =========================================================================

-- -----------------------------------------------------------------------
-- 1. Profile columns required by the activity tracker
-- -----------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm  INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg  NUMERIC(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS steps_goal INT DEFAULT 8000;

-- -----------------------------------------------------------------------
-- 2. daily_activity table (RLS policies already declared in
--    20260411192000_perf_optimizations.sql)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_activity (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date date        NOT NULL DEFAULT CURRENT_DATE,
  steps         int         DEFAULT 0,
  distance_km   numeric(8,3) DEFAULT 0,
  calories_kcal numeric(8,1) DEFAULT 0,
  source        text        DEFAULT 'manual' CHECK (source IN ('manual', 'device')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT daily_activity_member_date_unique UNIQUE (member_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_member      ON daily_activity(member_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date        ON daily_activity(activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_activity_member_date ON daily_activity(member_id, activity_date DESC);

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 3. calculate_activity_metrics
--    Used by rpc_update_daily_steps (20260413000001).
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_activity_metrics(
  p_member_id UUID,
  p_steps     INT
)
RETURNS TABLE (
  distance_km          NUMERIC,
  calories_kcal        NUMERIC,
  has_complete_profile BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_height_cm INT;
  v_weight_kg NUMERIC;
  v_sex       TEXT;
  v_stride_m  NUMERIC;
  v_distance  NUMERIC;
  v_calories  NUMERIC;
  v_complete  BOOLEAN;
BEGIN
  SELECT height_cm, weight_kg, sex
    INTO v_height_cm, v_weight_kg, v_sex
    FROM profiles WHERE id = p_member_id;

  v_complete := (v_height_cm IS NOT NULL AND v_weight_kg IS NOT NULL);

  IF NOT v_complete THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, false;
    RETURN;
  END IF;

  v_stride_m := CASE
    WHEN v_sex = 'male'   THEN v_height_cm * 0.415 / 100
    WHEN v_sex = 'female' THEN v_height_cm * 0.413 / 100
    ELSE                       v_height_cm * 0.414 / 100
  END;

  v_distance := p_steps * v_stride_m / 1000;
  v_calories := v_weight_kg * v_distance * 1.036;

  RETURN QUERY SELECT
    ROUND(v_distance, 3),
    ROUND(v_calories, 1),
    true;
END;
$$;

-- -----------------------------------------------------------------------
-- 4. rpc_get_today_activity
--    Called from components/ActivityTracker.jsx
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_get_today_activity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id   UUID;
  v_result      JSONB;
  v_steps_goal  INT;
  v_has_profile BOOLEAN;
BEGIN
  v_member_id := auth.uid();

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT
      (height_cm IS NOT NULL AND weight_kg IS NOT NULL),
      COALESCE(steps_goal, 8000)
    INTO v_has_profile, v_steps_goal
    FROM profiles WHERE id = v_member_id;

  SELECT jsonb_build_object(
      'activity_date',       COALESCE(da.activity_date, CURRENT_DATE),
      'steps',               COALESCE(da.steps, 0),
      'distance_km',         COALESCE(da.distance_km, 0),
      'calories_kcal',       COALESCE(da.calories_kcal, 0),
      'source',              COALESCE(da.source, 'manual'),
      'steps_goal',          v_steps_goal,
      'progress_percent',    ROUND((COALESCE(da.steps, 0)::NUMERIC / NULLIF(v_steps_goal, 0)) * 100, 1),
      'has_complete_profile', v_has_profile
    ) INTO v_result
    FROM daily_activity da
   WHERE da.member_id = v_member_id
     AND da.activity_date = CURRENT_DATE;

  IF v_result IS NULL THEN
    v_result := jsonb_build_object(
      'activity_date',       CURRENT_DATE,
      'steps',               0,
      'distance_km',         0,
      'calories_kcal',       0,
      'source',              'manual',
      'steps_goal',          v_steps_goal,
      'progress_percent',    0,
      'has_complete_profile', COALESCE(v_has_profile, false)
    );
  END IF;

  RETURN v_result;
END;
$$;
