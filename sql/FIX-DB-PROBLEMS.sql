-- ================================================
-- NL VIP - CORRECCIONES CRÍTICAS BASE DE DATOS (V3 FINAL)
-- ================================================

-- 1. TABLA: workout_videos (Soluciona crash y desajuste de columnas)
-- Eliminamos y recreamos para asegurar que las columnas coinciden con el código
DROP TABLE IF EXISTS workout_videos CASCADE;

CREATE TABLE workout_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_path TEXT NOT NULL, -- Ruta en el storage
  duration_seconds INTEGER,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para workout_videos
ALTER TABLE workout_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view workout_videos" ON workout_videos;
CREATE POLICY "Anyone authenticated can view workout_videos"
  ON workout_videos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and Trainers can manage workout_videos" ON workout_videos;
CREATE POLICY "Admins and Trainers can manage workout_videos"
  ON workout_videos FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- 2. POLÍTICAS: invitation_codes (Soluciona error al crear códigos)
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON invitation_codes;
CREATE POLICY "Admin full access" 
ON invitation_codes FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Trainers can view all invitation_codes" ON invitation_codes;
CREATE POLICY "Trainers can view all invitation_codes" 
ON invitation_codes FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'));

DROP POLICY IF EXISTS "Trainers can create own invitation_codes" ON invitation_codes;
CREATE POLICY "Trainers can create own invitation_codes" 
ON invitation_codes FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
    AND trainer_id = auth.uid()
);

-- 3. STORAGE: Crear bucket si no existe (esto suele dar error si no está configurado)
-- Nota: Los buckets suelen crearse desde la UI, pero aseguramos permisos si el bucket 'workout_videos' existe.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('workout_videos', 'workout_videos', true);
