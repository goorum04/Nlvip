-- ================================================
-- ACTUALIZAR NOMBRES DE USUARIOS DEMO
-- Ejecuta este SQL en tu Supabase SQL Editor
-- ================================================

-- Actualizar nombre del Socio a "Said"
UPDATE profiles 
SET name = 'Said' 
WHERE email = 'socio@demo.com';

-- Actualizar nombre del Entrenador a "Didac"
UPDATE profiles 
SET name = 'Didac' 
WHERE email = 'entrenador@demo.com';

-- Actualizar nombre del Admin a "Nacho"
UPDATE profiles 
SET name = 'Nacho' 
WHERE email = 'admin@demo.com';

-- Verificar los cambios
SELECT email, name, role FROM profiles WHERE email LIKE '%demo.com';
