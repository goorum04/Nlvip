-- SEGURIDAD: complete_diet_onboarding es SECURITY DEFINER sin ninguna
-- comprobación interna de quién llama. PostgreSQL otorga EXECUTE a PUBLIC
-- por defecto al crear una función, así que anon y authenticated podían
-- ejecutarla directo contra /rest/v1/rpc/complete_diet_onboarding:
-- cualquiera podía asignar una dieta arbitraria (contenido y macros
-- incluidos) a cualquier socio, sin autenticación.
--
-- Verificado en producción antes y después del fix: antes, un socio de
-- prueba y una petición anónima podían ejecutarla (200); después, ambas
-- devuelven "permission denied for function" (403 / 401).
--
-- El único llamador real en el código es app/api/diet-onboarding/complete
-- (route.js), que ya verifica token + rol admin/trainer antes de invocarla
-- usando SUPABASE_SERVICE_ROLE_KEY. service_role no está sujeto a estos
-- GRANT/REVOKE, así que revocar el acceso directo no rompe ese flujo.

REVOKE EXECUTE ON FUNCTION public.complete_diet_onboarding(
  uuid, uuid, text, integer, integer, integer, integer, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
