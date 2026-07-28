-- Gemelo izquierdo y derecho por separado, igual que brazo y muslo
-- (ver 20260728000001). Aditivo y nullable: la app antigua sigue enviando
-- solo calves_cm y no se rompe.
ALTER TABLE public.progress_records
  ADD COLUMN IF NOT EXISTS calves_left_cm  NUMERIC,
  ADD COLUMN IF NOT EXISTS calves_right_cm NUMERIC;
