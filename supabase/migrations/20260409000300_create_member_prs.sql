-- =========================================================================
-- NL VIP CLUB - Records Personales de Socios (member_prs)
-- Registra el historial de marcas personales de cada socio por ejercicio.
-- Incluye el 1RM estimado calculado con la fórmula de Brzycki.
-- =========================================================================

CREATE TABLE IF NOT EXISTS member_prs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_name  text        NOT NULL,
  weight_kg      numeric(6,2) NOT NULL,
  reps           integer     NOT NULL DEFAULT 1,
  estimated_1rm  numeric(6,2),              -- calculado por la API (fórmula Brzycki)
  date           date        NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_member_prs_member
  ON member_prs(member_id);

CREATE INDEX IF NOT EXISTS idx_member_prs_member_exercise
  ON member_prs(member_id, exercise_name);

CREATE INDEX IF NOT EXISTS idx_member_prs_date
  ON member_prs(member_id, date DESC);

-- -------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------------------------

ALTER TABLE member_prs ENABLE ROW LEVEL SECURITY;

-- El socio ve y gestiona sus propios PRs
CREATE POLICY "Socios gestionan sus propios PRs"
  ON member_prs FOR ALL
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- El trainer que tiene asignado al socio puede ver sus PRs
CREATE POLICY "Trainer ve PRs de sus socios"
  ON member_prs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trainer_members tm
      WHERE tm.trainer_id = auth.uid()
        AND tm.member_id = member_prs.member_id
    )
  );

-- Admin puede ver todos los PRs
CREATE POLICY "Admin ve todos los PRs"
  ON member_prs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
