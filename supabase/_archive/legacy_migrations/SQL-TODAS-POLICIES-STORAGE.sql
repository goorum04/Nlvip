-- =============================================
-- TODAS LAS POLÍTICAS DE STORAGE
-- Elimina las existentes y crea las nuevas
-- Ejecutar DESPUÉS del script de tablas
-- =============================================


-- ============================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS DE STORAGE
-- ============================================

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;


-- ============================================
-- PASO 2: CREAR POLÍTICAS DE STORAGE
-- ============================================

-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: avatars (Fotos de perfil)
-- ██ TODOS pueden ver las fotos de perfil
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Usuarios pueden subir su propia foto de perfil
CREATE POLICY "avatars_upload_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- TODOS los autenticados pueden ver TODAS las fotos de perfil
CREATE POLICY "avatars_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

-- Usuarios pueden actualizar su propia foto
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios pueden eliminar su propia foto
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: exercise_videos (Videos de ejercicios)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Staff (admin/trainer) puede subir videos
CREATE POLICY "exercise_videos_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exercise_videos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- TODOS los autenticados pueden ver videos de ejercicios
CREATE POLICY "exercise_videos_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exercise_videos');

-- Staff puede actualizar videos
CREATE POLICY "exercise_videos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'exercise_videos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Staff puede eliminar videos
CREATE POLICY "exercise_videos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exercise_videos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: progress-photos (Fotos de progreso)
-- ██ SOLO el dueño y admins pueden ver estas fotos
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Miembros pueden subir sus fotos de progreso
CREATE POLICY "progress_photos_upload_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'progress-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Miembros pueden ver SUS PROPIAS fotos
CREATE POLICY "progress_photos_view_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'progress-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- SOLO Admins pueden ver TODAS las fotos de progreso
CREATE POLICY "progress_photos_admin_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'progress-photos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Miembros pueden eliminar sus fotos
CREATE POLICY "progress_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'progress-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: feed-images (Imágenes del feed social)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos los autenticados pueden subir imágenes al feed
CREATE POLICY "feed_images_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feed-images');

-- TODOS los autenticados pueden ver imágenes del feed
CREATE POLICY "feed_images_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'feed-images');

-- Usuarios pueden eliminar sus propias imágenes
CREATE POLICY "feed_images_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'feed-images' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins pueden eliminar cualquier imagen del feed
CREATE POLICY "feed_images_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'feed-images' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: training-videos (Videos de entrenamiento general)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Staff puede subir videos
CREATE POLICY "training_videos_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'training-videos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- TODOS los autenticados pueden ver videos de entrenamiento
CREATE POLICY "training_videos_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'training-videos');

-- Staff puede actualizar videos
CREATE POLICY "training_videos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'training-videos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Staff puede eliminar videos
CREATE POLICY "training_videos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'training-videos' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: recipes (Imágenes de recetas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Staff puede subir imágenes de recetas
CREATE POLICY "recipes_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recipes' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- TODOS los autenticados pueden ver imágenes de recetas
CREATE POLICY "recipes_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'recipes');

-- Staff puede actualizar imágenes
CREATE POLICY "recipes_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'recipes' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Staff puede eliminar imágenes
CREATE POLICY "recipes_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'recipes' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BUCKET: food-logs (Imágenes de comidas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Usuarios pueden subir fotos de sus comidas
CREATE POLICY "food_logs_upload_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-logs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios pueden ver sus propias fotos de comidas
CREATE POLICY "food_logs_view_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'food-logs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Staff puede ver todas las fotos de comidas
CREATE POLICY "food_logs_staff_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'food-logs' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Usuarios pueden eliminar sus fotos de comidas
CREATE POLICY "food_logs_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'food-logs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);


-- =============================================
-- FIN DE POLÍTICAS DE STORAGE
-- =============================================
