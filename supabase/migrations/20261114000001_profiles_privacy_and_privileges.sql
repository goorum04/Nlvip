-- Privacidad y permisos de los perfiles (parte 1 de 2).
--
-- Problemas que corrige:
--  a) Cualquier usuario con sesión podía leer la ficha completa de todos los
--     demás (email, teléfono, fecha de nacimiento, peso, alergias, condiciones
--     médicas, ciclo, embarazo...). La parte 2 limita esa lectura; aquí se crea
--     public_profiles con lo mínimo para mostrar autores en comunidad y chat.
--  b) Un socio podía darse a sí mismo rol de admin, premium, entrenador o
--     cambiar su ciclo de revisión editando su propia fila.
--  c) Al registrarse, el rol y el premium se leían de user_metadata, que manda
--     quien se registra: cualquiera podía registrarse como admin o premium.
--  d) Las políticas "Service role ..." de notifications y device_tokens se
--     aplicaban a todo el mundo (incluso sin sesión): cualquiera podía leer
--     todos los avisos y tokens de móvil, y crear o cambiar avisos ajenos.

-- (a) Nombre, avatar y rol de cada usuario, sin el resto de la ficha.
create or replace view public.public_profiles
with (security_invoker = false) as
  select p.id, p.name, p.avatar_url, p.role
  from public.profiles p;

comment on view public.public_profiles is
  'Nombre, avatar y rol de cada usuario para mostrar autores en la comunidad y el chat. El resto de la ficha solo lo ven su dueño y el staff.';

-- Solo lectura y solo con sesión (la vista lee como su dueño, así que no
-- puede quedar ningún permiso de escritura).
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to authenticated;

-- (b) Rol, premium, entrenador y ciclo de revisión: solo admins y servidor.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  -- Solo se limita a las peticiones de la app con la sesión de un usuario.
  -- El servidor (service_role), los procesos internos y los admins pueden
  -- cambiarlo todo.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'member';
    new.has_premium := false;
    new.trainer_id := null;
    new.progress_reminder_days := null;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.has_premium is distinct from old.has_premium
     or new.trainer_id is distinct from old.trainer_id
     or new.progress_reminder_days is distinct from old.progress_reminder_days then
    raise exception 'No tienes permiso para cambiar el rol, el premium, el entrenador o el ciclo de revisión de un perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

create or replace trigger protect_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- (c) Registro: rol y premium solo desde app_metadata (lo pone el servidor).
-- El premium por código lo sigue activando /api/redeem-premium-code.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  insert into public.profiles (id, email, name, role, has_premium, sex)
  values (
    new.id,
    coalesce(new.email, 'user_' || substr(new.id::text, 1, 8) || '@temporary.com'),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      (case when new.email is not null then split_part(new.email, '@', 1) else 'Usuario' end),
      'Usuario'
    ),
    case when new.raw_app_meta_data->>'role' in ('member', 'trainer', 'admin')
         then new.raw_app_meta_data->>'role' else 'member' end,
    coalesce((new.raw_app_meta_data->>'has_premium')::boolean, false),
    new.raw_user_meta_data->>'sex'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(profiles.name, excluded.name),
    sex = coalesce(profiles.sex, excluded.sex);
  return new;
exception
  when others then
    return new;
end;
$function$;

-- (d) Las políticas "de servicio" quedan solo para el servidor. Cada usuario
-- sigue viendo y marcando como leídos sus propios avisos y gestionando sus
-- propios tokens con las políticas que ya existían.
alter policy "Service role manages notifications" on public.notifications to service_role;
alter policy "Service role can read all tokens" on public.device_tokens to service_role;
