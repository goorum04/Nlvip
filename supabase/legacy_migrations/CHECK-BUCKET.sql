-- Ejecute ESTO para ver qué está pasando:

-- Ver bucket
SELECT * FROM storage.buckets WHERE name = 'avatars';

-- Ver políticas
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
