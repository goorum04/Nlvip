-- Eliminar bucket avatars y recrear
DELETE FROM storage.objects WHERE bucket_id = 'avatars';
DELETE FROM storage.buckets WHERE id = 'avatars';

-- Crear bucket nuevo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Allow authenticated to insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all to select avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to select avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete avatars" ON storage.objects;

-- Crear políticas ABIERTAS
CREATE POLICY "Allow all inserts to avatars"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow all selects from avatars"
ON storage.objects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow anon selects from avatars"
ON storage.objects FOR SELECT TO anon USING (true);

CREATE POLICY "Allow all updates to avatars"
ON storage.objects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all deletes from avatars"
ON storage.objects FOR DELETE TO authenticated USING (true);

-- Verificar
SELECT * FROM storage.buckets WHERE name = 'avatars';
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE '%avatar%';
