-- Horarios personales de comidas y entreno, para poder avisar por push
-- cuando se acerque la hora. Antes no existía nada estructurado: las horas
-- de las comidas solo vivían como texto libre "(08:00)" dentro del
-- contenido de la dieta, imposible de consultar desde un cron.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS breakfast_time time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS lunch_time time DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS snack_time time DEFAULT '17:30',
ADD COLUMN IF NOT EXISTS dinner_time time DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS workout_time time,
ADD COLUMN IF NOT EXISTS meal_reminders_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS workout_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_workout_reminder_date date;

-- Registro de avisos de comida ya enviados hoy, para no repetir el push
-- si el cron vuelve a pasar dentro de la misma ventana.
CREATE TABLE IF NOT EXISTS meal_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_slot text NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'snack', 'dinner')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, date, meal_slot)
);

ALTER TABLE meal_reminders_sent ENABLE ROW LEVEL SECURITY;
-- Solo el service role (cron) escribe aquí; nadie más necesita acceso directo.

-- Registro de "ya he comido" que marca el propio socio desde la app.
CREATE TABLE IF NOT EXISTS meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_slot text NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'snack', 'dinner')),
  logged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, date, meal_slot)
);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own meal logs"
  ON meal_logs FOR ALL
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Admins and trainers read all meal logs"
  ON meal_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'trainer')
  ));
