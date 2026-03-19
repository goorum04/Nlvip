-- =============================================================================
-- NL VIP CLUB - COMPLETE SUPABASE DATABASE SETUP
-- =============================================================================
-- This script contains the full schema, expansion, and seed data.
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- =============================================================================
-- 1. CORE SCHEMA (PROFILES & ROLES)
-- =============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'trainer', 'member')),
  avatar_url text,
  phone text,
  has_premium boolean DEFAULT false,
  invitation_code text,
  height_cm integer,
  weight_kg numeric(5,2),
  birth_date date,
  sex text CHECK (sex IN ('male', 'female', 'other')),
  steps_goal integer DEFAULT 8000,
  life_stage text DEFAULT 'cycle',
  due_date date,
  postpartum_date date,
  cycle_enabled boolean DEFAULT false,
  cycle_start_date date,
  cycle_length_days integer DEFAULT 28,
  period_length_days integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =============================================================================
-- 2. INVITATION CODES & ASSIGNMENTS
-- =============================================================================

-- Invitation codes
CREATE TABLE IF NOT EXISTS invitation_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  trainer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  max_uses integer DEFAULT 1,
  current_uses integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Trainer components: Assign members to trainers
CREATE TABLE IF NOT EXISTS trainer_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trainer_id, member_id)
);

-- =============================================================================
-- 3. WORKOUTS & DIETS (TEMPLATES & ASSIGNMENTS)
-- =============================================================================

-- Workout Templates
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  goal_tag text CHECK (goal_tag IN ('fat_loss', 'maintain', 'muscle_gain')),
  level_tag text CHECK (level_tag IN ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz DEFAULT now()
);

-- Workout Days
CREATE TABLE IF NOT EXISTS workout_days (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  name text, -- e.g. "Empuje", "Tirón", "Pierna"
  created_at timestamptz DEFAULT now()
);

-- Workout Exercises
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_day_id uuid REFERENCES workout_days(id) ON DELETE CASCADE,
  name text NOT NULL,
  sets integer,
  reps text,
  rest_seconds integer,
  notes text,
  video_url text,
  order_index integer,
  created_at timestamptz DEFAULT now()
);

-- Member Workout Assignment
CREATE TABLE IF NOT EXISTS member_workouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  workout_template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now()
);

-- Diet Templates
CREATE TABLE IF NOT EXISTS diet_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  content text, -- Detailed plan description
  goal_tag text CHECK (goal_tag IN ('fat_loss', 'maintain', 'muscle_gain')),
  level_tag text CHECK (level_tag IN ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz DEFAULT now()
);

-- Member Diet Assignment
CREATE TABLE IF NOT EXISTS member_diets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  diet_template_id uuid REFERENCES diet_templates(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 4. FEED, PROGRESS & ACTIVITY
-- =============================================================================

-- Feed Posts
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text,
  image_url text,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,
  commenter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Progress Records
CREATE TABLE IF NOT EXISTS progress_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date timestamptz DEFAULT now(),
  weight_kg numeric(5,2),
  chest_cm numeric(5,2),
  waist_cm numeric(5,2),
  hips_cm numeric(5,2),
  arms_cm numeric(5,2),
  legs_cm numeric(5,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Progress Photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Daily Activity (Steps)
CREATE TABLE IF NOT EXISTS daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    steps INT DEFAULT 0,
    distance_km NUMERIC(6,3) DEFAULT 0,
    calories_kcal NUMERIC(6,1) DEFAULT 0,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'device')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_member_date UNIQUE (member_id, activity_date)
);

-- =============================================================================
-- 5. WELLNESS & WOMEN'S HEALTH
-- =============================================================================

-- Cycle Symptoms Tracker
CREATE TABLE IF NOT EXISTS cycle_symptoms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  energy_level integer CHECK (energy_level BETWEEN 1 AND 5),
  mood text CHECK (mood IN ('happy','calm','irritable','anxious','sad','motivated','tired')),
  pain_level integer CHECK (pain_level BETWEEN 0 AND 5),
  pain_locations text[],
  flow_intensity text CHECK (flow_intensity IN ('none','spotting','light','moderate','heavy')),
  extra_symptoms text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Lactation Sessions
