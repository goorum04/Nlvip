-- Eliminar políticas conflictivas de avatars
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
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar" ON storage.objects;
DROP POLICY IF EXISTS "anon_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "auth_avatars_all" ON storage.objects;

-- Políticas abiertas para authenticated
CREATE POLICY "avatars_any_insert"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_any_select"
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_any_update"
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_any_delete"
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'avatars');

-- Políticas para anon (necesario para imágenes públicas)
CREATE POLICY "avatars_anon_select"
ON storage.objects FOR SELECT TO anon 
USING (bucket_id = 'avatars');

-- Verificar resultado
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%';
