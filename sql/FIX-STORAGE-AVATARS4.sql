-- NO eliminar bucket, solo recrear políticas

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Allow authenticated to insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all to select avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to select avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all inserts to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all selects from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon selects from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes from avatars" ON storage.objects;

-- Crear políticas ABIERTAS para TODOS
CREATE POLICY "avatars_insert_open"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_select_open"
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_update_open"
ON storage.objects FOR UPDATE USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_delete_open"
ON storage.objects FOR DELETE USING (bucket_id = 'avatars');

-- Verificar
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE '%avatar%';
