-- =========================================================================
-- NL VIP CLUB - Migration: Missing calculate_activity_metrics + progress_photos bucket
-- 20260413000002_missing_function_and_bucket.sql
--
-- SAFE: Only additive operations.
--   - CREATE OR REPLACE FUNCTION  → never fails if function exists
--   - INSERT ... ON CONFLICT DO NOTHING  → never touches existing data
--   - DROP POLICY IF EXISTS + CREATE POLICY  → idempotent
-- =========================================================================

-- =========================================================================
-- PART 1: calculate_activity_metrics()
--
-- Required by rpc_update_daily_steps() (migration 20260413000001).
-- Calculates distance and calories from step count using profile data
-- (height, weight, sex). Returns safe defaults if profile is incomplete.
-- =========================================================================

CREATE OR REPLACE FUNCTION calculate_activity_metrics(
    p_member_id UUID,
    p_steps     INT
)
RETURNS TABLE (
    distance_km          NUMERIC,
    calories_kcal        NUMERIC,
    has_complete_profile BOOLEAN
) AS $$
DECLARE
    v_height_cm INT;
    v_weight_kg NUMERIC;
    v_sex       TEXT;
    v_stride_m  NUMERIC;
    v_distance  NUMERIC;
    v_calories  NUMERIC;
    v_complete  BOOLEAN;
BEGIN
    -- Get profile data needed for calculations
    SELECT height_cm, weight_kg, sex
    INTO v_height_cm, v_weight_kg, v_sex
    FROM profiles WHERE id = p_member_id;

    -- Need both height and weight; return zeros if incomplete
    v_complete := (v_height_cm IS NOT NULL AND v_weight_kg IS NOT NULL);

    IF NOT v_complete THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, false;
        RETURN;
    END IF;

    -- Stride length varies slightly by sex
    v_stride_m := CASE
        WHEN v_sex = 'male'   THEN v_height_cm * 0.415 / 100
        WHEN v_sex = 'female' THEN v_height_cm * 0.413 / 100
        ELSE                       v_height_cm * 0.414 / 100
    END;

    -- Distance in km
    v_distance := p_steps * v_stride_m / 1000;

    -- Calories: MET-based estimate (weight × distance × factor)
    v_calories := v_weight_kg * v_distance * 1.036;

    RETURN QUERY SELECT
        ROUND(v_distance, 3),
        ROUND(v_calories, 1),
        true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- PART 2: progress_photos storage bucket
--
-- The code uses bucket id 'progress_photos' (underscore):
--   - components/ProgressPhotos.jsx:75
--   - components/DietOnboardingForm.jsx:184
-- master-schema.sql only created 'progress-photos' (hyphen).
-- ON CONFLICT DO NOTHING = safe to run multiple times.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progress_photos',
    'progress_photos',
    false,
    52428800,  -- 50 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;


-- Storage policies for progress_photos (underscore bucket)
-- DROP IF EXISTS first → safe to re-run

DROP POLICY IF EXISTS "progress_photos_member_read"    ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_trainer_read"   ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_member_upload"  ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_member_delete"  ON storage.objects;

-- Members and their trainers/admins can read
CREATE POLICY "progress_photos_member_read" ON storage.objects FOR SELECT
USING (
    bucket_id = 'progress_photos' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM trainer_members
            WHERE trainer_id = auth.uid()
              AND member_id::text = (storage.foldername(name))[1]
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
);

-- Only premium members can upload (folder must match their own uid)
CREATE POLICY "progress_photos_member_upload" ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'progress_photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND has_premium = true
    )
);

-- Members can only delete their own photos
CREATE POLICY "progress_photos_member_delete" ON storage.objects FOR DELETE
USING (
    bucket_id = 'progress_photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