CREATE TABLE IF NOT EXISTS lactation_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_type text CHECK (session_type IN ('breastfeed','pump','bottle')) NOT NULL,
  breast_side text CHECK (breast_side IN ('left','right','both')),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  amount_ml integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Food Logs
CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    photo_url TEXT,
    food_name TEXT NOT NULL,
    description TEXT,
    calories INT DEFAULT 0,
    protein_g NUMERIC(5,1) DEFAULT 0,
    carbs_g NUMERIC(5,1) DEFAULT 0,
    fat_g NUMERIC(5,1) DEFAULT 0,
    meal_type TEXT DEFAULT 'other' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    log_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. ADMIN AI ASSISTANT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_assistant_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Nueva conversación',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES admin_assistant_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_name TEXT,
    tool_result JSONB,
    is_voice_input BOOLEAN DEFAULT false,
    execution_plan JSONB,
    execution_status TEXT CHECK (execution_status IN ('pending', 'confirmed', 'cancelled', 'executed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. NOTICES & ALERTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS trainer_notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE, -- Optional: null = global
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notice_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id uuid REFERENCES trainer_notices(id) ON DELETE CASCADE,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notice_id, member_id)
);

-- =============================================================================
-- 8. RLS POLICIES CONSOLIDATED
-- =============================================================================

-- Enable RLS for all tables
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lactation_sessions ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Owner only access for sensitive data)
CREATE POLICY "Users view own workout" ON member_workouts FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Users view own diet" ON member_diets FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Users manage own food logs" ON food_logs FOR ALL USING (member_id = auth.uid());
CREATE POLICY "Users manage own symptoms" ON cycle_symptoms FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own lactation" ON lactation_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own progress" ON progress_records FOR ALL USING (member_id = auth.uid());
CREATE POLICY "Users manage own photos" ON progress_photos FOR ALL USING (member_id = auth.uid());

-- Admin & Trainer bypasses
CREATE POLICY "Admins full access" ON profiles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Trainers view assigned members" ON profiles FOR SELECT USING (EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = profiles.id) OR role = 'trainer');

-- Workout/Diet visibility
CREATE POLICY "Public templates" ON workout_templates FOR SELECT USING (true);
CREATE POLICY "Public diet templates" ON diet_templates FOR SELECT USING (true);

-- =============================================================================
-- 9. RPC HELPERS (ACTIVITY & WELLNESS)
-- =============================================================================

-- Helper to track steps efficiently
CREATE OR REPLACE FUNCTION rpc_update_daily_steps(p_steps INT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_activity (member_id, activity_date, steps, source)
    VALUES (auth.uid(), CURRENT_DATE, p_steps, 'manual')
    ON CONFLICT (member_id, activity_date)
    DO UPDATE SET 
        steps = daily_activity.steps + EXCLUDED.steps,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_get_today_activity()
RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
    v_steps_goal INT;
    v_has_profile BOOLEAN;
BEGIN
    v_member_id := auth.uid();
    SELECT (height_cm IS NOT NULL AND weight_kg IS NOT NULL), COALESCE(steps_goal, 8000)
    INTO v_has_profile, v_steps_goal FROM profiles WHERE id = v_member_id;
    
    SELECT jsonb_build_object(
        'steps', COALESCE(da.steps, 0),
        'distance_km', COALESCE(da.distance_km, 0),
        'calories_kcal', COALESCE(da.calories_kcal, 0),
        'steps_goal', v_steps_goal,
        'has_complete_profile', v_has_profile
    ) INTO v_result FROM daily_activity da WHERE da.member_id = v_member_id AND da.activity_date = CURRENT_DATE;
    
    RETURN COALESCE(v_result, jsonb_build_object('steps', 0, 'distance_km', 0, 'calories_kcal', 0, 'steps_goal', v_steps_goal, 'has_complete_profile', v_has_profile));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10. SEED DATA (CORE ROLES & DEMO)
-- =============================================================================

-- Add manually if needed using the UI or Auth.
-- This script ensures structural integrity.

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
