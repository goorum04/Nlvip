-- Registro OPCIONAL de series por parte del socio: peso y repeticiones de
-- cada serie de cada ejercicio de su rutina.
--
-- Es opcional a propósito: el socio puede no rellenar nada y todo sigue
-- funcionando igual que hasta ahora. Cuando sí lo rellena, alimenta el
-- contexto que ve el entrenador y el que usa la IA para generar/progresar
-- rutinas (lib/routineGeneration.js).
--
-- Distinto de member_prs: aquello son marcas/récords puntuales; esto es el
-- registro sesión a sesión ligado al ejercicio concreto de la rutina.

CREATE TABLE IF NOT EXISTS public.workout_set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Ejercicio de la rutina. ON DELETE SET NULL: si el entrenador reescribe la
  -- rutina, el histórico del socio NO se borra — por eso se guarda también el
  -- nombre, que queda como referencia legible aunque la fila original ya no exista.
  workout_exercise_id UUID REFERENCES public.workout_exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  workout_day_id UUID REFERENCES public.workout_days(id) ON DELETE SET NULL,
  performed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  set_number INT NOT NULL CHECK (set_number > 0 AND set_number <= 20),
  weight_kg NUMERIC CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 1000)),
  reps INT CHECK (reps IS NULL OR (reps >= 0 AND reps <= 500)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Una fila por serie y día: reenviar la misma sesión actualiza en vez de duplicar.
  UNIQUE (member_id, workout_exercise_id, performed_on, set_number)
);

CREATE INDEX IF NOT EXISTS idx_workout_set_logs_member_date
  ON public.workout_set_logs (member_id, performed_on DESC);
CREATE INDEX IF NOT EXISTS idx_workout_set_logs_exercise
  ON public.workout_set_logs (member_id, exercise_name);

ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que member_prs / workout_checkins: el socio gestiona lo suyo;
-- admin y su entrenador asignado pueden leerlo.
CREATE POLICY workout_set_logs_select ON public.workout_set_logs
  FOR SELECT USING (
    member_id = (SELECT auth.uid())
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.trainer_members
      WHERE trainer_members.trainer_id = (SELECT auth.uid())
        AND trainer_members.member_id = workout_set_logs.member_id
    )
  );

CREATE POLICY workout_set_logs_insert ON public.workout_set_logs
  FOR INSERT WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY workout_set_logs_update ON public.workout_set_logs
  FOR UPDATE USING (member_id = (SELECT auth.uid()));

CREATE POLICY workout_set_logs_delete ON public.workout_set_logs
  FOR DELETE USING (member_id = (SELECT auth.uid()));
