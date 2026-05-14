-- =========================================================================
-- NL VIP CLUB - MASTER SCHEMA SCRIPT (V6)
-- Este script es ADITIVO y SEGURO. NO borra datos (sin DELETE ni TRUNCATE).
-- Solo aÃ±ade estructuras faltantes y recrea polÃ­ticas de seguridad (RLS).
-- =========================================================================

-- =========================================================================
-- PARTE 1: ESTRUCTURA DE TABLAS (DDL)
-- =========================================================================

-- 1. Perfiles (Asegurando columnas premium y de salud)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    role TEXT DEFAULT 'member', -- admin, trainer, member
    avatar_url TEXT,
    trainer_code TEXT, -- Para los trainers
    has_premium BOOLEAN DEFAULT false, -- Nivel de SuscripciÃ³n VIP
    -- Salud Femenina
    sex TEXT,
    cycle_enabled BOOLEAN DEFAULT false,
    cycle_start_date DATE,
    cycle_length_days INTEGER DEFAULT 28,
    period_length_days INTEGER DEFAULT 5,
    -- Medidas base
    weight_kg NUMERIC(5,2),
    height_cm NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar que las columnas existan por si la tabla ya estaba creada antes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_premium BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_start_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_length_days INTEGER DEFAULT 28;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS period_length_days INTEGER DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2);

-- 2. CÃ³digos de InvitaciÃ³n (Premium)
CREATE TABLE IF NOT EXISTS invitation_codes (
    code TEXT PRIMARY KEY,
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0
);

-- 3. Asignaciones de Entrenador (Acceso de Trainer a Socio)
CREATE TABLE IF NOT EXISTS trainer_members (
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (trainer_id, member_id)
);

-- 4. Progreso FÃ­sico (Premium)
CREATE TABLE IF NOT EXISTS progress_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5,2),
    chest_cm NUMERIC(5,2),
    waist_cm NUMERIC(5,2),
    hips_cm NUMERIC(5,2),
    arms_cm NUMERIC(5,2),
    legs_cm NUMERIC(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    front_url TEXT,
    back_url TEXT,
    side_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Actividad Diaria (Pasos - Gratis & Premium)
CREATE TABLE IF NOT EXISTS daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, activity_date)
);

-- 6. Rutinas (Templates y Asignaciones - Premium)
CREATE TABLE IF NOT EXISTS workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workout_template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workout_template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_minutes INTEGER,
    notes TEXT
);

-- 7. Dietas (Templates y Asignaciones - Premium)
CREATE TABLE IF NOT EXISTS diet_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    calories INTEGER,
    protein_g INTEGER,
    carbs_g INTEGER,
    fat_g INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    diet_template_id UUID REFERENCES diet_templates(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Food Tracker & Recetas IA (Gratis CatÃ¡logo/Premium Planes)
CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
    food_name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein_g NUMERIC(5,1) DEFAULT 0,
    carbs_g NUMERIC(5,1) DEFAULT 0,
    fat_g NUMERIC(5,1) DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    ingredients TEXT[],
    instructions TEXT[],
    prep_time_min INTEGER,
    calories INTEGER,
    protein_g NUMERIC(5,1),
    carbs_g NUMERIC(5,1),
    fat_g NUMERIC(5,1),
    image_url TEXT,
    dietary_tags TEXT[], -- keto, vegan, high-protein
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Admin o IA
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_recipe_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    goal TEXT, -- Ej: 'DefiniciÃ³n', 'Volumen'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS member_recipe_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES member_recipe_plans(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipe_catalog(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0-6 (0=Lunes)
    meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
    UNIQUE(plan_id, day_of_week, meal_type)
);

-- 9. Social Feed (Premium)
CREATE TABLE IF NOT EXISTS feed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
    commenter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. ComunicaciÃ³n y Asistente (Chat - Premium)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    receiver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainer_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL si es para todos
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notice_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID REFERENCES trainer_notices(id) ON DELETE CASCADE,
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(notice_id, member_id)
);

-- Asistente Admin
CREATE TABLE IF NOT EXISTS admin_assistant_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES admin_assistant_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant' o 'system'
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. GamificaciÃ³n (Retos - Gratis)
CREATE TABLE IF NOT EXISTS system_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL, -- 'steps', 'workouts', 'streaks', 'weight_loss'
    target_value INTEGER NOT NULL,
    points_reward INTEGER DEFAULT 10,
    badge_icon TEXT, -- URL o nombre del icono
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES system_challenges(id) ON DELETE CASCADE,
    progress_value INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, challenge_id)
);

