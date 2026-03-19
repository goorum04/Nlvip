-- ============================================
-- PRODUCCIÓN: Añadir campo has_premium a profiles
-- ============================================

-- Añadir columna has_premium para controlar acceso a funciones premium
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_premium BOOLEAN DEFAULT false;

-- Actualizar usuarios existentes que tienen código de invitación usado
UPDATE profiles p
SET has_premium = true
WHERE EXISTS (
    SELECT 1 FROM invitation_codes ic 
    WHERE ic.used_by = p.id
);

-- Actualizar trainers y admins como premium siempre
UPDATE profiles SET has_premium = true WHERE role IN ('trainer', 'admin');

-- Verificar
SELECT id, name, role, has_premium FROM profiles;
