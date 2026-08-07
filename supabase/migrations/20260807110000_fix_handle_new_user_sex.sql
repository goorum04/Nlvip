-- handle_new_user() creaba la ficha (profiles) al registrarse pero nunca
-- leía el campo "sex" del formulario de registro, aunque el dato sí llega
-- correctamente a auth.users.raw_user_meta_data->>'sex'. Resultado: TODO
-- socio nuevo se queda con profiles.sex = NULL para siempre, sin importar
-- lo que seleccionara en el formulario (verificado con datos reales: un
-- socio registrado el mismo día de este fix con sex='male' en los metadatos
-- de auth, pero NULL en profiles). Esto rompía la generación de rutinas:
-- sex=NULL se trataba como "mujer/otro" y excluía pecho por completo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, has_premium, sex)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'user_' || substr(NEW.id::text, 1, 8) || '@temporary.com'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      (CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'Usuario' END),
      'Usuario'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    COALESCE((NEW.raw_user_meta_data->>'has_premium')::boolean, false),
    NEW.raw_user_meta_data->>'sex'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(profiles.name, EXCLUDED.name),
    sex = COALESCE(profiles.sex, EXCLUDED.sex);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to return NEW even if profile creation fails, to at least let them log in
    RETURN NEW;
END;
$function$;

-- Backfill de los socios reales ya afectados, recuperando el sexo que SÍ
-- seleccionaron en el formulario (visible en auth.users.raw_user_meta_data)
-- pero que nunca llegó a guardarse en profiles por el bug de arriba.
UPDATE public.profiles p
SET sex = u.raw_user_meta_data->>'sex'
FROM auth.users u
WHERE p.id = u.id
  AND p.sex IS NULL
  AND u.raw_user_meta_data->>'sex' IN ('male', 'female', 'other');
