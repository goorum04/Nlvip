-- =========================================================================
-- NL VIP CLUB - Assistant background jobs
-- Permite que las generaciones largas del asistente IA (dietas, rutinas)
-- sigan procesándose en el servidor aunque el admin minimice o cierre la
-- app, guardando el resultado para recuperarlo al volver (polling).
-- =========================================================================

CREATE TABLE IF NOT EXISTS assistant_jobs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by  uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status      text        NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'error')),
  request     jsonb,
  result      jsonb,
  error       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_jobs_created_by ON assistant_jobs(created_by, created_at DESC);

ALTER TABLE assistant_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assistant jobs"
  ON assistant_jobs
  FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
