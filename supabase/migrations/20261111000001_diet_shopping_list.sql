-- Lista de la compra semanal de cada dieta, generada con IA a partir del
-- contenido y guardada para no regenerarla en cada apertura.
ALTER TABLE public.diet_templates
  ADD COLUMN IF NOT EXISTS shopping_list jsonb,
  ADD COLUMN IF NOT EXISTS shopping_list_generated_at timestamptz;
