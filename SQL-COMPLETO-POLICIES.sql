-- =============================================
-- SCRIPT COMPLETO: ELIMINAR Y RECREAR TODAS LAS POLÍTICAS
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- ============================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ============================================

-- Profiles
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON profiles;
DROP POLICY IF EXISTS "Trainers view assigned members" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Trainers can view their members" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can insert profile" ON profiles;

-- Workout Templates
DROP POLICY IF EXISTS "Admins full access workout_templates" ON workout_templates;
DROP POLICY IF EXISTS "Trainers manage own workouts" ON workout_templates;
DROP POLICY IF EXISTS "Members view assigned workouts" ON workout_templates;
DROP POLICY IF EXISTS "Trainers can manage their workouts" ON workout_templates;
DROP POLICY IF EXISTS "Members can view assigned workouts" ON workout_templates;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON workout_templates;

-- Workout Days
DROP POLICY IF EXISTS "Admins full access workout_days" ON workout_days;
DROP POLICY IF EXISTS "Trainers manage own workout_days" ON workout_days;
DROP POLICY IF EXISTS "Members view assigned workout_days" ON workout_days;
DROP POLICY IF EXISTS "Trainers can manage their workout days" ON workout_days;
DROP POLICY IF EXISTS "Members can view assigned workout days" ON workout_days;

-- Workout Exercises
DROP POLICY IF EXISTS "Admins full access workout_exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Trainers manage own exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Members view assigned exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Trainers can manage exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Members can view assigned exercises" ON workout_exercises;

-- Diet Templates
DROP POLICY IF EXISTS "Admins full access diet_templates" ON diet_templates;
DROP POLICY IF EXISTS "Trainers manage own diets" ON diet_templates;
DROP POLICY IF EXISTS "Members view assigned diets" ON diet_templates;
DROP POLICY IF EXISTS "Trainers can manage their diets" ON diet_templates;
DROP POLICY IF EXISTS "Members can view assigned diets" ON diet_templates;

-- Member Workouts
DROP POLICY IF EXISTS "Admins full access member_workouts" ON member_workouts;
DROP POLICY IF EXISTS "Trainers manage member_workouts" ON member_workouts;
DROP POLICY IF EXISTS "Members view own workout assignments" ON member_workouts;
DROP POLICY IF EXISTS "Trainers can assign workouts" ON member_workouts;
DROP POLICY IF EXISTS "Members can view own assignments" ON member_workouts;

-- Member Diets
DROP POLICY IF EXISTS "Admins full access member_diets" ON member_diets;
DROP POLICY IF EXISTS "Trainers manage member_diets" ON member_diets;
DROP POLICY IF EXISTS "Members view own diet assignments" ON member_diets;
DROP POLICY IF EXISTS "Trainers can assign diets" ON member_diets;
DROP POLICY IF EXISTS "Members can view own diet" ON member_diets;

-- Challenges
DROP POLICY IF EXISTS "Anyone can view challenges" ON challenges;
DROP POLICY IF EXISTS "Admins full access challenges" ON challenges;
DROP POLICY IF EXISTS "Trainers create challenges" ON challenges;
DROP POLICY IF EXISTS "Enable read access for all" ON challenges;
DROP POLICY IF EXISTS "Admins can manage challenges" ON challenges;

-- Challenge Participants
DROP POLICY IF EXISTS "Anyone view challenge_participants" ON challenge_participants;
DROP POLICY IF EXISTS "Members join challenges" ON challenge_participants;
DROP POLICY IF EXISTS "Members update own progress" ON challenge_participants;
DROP POLICY IF EXISTS "Admins full access challenge_participants" ON challenge_participants;
DROP POLICY IF EXISTS "Enable read for all" ON challenge_participants;
DROP POLICY IF EXISTS "Members can join" ON challenge_participants;

-- Feed Posts
DROP POLICY IF EXISTS "Anyone view feed_posts" ON feed_posts;
DROP POLICY IF EXISTS "Users create own posts" ON feed_posts;
DROP POLICY IF EXISTS "Users manage own posts" ON feed_posts;
DROP POLICY IF EXISTS "Users delete own posts" ON feed_posts;
DROP POLICY IF EXISTS "Admins delete any post" ON feed_posts;
DROP POLICY IF EXISTS "Enable read access for all" ON feed_posts;
DROP POLICY IF EXISTS "Users can create posts" ON feed_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON feed_posts;

