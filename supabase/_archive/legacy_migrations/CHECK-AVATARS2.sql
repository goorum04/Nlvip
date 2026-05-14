-- Ver políticas de avatars
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%avatar%';

-- Ver bucket avatars
SELECT * FROM storage.buckets WHERE name = 'avatars';
