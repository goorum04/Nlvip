-- Verificar bucket y políticas
SELECT * FROM storage.buckets WHERE name = 'avatars';

-- Ver todas las políticas de storage
SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'storage';
