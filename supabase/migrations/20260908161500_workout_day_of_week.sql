-- Para poder decir "hoy toca pierna" en el aviso de entreno, cada día de
-- la rutina necesita un día de la semana asociado. No existía ninguno:
-- day_number solo es el orden de la rotación (1,2,3...), no un día fijo.
-- Por defecto se asume que el día 1 cae en lunes, el 2 en martes, etc.
-- (rutinas de 4 días -> lunes a jueves, descanso viernes-domingo), que es
-- el patrón más habitual. El entrenador puede corregirlo a mano si algún
-- socio entrena en días distintos.
ALTER TABLE workout_days
ADD COLUMN IF NOT EXISTS day_of_week smallint CHECK (day_of_week BETWEEN 1 AND 7);

UPDATE workout_days
SET day_of_week = ((day_number - 1) % 7) + 1
WHERE day_of_week IS NULL;

CREATE OR REPLACE FUNCTION set_default_workout_day_of_week()
RETURNS trigger AS $$
BEGIN
  IF NEW.day_of_week IS NULL THEN
    NEW.day_of_week := ((NEW.day_number - 1) % 7) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_default_workout_day_of_week ON workout_days;
CREATE TRIGGER trg_default_workout_day_of_week
  BEFORE INSERT ON workout_days
  FOR EACH ROW
  EXECUTE FUNCTION set_default_workout_day_of_week();
