-- Revisión periódica: medidas por lado (brazo/muslo izquierdo y derecho) y
-- cuarta foto de progreso (el otro lateral).
--
-- Ambos cambios son ADITIVOS y compatibles hacia atrás a propósito: la app
-- instalada desde la App Store sigue enviando 3 fotos y una sola medida de
-- brazo/muslo, y debe seguir funcionando igual hasta que salga la build
-- nueva. Por eso las columnas nuevas son nullable y el tipo de foto nuevo
-- se AÑADE al CHECK en vez de sustituir a los existentes.

-- 1. Medidas bilaterales. Se conservan arms_cm / legs_cm tal cual para no
--    romper el histórico ya guardado ni las vistas que los leen.
ALTER TABLE public.progress_records
  ADD COLUMN IF NOT EXISTS arms_left_cm  NUMERIC,
  ADD COLUMN IF NOT EXISTS arms_right_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS legs_left_cm  NUMERIC,
  ADD COLUMN IF NOT EXISTS legs_right_cm NUMERIC;

-- 2. Cuarta foto: se añade 'side_right' (lado derecho). Las fotos históricas
--    con tipo 'side' se siguen mostrando como "Lado" y sin tocar.
ALTER TABLE public.progress_photos
  DROP CONSTRAINT IF EXISTS progress_photos_photo_type_check;

ALTER TABLE public.progress_photos
  ADD CONSTRAINT progress_photos_photo_type_check
  CHECK (photo_type = ANY (ARRAY['front'::text, 'side'::text, 'back'::text, 'side_right'::text]));
