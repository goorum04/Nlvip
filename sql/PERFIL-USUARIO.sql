-- =============================================
-- SQL PARA AÑADIR CAMPOS DE PERFIL DE USUARIO
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Añadir columnas a la tabla profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Crear bucket para avatares (si no existe)
-- NOTA: Esto se hace desde el dashboard de Supabase > Storage > New Bucket
-- Nombre: avatars
-- Público: NO (usaremos signed URLs)

-- 3. Políticas de Storage para avatares
-- Ejecutar SOLO si el bucket 'avatars' ya existe

-- Permitir a usuarios subir su propio avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a usuarios ver su propio avatar
CREATE POLICY "Users can view own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a usuarios actualizar su propio avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a usuarios eliminar su propio avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir a admins ver todos los avatares
CREATE POLICY "Admins can view all avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > Storage
-- 2. Crea un nuevo bucket llamado "avatars"
-- 3. Marca como PRIVADO (no público)
-- 4. Ve a SQL Editor y ejecuta este script
-- =============================================
