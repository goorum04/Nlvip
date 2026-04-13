-- =========================================================================
-- Fix: rpc_update_daily_steps function overload ambiguity
-- 20260413000001_fix_steps_function_overload.sql
--
-- Problem: Two overloaded versions existed in the DB:
--   1. rpc_update_daily_steps(p_steps integer)           → VOID  (legacy)
--   2. rpc_update_daily_steps(p_steps integer, p_date date) → JSONB (correct)
-- PostgreSQL couldn't resolve the call when only p_steps was passed.
--
-- Fix: Drop the legacy single-parameter overload, then replace the correct
-- version adding p_source so HealthKit data is stored as 'device'.
-- =========================================================================

-- Drop the old VOID overload (no p_date, no p_source)
DROP FUNCTION IF EXISTS rpc_update_daily_steps(integer);

-- Drop old two-parameter overload without p_source (idempotent re-create below)
DROP FUNCTION IF EXISTS rpc_update_daily_steps(integer, date);

-- Correct version: returns JSONB, distinguishes manual vs HealthKit source
CREATE OR REPLACE FUNCTION rpc_update_daily_steps(
    p_steps  INT,
    p_date   DATE DEFAULT CURRENT_DATE,
    p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB AS $$
DECLARE
    v_member_id  UUID;
    v_distance   NUMERIC;
    v_calories   NUMERIC;
    v_complete   BOOLEAN;
    v_activity_id UUID;
    v_steps_goal INT;
BEGIN
    v_member_id := auth.uid();

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Validate source
    IF p_source NOT IN ('manual', 'device') THEN
        p_source := 'manual';
    END IF;

    -- Get steps goal from profile
    SELECT steps_goal INTO v_steps_goal FROM profiles WHERE id = v_member_id;
    v_steps_goal := COALESCE(v_steps_goal, 8000);

    -- Calculate distance and calories
    SELECT * INTO v_distance, v_calories, v_complete
    FROM calculate_activity_metrics(v_member_id, p_steps);

    -- Upsert daily activity
    INSERT INTO daily_activity (member_id, activity_date, steps, distance_km, calories_kcal, source, updated_at)
    VALUES (v_member_id, p_date, p_steps, v_distance, v_calories, p_source, NOW())
    ON CONFLICT (member_id, activity_date)
    DO UPDATE SET
        steps        = EXCLUDED.steps,
        distance_km  = EXCLUDED.distance_km,
        calories_kcal = EXCLUDED.calories_kcal,
        source       = EXCLUDED.source,
        updated_at   = NOW()
    RETURNING id INTO v_activity_id;

    RETURN jsonb_build_object(
        'success',            true,
        'activity_id',        v_activity_id,
        'steps',              p_steps,
        'distance_km',        v_distance,
        'calories_kcal',      v_calories,
        'steps_goal',         v_steps_goal,
        'progress_percent',   ROUND((p_steps::NUMERIC / v_steps_goal) * 100, 1),
        'has_complete_profile', v_complete
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
