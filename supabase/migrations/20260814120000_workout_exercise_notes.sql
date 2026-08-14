-- Nota OPCIONAL del socio por ejercicio y día: contexto libre que no encaja
-- en peso/reps ("me costó más acabar", "tuve que hacerlo con otra máquina").
--
-- Va en tabla propia (no una columna en workout_set_logs) porque es un dato
-- a nivel de ejercicio+día, no de serie: el socio puede dejar una nota sin
-- rellenar ninguna serie, o rellenar series sin dejar nota, y ambas cosas
-- deben poder editarse/borrarse de forma independiente.

CREATE TABLE IF NOT EXISTS public.workout_exercise_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Mismo patrón que workout_set_logs: ON DELETE SET NULL para no perder el
  -- histórico si el entrenador reescribe la rutina; exercise_name queda como
  -- referencia legible aunque la fila original ya no exista.
  workout_exercise_id UUID REFERENCES public.workout_exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  workout_day_id UUID REFERENCES public.workout_days(id) ON DELETE SET NULL,
  performed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT NOT NULL CHECK (char_length(note) > 0 AND char_length(note) <= 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, workout_exercise_id, performed_on)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_notes_member_date
  ON public.workout_exercise_notes (member_id, performed_on DESC);

ALTER TABLE public.workout_exercise_notes ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que workout_set_logs: el socio gestiona lo suyo; admin y su
-- entrenador asignado pueden leerlo.
CREATE POLICY workout_exercise_notes_select ON public.workout_exercise_notes
  FOR SELECT USING (
    member_id = (SELECT auth.uid())
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.trainer_members
      WHERE trainer_members.trainer_id = (SELECT auth.uid())
        AND trainer_members.member_id = workout_exercise_notes.member_id
    )
  );

CREATE POLICY workout_exercise_notes_insert ON public.workout_exercise_notes
  FOR INSERT WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY workout_exercise_notes_update ON public.workout_exercise_notes
  FOR UPDATE USING (member_id = (SELECT auth.uid()));

CREATE POLICY workout_exercise_notes_delete ON public.workout_exercise_notes
  FOR DELETE USING (member_id = (SELECT auth.uid()));
