-- =========================================================================
-- NL VIP CLUB - Migration 3: Schema Fixes (tables with wrong columns)
-- 20260412000003_schema_fixes.sql
-- SAFE: Only additive ALTER TABLE. No DROP TABLE, no data loss.
-- =========================================================================

-- =========================================================================
-- PART 1: PROGRESS_PHOTOS
-- master-schema.sql has front_url/back_url/side_url
-- ProgressPhotos.jsx uses photo_url, photo_type, group_id, notes
-- =========================================================================

ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS photo_url   TEXT;
ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS photo_type  TEXT; -- 'front', 'back', 'side'
ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS group_id    UUID; -- groups 3 photos per session
ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS notes       TEXT;

CREATE INDEX IF NOT EXISTS idx_progress_photos_member   ON progress_photos(member_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_group    ON progress_photos(group_id);

-- Update RLS to allow trainer view
DROP POLICY IF EXISTS "Premium users manage own photos"        ON progress_photos;
DROP POLICY IF EXISTS "Trainers view assigned member photos"   ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_member_policy"         ON progress_photos;

CREATE POLICY "Members manage own photos" ON progress_photos FOR ALL
  USING (member_id = (SELECT auth.uid()))
  WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY "Trainers view member photos" ON progress_photos FOR SELECT
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = progress_photos.member_id)
  );

-- =========================================================================
-- PART 2: CYCLE_SYMPTOMS
-- master-schema.sql has symptom_type / severity (old single-row schema)
-- SymptomsTracker.jsx uses energy_level, mood, pain_level, pain_locations[],
--   flow_intensity, extra_symptoms[] (one row per day with all fields)
-- =========================================================================

ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS energy_level   INTEGER CHECK (energy_level BETWEEN 1 AND 5);
ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS mood           TEXT;
ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS pain_level     INTEGER DEFAULT 0 CHECK (pain_level BETWEEN 0 AND 5);
ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS pain_locations TEXT[]  DEFAULT '{}';
ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS flow_intensity TEXT;
ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS extra_symptoms TEXT[]  DEFAULT '{}';

-- =========================================================================
-- PART 3: MEMBER_RECIPE_PLANS
-- master-schema.sql: week_start_date, no trainer_id/status/targets
-- RecipePlan.jsx inserts: week_start, trainer_id, diet_template_id,
--   status, target_calories, target_protein_g, target_carbs_g, target_fat_g
-- =========================================================================

ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS week_start        DATE;
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS trainer_id        UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS diet_template_id  UUID REFERENCES diet_templates(id) ON DELETE SET NULL;
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS target_calories   INTEGER;
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS target_protein_g  NUMERIC(6,2);
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS target_carbs_g    NUMERIC(6,2);
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS target_fat_g      NUMERIC(6,2);
ALTER TABLE member_recipe_plans ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Back-fill week_start from week_start_date for existing rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_recipe_plans' AND column_name = 'week_start_date') THEN
    EXECUTE 'UPDATE member_recipe_plans SET week_start = week_start_date WHERE week_start IS NULL';
  END IF;
END $$;

-- Unique active plan per member per week
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_recipe_plans_active
  ON member_recipe_plans(member_id, week_start) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_member_recipe_plans_trainer ON member_recipe_plans(trainer_id);
CREATE INDEX IF NOT EXISTS idx_member_recipe_plans_status  ON member_recipe_plans(status);

-- RLS: trainers can manage plans for their assigned members
DROP POLICY IF EXISTS "Premium manage own recipe plans"      ON member_recipe_plans;
DROP POLICY IF EXISTS "plans_select_own_or_assigned"         ON member_recipe_plans;
DROP POLICY IF EXISTS "plans_insert_trainer_admin"           ON member_recipe_plans;
DROP POLICY IF EXISTS "plans_update_trainer_admin"           ON member_recipe_plans;
DROP POLICY IF EXISTS "plans_delete_trainer_admin"           ON member_recipe_plans;

CREATE POLICY "recipe_plans_select" ON member_recipe_plans FOR SELECT USING (
  member_id = (SELECT auth.uid()) OR
  trainer_id = (SELECT auth.uid()) OR
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_recipe_plans.member_id)
);

CREATE POLICY "recipe_plans_insert" ON member_recipe_plans FOR INSERT WITH CHECK (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_recipe_plans.member_id)
);

