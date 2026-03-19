-- =============================================
-- EJECUTAR ESTE SQL EN SUPABASE SQL EDITOR
-- PARA ARREGLAR ERROR 42P17 AL SUBIR AVATAR
-- =============================================

-- 1. Primero verificar si el bucket 'avatars' existe
SELECT id, name, public FROM storage.buckets WHERE name = 'avatars';

-- 2. Si no existe, crear el bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

-- 3. Eliminar políticas existentes (si hay errores, ignorar)
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_admin_select" ON storage.objects;

-- 4. Crear políticas para avatares
-- Permitir a usuarios autenticados subir su propio avatar
CREATE POLICY "avatars_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permitir a usuarios ver su propio avatar
CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permitir a usuarios actualizar su propio avatar
CREATE POLICY "avatars_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permitir a usuarios eliminar su propio avatar
CREATE POLICY "avatars_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permitir a admins ver todos los avatares
CREATE POLICY "avatars_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Verificar que se crearon
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
