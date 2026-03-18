-- Solución al error de RLS en invitation_codes
-- El error "new row violates row-level security policy" ocurre porque 
-- los entrenadores no tienen permiso de INSERT.

-- 1. Permitir que los entrenadores inserten sus propios códigos
CREATE POLICY "Trainers pueden crear sus propios códigos"
  ON invitation_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'trainer'
    ) AND trainer_id = auth.uid()
  );

-- 2. Permitir que los entrenadores actualicen sus propios códigos (activar/desactivar)
CREATE POLICY "Trainers pueden actualizar sus propios códigos"
  ON invitation_codes FOR UPDATE
  TO authenticated
  USING (
    trainer_id = auth.uid()
  );

-- 3. Asegurar que los entrenadores puedan ver sus propios códigos (ya cubierto por la política de SELECT general, pero por seguridad)
-- La política existente ya permite SELECT si el rol es 'trainer'.
