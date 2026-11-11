-- Ticks de la lista de la compra de cada socio (checklist en el súper),
-- guardados en servidor para que se mantengan entre dispositivos y para
-- medir cuánto se usa (opened_count).
CREATE TABLE IF NOT EXISTS public.shopping_list_checks (
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  diet_template_id uuid NOT NULL REFERENCES public.diet_templates(id) ON DELETE CASCADE,
  checked jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, diet_template_id)
);
ALTER TABLE public.shopping_list_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY shopping_checks_member_all ON public.shopping_list_checks
  FOR ALL USING (member_id = (SELECT auth.uid())) WITH CHECK (member_id = (SELECT auth.uid()));
CREATE POLICY shopping_checks_staff_select ON public.shopping_list_checks
  FOR SELECT USING (is_admin() OR EXISTS (SELECT 1 FROM trainer_members tm WHERE tm.trainer_id = (SELECT auth.uid()) AND tm.member_id = shopping_list_checks.member_id));
