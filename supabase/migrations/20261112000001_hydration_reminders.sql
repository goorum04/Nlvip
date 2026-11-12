-- Recordatorios de hidratación (mañana y mediodía): opt-out por socio y
-- marca del último aviso enviado ("YYYY-MM-DD:am|pm") para no repetirlo.
alter table public.profiles
  add column if not exists hydration_reminders_enabled boolean not null default true,
  add column if not exists last_hydration_reminder text;
