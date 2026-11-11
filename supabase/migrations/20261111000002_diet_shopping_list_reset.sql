-- Si cambia el contenido de la dieta, la lista de la compra guardada deja
-- de valer: se borra y se regenera sola la próxima vez que alguien la abra.
CREATE OR REPLACE FUNCTION public.reset_shopping_list_on_content_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.shopping_list := NULL;
    NEW.shopping_list_generated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_shopping_list ON public.diet_templates;
CREATE TRIGGER trg_reset_shopping_list
  BEFORE UPDATE OF content ON public.diet_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_shopping_list_on_content_change();
