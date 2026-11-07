-- Versión de la app nativa que usa cada socio (la guarda la propia app al
-- arrancar). Permite saber desde el panel quién tiene la app actualizada.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS app_version_seen_at timestamptz;
