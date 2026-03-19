-- =============================================
-- POLÍTICAS DE STORAGE PARA BUCKETS
-- Ejecutar DESPUÉS de crear los buckets
-- =============================================

-- ============================================
-- BUCKET: avatars (fotos de perfil)
-- ============================================

-- Usuarios pueden subir su propio avatar
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios pueden ver su propio avatar
CREATE POLICY "Users view own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios pueden actualizar su avatar
CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios pueden eliminar su avatar
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins pueden ver todos los avatares
CREATE POLICY "Admins view all avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- BUCKET: exercise_videos (videos de ejercicios)
-- ============================================

-- Admins y Trainers pueden subir videos
CREATE POLICY "Staff upload exercise_videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Todos los autenticados pueden ver videos
CREATE POLICY "Anyone view exercise_videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exercise_videos');

-- Admins y Trainers pueden actualizar videos
CREATE POLICY "Staff update exercise_videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Admins y Trainers pueden eliminar videos
CREATE POLICY "Staff delete exercise_videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- ============================================
-- BUCKET: progress-photos (fotos de progreso)
-- ============================================

-- Miembros pueden subir sus fotos
CREATE POLICY "Members upload progress photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Miembros pueden ver sus propias fotos
CREATE POLICY "Members view own progress photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Solo Admins pueden ver todas las fotos de progreso
CREATE POLICY "Admins view all progress photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Miembros pueden eliminar sus fotos
CREATE POLICY "Members delete own progress photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- BUCKET: feed-images (imágenes del feed)
-- ============================================

-- Usuarios pueden subir imágenes al feed
CREATE POLICY "Users upload feed images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'feed-images');

-- Todos pueden ver imágenes del feed
CREATE POLICY "Anyone view feed images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'feed-images');

-- Usuarios pueden eliminar sus imágenes
CREATE POLICY "Users delete own feed images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feed-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- BUCKET: training-videos (videos de entrenamiento)
-- ============================================

-- Staff puede subir videos
CREATE POLICY "Staff upload training videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'training-videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- Todos pueden ver videos de entrenamiento
CREATE POLICY "Anyone view training videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'training-videos');

-- Staff puede eliminar videos
CREATE POLICY "Staff delete training videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'training-videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);


-- =============================================
-- FIN DE POLÍTICAS DE STORAGE
-- =============================================
