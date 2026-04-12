-- =========================================================================
-- NL VIP CLUB - Migration 1: Missing Tables & Schema Fixes
-- 20260412000001_missing_tables.sql
-- SAFE: Only additive (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
-- No data loss, no DROP TABLE, no DELETE.
-- =========================================================================

-- =========================================================================
-- PART 1: REAL-TIME CHAT TABLES
-- (Used in FloatingChat.jsx and admin-delete-user route)
-- =========================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text        NOT NULL DEFAULT 'trainer_member',
  created_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id              uuid   DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid   NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid   NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  text            text,
  type            text        NOT NULL DEFAULT 'text',
  audio_path      text,
  image_path      text,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_created_by    ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv      ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user      ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation       ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender            ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created           ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread            ON messages(conversation_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;

-- conversations: participants see their own, admins see all
DROP POLICY IF EXISTS "Participants see own conversations"  ON conversations;
DROP POLICY IF EXISTS "Admins see all conversations"        ON conversations;
CREATE POLICY "Participants see own conversations" ON conversations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = (SELECT auth.uid())
  )
);
CREATE POLICY "Admins see all conversations" ON conversations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- conversation_participants: users see own, admins all
DROP POLICY IF EXISTS "Users see own participations"  ON conversation_participants;
DROP POLICY IF EXISTS "Admins see all participations" ON conversation_participants;
CREATE POLICY "Users see own participations" ON conversation_participants FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM conversation_participants cp2 WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = (SELECT auth.uid())) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "Admins see all participations" ON conversation_participants FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- messages: participants see messages in their conversations
DROP POLICY IF EXISTS "Participants see conversation messages" ON messages;
DROP POLICY IF EXISTS "Participants send messages"            ON messages;
DROP POLICY IF EXISTS "Participants update read status"       ON messages;
CREATE POLICY "Participants see conversation messages" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (SELECT auth.uid())
  ) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "Participants send messages" ON messages FOR INSERT WITH CHECK (
  sender_id = (SELECT auth.uid()) AND
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (SELECT auth.uid())
  )
);
CREATE POLICY "Participants update read status" ON messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (SELECT auth.uid())
  )
);

-- =========================================================================
-- PART 2: DIET ONBOARDING REQUESTS
-- (Used in TrainerDashboard, AdminDashboard, diet-onboarding API routes)
-- =========================================================================

CREATE TABLE IF NOT EXISTS diet_onboarding_requests (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'pending',
  responses       jsonb,
  generated_diet_id uuid,
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_diet_onboarding_member ON diet_onboarding_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_diet_onboarding_status ON diet_onboarding_requests(status);

ALTER TABLE diet_onboarding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see own requests"        ON diet_onboarding_requests;
DROP POLICY IF EXISTS "Staff manage onboarding requests" ON diet_onboarding_requests;
CREATE POLICY "Members see own requests" ON diet_onboarding_requests FOR SELECT USING (
  member_id = (SELECT auth.uid()) OR requested_by = (SELECT auth.uid())
);
CREATE POLICY "Staff manage onboarding requests" ON diet_onboarding_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
  OR member_id = (SELECT auth.uid())
);

-- =========================================================================
-- PART 3: MACRO GOALS
-- (Used in adminAssistantTools.js and admin-delete-user)
-- =========================================================================

CREATE TABLE IF NOT EXISTS macro_goals (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calories    integer,
  protein_g   numeric(6,1),
  carbs_g     numeric(6,1),
  fat_g       numeric(6,1),
  assigned_by uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(member_id)
);

CREATE INDEX IF NOT EXISTS idx_macro_goals_member ON macro_goals(member_id);

ALTER TABLE macro_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own macros"       ON macro_goals;
DROP POLICY IF EXISTS "Users manage own macros"     ON macro_goals;
DROP POLICY IF EXISTS "Staff manage member macros"  ON macro_goals;
CREATE POLICY "Users view own macros" ON macro_goals FOR SELECT USING (
  member_id = (SELECT auth.uid())
);
CREATE POLICY "Users manage own macros" ON macro_goals FOR ALL WITH CHECK (
  member_id = (SELECT auth.uid())
);
CREATE POLICY "Staff manage member macros" ON macro_goals FOR ALL USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = macro_goals.member_id)
);

-- =========================================================================
-- PART 4: MEMBER PRs (Personal Records)
-- (Used in api/member-prs/route.js and admin-delete-user)
-- =========================================================================

