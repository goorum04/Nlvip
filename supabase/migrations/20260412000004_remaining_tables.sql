-- =========================================================================
-- NL VIP CLUB - Migration 4: Remaining Missing Tables & Column Fixes
-- 20260412000004_remaining_tables.sql
-- SAFE: Only additive. No data loss.
-- =========================================================================

-- =========================================================================
-- PART 1: FEED_REPORTS — missing item_id column
-- admin-delete-user deletes by item_id when removing user's posts
-- =========================================================================

ALTER TABLE feed_reports ADD COLUMN IF NOT EXISTS item_id UUID;

-- =========================================================================
-- PART 2: TRAINER_NOTICES — missing priority column
-- rpc_create_notice inserts with priority field
-- =========================================================================

ALTER TABLE trainer_notices ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high'));

-- =========================================================================
-- PART 3: MEMBER_GOALS
-- Used in admin-delete-user; defined in legacy COPIAR-ESTE-SQL.sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS member_goals (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id      uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  target_calories integer,
  target_protein_g integer,
  target_carbs_g   integer,
  target_fat_g     integer,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_goals_policy" ON member_goals;
CREATE POLICY "member_goals_policy" ON member_goals FOR ALL TO authenticated USING (
  member_id = (SELECT auth.uid()) OR
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_goals.member_id)
);

-- =========================================================================
-- PART 4: WORKOUT_LOGS
-- Used in admin-delete-user; defined in legacy COPIAR-ESTE-SQL.sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS workout_logs (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_template_id uuid        REFERENCES workout_templates(id) ON DELETE CASCADE,
  completed_at        timestamptz DEFAULT now(),
  notes               text
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_member ON workout_logs(member_id);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_logs_policy" ON workout_logs;
CREATE POLICY "workout_logs_policy" ON workout_logs FOR ALL TO authenticated USING (
  member_id = (SELECT auth.uid()) OR
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = workout_logs.member_id)
);

-- =========================================================================
-- PART 5: MACRO_GOAL_HISTORY
-- Only used in admin-delete-user (delete on user removal)
-- =========================================================================

CREATE TABLE IF NOT EXISTS macro_goal_history (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id   uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  changed_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  calories    integer,
  protein_g   numeric(6,1),
  carbs_g     numeric(6,1),
  fat_g       numeric(6,1),
  changed_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_goal_history_member     ON macro_goal_history(member_id);
CREATE INDEX IF NOT EXISTS idx_macro_goal_history_changed_by ON macro_goal_history(changed_by);

ALTER TABLE macro_goal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macro_goal_history_policy" ON macro_goal_history;
CREATE POLICY "macro_goal_history_policy" ON macro_goal_history FOR ALL USING (
  member_id = (SELECT auth.uid()) OR is_admin()
);

-- =========================================================================
-- PART 6: MEMBER_BADGES
-- Used in admin-delete-user. Note: user_badges already exists (migration 1).
-- member_badges may be an older name — create as alias-compatible table.
-- =========================================================================

CREATE TABLE IF NOT EXISTS member_badges (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id   uuid        REFERENCES badges(id) ON DELETE CASCADE,
  member_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(badge_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_badges_member ON member_badges(member_id);

ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_badges_select_all"   ON member_badges;
DROP POLICY IF EXISTS "member_badges_admin_insert" ON member_badges;
DROP POLICY IF EXISTS "member_badges_admin_delete" ON member_badges;
CREATE POLICY "member_badges_select_all" ON member_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_badges_admin_insert" ON member_badges FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_badges.member_id)
);
CREATE POLICY "member_badges_admin_delete" ON member_badges FOR DELETE TO authenticated USING (
  is_admin()
);

-- =========================================================================
-- PART 7: RECIPE_IMAGES storage bucket
-- RecipesManager.jsx uploads to supabase.storage.from('recipe_images')
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recipe_images', 'recipe_images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public          = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "recipe_images_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "recipe_images_staff_upload" ON storage.objects;
DROP POLICY IF EXISTS "recipe_images_staff_delete" ON storage.objects;

CREATE POLICY "recipe_images_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe_images');

CREATE POLICY "recipe_images_staff_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'recipe_images' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

CREATE POLICY "recipe_images_staff_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'recipe_images' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);
