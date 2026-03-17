-- ============================================================
-- ARREGLAR PERFIL DE ADMIN
-- Ejecuta esto en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Paso 1: Ver qué usuarios existen en Auth
SELECT id, email, created_at, raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- Paso 2: Ver qué perfiles existen en la tabla profiles
SELECT id, email, name, role, has_premium
FROM profiles
ORDER BY created_at DESC;

-- ============================================================
-- Paso 3: ARREGLAR el perfil del admin
-- Reemplaza 'TU_EMAIL_ADMIN@email.com' con tu email real de admin
-- Reemplaza 'Nacho' con tu nombre real si es diferente
-- ============================================================

DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'TU_EMAIL_ADMIN@email.com'; -- ← CAMBIA ESTO
  admin_name text := 'Nacho';                       -- ← CAMBIA SI ES DIFERENTE
BEGIN
  -- Buscar el ID del usuario en auth
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = admin_email;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró usuario con email: %', admin_email;
  END IF;

  -- Crear o actualizar el perfil con rol admin
  INSERT INTO profiles (id, email, name, role, has_premium)
  VALUES (admin_id, admin_email, admin_name, 'admin', true)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    role = 'admin',
    has_premium = true,
    updated_at = now();

  RAISE NOTICE '✅ Perfil de admin actualizado correctamente para: % (ID: %)', admin_email, admin_id;
END $$;

-- Paso 4: Verificar que quedó bien
SELECT id, email, name, role, has_premium
FROM profiles
WHERE role = 'admin';
