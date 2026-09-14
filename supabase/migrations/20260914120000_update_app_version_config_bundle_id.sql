-- La app se movió a una cuenta de Apple Developer distinta: bundle ID e ID de
-- App Store Connect cambiaron de com.leonardos.app (id6759666320) a
-- com.nlvipteam.app (id6759003518). Actualiza las URLs de las tiendas para
-- que el aviso de "nueva versión disponible" apunte al listing correcto.
UPDATE public.app_version_config
SET store_url = 'https://apps.apple.com/es/app/nl-vip-team/id6759003518',
    updated_at = NOW()
WHERE platform = 'ios';

UPDATE public.app_version_config
SET store_url = REPLACE(store_url, 'com.leonardos.app', 'com.nlvipteam.app'),
    updated_at = NOW()
WHERE platform = 'android';
