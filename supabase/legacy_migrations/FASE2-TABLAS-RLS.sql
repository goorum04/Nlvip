-- ================================================
-- NL VIP CLUB - FASE 2: STORAGE, VIDEOS, FOTOS
-- ================================================
-- Este script añade soporte para:
-- (a) Vídeos en rutinas (admin/trainer suben, member ve si asignado)
-- (b) Fotos en feed (todos suben)
-- (c) Fotos privadas de progreso (member sube, solo él + trainer + admin ven)
-- 
-- EJECUTA ESTE SCRIPT EN EL SQL EDITOR DE SUPABASE
-- ================================================

-- ================================================
-- PARTE 1: TABLA workout_videos
-- ================================================

-- Crear tabla para vídeos de rutinas
CREATE TABLE IF NOT EXISTS workout_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 120),
  title TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_workout_videos_template ON workout_videos(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_workout_videos_uploaded_by ON workout_videos(uploaded_by);

-- Habilitar RLS
ALTER TABLE workout_videos ENABLE ROW LEVEL SECURITY;

-- ================================================
-- PARTE 2: RLS PARA workout_videos
-- ================================================

-- Admin: acceso total
CREATE POLICY "workout_videos_admin_all"
  ON workout_videos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trainer: insert/update/delete SOLO si la rutina es suya y él subió el video
CREATE POLICY "workout_videos_trainer_select"
  ON workout_videos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates wt
      WHERE wt.id = workout_videos.workout_template_id
      AND wt.trainer_id = auth.uid()
    )
  );

CREATE POLICY "workout_videos_trainer_insert"
  ON workout_videos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workout_templates wt
      WHERE wt.id = workout_template_id
      AND wt.trainer_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

CREATE POLICY "workout_videos_trainer_update"
  ON workout_videos FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workout_templates wt
      WHERE wt.id = workout_videos.workout_template_id
      AND wt.trainer_id = auth.uid()
    )
  );

CREATE POLICY "workout_videos_trainer_delete"
  ON workout_videos FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workout_templates wt
      WHERE wt.id = workout_videos.workout_template_id
      AND wt.trainer_id = auth.uid()
    )
  );

-- Member: select SOLO si tiene la rutina asignada
CREATE POLICY "workout_videos_member_select"
  ON workout_videos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_workouts mw
      WHERE mw.member_id = auth.uid()
      AND mw.workout_template_id = workout_videos.workout_template_id
    )
  );


-- ================================================
-- PARTE 3: ACTUALIZAR feed_posts (añadir image_path si no existe)
-- ================================================

-- Renombrar image_url a image_path si queremos ser consistentes
-- O simplemente usamos image_url como path (ya existe la columna)
-- Verificamos que existe y si no la creamos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feed_posts' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE feed_posts ADD COLUMN image_url TEXT;
  END IF;
END $$;


-- ================================================
-- PARTE 4: ACTUALIZAR progress_photos
-- ================================================

-- Asegurar que la tabla tiene las columnas correctas
-- Renombrar photo_url a image_path para consistencia
DO $$ 
BEGIN
  -- Si existe photo_url, renombrarlo a image_path
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'progress_photos' AND column_name = 'photo_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'progress_photos' AND column_name = 'image_path'
  ) THEN
    ALTER TABLE progress_photos RENAME COLUMN photo_url TO image_path;
  END IF;
  
  -- Si no existe ninguna, crear image_path
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'progress_photos' AND (column_name = 'photo_url' OR column_name = 'image_path')
  ) THEN
    ALTER TABLE progress_photos ADD COLUMN image_path TEXT NOT NULL;
  END IF;
  
  -- Añadir taken_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'progress_photos' AND column_name = 'taken_at'
  ) THEN
    ALTER TABLE progress_photos ADD COLUMN taken_at DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;


-- ================================================
-- PARTE 5: ACTUALIZAR RLS para progress_photos (añadir admin)
-- ================================================

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Fotos privadas" ON progress_photos;
DROP POLICY IF EXISTS "Socio sube fotos" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_member_select" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_member_insert" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_trainer_select" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_admin_select" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_admin_delete" ON progress_photos;

-- Member: insert/select solo sus propias fotos
CREATE POLICY "progress_photos_member_select"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "progress_photos_member_insert"
  ON progress_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'member')
  );

-- Trainer: select fotos de sus socios asignados
CREATE POLICY "progress_photos_trainer_select"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trainer_members tm
      WHERE tm.trainer_id = auth.uid()
      AND tm.member_id = progress_photos.member_id
    )
  );

-- Admin: select todo
CREATE POLICY "progress_photos_admin_select"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin: delete todo
CREATE POLICY "progress_photos_admin_delete"
  ON progress_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Member puede borrar sus propias fotos (últimas 24h)
CREATE POLICY "progress_photos_member_delete_own"
  ON progress_photos FOR DELETE
  TO authenticated
  USING (
    member_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  );


-- ================================================
-- PARTE 6: INDICES ADICIONALES
-- ================================================
CREATE INDEX IF NOT EXISTS idx_progress_photos_member ON progress_photos(member_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_taken_at ON progress_photos(taken_at DESC);


-- ================================================
-- FIN DEL SCRIPT DE TABLAS Y RLS
-- ================================================
-- Ahora ejecuta el script de STORAGE en el Dashboard de Supabase
-- (Storage > Policies) ya que las políticas de storage no se pueden
-- crear desde SQL Editor directamente.

COMMIT;
