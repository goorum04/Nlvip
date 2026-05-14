-- =============================================
-- CATÁLOGO GLOBAL DE EJERCICIOS
-- Ejecutar en Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  name_aliases TEXT[],                        -- Nombres alternativos para búsqueda
  category VARCHAR(50) NOT NULL DEFAULT 'fuerza', -- 'fuerza', 'aislamiento', 'cardio', 'funcional'
  muscle_primary VARCHAR(50) NOT NULL,        -- espalda, pecho, hombros, bíceps, tríceps, cuádriceps, femoral, glúteo, gemelos, abdomen, lumbares
  muscle_secondary TEXT[],                    -- Músculos secundarios involucrados
  equipment VARCHAR(50) DEFAULT 'máquina',    -- barra, mancuernas, máquina, cable, multipower, peso_corporal, peso_libre, ninguno
  difficulty VARCHAR(20) DEFAULT 'intermedio', -- principiante, intermedio, avanzado
  description TEXT,
  default_sets INTEGER DEFAULT 3,
  default_reps VARCHAR(20) DEFAULT '10-12',
  default_rest_seconds INTEGER DEFAULT 90,
  video_url TEXT,                             -- Vacío hasta que se añadan los vídeos
  video_thumbnail TEXT,
  is_global BOOLEAN DEFAULT true,             -- true = admin/trainer crea para todos; false = privado
  only_male BOOLEAN DEFAULT false,            -- true = no asignar a mujeres
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint para upserts idempotentes por nombre
ALTER TABLE exercises ADD CONSTRAINT exercises_name_unique UNIQUE(name);

-- Índices
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_primary ON exercises(muscle_primary);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX IF NOT EXISTS idx_exercises_is_global ON exercises(is_global);
CREATE INDEX IF NOT EXISTS idx_exercises_name_search ON exercises USING gin(to_tsvector('spanish', name));

-- RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los autenticados pueden ver ejercicios globales"
ON exercises FOR SELECT
TO authenticated
USING (is_global = true);

CREATE POLICY "Trainers ven sus propios ejercicios privados"
ON exercises FOR SELECT
TO authenticated
USING (is_global = false AND created_by = auth.uid());

CREATE POLICY "Admin y trainer pueden crear ejercicios"
ON exercises FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

CREATE POLICY "Creador o admin puede actualizar ejercicios"
ON exercises FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Creador o admin puede eliminar ejercicios"
ON exercises FOR DELETE
TO authenticated
USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- INSTRUCCIONES:
-- 1. Ejecuta este SQL en Supabase SQL Editor
-- 2. Luego ejecuta: node scripts/seed-exercises.js
-- =============================================
