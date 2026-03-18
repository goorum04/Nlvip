-- Solución definitiva para avatars - políticas sin restricciones de folder
-- Ejecutar esto en SQL Editor

-- 1. Primero verificar qué políticas hay
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%avatar%';

-- 2. Eliminar todas las políticas de avatars
DROP POLICY IF EXISTS "avatars_insert_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_admin_select" ON storage.objects;

-- 3. Crear políticas simples que funcionan
-- Cualquier usuario autenticado puede hacer cualquier cosa con avatars
CREATE POLICY "allow_all_avatars"
ON storage.objects FOR ALL 
TO authenticated 
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- 4. Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%avatar%';
