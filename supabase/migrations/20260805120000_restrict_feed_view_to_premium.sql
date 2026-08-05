-- El feed social (feed_posts, feed_comments) era visible para cualquier
-- socio autenticado, aunque dar me gusta / comentar ya estaba restringido a
-- premium. Decisión de producto: solo los socios premium (o admin) deben
-- poder ver el feed, no solo interactuar con él.

DROP POLICY IF EXISTS "Everyone viewable posts" ON feed_posts;
CREATE POLICY "Premium ven posts visibles, admin ve todos"
  ON feed_posts FOR SELECT
  USING ((NOT is_hidden AND is_premium()) OR is_admin());

DROP POLICY IF EXISTS "Everyone views comments" ON feed_comments;
CREATE POLICY "Solo premium ven comentarios"
  ON feed_comments FOR SELECT
  USING (is_premium());