CREATE TABLE IF NOT EXISTS member_prs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_name text        NOT NULL,
  weight_kg     numeric(6,2),
  reps          integer,
  date          date        NOT NULL DEFAULT CURRENT_DATE,
  estimated_1rm numeric(6,2),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_prs_member   ON member_prs(member_id);
CREATE INDEX IF NOT EXISTS idx_member_prs_exercise ON member_prs(exercise_name);
CREATE INDEX IF NOT EXISTS idx_member_prs_date     ON member_prs(date DESC);

ALTER TABLE member_prs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own prs"    ON member_prs;
DROP POLICY IF EXISTS "Staff view member prs"   ON member_prs;
CREATE POLICY "Users manage own prs" ON member_prs FOR ALL
  USING (member_id = (SELECT auth.uid())) WITH CHECK (member_id = (SELECT auth.uid()));
CREATE POLICY "Staff view member prs" ON member_prs FOR SELECT USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = member_prs.member_id)
);

-- =========================================================================
-- PART 5: GAMIFICATION (challenges, badges)
-- (Defined in FASE3-RETOS-BADGES.sql but missing from current migrations)
-- NOTE: Code uses these names, NOT system_challenges/member_challenges
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE challenge_type AS ENUM ('workouts', 'weight', 'consistency');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE badge_condition_type AS ENUM ('workouts_count', 'streak', 'challenge_completed', 'first_workout', 'weight_goal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS challenges (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text        NOT NULL,
  description  text,
  type         text        NOT NULL DEFAULT 'workouts',
  target_value numeric     NOT NULL DEFAULT 10,
  start_date   date        NOT NULL DEFAULT CURRENT_DATE,
  end_date     date        NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  created_by   uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  is_active    boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  progress_value numeric   DEFAULT 0,
  completed    boolean     DEFAULT false,
  completed_at timestamptz,
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(challenge_id, member_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text        NOT NULL,
  description     text,
  icon            text        NOT NULL DEFAULT 'trophy',
  color           text        DEFAULT 'gold',
  condition_type  text        NOT NULL,
  condition_value integer     NOT NULL DEFAULT 1,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id   uuid        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  member_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(badge_id, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_challenges_active             ON challenges(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_member ON challenge_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_ch     ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_member           ON user_badges(member_id);

-- RLS
ALTER TABLE challenges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select_active"         ON challenges;
DROP POLICY IF EXISTS "challenges_insert_admin_trainer"  ON challenges;
DROP POLICY IF EXISTS "challenges_update_own"            ON challenges;
DROP POLICY IF EXISTS "challenges_delete_own"            ON challenges;
CREATE POLICY "challenges_select_active" ON challenges FOR SELECT USING (
  is_active = true OR created_by = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "challenges_insert_admin_trainer" ON challenges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "challenges_update_own" ON challenges FOR UPDATE USING (
  created_by = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "challenges_delete_own" ON challenges FOR DELETE USING (
  created_by = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "participants_select"      ON challenge_participants;
DROP POLICY IF EXISTS "participants_insert_self" ON challenge_participants;
DROP POLICY IF EXISTS "participants_update_self" ON challenge_participants;
CREATE POLICY "participants_select" ON challenge_participants FOR SELECT USING (
  member_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "participants_insert_self" ON challenge_participants FOR INSERT WITH CHECK (
  member_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "participants_update_self" ON challenge_participants FOR UPDATE USING (
  member_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);

DROP POLICY IF EXISTS "badges_select_all"   ON badges;
DROP POLICY IF EXISTS "badges_insert_admin" ON badges;
DROP POLICY IF EXISTS "badges_update_admin" ON badges;
CREATE POLICY "badges_select_all"   ON badges FOR SELECT USING (true);
CREATE POLICY "badges_insert_admin" ON badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "badges_update_admin" ON badges FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "user_badges_select" ON user_badges;
DROP POLICY IF EXISTS "user_badges_insert" ON user_badges;
CREATE POLICY "user_badges_select" ON user_badges FOR SELECT USING (
  member_id = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "user_badges_insert" ON user_badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
  OR member_id = (SELECT auth.uid())
);

-- =========================================================================
-- PART 6: WORKOUT STRUCTURE (days & exercises)
-- =========================================================================

CREATE TABLE IF NOT EXISTS workout_days (
  id                   uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_template_id  uuid    REFERENCES workout_templates(id) ON DELETE CASCADE,
  day_number           integer NOT NULL,
  name                 varchar(100) NOT NULL,
  description          text,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_day_id  uuid         REFERENCES workout_days(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL,
  description     text,
  sets            integer      DEFAULT 3,
  reps            varchar(20)  DEFAULT '10',
  rest_seconds    integer      DEFAULT 90,
  video_url       text,
  video_thumbnail text,
  order_index     integer      DEFAULT 0,
  created_at      timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_days_template  ON workout_days(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_day  ON workout_exercises(workout_day_id);

ALTER TABLE workout_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers manage workout days"        ON workout_days;
DROP POLICY IF EXISTS "Members view assigned workout days"  ON workout_days;
CREATE POLICY "Trainers manage workout days" ON workout_days FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = workout_days.workout_template_id
    AND (wt.trainer_id = (SELECT auth.uid()) OR is_admin())
  )
);
CREATE POLICY "Members view assigned workout days" ON workout_days FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_days.workout_template_id
    AND mw.member_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Trainers manage exercises"       ON workout_exercises;
DROP POLICY IF EXISTS "Members view assigned exercises" ON workout_exercises;
CREATE POLICY "Trainers manage exercises" ON workout_exercises FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN workout_templates wt ON wt.id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id
    AND (wt.trainer_id = (SELECT auth.uid()) OR is_admin())
  )
);
CREATE POLICY "Members view assigned exercises" ON workout_exercises FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN member_workouts mw ON mw.workout_template_id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id
    AND mw.member_id = (SELECT auth.uid())
  )
);

-- =========================================================================
-- PART 7: TRAINING VIDEOS (with admin approval workflow)
-- =========================================================================

CREATE TABLE IF NOT EXISTS training_videos (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text        NOT NULL,
  description  text,
  video_url    text        NOT NULL,
  thumbnail_url text,
  uploaded_by  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_approved  boolean     NOT NULL DEFAULT false,
  approved_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_videos_uploaded ON training_videos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_training_videos_approved ON training_videos(is_approved);

ALTER TABLE training_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see approved training videos"    ON training_videos;
DROP POLICY IF EXISTS "Trainers upload training videos"       ON training_videos;
DROP POLICY IF EXISTS "Admin approves training videos"        ON training_videos;
DROP POLICY IF EXISTS "Admin deletes training videos"         ON training_videos;
CREATE POLICY "Users see approved training videos" ON training_videos FOR SELECT TO authenticated USING (
  is_approved = true OR uploaded_by = (SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "Trainers upload training videos" ON training_videos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "Admin approves training videos" ON training_videos FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY "Admin deletes training videos" ON training_videos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- =========================================================================
-- PART 8: ADMIN ASSISTANT ACTION LOGS
-- =========================================================================

CREATE TABLE IF NOT EXISTS admin_assistant_action_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid        REFERENCES admin_assistant_conversations(id) ON DELETE SET NULL,
  message_id      uuid        REFERENCES admin_assistant_messages(id) ON DELETE SET NULL,
  action_type     text        NOT NULL,
  action_params   jsonb       NOT NULL DEFAULT '{}',
  target_entities jsonb,
  result          jsonb,
  success         boolean     NOT NULL DEFAULT true,
  error_message   text,
  executed_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_admin  ON admin_assistant_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON admin_assistant_action_logs(action_type);

ALTER TABLE admin_assistant_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_action_logs_policy" ON admin_assistant_action_logs;
CREATE POLICY "admin_action_logs_policy" ON admin_assistant_action_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- =========================================================================
-- PART 9: RECIPES catalog
-- (RecipesManager.jsx uses 'recipes', separate from 'recipe_catalog')
-- =========================================================================

CREATE TABLE IF NOT EXISTS recipes (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text        NOT NULL,
  description      text,
  instructions     text,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings         integer     DEFAULT 1,
  calories         integer,
  protein_g        numeric(6,2),
  carbs_g          numeric(6,2),
  fat_g            numeric(6,2),
  image_url        text,
  category         text,
  is_global        boolean     DEFAULT true,
  created_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_category   ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_global     ON recipes(is_global);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipes_select_all"            ON recipes;
DROP POLICY IF EXISTS "recipes_insert_admin_trainer"  ON recipes;
DROP POLICY IF EXISTS "recipes_update_admin_trainer"  ON recipes;
DROP POLICY IF EXISTS "recipes_delete_admin"          ON recipes;
CREATE POLICY "recipes_select_all" ON recipes FOR SELECT USING (true);
CREATE POLICY "recipes_insert_admin_trainer" ON recipes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "recipes_update_admin_trainer" ON recipes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);
CREATE POLICY "recipes_delete_admin" ON recipes FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin') OR
  created_by = (SELECT auth.uid())
);

-- diet_recipes: links between diet templates and recipes
CREATE TABLE IF NOT EXISTS diet_recipes (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  diet_template_id uuid        REFERENCES diet_templates(id) ON DELETE CASCADE,
  recipe_id        uuid        REFERENCES recipes(id) ON DELETE CASCADE,
  meal_slot        text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(diet_template_id, recipe_id)
);

ALTER TABLE diet_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diet_recipes_select_all"            ON diet_recipes;
DROP POLICY IF EXISTS "diet_recipes_insert_admin_trainer"  ON diet_recipes;
CREATE POLICY "diet_recipes_select_all" ON diet_recipes FOR SELECT USING (true);
CREATE POLICY "diet_recipes_insert_admin_trainer" ON diet_recipes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'trainer'))
);

-- =========================================================================
-- PART 10: SCHEMA FIXES
-- =========================================================================

-- cycle_symptoms: code uses user_id, master-schema created member_id
ALTER TABLE cycle_symptoms ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
UPDATE cycle_symptoms SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL;

-- Add unique index on (user_id, date) if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_cycle_symptoms_user_date ON cycle_symptoms(user_id, date);

-- Update RLS to allow user_id
DROP POLICY IF EXISTS "Premium users manage cycle symptoms"    ON cycle_symptoms;
DROP POLICY IF EXISTS "Users can manage own symptoms"          ON cycle_symptoms;
CREATE POLICY "Users manage own cycle symptoms" ON cycle_symptoms FOR ALL USING (
  user_id = (SELECT auth.uid()) OR member_id = (SELECT auth.uid())
) WITH CHECK (
  user_id = (SELECT auth.uid()) OR member_id = (SELECT auth.uid())
);

-- lactation_sessions: add user_id + detailed columns
ALTER TABLE lactation_sessions ADD COLUMN IF NOT EXISTS user_id        uuid  REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE lactation_sessions ADD COLUMN IF NOT EXISTS session_type   text  DEFAULT 'breastfeed';
ALTER TABLE lactation_sessions ADD COLUMN IF NOT EXISTS breast_side    text;
ALTER TABLE lactation_sessions ADD COLUMN IF NOT EXISTS start_time     timestamptz DEFAULT now();
ALTER TABLE lactation_sessions ADD COLUMN IF NOT EXISTS end_time       timestamptz;
ALTER TABLE lactation_sessions ADD COLUMN IF NOT EXISTS amount_ml      integer;
UPDATE lactation_sessions SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL;

-- Update RLS
DROP POLICY IF EXISTS "Premium users manage lactation"      ON lactation_sessions;
DROP POLICY IF EXISTS "Users can manage own lactation sessions" ON lactation_sessions;
CREATE POLICY "Users manage own lactation sessions" ON lactation_sessions FOR ALL USING (
  user_id = (SELECT auth.uid()) OR member_id = (SELECT auth.uid())
) WITH CHECK (
  user_id = (SELECT auth.uid()) OR member_id = (SELECT auth.uid())
);

-- =========================================================================
-- PART 11: STORAGE BUCKETS
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat_images', 'chat_images', true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('chat_audios', 'chat_audios', false, 10485760, ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: chat_images
DROP POLICY IF EXISTS "Chat images read public"   ON storage.objects;
DROP POLICY IF EXISTS "Chat images upload auth"   ON storage.objects;
CREATE POLICY "Chat images read public" ON storage.objects FOR SELECT USING (bucket_id = 'chat_images');
CREATE POLICY "Chat images upload auth" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat_images' AND auth.uid() IS NOT NULL
);

-- Storage policies: chat_audios (only admin can upload voice messages)
DROP POLICY IF EXISTS "Chat audios read participants" ON storage.objects;
DROP POLICY IF EXISTS "Chat audios upload admin"      ON storage.objects;
CREATE POLICY "Chat audios read participants" ON storage.objects FOR SELECT USING (
  bucket_id = 'chat_audios' AND auth.uid() IS NOT NULL
);
CREATE POLICY "Chat audios upload admin" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat_audios' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);