CREATE POLICY "recipe_plans_update" ON member_recipe_plans FOR UPDATE USING (
  trainer_id = (SELECT auth.uid()) OR is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_recipe_plans.member_id)
);

CREATE POLICY "recipe_plans_delete" ON member_recipe_plans FOR DELETE USING (
  trainer_id = (SELECT auth.uid()) OR is_admin()
);

-- =========================================================================
-- PART 4: MEMBER_RECIPE_PLAN_ITEMS
-- master-schema.sql: day_of_week, meal_type (no notes, references recipe_catalog)
-- RecipePlan.jsx inserts: day_index, meal_slot, notes; recipe_id from recipes table
-- =========================================================================

ALTER TABLE member_recipe_plan_items ADD COLUMN IF NOT EXISTS day_index  INTEGER;
ALTER TABLE member_recipe_plan_items ADD COLUMN IF NOT EXISTS meal_slot  TEXT;
ALTER TABLE member_recipe_plan_items ADD COLUMN IF NOT EXISTS notes      TEXT;

-- Back-fill day_index from day_of_week for existing rows (same meaning, different name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_recipe_plan_items' AND column_name = 'day_of_week') THEN
    EXECUTE 'UPDATE member_recipe_plan_items SET day_index = day_of_week WHERE day_index IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_recipe_plan_items' AND column_name = 'meal_type') THEN
    EXECUTE 'UPDATE member_recipe_plan_items SET meal_slot = meal_type WHERE meal_slot IS NULL';
  END IF;
END $$;

-- Fix FK: switch recipe_id reference from recipe_catalog to recipes
DO $$
BEGIN
  -- Drop old FK to recipe_catalog if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'member_recipe_plan_items'
      AND constraint_name = 'member_recipe_plan_items_recipe_id_fkey'
  ) THEN
    ALTER TABLE member_recipe_plan_items DROP CONSTRAINT member_recipe_plan_items_recipe_id_fkey;
  END IF;
END $$;

-- Unique index on new column names (in addition to old day_of_week/meal_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_items_day_slot
  ON member_recipe_plan_items(plan_id, day_index, meal_slot);

-- Update RLS
DROP POLICY IF EXISTS "Premium manage own recipe items"   ON member_recipe_plan_items;
DROP POLICY IF EXISTS "items_select"                      ON member_recipe_plan_items;
DROP POLICY IF EXISTS "items_insert"                      ON member_recipe_plan_items;
DROP POLICY IF EXISTS "items_update"                      ON member_recipe_plan_items;
DROP POLICY IF EXISTS "items_delete"                      ON member_recipe_plan_items;

CREATE POLICY "recipe_items_select" ON member_recipe_plan_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM member_recipe_plans p
    WHERE p.id = member_recipe_plan_items.plan_id
      AND (
        p.member_id = (SELECT auth.uid()) OR
        p.trainer_id = (SELECT auth.uid()) OR
        is_admin() OR
        EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = p.member_id)
      )
  )
);

CREATE POLICY "recipe_items_insert" ON member_recipe_plan_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM member_recipe_plans p
    WHERE p.id = member_recipe_plan_items.plan_id
      AND (
        p.trainer_id = (SELECT auth.uid()) OR is_admin() OR
        EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = p.member_id)
      )
  )
);

CREATE POLICY "recipe_items_update" ON member_recipe_plan_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM member_recipe_plans p
    WHERE p.id = member_recipe_plan_items.plan_id
      AND (p.trainer_id = (SELECT auth.uid()) OR is_admin())
  )
);

CREATE POLICY "recipe_items_delete" ON member_recipe_plan_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM member_recipe_plans p
    WHERE p.id = member_recipe_plan_items.plan_id
      AND (p.trainer_id = (SELECT auth.uid()) OR is_admin())
  )
);

-- =========================================================================
-- PART 5: DAILY_ACTIVITY
-- master-schema.sql: no distance_km / calories_kcal
-- rpc_get_activity_history and rpc_get_member_activity reference both
-- =========================================================================

ALTER TABLE daily_activity ADD COLUMN IF NOT EXISTS distance_km   NUMERIC(8,3) DEFAULT 0;
ALTER TABLE daily_activity ADD COLUMN IF NOT EXISTS calories_kcal INTEGER       DEFAULT 0;
