-- Progress reminder scheduling
--
-- Adds two columns to profiles that power the weekly/biweekly progress
-- reminder feature:
--
--   progress_reminder_days:
--     How often (in days) this member should be nudged to upload a full
--     progress check-in. NULL = disabled, no automatic reminder.
--
--   last_progress_reminder_at:
--     When the last reminder push was sent. Used by the daily cron to
--     avoid re-sending within a short window (anti-spam guard).
--
-- Neither column affects read paths. They are written only by
-- /api/profile (admin setting the frequency) and /api/cron/progress-reminders
-- (cron marking a reminder as sent).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS progress_reminder_days INTEGER,
  ADD COLUMN IF NOT EXISTS last_progress_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.progress_reminder_days IS
  'Frecuencia del recordatorio de progreso, en días. NULL = sin recordatorio.';
COMMENT ON COLUMN public.profiles.last_progress_reminder_at IS
  'Timestamp del último push de recordatorio enviado por el cron.';

-- Only index rows where the feature is actually enabled.
-- Keeps the index small — most members will have NULL.
CREATE INDEX IF NOT EXISTS idx_profiles_progress_reminder_days
  ON public.profiles (progress_reminder_days)
  WHERE progress_reminder_days IS NOT NULL;
