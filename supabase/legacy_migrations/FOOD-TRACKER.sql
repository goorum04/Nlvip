-- ============================================
-- MÓDULO: REGISTRO DE COMIDAS CON FOTOS
-- NL VIP CLUB
-- ============================================

-- Tabla para registrar comidas
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_food_logs_member ON food_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_food_logs_member_date ON food_logs(member_id, log_date);

-- RLS
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- Member: solo sus propios registros
DROP POLICY IF EXISTS "member_own_food_logs" ON food_logs;
CREATE POLICY "member_own_food_logs" ON food_logs
    FOR ALL USING (member_id = auth.uid());

-- Trainer: puede ver de sus socios
DROP POLICY IF EXISTS "trainer_view_food_logs" ON food_logs;
CREATE POLICY "trainer_view_food_logs" ON food_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
        )
        AND EXISTS (
            SELECT 1 FROM trainer_members tm 
            WHERE tm.trainer_id = auth.uid() AND tm.member_id = food_logs.member_id
        )
    );

-- Admin: acceso total
DROP POLICY IF EXISTS "admin_food_logs" ON food_logs;
CREATE POLICY "admin_food_logs" ON food_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- RPC: Obtener resumen de macros del día
-- ============================================

CREATE OR REPLACE FUNCTION rpc_get_daily_macros_summary(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_assigned JSONB;
    v_consumed JSONB;
BEGIN
    v_member_id := auth.uid();
    
    -- Obtener macros asignados (de la dieta)
    SELECT jsonb_build_object(
        'calories', COALESCE(dt.calories, 0),
        'protein_g', COALESCE(dt.protein_g, 0),
        'carbs_g', COALESCE(dt.carbs_g, 0),
        'fat_g', COALESCE(dt.fat_g, 0)
    ) INTO v_assigned
    FROM member_diets md
    JOIN diet_templates dt ON dt.id = md.diet_template_id
    WHERE md.member_id = v_member_id;
    
    -- Si no tiene dieta asignada, usar valores por defecto
    IF v_assigned IS NULL THEN
        v_assigned := jsonb_build_object(
            'calories', 2000,
            'protein_g', 150,
            'carbs_g', 200,
            'fat_g', 65
        );
    END IF;
    
    -- Obtener macros consumidos hoy
    SELECT jsonb_build_object(
        'calories', COALESCE(SUM(calories), 0),
        'protein_g', COALESCE(SUM(protein_g), 0),
        'carbs_g', COALESCE(SUM(carbs_g), 0),
        'fat_g', COALESCE(SUM(fat_g), 0)
    ) INTO v_consumed
    FROM food_logs
    WHERE member_id = v_member_id AND log_date = p_date;
    
    RETURN jsonb_build_object(
        'assigned', v_assigned,
        'consumed', v_consumed,
        'remaining', jsonb_build_object(
            'calories', (v_assigned->>'calories')::INT - (v_consumed->>'calories')::INT,
            'protein_g', (v_assigned->>'protein_g')::NUMERIC - (v_consumed->>'protein_g')::NUMERIC,
            'carbs_g', (v_assigned->>'carbs_g')::NUMERIC - (v_consumed->>'carbs_g')::NUMERIC,
            'fat_g', (v_assigned->>'fat_g')::NUMERIC - (v_consumed->>'fat_g')::NUMERIC
        ),
        'date', p_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Obtener comidas del día
-- ============================================

CREATE OR REPLACE FUNCTION rpc_get_daily_food_logs(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', id,
                'food_name', food_name,
                'description', description,
                'photo_url', photo_url,
                'calories', calories,
                'protein_g', protein_g,
                'carbs_g', carbs_g,
                'fat_g', fat_g,
                'meal_type', meal_type,
                'logged_at', logged_at
            ) ORDER BY logged_at DESC
        ), '[]'::jsonb)
        FROM food_logs
        WHERE member_id = auth.uid() AND log_date = p_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Registrar comida
-- ============================================

CREATE OR REPLACE FUNCTION rpc_log_food(
    p_food_name TEXT,
    p_calories INT,
    p_protein_g NUMERIC,
    p_carbs_g NUMERIC,
    p_fat_g NUMERIC,
    p_meal_type TEXT DEFAULT 'other',
    p_photo_url TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO food_logs (member_id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, photo_url, description)
    VALUES (auth.uid(), p_food_name, p_calories, p_protein_g, p_carbs_g, p_fat_g, p_meal_type, p_photo_url, p_description)
    RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Eliminar registro de comida
-- ============================================

CREATE OR REPLACE FUNCTION rpc_delete_food_log(p_id UUID)
RETURNS JSONB AS $$
BEGIN
    DELETE FROM food_logs WHERE id = p_id AND member_id = auth.uid();
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
