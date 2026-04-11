-- =========================================================================
-- NL VIP CLUB - Cuestionario de Dieta (diet_onboarding_requests)
-- Tabla para el flujo de onboarding nutricional:
--   1. Admin/Trainer envía la solicitud al socio (status: pending)
--   2. Socio rellena el cuestionario (status: submitted)
--   3. Admin revisa, genera y confirma la dieta (status: completed)
-- También crea el RPC complete_diet_onboarding que guarda y asigna
-- la dieta al socio de forma atómica (SECURITY DEFINER).
-- =========================================================================

CREATE TABLE IF NOT EXISTS diet_onboarding_requests (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'submitted', 'completed')),
  responses    jsonb,                         -- respuestas del cuestionario
  completed_at timestamptz,                   -- cuando el admin finaliza la dieta
  created_at   timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_diet_onboarding_member
  ON diet_onboarding_requests(member_id);

CREATE INDEX IF NOT EXISTS idx_diet_onboarding_requested_by
  ON diet_onboarding_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_diet_onboarding_status
  ON diet_onboarding_requests(status);

-- -------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------------------------

ALTER TABLE diet_onboarding_requests ENABLE ROW LEVEL SECURITY;

-- El socio ve sus propias solicitudes
CREATE POLICY "Socio ve sus solicitudes de dieta"
  ON diet_onboarding_requests FOR SELECT
  USING (member_id = auth.uid());

-- El trainer/admin que hizo la solicitud también puede verlas
CREATE POLICY "Trainer y admin ven las solicitudes que gestionan"
  ON diet_onboarding_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Sólo admin/trainer pueden crear solicitudes
CREATE POLICY "Admin y trainer pueden crear solicitudes"
  ON diet_onboarding_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
    )
  );

-- El socio puede actualizar (enviar respuestas); admin puede completar
CREATE POLICY "Socio envía respuestas; admin completa"
  ON diet_onboarding_requests FOR UPDATE
  USING (
    member_id = auth.uid()
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    member_id = auth.uid()
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- -------------------------------------------------------------------------
-- RPC: complete_diet_onboarding
-- Operación atómica que:
--   1. Crea el diet_template con los datos proporcionados
--   2. Asigna la dieta al socio (upsert en member_diets)
--   3. Marca la solicitud como 'completed'
--   4. Devuelve el id del diet_template creado
-- SECURITY DEFINER para ejecutar con permisos de owner (admin).
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION complete_diet_onboarding(
  p_member_id  uuid,
  p_request_id uuid,
  p_diet_name  text,
  p_calories   integer,
  p_protein_g  integer,
  p_carbs_g    integer,
  p_fat_g      integer,
  p_content    text,
  p_admin_id   uuid,
  p_responses  jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_diet_id uuid;
BEGIN
  -- 1. Crear el template de dieta
  INSERT INTO diet_templates (
    trainer_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    content
  )
  VALUES (
    p_admin_id,
    p_diet_name,
    p_calories,
    p_protein_g,
    p_carbs_g,
    p_fat_g,
    p_content
  )
  RETURNING id INTO v_diet_id;

  -- 2. Asignar la dieta al socio (reemplaza la anterior si ya tenía una)
  INSERT INTO member_diets (member_id, diet_template_id, assigned_by, assigned_at)
  VALUES (p_member_id, v_diet_id, p_admin_id, now())
  ON CONFLICT (member_id)
  DO UPDATE SET
    diet_template_id = EXCLUDED.diet_template_id,
    assigned_by      = EXCLUDED.assigned_by,
    assigned_at      = EXCLUDED.assigned_at;

  -- 3. Marcar la solicitud como completada
  UPDATE diet_onboarding_requests
  SET
    status       = 'completed',
    completed_at = now(),
    responses    = COALESCE(p_responses, responses)
  WHERE id = p_request_id;

  RETURN v_diet_id;
END;
$$;