-- 12. Bienestar Femenino Avanzado (Premium)
CREATE TABLE IF NOT EXISTS cycle_symptoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    symptom_type TEXT NOT NULL, -- fatigue, pain, mood, cravings
    severity INTEGER CHECK (severity BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lactation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    estimated_calories_burned INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =========================================================================
-- PARTE 2: FUNCIONES RPC
-- (Se declaran con SECURITY DEFINER para las IAs donde es necesario)
-- =========================================================================

-- RPC para buscar socio por nombre (Usado por Asistente IA)
CREATE OR REPLACE FUNCTION rpc_find_member(search_query text)
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    role text,
    has_premium boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.email, p.role, p.has_premium
    FROM profiles p
    WHERE p.name ILIKE '%' || search_query || '%'
       OR p.email ILIKE '%' || search_query || '%';
END;
$$;

-- RPC para Resumen de Actividad Diaria
CREATE OR REPLACE FUNCTION rpc_get_today_activity(p_member_id uuid)
RETURNS TABLE (
    steps_today integer,
    calories_burned integer,
    food_calories integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date date := current_date;
    v_steps integer := 0;
    v_food_cals integer := 0;
BEGIN
    -- Pasos
    SELECT steps INTO v_steps FROM daily_activity WHERE member_id = p_member_id AND activity_date = v_date;
    IF v_steps IS NULL THEN v_steps := 0; END IF;
    
    -- CalorÃ­as ingeridas
    SELECT COALESCE(SUM(calories), 0) INTO v_food_cals FROM food_logs WHERE member_id = p_member_id AND date = v_date;
    
    RETURN QUERY SELECT v_steps, (v_steps / 20)::integer, v_food_cals;
END;
$$;

-- RPC para subir pasos (Actualiza o Inserta)
CREATE OR REPLACE FUNCTION rpc_update_daily_steps(p_member_id uuid, p_steps integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date date := current_date;
BEGIN
    INSERT INTO daily_activity (member_id, activity_date, steps, updated_at)
    VALUES (p_member_id, v_date, p_steps, now())
    ON CONFLICT (member_id, activity_date)
    DO UPDATE SET steps = daily_activity.steps + p_steps, updated_at = now();
END;
$$;


-- =========================================================================
-- PARTE 3: SUPREMACÃA DE SEGURIDAD RLS (LA PARTE MÃS IMPORTANTE)
-- MUEBLES NO DAÃ‘ADOS, SOLO CERRADURAS NUEVAS
-- =========================================================================

-- Activar RLS en todas las tablas por seguridad
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_recipe_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_recipe_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lactation_sessions ENABLE ROW LEVEL SECURITY;

-- ELIMINAR TODAS LAS POLÃTICAS ANTIGUAS (Evita colisiones sin perder datos)
DO $$ 
DECLARE 
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin All" ON %I', tbl);
        -- Un drop dinÃ¡mico por si acaso quedan residuos (seguro porque si no existe no falla el bloque)
    END LOOP;
END $$;

-- Drop general para estar seguros
DROP POLICY IF EXISTS "Public Profile View" ON profiles;
DROP POLICY IF EXISTS "Users Update Own Profile" ON profiles;
DROP POLICY IF EXISTS "Admin Full Profile Access" ON profiles;

-- (ContinuarÃ¡ en el bloque de polÃ­ticas) ->
-- =========================================================================
-- PARTE 4: POLÍTICAS RLS DETALLADAS (LA NUEVA CERRADURA)
-- =========================================================================

-- FUNCIONES DE AYUDA PARA POLÍTICAS
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $body
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$body LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_trainer() RETURNS BOOLEAN AS $body
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer');
END;
$body LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_premium() RETURNS BOOLEAN AS $body
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND has_premium = true);
END;
$body LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PROFILES (Perfiles)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (is_admin());

-- 2. INVITATION CODES
CREATE POLICY "Trainers can view own codes" ON invitation_codes FOR SELECT USING (trainer_id = auth.uid() OR is_admin());
CREATE POLICY "Trainers can create codes" ON invitation_codes FOR INSERT WITH CHECK ((trainer_id = auth.uid() AND is_trainer()) OR is_admin());

-- 3. TRAINER MEMBERS
CREATE POLICY "Trainers see own assignments" ON trainer_members FOR SELECT USING (trainer_id = auth.uid() OR is_admin());
CREATE POLICY "Members see who trains them" ON trainer_members FOR SELECT USING (member_id = auth.uid());
CREATE POLICY "Admins link members" ON trainer_members FOR ALL USING (is_admin());

-- 4. FUNCIÓN PREMIUM A: PROGRESS (Registros y Fotos)
-- SOLO SI ERES PREMIUM puedes insertar.
CREATE POLICY "Premium users manage own progress" ON progress_records 
FOR ALL USING (member_id = auth.uid() AND is_premium());

CREATE POLICY "Trainers view assigned member progress" ON progress_records 
FOR SELECT USING (EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = progress_records.member_id) OR is_admin());

CREATE POLICY "Premium users manage own photos" ON progress_photos 
FOR ALL USING (member_id = auth.uid() AND is_premium());

CREATE POLICY "Trainers view assigned member photos" ON progress_photos 
FOR SELECT USING (EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = progress_photos.member_id) OR is_admin());

