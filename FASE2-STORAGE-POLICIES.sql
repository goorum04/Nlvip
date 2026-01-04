-- ================================================
-- NL VIP CLUB - FASE 2: STORAGE BUCKETS & POLICIES
-- ================================================
-- IMPORTANTE: Los buckets se crean desde el Dashboard de Supabase
-- pero las políticas SÍ se pueden crear desde SQL
-- 
-- PASOS:
-- 1. Ve a Storage en el Dashboard de Supabase
-- 2. Crea los 3 buckets manualmente:
--    - workout_videos (privado)
--    - feed_images (privado)
--    - progress_photos (privado)
-- 3. Luego ejecuta este SQL para las políticas
-- ================================================

-- ================================================
-- CREAR BUCKETS (esto también se puede hacer por SQL)
-- ================================================

-- Bucket para vídeos de rutinas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workout_videos', 
  'workout_videos', 
  false,
  52428800, -- 50MB máximo
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

-- Bucket para imágenes del feed
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed_images', 
  'feed_images', 
  false,
  5242880, -- 5MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Bucket para fotos de progreso
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress_photos', 
  'progress_photos', 
  false,
  10485760, -- 10MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];


-- ================================================
-- POLÍTICAS STORAGE: workout_videos
-- ================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "workout_videos_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_insert_trainer" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_select_trainer" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_select_member" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "workout_videos_delete_trainer" ON storage.objects;

-- Admin puede insertar cualquier video
CREATE POLICY "workout_videos_insert_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workout_videos'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainer puede insertar videos (path: workouts/{workout_template_id}/...)
CREATE POLICY "workout_videos_insert_trainer"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workout_videos'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  AND EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.trainer_id = auth.uid()
    AND (storage.foldername(name))[1] = 'workouts'
    AND (storage.foldername(name))[2] = wt.id::text
  )
);

-- Admin puede ver todos los videos
CREATE POLICY "workout_videos_select_admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'workout_videos'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainer puede ver videos de sus rutinas
CREATE POLICY "workout_videos_select_trainer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'workout_videos'
  AND EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.trainer_id = auth.uid()
    AND (storage.foldername(name))[1] = 'workouts'
    AND (storage.foldername(name))[2] = wt.id::text
  )
);

-- Member puede ver videos de rutinas que tiene asignadas
CREATE POLICY "workout_videos_select_member"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'workout_videos'
  AND EXISTS (
    SELECT 1 FROM member_workouts mw
    JOIN workout_templates wt ON wt.id = mw.workout_template_id
    WHERE mw.member_id = auth.uid()
    AND (storage.foldername(name))[1] = 'workouts'
    AND (storage.foldername(name))[2] = wt.id::text
  )
);

-- Admin puede eliminar cualquier video
CREATE POLICY "workout_videos_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workout_videos'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainer puede eliminar videos de sus rutinas
CREATE POLICY "workout_videos_delete_trainer"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workout_videos'
  AND EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.trainer_id = auth.uid()
    AND (storage.foldername(name))[1] = 'workouts'
    AND (storage.foldername(name))[2] = wt.id::text
  )
);


-- ================================================
-- POLÍTICAS STORAGE: feed_images
-- ================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "feed_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "feed_images_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "feed_images_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "feed_images_delete_admin" ON storage.objects;

-- Cualquier usuario autenticado puede subir (path: feed/{user_id}/...)
CREATE POLICY "feed_images_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feed_images'
  AND (storage.foldername(name))[1] = 'feed'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Cualquier usuario autenticado puede ver todas las imágenes del feed
CREATE POLICY "feed_images_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'feed_images');

-- Usuario puede eliminar sus propias imágenes
CREATE POLICY "feed_images_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feed_images'
  AND (storage.foldername(name))[1] = 'feed'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Admin puede eliminar cualquier imagen
CREATE POLICY "feed_images_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feed_images'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ================================================
-- POLÍTICAS STORAGE: progress_photos
-- ================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "progress_photos_insert_member" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_select_member" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_select_trainer" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_delete_member" ON storage.objects;

-- Member puede subir sus propias fotos (path: progress/{member_id}/...)
CREATE POLICY "progress_photos_insert_member"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'progress_photos'
  AND (storage.foldername(name))[1] = 'progress'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'member')
);

-- Member puede ver sus propias fotos
CREATE POLICY "progress_photos_select_member"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress_photos'
  AND (storage.foldername(name))[1] = 'progress'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Trainer puede ver fotos de sus socios asignados
CREATE POLICY "progress_photos_select_trainer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress_photos'
  AND EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.trainer_id = auth.uid()
    AND (storage.foldername(name))[1] = 'progress'
    AND (storage.foldername(name))[2] = tm.member_id::text
  )
);

-- Admin puede ver todas las fotos
CREATE POLICY "progress_photos_select_admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress_photos'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Admin puede eliminar cualquier foto
CREATE POLICY "progress_photos_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'progress_photos'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Member puede eliminar sus propias fotos
CREATE POLICY "progress_photos_delete_member"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'progress_photos'
  AND (storage.foldername(name))[1] = 'progress'
  AND (storage.foldername(name))[2] = auth.uid()::text
);


-- ================================================
-- FIN DE POLÍTICAS DE STORAGE
-- ================================================

COMMIT;
