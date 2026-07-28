-- Config de versión de la app nativa, para que el propio cliente detecte que
-- hay una actualización sin que el admin tenga que avisar uno a uno cada vez.
--
-- Solo lectura pública (es información inofensiva: "la última versión es
-- X"), sin RLS de escritura desde el cliente — se actualiza a mano (SQL o
-- panel interno) cada vez que se publica una build nueva en la App Store.
CREATE TABLE IF NOT EXISTS public.app_release_config (
  platform TEXT PRIMARY KEY,           -- 'ios' | 'android'
  latest_version TEXT NOT NULL,        -- ej: "1.34" (comparado contra MARKETING_VERSION del build instalado)
  update_message TEXT NOT NULL,
  store_url TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_release_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_release_config_select ON public.app_release_config
  FOR SELECT USING (true);

GRANT SELECT ON public.app_release_config TO anon, authenticated;

-- Versión actual publicada: 1.33 (ver MARKETING_VERSION en
-- ios/App/App.xcodeproj/project.pbxproj). Cuando se publique la próxima
-- build con estos cambios, actualizar latest_version a la nueva versión.
INSERT INTO public.app_release_config (platform, latest_version, update_message, store_url)
VALUES (
  'ios',
  '1.33',
  'Hay una nueva versión disponible. Si no actualizas, no podrás disfrutar de las últimas novedades.',
  'https://apps.apple.com/es/app/nl-vip-club/id6759666320'
)
ON CONFLICT (platform) DO NOTHING;
