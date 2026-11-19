-- Los socios ya no leen la ficha completa de admins y entrenadores.
--
-- La política anterior (20261114000002) dejaba a cualquier usuario
-- autenticado leer las filas de role admin/trainer enteras (email, teléfono,
-- fecha de nacimiento...) para poder mostrar el nombre del entrenador. El
-- 18/11 unas cuentas creadas desde fuera lo aprovecharon. Para nombre y foto
-- ya existe la vista public_profiles; para localizar al admin del gimnasio
-- (sin exponer emails) se usa get_gym_admin().

create or replace function public.get_gym_admin()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name
  from public.profiles p
  where p.role = 'admin'
    and coalesce(p.email, '') not like '%@nlvipnutrition.internal'
    and coalesce(p.email, '') not like '%@example.com'
  order by p.created_at asc
  limit 1
$$;

revoke all on function public.get_gym_admin() from public, anon;
grant execute on function public.get_gym_admin() to authenticated;

alter policy profiles_select on public.profiles
  using (id = (select auth.uid()) or (select public.is_staff()));
