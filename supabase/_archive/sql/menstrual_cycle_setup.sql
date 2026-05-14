-- Script para añadir funcionalidad de ciclo menstrual
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sex text,
ADD COLUMN IF NOT EXISTS cycle_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cycle_start_date date,
ADD COLUMN IF NOT EXISTS cycle_length_days integer DEFAULT 28,
ADD COLUMN IF NOT EXISTS period_length_days integer DEFAULT 5;

-- Comentario informativo
COMMENT ON COLUMN profiles.sex IS 'Sexo del usuario: male, female, other';
COMMENT ON COLUMN profiles.cycle_enabled IS 'Indica si el seguimiento del ciclo está activo';
COMMENT ON COLUMN profiles.cycle_start_date IS 'Fecha de inicio del último periodo';
COMMENT ON COLUMN profiles.cycle_length_days IS 'Duración promedio del ciclo en días';
COMMENT ON COLUMN profiles.period_length_days IS 'Duración promedio del periodo en días';
