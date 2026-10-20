-- Denuncias y bloqueos en el feed (App Review Guideline 1.2: contenido
-- generado por usuarios exige poder denunciar contenido y bloquear usuarios).
-- feed_reports ya existía (solo posts, sin estado): se amplía a comentarios
-- y se le añade el estado de revisión. user_blocks es nueva.
--
-- Se conservan las políticas antiguas de feed_reports ("Authenticated users
-- can report posts" / "Admins/Trainers can view reports") y solo se AÑADEN
-- las nuevas: las políticas se combinan con OR. Sin FK a profiles en
-- reviewed_by / user_blocks; la limpieza al borrar un usuario la hace
-- app/api/admin-delete-user.

ALTER TABLE public.feed_reports ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE public.feed_reports ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.feed_comments(id) ON DELETE CASCADE;
ALTER TABLE public.feed_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.feed_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.feed_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.feed_reports ADD CONSTRAINT feed_reports_status_check CHECK (status IN ('pending', 'reviewed'));
ALTER TABLE public.feed_reports ADD CONSTRAINT feed_reports_target_check CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS feed_reports_reporter_post_uniq
  ON public.feed_reports (reporter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS feed_reports_reporter_comment_uniq
  ON public.feed_reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS feed_reports_status_idx ON public.feed_reports (status, created_at DESC);

-- El socio necesita leer sus propias denuncias para ocultar en su feed lo que ya denunció.
CREATE POLICY "feed_reports_select_own" ON public.feed_reports
  FOR SELECT USING (reporter_id = (SELECT auth.uid()));
CREATE POLICY "feed_reports_update_staff" ON public.feed_reports
  FOR UPDATE USING (is_admin() OR is_trainer());

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_blocks_manage_own" ON public.user_blocks
  FOR ALL USING (blocker_id = (SELECT auth.uid())) WITH CHECK (blocker_id = (SELECT auth.uid()));
CREATE POLICY "user_blocks_select_staff" ON public.user_blocks
  FOR SELECT USING (is_admin() OR is_trainer());
