-- =============================================
-- SQL PARA SISTEMA DE RUTINAS POR DÍAS Y EJERCICIOS
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Tabla de días de entrenamiento (pertenecen a una rutina)
CREATE TABLE IF NOT EXISTS workout_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL, -- 1, 2, 3, 4...
  name VARCHAR(100) NOT NULL, -- "Pecho y Tríceps", "Espalda y Bíceps"
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de ejercicios (pertenecen a un día)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_day_id UUID REFERENCES workout_days(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- "Press Banca"
  description TEXT, -- Instrucciones adicionales
  sets INTEGER DEFAULT 3, -- Series
  reps VARCHAR(20) DEFAULT '10', -- Repeticiones (puede ser "10" o "8-12" o "al fallo")
  rest_seconds INTEGER DEFAULT 90, -- Descanso entre series
  video_url TEXT, -- URL del video en Supabase Storage
  video_thumbnail TEXT, -- Thumbnail del video
  order_index INTEGER DEFAULT 0, -- Orden del ejercicio en el día
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_workout_days_template ON workout_days(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_day ON workout_exercises(workout_day_id);

-- 4. RLS Policies para workout_days
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage their workout days"
ON workout_days FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = workout_days.workout_template_id
    AND (wt.trainer_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ))
  )
);

CREATE POLICY "Members can view assigned workout days"
ON workout_days FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    JOIN workout_templates wt ON wt.id = mw.workout_template_id
    WHERE wt.id = workout_days.workout_template_id
    AND mw.member_id = auth.uid()
  )
);

-- 5. RLS Policies para workout_exercises
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage exercises"
ON workout_exercises FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN workout_templates wt ON wt.id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id
    AND (wt.trainer_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ))
  )
);

CREATE POLICY "Members can view assigned exercises"
ON workout_exercises FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN member_workouts mw ON mw.workout_template_id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id
    AND mw.member_id = auth.uid()
  )
);

-- 6. Crear bucket para videos de ejercicios (hacer desde Supabase Dashboard > Storage)
-- Nombre: exercise_videos
-- Público: NO

-- 7. Storage policies para exercise_videos
-- (Ejecutar solo después de crear el bucket)

/*
CREATE POLICY "Trainers can upload exercise videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer', 'admin'))
);

CREATE POLICY "Anyone authenticated can view exercise videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exercise_videos');

CREATE POLICY "Trainers can delete their exercise videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise_videos' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer', 'admin'))
);
*/

-- =============================================
-- INSTRUCCIONES:
-- 1. Ejecuta este SQL en Supabase SQL Editor
-- 2. Ve a Storage > New Bucket > "exercise_videos" (privado)
-- 3. Descomenta y ejecuta las políticas de storage (líneas 75-95)
-- =============================================
