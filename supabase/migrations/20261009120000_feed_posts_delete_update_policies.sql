-- feed_posts no tenía políticas de DELETE ni UPDATE: con RLS activo, el
-- borrado/ocultado desde el panel de admin afectaba a 0 filas sin dar error
-- y la app mostraba "Post eliminado" aunque el post seguía ahí.

DROP POLICY IF EXISTS "Autor o admin borran posts" ON public.feed_posts;
CREATE POLICY "Autor o admin borran posts" ON public.feed_posts
  FOR DELETE
  USING (author_id = (SELECT auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "Admin modera posts" ON public.feed_posts;
CREATE POLICY "Admin modera posts" ON public.feed_posts
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());
