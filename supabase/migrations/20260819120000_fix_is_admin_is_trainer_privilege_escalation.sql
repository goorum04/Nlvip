-- SEGURIDAD CRÍTICA: is_admin()/is_trainer() confiaban primero en
-- auth.jwt()->'user_metadata'->>'role', un campo que CUALQUIER usuario
-- autenticado puede escribirse a sí mismo con el anon key vía
-- supabase.auth.updateUser({ data: { role: 'admin' } }). Verificado en vivo
-- con una cuenta de socio de prueba: tras ese update + refresh de sesión,
-- is_admin() devolvía TRUE para el socio de prueba.
--
-- De estas dos funciones dependen decenas de políticas RLS (perfiles,
-- mensajes, dietas, rutinas, fotos de progreso, storage, invitation
-- codes...), así que era una escalada de privilegios total: cualquier socio
-- podía convertirse en admin con dos líneas de JavaScript en el cliente.
--
-- Se elimina el atajo inseguro y se deja SOLO el fallback que ya existía,
-- que consulta la tabla profiles (server-side, no manipulable por el
-- cliente) por el auth.uid() real de la sesión.

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_trainer()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'trainer'
  );
END;
$function$;
