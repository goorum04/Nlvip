-- ============================================
-- FASE 3: RETOS, BADGES Y GRÁFICAS
-- NL VIP CLUB - Sistema de Gamificación
-- ============================================

-- ============================================
-- 1. CREAR TIPOS ENUM
-- ============================================

-- Tipo de reto
DO $$ BEGIN
    CREATE TYPE challenge_type AS ENUM ('workouts', 'weight', 'consistency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipo de condición para badges
DO $$ BEGIN
    CREATE TYPE badge_condition_type AS ENUM ('workouts_count', 'streak', 'challenge_completed', 'first_workout', 'weight_goal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. CREAR TABLA DE RETOS (CHALLENGES)
-- ============================================

CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type challenge_type NOT NULL DEFAULT 'workouts',
    target_value NUMERIC NOT NULL DEFAULT 10,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREAR TABLA DE PARTICIPANTES EN RETOS
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    progress_value NUMERIC DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, member_id)
);

-- ============================================
-- 4. CREAR TABLA DE BADGES (LOGROS)
-- ============================================

CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT 'trophy',
    color TEXT DEFAULT 'gold',
    condition_type badge_condition_type NOT NULL,
    condition_value INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CREAR TABLA DE BADGES DE USUARIOS
-- ============================================

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(badge_id, member_id)
);

-- ============================================
-- 6. CREAR TABLA DE CHECK-INS DE ENTRENAMIENTOS
-- (Si no existe)
-- ============================================

CREATE TABLE IF NOT EXISTS workout_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workout_template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INT,
    notes TEXT
);

-- ============================================
-- 7. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_checkins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. POLÍTICAS RLS PARA CHALLENGES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "challenges_select_active" ON challenges;
DROP POLICY IF EXISTS "challenges_insert_admin_trainer" ON challenges;
DROP POLICY IF EXISTS "challenges_update_own" ON challenges;
DROP POLICY IF EXISTS "challenges_delete_own" ON challenges;

-- Todos pueden ver retos activos
CREATE POLICY "challenges_select_active" ON challenges
    FOR SELECT USING (
        is_active = true 
        OR created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin y Trainer pueden crear retos
CREATE POLICY "challenges_insert_admin_trainer" ON challenges
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- Admin puede actualizar cualquiera, Trainer solo los suyos
CREATE POLICY "challenges_update_own" ON challenges
    FOR UPDATE USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin puede eliminar cualquiera, Trainer solo los suyos
CREATE POLICY "challenges_delete_own" ON challenges
    FOR DELETE USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 9. POLÍTICAS RLS PARA CHALLENGE_PARTICIPANTS
-- ============================================

DROP POLICY IF EXISTS "participants_select" ON challenge_participants;
DROP POLICY IF EXISTS "participants_insert_self" ON challenge_participants;
DROP POLICY IF EXISTS "participants_update_self" ON challenge_participants;

-- Miembros ven su participación, Admin/Trainer ven todo
CREATE POLICY "participants_select" ON challenge_participants
    FOR SELECT USING (
        member_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- Miembros pueden unirse a retos (solo para sí mismos)
CREATE POLICY "participants_insert_self" ON challenge_participants
    FOR INSERT WITH CHECK (
        member_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- Miembros pueden actualizar su progreso
CREATE POLICY "participants_update_self" ON challenge_participants
    FOR UPDATE USING (
        member_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- ============================================
-- 10. POLÍTICAS RLS PARA BADGES
-- ============================================

DROP POLICY IF EXISTS "badges_select_all" ON badges;
DROP POLICY IF EXISTS "badges_insert_admin" ON badges;
DROP POLICY IF EXISTS "badges_update_admin" ON badges;

-- Todos pueden ver badges
CREATE POLICY "badges_select_all" ON badges
    FOR SELECT USING (true);

-- Solo admin puede crear badges
CREATE POLICY "badges_insert_admin" ON badges
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Solo admin puede actualizar badges
CREATE POLICY "badges_update_admin" ON badges
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 11. POLÍTICAS RLS PARA USER_BADGES
-- ============================================

DROP POLICY IF EXISTS "user_badges_select" ON user_badges;
DROP POLICY IF EXISTS "user_badges_insert" ON user_badges;

-- Miembros ven sus badges, Admin/Trainer ven todo
CREATE POLICY "user_badges_select" ON user_badges
    FOR SELECT USING (
        member_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- Admin/Trainer pueden asignar badges
CREATE POLICY "user_badges_insert" ON user_badges
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
        OR member_id = auth.uid()
    );

-- ============================================
-- 12. POLÍTICAS RLS PARA WORKOUT_CHECKINS
-- ============================================

DROP POLICY IF EXISTS "checkins_select" ON workout_checkins;
DROP POLICY IF EXISTS "checkins_insert" ON workout_checkins;

-- Miembros ven sus check-ins, Admin/Trainer ven de sus socios
CREATE POLICY "checkins_select" ON workout_checkins
    FOR SELECT USING (
        member_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- Miembros pueden crear check-ins
CREATE POLICY "checkins_insert" ON workout_checkins
    FOR INSERT WITH CHECK (
        member_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );

-- ============================================
-- 13. ÍNDICES PARA RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_challenges_active ON challenges(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_member ON challenge_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_member ON user_badges(member_id);
CREATE INDEX IF NOT EXISTS idx_workout_checkins_member ON workout_checkins(member_id);
CREATE INDEX IF NOT EXISTS idx_workout_checkins_date ON workout_checkins(checked_in_at);

-- ============================================
-- FIN DEL SCRIPT DE ESTRUCTURA
-- ============================================
-- Ejecuta primero este script, luego el de SEED
