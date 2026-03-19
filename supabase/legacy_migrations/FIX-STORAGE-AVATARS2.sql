-- 1. Verificar si el bucket avatars existe
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE name = 'avatars';

-- 2. Si no existe, crearlo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3. Eliminar TODAS las políticas de storage.objects relacionadas con avatars
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_open" ON storage.objects;
DROP POLICY IF EXISTS "avatars_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_any_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_any_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_any_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_any_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar" ON storage.objects;
DROP POLICY IF EXISTS "anon_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "auth_avatars_all" ON storage.objects;

-- 4. Crear políticas NUEVAS y SIMPLES
-- INSERT: cualquier usuario autenticado puede subir
CREATE POLICY "Allow authenticated to insert avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- SELECT: cualquier usuario puede ver
CREATE POLICY "Allow all to select avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Allow anon to select avatars"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'avatars');

-- UPDATE: solo puede actualizar si es su archivo
CREATE POLICY "Allow authenticated to update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- DELETE: solo puede eliminar si es su archivo
CREATE POLICY "Allow authenticated to delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- 5. Verificar que las políticas se crearon
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%';
