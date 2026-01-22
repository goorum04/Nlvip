-- =============================================
-- POLÍTICAS DE STORAGE - ELIMINAR Y RECREAR
-- Ejecutar DESPUÉS del script de tablas
-- =============================================

-- ============================================
-- PASO 1: ELIMINAR POLÍTICAS EXISTENTES DE STORAGE
-- ============================================

-- Avatars
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users view own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Admins view all avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar" ON storage.objects;

-- Exercise Videos
DROP POLICY IF EXISTS "Staff upload exercise_videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone view exercise_videos" ON storage.objects;
DROP POLICY IF EXISTS "Staff update exercise_videos" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete exercise_videos" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can upload exercise videos" ON storage.objects;

-- Progress Photos
DROP POLICY IF EXISTS "Members upload progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Members view own progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins view all progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Members delete own progress photos" ON storage.objects;

-- Feed Images
DROP POLICY IF EXISTS "Users upload feed images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone view feed images" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own feed images" ON storage.objects;

-- Training Videos
DROP POLICY IF EXISTS "Staff upload training videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone view training videos" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete training videos" ON storage.objects;

-- ============================================
-- PASO 2: CREAR NUEVAS POLÍTICAS DE STORAGE
-- ============================================

-- ==================== AVATARS ====================

CREATE POLICY "avatars_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ==================== EXERCISE_VIDEOS ====================

CREATE POLICY "exercise_videos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise_videos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

CREATE POLICY "exercise_videos_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exercise_videos');

CREATE POLICY "exercise_videos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exercise_videos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

CREATE POLICY "exercise_videos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exercise_videos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- ==================== PROGRESS-PHOTOS ====================

CREATE POLICY "progress_photos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "progress_photos_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "progress_photos_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'progress-photos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "progress_photos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==================== FEED-IMAGES ====================

CREATE POLICY "feed_images_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feed-images');

CREATE POLICY "feed_images_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'feed-images');

CREATE POLICY "feed_images_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'feed-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==================== TRAINING-VIDEOS ====================

CREATE POLICY "training_videos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'training-videos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

CREATE POLICY "training_videos_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'training-videos');

CREATE POLICY "training_videos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'training-videos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- =============================================
-- FIN DEL SCRIPT DE POLÍTICAS DE STORAGE
-- =============================================
