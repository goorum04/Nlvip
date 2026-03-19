-- Eliminar TODAS las políticas de avatars (ignorará errores si no existen)
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar" ON storage.objects;

-- Crear políticas abiertas para avatars
CREATE POLICY "avatars_insert_open"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_select_open"
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_update_open"
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_delete_open"
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'avatars');

-- Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%avatars%';
