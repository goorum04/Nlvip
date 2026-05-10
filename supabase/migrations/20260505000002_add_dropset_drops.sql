ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS dropset_drops INTEGER;

COMMENT ON COLUMN workout_exercises.dropset_drops IS
  'Número de drops (reducciones de peso al fallo) que tiene cada serie principal del ejercicio. NULL o 0 = ejercicio normal sin dropset. Ej: 2 significa que tras la serie principal, el atleta hace 2 mini-series con menos peso al fallo, sin descanso entre ellas.';
