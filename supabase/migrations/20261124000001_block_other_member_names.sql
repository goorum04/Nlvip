-- Bloquea asignar a un socio una rutina o dieta que contenga el nombre de OTRO
-- socio o entrenador.
--
-- Visto en producción (23/11): el asistente tituló la rutina de Gabriela
-- "… ESTILO DANIELA - GABRIELA" porque el admin pidió una rutina "del estilo de
-- Daniela", y Gabriela lo vio en su app. El código del servidor ya limpia los
-- nombres antes de guardar (lib/memberNameGuard.js); esto es la red de
-- seguridad para cualquier otro camino (panel, asistente, scripts...).

create or replace function public.nl_fold(t text)
returns text
language sql
immutable
as $$
  select lower(translate(coalesce(t, ''),
    'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇáéíóúàèìòùäëïöüâêîôûñç',
    'AEIOUAEIOUAEIOUAEIOUNCaeiouaeiouaeiouaeiounc'))
$$;

-- Devuelve los nombres de otros socios/entrenadores que aparecen en el texto.
create or replace function public.nl_other_names_in_text(p_member_id uuid, p_text text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with own as (
    select split_part(public.nl_fold(trim(name)), ' ', 1) as first
    from public.profiles where id = p_member_id
  ),
  people as (
    select p.name,
           split_part(public.nl_fold(trim(p.name)), ' ', 1) as n1,
           nullif(split_part(public.nl_fold(trim(p.name)), ' ', 2), '') as n2
    from public.profiles p
    where p.role in ('member', 'trainer')
      and p.id <> p_member_id
      and p.name is not null
  ),
  t as (select public.nl_fold(p_text) as txt)
  select coalesce(array_agg(distinct people.name), '{}')
  from people, t
  where (people.n2 is not null and length(people.n1) >= 2
         and t.txt ~ ('(^|[^a-z0-9])' || people.n1 || '\s+' || people.n2 || '($|[^a-z0-9])'))
     or (length(people.n1) >= 4
         and people.n1 <> coalesce((select first from own), '')
         and people.n1 not in ('socio', 'demo', 'cuenta', 'arnold', 'scott', 'larsen', 'pallof',
                               'zottman', 'jefferson', 'nordic', 'copenhagen', 'pilar', 'rosa',
                               'probe', 'test')
         and t.txt ~ ('(^|[^a-z0-9])' || people.n1 || '($|[^a-z0-9])'))
$$;

create or replace function public.nl_block_other_names_on_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text;
  v_names text[];
  v_kind text;
begin
  if tg_table_name = 'member_workouts' then
    v_kind := 'La rutina';
    select concat_ws(' | ', wt.name, wt.description, wt.medical_rationale,
             (select string_agg(concat_ws(' ', d.name, d.description), ' | ')
                from public.workout_days d where d.workout_template_id = wt.id),
             (select string_agg(concat_ws(' ', e.name, e.description), ' | ')
                from public.workout_days d join public.workout_exercises e on e.workout_day_id = d.id
               where d.workout_template_id = wt.id))
      into v_text
      from public.workout_templates wt where wt.id = new.workout_template_id;
  else
    v_kind := 'La dieta';
    select concat_ws(' | ', dt.name, dt.content) into v_text
      from public.diet_templates dt where dt.id = new.diet_template_id;
  end if;

  v_names := public.nl_other_names_in_text(new.member_id, v_text);
  if array_length(v_names, 1) > 0 then
    raise exception '% contiene el nombre de otro socio (%). Quítalo del título y del texto antes de asignarla.',
      v_kind, array_to_string(v_names, ', ')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger nl_block_other_names
  before insert or update of workout_template_id, member_id on public.member_workouts
  for each row execute function public.nl_block_other_names_on_assign();

create or replace trigger nl_block_other_names
  before insert or update of diet_template_id, member_id on public.member_diets
  for each row execute function public.nl_block_other_names_on_assign();

revoke all on function public.nl_other_names_in_text(uuid, text) from public, anon, authenticated;
revoke all on function public.nl_block_other_names_on_assign() from public, anon, authenticated;
