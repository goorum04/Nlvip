-- ============================================
-- MÓDULO: CUENTA PASOS / ACTIVIDAD DIARIA
-- NL VIP CLUB
-- ============================================

-- ============================================
-- 1. AÑADIR CAMPOS AL PERFIL
-- ============================================

-- Altura en cm
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm INT;

-- Peso actual en kg (puede ya existir)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);

-- Fecha de nacimiento (para calcular edad dinámicamente)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Sexo (mejora estimación de zancada)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sex_type') THEN
        CREATE TYPE sex_type AS ENUM ('male', 'female', 'other');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female', 'other'));

-- Objetivo de pasos diarios
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS steps_goal INT DEFAULT 8000;

-- ============================================
-- 2. CREAR TABLA daily_activity
-- ============================================

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
    
    -- Una fila por usuario por día
    CONSTRAINT unique_member_date UNIQUE (member_id, activity_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_daily_activity_member ON daily_activity(member_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_activity_member_date ON daily_activity(member_id, activity_date DESC);

-- ============================================
-- 3. RLS PARA daily_activity
-- ============================================

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- Member: solo su propia actividad
DROP POLICY IF EXISTS "member_own_activity" ON daily_activity;
CREATE POLICY "member_own_activity" ON daily_activity
    FOR ALL USING (member_id = auth.uid());

-- Trainer: puede ver actividad de sus socios asignados
DROP POLICY IF EXISTS "trainer_view_member_activity" ON daily_activity;
CREATE POLICY "trainer_view_member_activity" ON daily_activity
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() AND p.role = 'trainer'
        )
        AND EXISTS (
            SELECT 1 FROM trainer_members tm 
            WHERE tm.trainer_id = auth.uid() AND tm.member_id = daily_activity.member_id
        )
    );

-- Admin: acceso total
DROP POLICY IF EXISTS "admin_full_activity" ON daily_activity;
CREATE POLICY "admin_full_activity" ON daily_activity
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 4. FUNCIÓN PARA CALCULAR Y ACTUALIZAR ACTIVIDAD
-- ============================================

CREATE OR REPLACE FUNCTION calculate_activity_metrics(
    p_member_id UUID,
    p_steps INT
)
RETURNS TABLE (
    distance_km NUMERIC,
    calories_kcal NUMERIC,
    has_complete_profile BOOLEAN
) AS $$
DECLARE
    v_height_cm INT;
    v_weight_kg NUMERIC;
    v_sex TEXT;
    v_stride_m NUMERIC;
    v_distance NUMERIC;
    v_calories NUMERIC;
    v_complete BOOLEAN;
BEGIN
    -- Obtener datos del perfil
    SELECT height_cm, weight_kg, sex
    INTO v_height_cm, v_weight_kg, v_sex
    FROM profiles WHERE id = p_member_id;
    
    -- Verificar si el perfil está completo
    v_complete := (v_height_cm IS NOT NULL AND v_weight_kg IS NOT NULL);
    
    IF NOT v_complete THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, false;
        RETURN;
    END IF;
    
    -- Calcular longitud de zancada según sexo
    v_stride_m := CASE 
        WHEN v_sex = 'male' THEN v_height_cm * 0.415 / 100
        WHEN v_sex = 'female' THEN v_height_cm * 0.413 / 100
        ELSE v_height_cm * 0.414 / 100
    END;
    
    -- Calcular distancia
    v_distance := p_steps * v_stride_m / 1000;
    
    -- Calcular calorías
    v_calories := v_weight_kg * v_distance * 1.036;
    
    RETURN QUERY SELECT 
        ROUND(v_distance, 3),
        ROUND(v_calories, 1),
        true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. RPC PARA REGISTRAR/ACTUALIZAR PASOS
-- ============================================

