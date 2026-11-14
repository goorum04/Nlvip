-- Privacidad de los perfiles (parte 2 de 2). Se aplica después de publicar la
-- app que lee los nombres de otros usuarios desde public_profiles.
--
-- Antes: cualquier usuario con sesión leía la ficha completa de todos.
-- Ahora: cada uno lee la suya; el staff (entrenadores y admins) lee todas; y
-- las fichas de entrenadores y admins siguen visibles para que las versiones
-- de la app ya instaladas encuentren a su entrenador y al admin del chat.
alter policy profiles_select on public.profiles
  using (
    id = (select auth.uid())
    or (select public.is_staff())
    or role in ('admin', 'trainer')
  );
