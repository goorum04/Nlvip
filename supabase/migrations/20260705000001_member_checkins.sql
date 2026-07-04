-- =========================================================================
-- Revisión periódica del socio → IA adapta dieta y rutina → Admin aprueba
-- 20260705000001_member_checkins.sql
-- =========================================================================

-- =========================================================================
-- PART 1: Campos adicionales en progress_records
-- La revisión real que ya usa Nacho (hoja de cálculo) recoge, además de
-- peso/medidas: adherencia a dieta/pasos, ánimo, digestiones, estrés,
-- apetito y calidad del sueño.
-- Nunca incluye nada relacionado con comida/dieta/macros: son campos de
-- estado, no de contenido nutricional. (Se excluyen a propósito tensión
-- arterial, glucosa y fecha de próxima analítica — solo aplicables a
-- atletas con preparación química, fuera de alcance de este club.)
-- =========================================================================

ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS neck_cm             NUMERIC(5,2);
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS diet_adherence      BOOLEAN;
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS activity_adherence  BOOLEAN;
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS mood                TEXT;
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS digestion           TEXT;
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS stress_level        TEXT;
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS appetite            TEXT;
ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS sleep_quality       TEXT;

-- =========================================================================
-- PART 2: member_checkins
-- Una fila por revisión enviada. Guarda el ciclo de vida completo: fotos
-- comparadas, propuesta de dieta adaptada, propuesta de rutina adaptada,
-- y el resultado de la aprobación del admin/entrenador.
-- =========================================================================

CREATE TABLE IF NOT EXISTS member_checkins (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id                 uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  progress_record_id        uuid        REFERENCES progress_records(id) ON DELETE SET NULL,
  photo_group_id            uuid,
  previous_photo_group_id   uuid,
  status                    text        NOT NULL DEFAULT 'analyzing'
    CHECK (status IN ('analyzing', 'draft_ready', 'approved', 'dismissed', 'failed')),
  photo_analysis            text,
  -- Propuesta de dieta adaptada
  current_diet_id           uuid        REFERENCES diet_templates(id),
  draft_diet_content        text,
  draft_calories            int,
  draft_protein_g           int,
  draft_carbs_g             int,
  draft_fat_g               int,
  diet_change_summary       text,
  new_diet_id               uuid        REFERENCES diet_templates(id),
  -- Propuesta de rutina adaptada
  current_workout_template_id uuid      REFERENCES workout_templates(id),
  draft_routine_data        jsonb,
  routine_change_summary    text,
  new_workout_template_id   uuid        REFERENCES workout_templates(id),
  reviewed_by               uuid        REFERENCES profiles(id),
  error_message             text,
  created_at                timestamptz DEFAULT now(),
  completed_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_member_checkins_member ON member_checkins(member_id);
CREATE INDEX IF NOT EXISTS idx_member_checkins_status ON member_checkins(status);

ALTER TABLE member_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see own checkins"    ON member_checkins;
DROP POLICY IF EXISTS "Members insert own checkins" ON member_checkins;
DROP POLICY IF EXISTS "Staff manage checkins"       ON member_checkins;

CREATE POLICY "Members see own checkins" ON member_checkins FOR SELECT USING (
  member_id = (SELECT auth.uid())
);
CREATE POLICY "Members insert own checkins" ON member_checkins FOR INSERT WITH CHECK (
  member_id = (SELECT auth.uid())
);
CREATE POLICY "Staff manage checkins" ON member_checkins FOR ALL USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_checkins.member_id)
);