-- 5. FUNCIÓN PREMIUM B: WORKOUTS Y DIETAS
CREATE POLICY "Premium members see their workouts" ON member_workouts
FOR SELECT USING ((member_id = auth.uid() AND is_premium()) OR is_admin());

CREATE POLICY "Trainers manage member workouts" ON member_workouts
FOR ALL USING (EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = member_workouts.member_id) OR is_admin());

CREATE POLICY "Premium members see their diets" ON member_diets
FOR SELECT USING ((member_id = auth.uid() AND is_premium()) OR is_admin());

CREATE POLICY "Trainers manage member diets" ON member_diets
FOR ALL USING (EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = member_diets.member_id) OR is_admin());

-- Notas: Los templates (workout_templates, diet_templates) son visibles para quienes los crean
CREATE POLICY "Trainers manage own templates" ON workout_templates FOR ALL USING (trainer_id = auth.uid() OR is_admin());
CREATE POLICY "Members see assigned templates" ON workout_templates FOR SELECT USING (
    EXISTS (SELECT 1 FROM member_workouts WHERE workout_template_id = workout_templates.id AND member_id = auth.uid()) OR is_admin()
);

-- 6. FUNCIÓN PREMIUM C: SOCIAL FEED
CREATE POLICY "Everyone sees public posts" ON feed_posts FOR SELECT USING (is_hidden = false OR is_admin());
CREATE POLICY "Only Premium can post to feed" ON feed_posts FOR INSERT WITH CHECK (author_id = auth.uid() AND is_premium());
CREATE POLICY "Only Premium can comment" ON feed_comments FOR INSERT WITH CHECK (commenter_id = auth.uid() AND is_premium());
CREATE POLICY "Everyone views comments" ON feed_comments FOR SELECT USING (true);
CREATE POLICY "Only Premium can like" ON feed_likes FOR ALL USING (user_id = auth.uid() AND is_premium());

-- 7. FUNCIÓN PARA TODOS D: ACTIVITY Y CHALLENGES (Gancho para Gratis)
CREATE POLICY "Users manage own activity" ON daily_activity FOR ALL USING (member_id = auth.uid());
CREATE POLICY "Trainers view assigned activity" ON daily_activity FOR SELECT USING (
    EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = daily_activity.member_id) OR is_admin()
);

