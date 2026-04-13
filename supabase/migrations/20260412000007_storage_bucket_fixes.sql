-- =========================================================================
-- NL VIP CLUB - Migration 7: Storage Bucket Name Fixes
-- 20260412000007_storage_bucket_fixes.sql
-- SAFE: Only additive. No data loss.
-- =========================================================================

-- =========================================================================
-- PART 1: feed_images bucket (underscore)
-- master-schema.sql creates 'feed-images' (hyphen) but the code uses
-- 'feed_images' (underscore) in:
--   - FeedSection.jsx:55,78
--   - FeedTab.jsx:35
--   - MemberDashboard.jsx:333,415
-- Without this bucket, image uploads and signed URLs will fail silently.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feed_images', 'feed_images', true, 52428800,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic'])
ON CONFLICT (id) DO UPDATE SET
  public          = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "feed_images_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "feed_images_member_upload"  ON storage.objects;
DROP POLICY IF EXISTS "feed_images_owner_delete"   ON storage.objects;

CREATE POLICY "feed_images_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'feed_images');

CREATE POLICY "feed_images_member_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feed_images' AND auth.uid() IS NOT NULL AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND has_premium = true)
);

CREATE POLICY "feed_images_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'feed_images' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- =========================================================================
-- PART 2: exercise_videos bucket
-- Used in WorkoutBuilder.jsx for trainer video uploads.
-- Defined in master-schema.sql but re-created here as a safety net in case
-- the master schema was not fully applied.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exercise_videos', 'exercise_videos', true, 524288000,
        ARRAY['video/mp4','video/quicktime','video/x-m4v','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "exercise_videos_public_read"     ON storage.objects;
DROP POLICY IF EXISTS "exercise_videos_trainer_upload"  ON storage.objects;
DROP POLICY IF EXISTS "exercise_videos_admin_delete"    ON storage.objects;

CREATE POLICY "exercise_videos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'exercise_videos');

CREATE POLICY "exercise_videos_trainer_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

CREATE POLICY "exercise_videos_admin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
