-- Funciones de la base de datos que leían o cambiaban datos de CUALQUIER socio
-- sin comprobar quién llamaba (se podían usar incluso sin iniciar sesión):
--   notas privadas del staff sobre un socio, preferencias del gimnasio para la
--   IA, aversiones de alimentos (ver, añadir y quitar), macros del día,
--   actividad de hoy y métricas de actividad de un socio.
--
-- A partir de ahora solo responden a:
--   - el servidor (service_role) y los procesos internos (cron),
--   - el staff (entrenadores y admins), que es lo que usa el asistente IA,
--   - el propio socio cuando pide SUS datos.
-- Las notas del staff y las preferencias del gimnasio: solo staff y servidor.
--
-- De paso se corrige rpc_get_food_aversions, que fallaba siempre (ORDER BY
-- fuera del STRING_AGG): la generación de dietas con IA no recibía nunca las
-- aversiones de alimentos del socio.

create or replace function public.can_access_member(p_member_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $f$
  select coalesce(
    coalesce(auth.role(), '') not in ('authenticated', 'anon')
    or public.is_staff()
    or (p_member_id is not null and p_member_id = auth.uid()),
    false)
$f$;

create or replace function public.rpc_get_food_aversions(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_aversions text;
begin
  if not public.can_access_member(p_member_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select string_agg(food_name, ', ' order by food_name)
  into v_aversions
  from public.member_food_aversions
  where member_id = p_member_id;
  return coalesce(v_aversions, '');
end;
$function$;

-- Al resto se les añade la comprobación al principio de su código, sin tocar
-- nada más (se lee la definición actual y se vuelve a crear con la guarda).
do $do$
declare
  r record;
  def text;
  newdef text;
  guard_self constant text := E'\n  IF NOT public.can_access_member(p_member_id) THEN RAISE EXCEPTION ''No autorizado'' USING ERRCODE = ''42501''; END IF;';
  guard_staff constant text := E'\n  IF NOT public.can_access_member(NULL) THEN RAISE EXCEPTION ''No autorizado'' USING ERRCODE = ''42501''; END IF;';
  n int;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.proname, pg_get_function_identity_arguments(p.oid)) in (
        ('calculate_activity_metrics', 'p_member_id uuid, p_steps integer'),
        ('rpc_add_food_aversion', 'p_member_id uuid, p_food_name text, p_reason text'),
        ('rpc_get_admin_preferences_text', ''),
        ('rpc_get_daily_macros_v2', 'p_member_id uuid, p_date date'),
        ('rpc_get_member_notes_text', 'p_member_id uuid'),
        ('rpc_get_today_activity', 'p_member_id uuid'),
        ('rpc_list_food_aversions', 'p_member_id uuid'),
        ('rpc_remove_food_aversion', 'p_member_id uuid, p_food_name text'))
  loop
    def := pg_get_functiondef(r.oid);
    if def ~ 'can_access_member' then continue; end if;
    newdef := regexp_replace(def, '^(.*?AS \$function\$.*?\mBEGIN\M)',
      '\1' || case when r.proname in ('rpc_get_admin_preferences_text', 'rpc_get_member_notes_text') then guard_staff else guard_self end);
    if newdef = def then
      raise exception 'No se pudo proteger %(%)', r.proname, r.args;
    end if;
    execute newdef;
  end loop;

  select count(*) into n
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname <> 'can_access_member'
    and pg_get_functiondef(p.oid) ~ 'can_access_member';
  if n <> 9 then
    raise exception 'Se esperaban 9 funciones protegidas y hay %', n;
  end if;
end
$do$;
