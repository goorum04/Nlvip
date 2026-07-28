-- Configuración de avisos de actualización de app
CREATE TABLE IF NOT EXISTS public.app_version_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  latest_version TEXT NOT NULL,
  update_message TEXT NOT NULL,
  store_url TEXT NOT NULL,
  configured BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (platform)
);

INSERT INTO public.app_version_config (platform, latest_version, update_message, store_url, configured)
VALUES
  ('ios', '1.97', 'Nueva versión disponible', 'https://apps.apple.com/app/nl-vip-club/id6503098673', true),
  ('android', '1.97', 'Nueva versión disponible', 'https://play.google.com/store/apps/details?id=com.leonardos.app', true)
ON CONFLICT (platform) DO UPDATE SET
  latest_version = EXCLUDED.latest_version,
  update_message = EXCLUDED.update_message,
  store_url = EXCLUDED.store_url,
  configured = EXCLUDED.configured,
  updated_at = NOW();