CREATE POLICY "Everyone sees active challenges" ON system_challenges FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY "Users manage own challenge progress" ON member_challenges FOR ALL USING (member_id = auth.uid());

-- 8. BIENESTAR FEMENINO (Premium)
CREATE POLICY "Premium users manage cycle symptoms" ON cycle_symptoms FOR ALL USING (member_id = auth.uid() AND is_premium());
CREATE POLICY "Premium users manage lactation" ON lactation_sessions FOR ALL USING (member_id = auth.uid() AND is_premium());

-- 9. RECETAS (Gratis el catálogo, Premium los planes IA)
CREATE POLICY "Everyone sees public recipes" ON recipe_catalog FOR SELECT USING (is_public = true OR created_by = auth.uid() OR is_admin());
CREATE POLICY "Premium manage own recipe plans" ON member_recipe_plans FOR ALL USING (member_id = auth.uid() AND is_premium());
CREATE POLICY "Premium manage own recipe items" ON member_recipe_plan_items FOR ALL USING (
    EXISTS (SELECT 1 FROM member_recipe_plans WHERE id = plan_id AND member_id = auth.uid()) 
    AND is_premium()
);

-- =========================================================================
-- PARTE 5: STORAGE BUCKETS (CONFIGURANDO LÍMITES MÁXIMOS)
-- =========================================================================

-- Inserción segura de Buckets (Premium Quality)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']), -- 10MB MÁX
  ('progress-photos', 'progress-photos', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']), -- 50MB MÁX
  ('feed-images', 'feed-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']), -- 50MB MÁX
  ('exercise_videos', 'exercise_videos', true, 524288000, ARRAY['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm']) -- 500MB MÁX (4K Ready)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Limpiar Políticas Viejas
DROP POLICY IF EXISTS "Avatars Públicos" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Inserción" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Actualización" ON storage.objects;
DROP POLICY IF EXISTS "Progress Photos Lectura Privada" ON storage.objects;
DROP POLICY IF EXISTS "Progress Photos Subida" ON storage.objects;
DROP POLICY IF EXISTS "Progress Photos Borrado" ON storage.objects;
DROP POLICY IF EXISTS "Feed Images Lectura Pública" ON storage.objects;
DROP POLICY IF EXISTS "Feed Images Subida Premium" ON storage.objects;
DROP POLICY IF EXISTS "Exercise Videos Lectura Pública" ON storage.objects;
DROP POLICY IF EXISTS "Exercise Videos Subida Trainers" ON storage.objects;

-- AVATARS (Todos suben el suyo)
CREATE POLICY "Avatars Públicos" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatars Inserción" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Avatars Actualización" ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Avatars Borrado" ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- PROGRESS PHOTOS (Dueño, Entrenador y Admin)
CREATE POLICY "Progress Photos Lectura Privada" ON storage.objects FOR SELECT USING (
    bucket_id = 'progress-photos' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id::text = (storage.foldername(name))[1]) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
);
CREATE POLICY "Progress Photos Subida" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND has_premium = true)
);
CREATE POLICY "Progress Photos Borrado" ON storage.objects FOR DELETE USING (
    bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- FEED IMAGES (Todos ven, Premium suben)
CREATE POLICY "Feed Images Lectura Pública" ON storage.objects FOR SELECT USING (bucket_id = 'feed-images');
CREATE POLICY "Feed Images Subida Premium" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'feed-images' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND has_premium = true)
);

-- EXERCISE VIDEOS (Todos ven, Trainers suben)
CREATE POLICY "Exercise Videos Lectura Pública" ON storage.objects FOR SELECT USING (bucket_id = 'exercise_videos');
CREATE POLICY "Exercise Videos Subida Trainers" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'exercise_videos' AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer', 'admin'))
);
CREATE POLICY "Exercise Videos Borrado Trainers" ON storage.objects FOR DELETE USING (
    bucket_id = 'exercise_videos' AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('trainer', 'admin'))
);

-- FIN DEL SCRIPT MAESTRO DE BASE DE DATOS
