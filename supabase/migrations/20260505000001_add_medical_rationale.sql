ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS medical_rationale TEXT;

COMMENT ON COLUMN workout_templates.medical_rationale IS
  'Explicación generada por IA cuando la rutina aplica a una condición médica (lesión, post-hospital, etc.). NULL para rutinas estándar.';
