-- =========================================================================
-- NL VIP CLUB - Migration 6: Remaining Schema Fixes
-- 20260412000006_remaining_fixes.sql
-- SAFE: Only additive. No data loss.
-- =========================================================================

-- =========================================================================
-- PART 1: PROFILES — missing columns used throughout the app
-- =========================================================================

-- UserProfile.jsx uses phone and birth_date
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date  DATE;

-- LifeStageModules.jsx uses life_stage, due_date, postpartum_date
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS life_stage      TEXT; -- 'active', 'pregnant', 'postpartum', 'lactating'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS due_date         DATE; -- expected birth date (pregnancy)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS postpartum_date  DATE; -- actual birth date (postpartum tracking)

-- diet-onboarding/submit/route.js stores allergies and medical_conditions
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allergies          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_conditions TEXT;

-- updated_at used in many profile updates
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =========================================================================
-- PART 2: DIET_TEMPLATES — missing level_tag column
-- DietBuilder.jsx inserts level_tag (beginner/intermediate/advanced)
-- =========================================================================

ALTER TABLE diet_templates ADD COLUMN IF NOT EXISTS level_tag TEXT;

-- =========================================================================
-- PART 3: WORKOUT_VIDEOS TABLE — missing columns
-- VideoUploader.jsx inserts: uploaded_by, video_path, duration_seconds
-- master-schema.sql only has: workout_template_id, video_url, title, description, order_index
-- =========================================================================

ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS uploaded_by      UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS video_path       TEXT; -- storage path (VideoUploader uses this)
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS is_approved      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE workout_videos ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

-- =========================================================================
-- PART 4: WORKOUT_VIDEOS storage bucket
-- VideoUploader.jsx uploads to 'workout_videos' bucket (not 'exercise_videos')
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('workout_videos', 'workout_videos', false, 524288000,
        ARRAY['video/mp4','video/quicktime','video/x-m4v','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "workout_videos_trainer_upload" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_auth_read"      ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_admin_delete"   ON storage.objects;

CREATE POLICY "workout_videos_trainer_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'workout_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);
CREATE POLICY "workout_videos_auth_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'workout_videos' AND auth.uid() IS NOT NULL
);
CREATE POLICY "workout_videos_admin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'workout_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