-- Feed Likes
DROP POLICY IF EXISTS "Anyone can view likes" ON feed_likes;
DROP POLICY IF EXISTS "Users can like" ON feed_likes;
DROP POLICY IF EXISTS "Users can unlike" ON feed_likes;

-- Feed Comments
DROP POLICY IF EXISTS "Anyone can view comments" ON feed_comments;
DROP POLICY IF EXISTS "Users can comment" ON feed_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON feed_comments;

-- Progress Photos
DROP POLICY IF EXISTS "Members view own progress_photos" ON progress_photos;
DROP POLICY IF EXISTS "Members upload own progress_photos" ON progress_photos;
DROP POLICY IF EXISTS "Admins view all progress_photos" ON progress_photos;
DROP POLICY IF EXISTS "Members can view own photos" ON progress_photos;
DROP POLICY IF EXISTS "Members can upload photos" ON progress_photos;
DROP POLICY IF EXISTS "Only admins can view all" ON progress_photos;

-- Progress Records
DROP POLICY IF EXISTS "Members view own records" ON progress_records;
DROP POLICY IF EXISTS "Members insert own records" ON progress_records;
DROP POLICY IF EXISTS "Trainers view member records" ON progress_records;

-- Trainer Members
DROP POLICY IF EXISTS "Admins full access trainer_members" ON trainer_members;
DROP POLICY IF EXISTS "Trainers view own assignments" ON trainer_members;
DROP POLICY IF EXISTS "Members view own trainer" ON trainer_members;
DROP POLICY IF EXISTS "Enable read for trainers" ON trainer_members;
DROP POLICY IF EXISTS "Enable read for members" ON trainer_members;

-- Daily Activity
DROP POLICY IF EXISTS "Users view own activity" ON daily_activity;
DROP POLICY IF EXISTS "Users insert own activity" ON daily_activity;
DROP POLICY IF EXISTS "Users update own activity" ON daily_activity;
DROP POLICY IF EXISTS "Staff view member activity" ON daily_activity;
DROP POLICY IF EXISTS "Users can view own activity" ON daily_activity;
DROP POLICY IF EXISTS "Users can insert activity" ON daily_activity;

-- Food Logs
DROP POLICY IF EXISTS "Users view own food_logs" ON food_logs;
DROP POLICY IF EXISTS "Users insert own food_logs" ON food_logs;
DROP POLICY IF EXISTS "Users delete own food_logs" ON food_logs;
DROP POLICY IF EXISTS "Users can view own logs" ON food_logs;
DROP POLICY IF EXISTS "Users can insert logs" ON food_logs;

-- Invitation Codes
DROP POLICY IF EXISTS "Anyone can read codes" ON invitation_codes;
DROP POLICY IF EXISTS "Admins manage invitation_codes" ON invitation_codes;
DROP POLICY IF EXISTS "Update code usage on register" ON invitation_codes;
DROP POLICY IF EXISTS "Enable read for all" ON invitation_codes;
DROP POLICY IF EXISTS "Admins can manage codes" ON invitation_codes;

-- Recipes
DROP POLICY IF EXISTS "Anyone can view recipes" ON recipes;
DROP POLICY IF EXISTS "Staff can manage recipes" ON recipes;

-- Training Videos
DROP POLICY IF EXISTS "Anyone can view training_videos" ON training_videos;
DROP POLICY IF EXISTS "Staff can manage training_videos" ON training_videos;

-- ============================================
-- PASO 2: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Estas tablas pueden no existir, ignorar errores
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_videos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 3: CREAR NUEVAS POLÍTICAS
-- ============================================

-- ==================== PROFILES ====================

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins view all profiles"
ON profiles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update all profiles"
ON profiles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers view their members"
ON profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = profiles.id AND tm.trainer_id = auth.uid()
  )
);

-- ==================== WORKOUT_TEMPLATES ====================

CREATE POLICY "Admins full access workout_templates"
ON workout_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers manage own workouts"
ON workout_templates FOR ALL TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "Members view assigned workouts"
ON workout_templates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_templates.id AND mw.member_id = auth.uid()
  )
);

