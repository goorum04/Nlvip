-- Aviso de "racha en peligro" (cron /api/cron/streak-guard): como mucho un
-- push al día por socio. Guarda la fecha (Europe/Madrid) del último aviso.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_streak_reminder_date date;
