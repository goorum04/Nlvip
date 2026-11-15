-- Problemas con la app que mandan los usuarios desde "Informar de un problema".
-- Los guarda el servidor (service role) junto con el resumen de la IA y el
-- resultado de la llamada de aviso. Cada usuario ve los suyos; los admins, todos.
create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  summary text,
  severity text,
  call_status text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists problem_reports_created_idx on public.problem_reports (created_at desc);
alter table public.problem_reports enable row level security;
create policy problem_reports_select on public.problem_reports
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy problem_reports_admin_update on public.problem_reports
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
