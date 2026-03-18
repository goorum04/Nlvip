// Script para crear tablas usando pg directamente
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const CREATE_TABLES_SQL = `
-- Crear tabla challenges (si no existe)
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'workouts',
    target_value NUMERIC NOT NULL DEFAULT 10,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla challenge_participants
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

-- Crear tabla badges
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT 'trophy',
    color TEXT DEFAULT 'gold',
    condition_type TEXT NOT NULL,
    condition_value INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla user_badges
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(badge_id, member_id)
);

-- Crear tabla workout_checkins
CREATE TABLE IF NOT EXISTS workout_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workout_template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INT,
    notes TEXT
);

-- Habilitar RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_checkins ENABLE ROW LEVEL SECURITY;

-- Políticas para challenges
DROP POLICY IF EXISTS "challenges_select" ON challenges;
CREATE POLICY "challenges_select" ON challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "challenges_update" ON challenges;
CREATE POLICY "challenges_update" ON challenges FOR UPDATE USING (true);

-- Políticas para challenge_participants
DROP POLICY IF EXISTS "participants_select" ON challenge_participants;
CREATE POLICY "participants_select" ON challenge_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "participants_insert" ON challenge_participants;
CREATE POLICY "participants_insert" ON challenge_participants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "participants_update" ON challenge_participants;
CREATE POLICY "participants_update" ON challenge_participants FOR UPDATE USING (true);

-- Políticas para badges
DROP POLICY IF EXISTS "badges_select" ON badges;
CREATE POLICY "badges_select" ON badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "badges_insert" ON badges;
CREATE POLICY "badges_insert" ON badges FOR INSERT WITH CHECK (true);

-- Políticas para user_badges
DROP POLICY IF EXISTS "user_badges_select" ON user_badges;
CREATE POLICY "user_badges_select" ON user_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_badges_insert" ON user_badges;
CREATE POLICY "user_badges_insert" ON user_badges FOR INSERT WITH CHECK (true);

-- Políticas para workout_checkins
DROP POLICY IF EXISTS "checkins_select" ON workout_checkins;
CREATE POLICY "checkins_select" ON workout_checkins FOR SELECT USING (true);

DROP POLICY IF EXISTS "checkins_insert" ON workout_checkins;
CREATE POLICY "checkins_insert" ON workout_checkins FOR INSERT WITH CHECK (true);
`

async function main() {
  console.log('📋 SQL para crear tablas:')
  console.log('=' .repeat(50))
  console.log(CREATE_TABLES_SQL)
  console.log('=' .repeat(50))
  console.log('\n⚠️  Por favor, copia el SQL de arriba y ejecútalo en el SQL Editor de Supabase')
  console.log('   URL: https://supabase.com/dashboard/project/qnuzcmdjpafbqnofpzfp/sql/new')
}

main()