-- ==================== WORKOUT_DAYS ====================

CREATE POLICY "Admins full access workout_days"
ON workout_days FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers manage workout_days"
ON workout_days FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = workout_days.workout_template_id AND wt.trainer_id = auth.uid()
  )
);

CREATE POLICY "Members view assigned workout_days"
ON workout_days FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_days.workout_template_id AND mw.member_id = auth.uid()
  )
);

-- ==================== WORKOUT_EXERCISES ====================

CREATE POLICY "Admins full access workout_exercises"
ON workout_exercises FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers manage exercises"
ON workout_exercises FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN workout_templates wt ON wt.id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id AND wt.trainer_id = auth.uid()
  )
);

CREATE POLICY "Members view assigned exercises"
ON workout_exercises FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN member_workouts mw ON mw.workout_template_id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id AND mw.member_id = auth.uid()
  )
);

-- ==================== DIET_TEMPLATES ====================

CREATE POLICY "Admins full access diet_templates"
ON diet_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers manage own diets"
ON diet_templates FOR ALL TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "Members view assigned diets"
ON diet_templates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_diets md
    WHERE md.diet_template_id = diet_templates.id AND md.member_id = auth.uid()
  )
);

-- ==================== MEMBER_WORKOUTS ====================

CREATE POLICY "Admins full access member_workouts"
ON member_workouts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers manage member_workouts"
ON member_workouts FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = member_workouts.member_id AND tm.trainer_id = auth.uid()
  )
);

CREATE POLICY "Members view own workout assignments"
ON member_workouts FOR SELECT TO authenticated
USING (member_id = auth.uid());

-- ==================== MEMBER_DIETS ====================

CREATE POLICY "Admins full access member_diets"
ON member_diets FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers manage member_diets"
ON member_diets FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = member_diets.member_id AND tm.trainer_id = auth.uid()
  )
);

CREATE POLICY "Members view own diet assignments"
ON member_diets FOR SELECT TO authenticated
USING (member_id = auth.uid());

-- ==================== CHALLENGES ====================

CREATE POLICY "Anyone view challenges"
ON challenges FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins full access challenges"
ON challenges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers create challenges"
ON challenges FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'));

-- ==================== CHALLENGE_PARTICIPANTS ====================

CREATE POLICY "Anyone view challenge_participants"
ON challenge_participants FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Members join challenges"
ON challenge_participants FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members update own progress"
ON challenge_participants FOR UPDATE TO authenticated
USING (member_id = auth.uid());

CREATE POLICY "Admins full access challenge_participants"
ON challenge_participants FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ==================== FEED_POSTS ====================

CREATE POLICY "Anyone view feed_posts"
ON feed_posts FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users create own posts"
ON feed_posts FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users update own posts"
ON feed_posts FOR UPDATE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Users delete own posts"
ON feed_posts FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Admins delete any post"
ON feed_posts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ==================== PROGRESS_PHOTOS ====================

CREATE POLICY "Members view own progress_photos"
ON progress_photos FOR SELECT TO authenticated
USING (member_id = auth.uid());

CREATE POLICY "Members upload progress_photos"
ON progress_photos FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

CREATE POLICY "Admins view all progress_photos"
ON progress_photos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ==================== TRAINER_MEMBERS ====================

CREATE POLICY "Admins full access trainer_members"
ON trainer_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Trainers view own assignments"
ON trainer_members FOR SELECT TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "Members view own trainer"
ON trainer_members FOR SELECT TO authenticated
USING (member_id = auth.uid());

-- ==================== DAILY_ACTIVITY ====================

CREATE POLICY "Users view own activity"
ON daily_activity FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own activity"
ON daily_activity FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own activity"
ON daily_activity FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff view member activity"
ON daily_activity FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- ==================== FOOD_LOGS ====================

CREATE POLICY "Users view own food_logs"
ON food_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own food_logs"
ON food_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own food_logs"
ON food_logs FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ==================== INVITATION_CODES ====================

CREATE POLICY "Anyone read invitation_codes"
ON invitation_codes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage invitation_codes"
ON invitation_codes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone update invitation_codes"
ON invitation_codes FOR UPDATE TO authenticated
USING (true);

-- =============================================
-- FIN DEL SCRIPT DE POLÍTICAS DE TABLAS
-- =============================================