CREATE OR REPLACE FUNCTION rpc_update_daily_steps(
    p_steps INT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_distance NUMERIC;
    v_calories NUMERIC;
    v_complete BOOLEAN;
    v_activity_id UUID;
    v_steps_goal INT;
BEGIN
    v_member_id := auth.uid();
    
    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Obtener objetivo de pasos
    SELECT steps_goal INTO v_steps_goal FROM profiles WHERE id = v_member_id;
    v_steps_goal := COALESCE(v_steps_goal, 8000);
    
    -- Calcular métricas
    SELECT * INTO v_distance, v_calories, v_complete
    FROM calculate_activity_metrics(v_member_id, p_steps);
    
    -- Insertar o actualizar
    INSERT INTO daily_activity (member_id, activity_date, steps, distance_km, calories_kcal, source, updated_at)
    VALUES (v_member_id, p_date, p_steps, v_distance, v_calories, 'manual', NOW())
    ON CONFLICT (member_id, activity_date) 
    DO UPDATE SET 
        steps = EXCLUDED.steps,
        distance_km = EXCLUDED.distance_km,
        calories_kcal = EXCLUDED.calories_kcal,
        updated_at = NOW()
    RETURNING id INTO v_activity_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'activity_id', v_activity_id,
        'steps', p_steps,
        'distance_km', v_distance,
        'calories_kcal', v_calories,
        'steps_goal', v_steps_goal,
        'progress_percent', ROUND((p_steps::NUMERIC / v_steps_goal) * 100, 1),
        'has_complete_profile', v_complete
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. RPC PARA OBTENER ACTIVIDAD DE HOY
-- ============================================

CREATE OR REPLACE FUNCTION rpc_get_today_activity()
RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
    v_steps_goal INT;
    v_has_profile BOOLEAN;
BEGIN
    v_member_id := auth.uid();
    
    -- Verificar perfil completo
    SELECT 
        (height_cm IS NOT NULL AND weight_kg IS NOT NULL),
        COALESCE(steps_goal, 8000)
    INTO v_has_profile, v_steps_goal
    FROM profiles WHERE id = v_member_id;
    
    SELECT jsonb_build_object(
        'activity_date', COALESCE(da.activity_date, CURRENT_DATE),
        'steps', COALESCE(da.steps, 0),
        'distance_km', COALESCE(da.distance_km, 0),
        'calories_kcal', COALESCE(da.calories_kcal, 0),
        'source', COALESCE(da.source, 'manual'),
        'steps_goal', v_steps_goal,
        'progress_percent', ROUND((COALESCE(da.steps, 0)::NUMERIC / v_steps_goal) * 100, 1),
        'has_complete_profile', v_has_profile
    ) INTO v_result
    FROM daily_activity da
    WHERE da.member_id = v_member_id AND da.activity_date = CURRENT_DATE;
    
    -- Si no hay registro hoy, devolver valores por defecto
    IF v_result IS NULL THEN
        v_result := jsonb_build_object(
            'activity_date', CURRENT_DATE,
            'steps', 0,
            'distance_km', 0,
            'calories_kcal', 0,
            'source', 'manual',
            'steps_goal', v_steps_goal,
            'progress_percent', 0,
            'has_complete_profile', v_has_profile
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. RPC PARA HISTORIAL DE 7 DÍAS
-- ============================================

CREATE OR REPLACE FUNCTION rpc_get_activity_history(p_days INT DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
BEGIN
    v_member_id := auth.uid();
    
    RETURN (
        SELECT jsonb_build_object(
            'history', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', d.date,
                    'steps', COALESCE(da.steps, 0),
                    'distance_km', COALESCE(da.distance_km, 0),
                    'calories_kcal', COALESCE(da.calories_kcal, 0)
                ) ORDER BY d.date DESC
            ), '[]'::jsonb),
            'avg_steps', COALESCE(
                (SELECT ROUND(AVG(steps)) FROM daily_activity 
                 WHERE member_id = v_member_id 
                 AND activity_date >= CURRENT_DATE - p_days),
                0
            ),
            'total_steps', COALESCE(
                (SELECT SUM(steps) FROM daily_activity 
                 WHERE member_id = v_member_id 
                 AND activity_date >= CURRENT_DATE - p_days),
                0
            )
        )
        FROM generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day') AS d(date)
        LEFT JOIN daily_activity da ON da.activity_date = d.date AND da.member_id = v_member_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. RPC PARA TRAINER/ADMIN VER ACTIVIDAD DE SOCIO
-- ============================================

CREATE OR REPLACE FUNCTION rpc_get_member_activity(
    p_member_id UUID,
    p_days INT DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_is_authorized BOOLEAN := false;
BEGIN
    v_caller_id := auth.uid();
    
    SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
    
    -- Verificar autorización
    IF v_caller_role = 'admin' THEN
        v_is_authorized := true;
    ELSIF v_caller_role = 'trainer' THEN
        SELECT EXISTS(
            SELECT 1 FROM trainer_members 
            WHERE trainer_id = v_caller_id AND member_id = p_member_id
        ) INTO v_is_authorized;
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'No autorizado para ver esta información';
    END IF;
    
    RETURN (
        SELECT jsonb_build_object(
            'member', (SELECT jsonb_build_object('id', id, 'name', name) FROM profiles WHERE id = p_member_id),
            'today', (
                SELECT jsonb_build_object(
                    'steps', COALESCE(steps, 0),
                    'distance_km', COALESCE(distance_km, 0),
                    'calories_kcal', COALESCE(calories_kcal, 0)
                )
                FROM daily_activity 
                WHERE member_id = p_member_id AND activity_date = CURRENT_DATE
            ),
            'history', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'date', activity_date,
                        'steps', steps,
                        'distance_km', distance_km,
                        'calories_kcal', calories_kcal
                    ) ORDER BY activity_date DESC
                ), '[]'::jsonb)
                FROM daily_activity 
                WHERE member_id = p_member_id 
                AND activity_date >= CURRENT_DATE - p_days
            ),
            'avg_steps_7d', COALESCE(
                (SELECT ROUND(AVG(steps)) FROM daily_activity 
                 WHERE member_id = p_member_id 
                 AND activity_date >= CURRENT_DATE - 7),
                0
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. SEED DATA DEMO
-- ============================================

-- Actualizar socio demo con datos de perfil
UPDATE profiles 
SET 
    height_cm = 175,
    weight_kg = 72,
    birth_date = '1990-05-15',
    sex = 'male',
    steps_goal = 10000
WHERE email = 'socio@demo.com';

-- Actualizar María demo
UPDATE profiles 
SET 
    height_cm = 165,
    weight_kg = 58,
    birth_date = '1995-08-22',
    sex = 'female',
    steps_goal = 8000
WHERE email = 'maria@demo.com';

-- Insertar actividad de hoy y últimos 7 días para Said
INSERT INTO daily_activity (member_id, activity_date, steps, distance_km, calories_kcal, source)
SELECT 
    p.id,
    d.date,
    CASE 
        WHEN d.date = CURRENT_DATE THEN 6542
        ELSE 5000 + (random() * 8000)::INT
    END as steps,
    0, 0, 'manual'
FROM profiles p
CROSS JOIN generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(date)
WHERE p.email = 'socio@demo.com'
ON CONFLICT (member_id, activity_date) DO UPDATE SET
    steps = EXCLUDED.steps,
    updated_at = NOW();

-- Recalcular métricas para Said
UPDATE daily_activity da
SET 
    distance_km = (da.steps * 175 * 0.415 / 100) / 1000,
    calories_kcal = 72 * ((da.steps * 175 * 0.415 / 100) / 1000) * 1.036
WHERE da.member_id = (SELECT id FROM profiles WHERE email = 'socio@demo.com');

-- Insertar actividad para María
INSERT INTO daily_activity (member_id, activity_date, steps, distance_km, calories_kcal, source)
SELECT 
    p.id,
    d.date,
    CASE 
        WHEN d.date = CURRENT_DATE THEN 4230
        ELSE 3000 + (random() * 6000)::INT
    END as steps,
    0, 0, 'manual'
FROM profiles p
CROSS JOIN generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(date)
WHERE p.email = 'maria@demo.com'
ON CONFLICT (member_id, activity_date) DO UPDATE SET
    steps = EXCLUDED.steps,
    updated_at = NOW();

-- Recalcular métricas para María
UPDATE daily_activity da
SET 
    distance_km = (da.steps * 165 * 0.413 / 100) / 1000,
    calories_kcal = 58 * ((da.steps * 165 * 0.413 / 100) / 1000) * 1.036
WHERE da.member_id = (SELECT id FROM profiles WHERE email = 'maria@demo.com');

-- ============================================
-- VERIFICACIÓN
-- ============================================

SELECT 'Campos añadidos a profiles:' as info;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('height_cm', 'weight_kg', 'birth_date', 'sex', 'steps_goal');

SELECT 'Tabla daily_activity creada:' as info;
SELECT * FROM daily_activity LIMIT 5;
