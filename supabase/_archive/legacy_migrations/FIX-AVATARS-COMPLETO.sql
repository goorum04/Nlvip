-- Script completo para arreglar avatars

-- 1. Verificar bucket
SELECT id, name, public FROM storage.buckets WHERE name = 'avatars';

-- 2. Si no existe, crear bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'avatars', 'avatars', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'avatars');

-- 3. Eliminar TODAS las políticas existentes de avatars
DO $$
DECLARE
    pol_name TEXT;
BEGIN
    SELECT polic FOR pol_name INyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_name);
    END LOOP;
END $$;

-- 4. Crear políticas ANÓNIMAS (para todos)
CREATE POLICY "anon_avatars_insert"
ON storage.objects FOR INSERT TO anon 
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "anon_avatars_select"
ON storage.objects FOR SELECT TO anon 
USING (bucket_id = 'avatars');

-- 5. Crear políticas AUTHENTICATED
CREATE POLICY "auth_avatars_all"
ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- 6. Ver resultado
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%';
