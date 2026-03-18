-- ============================================
-- FASE 5: ADMIN AI ASSISTANT
-- NL VIP CLUB - Sistema de Asistente IA para Admin
-- ============================================

-- ============================================
-- 1. TABLAS PARA EL ASISTENTE
-- ============================================

-- Conversaciones del asistente
CREATE TABLE IF NOT EXISTS admin_assistant_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Nueva conversación',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensajes de cada conversación
CREATE TABLE IF NOT EXISTS admin_assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES admin_assistant_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    -- Para tool calls
    tool_calls JSONB,
    tool_name TEXT,
    tool_result JSONB,
    -- Metadata
    is_voice_input BOOLEAN DEFAULT false,
    execution_plan JSONB,
    execution_status TEXT CHECK (execution_status IN ('pending', 'confirmed', 'cancelled', 'executed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de auditoría de acciones ejecutadas
CREATE TABLE IF NOT EXISTS admin_assistant_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES admin_assistant_conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES admin_assistant_messages(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    action_params JSONB NOT NULL,
    target_entities JSONB,
    result JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_admin ON admin_assistant_conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON admin_assistant_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_action_logs_admin ON admin_assistant_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_assistant_action_logs_action ON admin_assistant_action_logs(action_type);

-- ============================================
-- 2. AÑADIR TAGS A TEMPLATES
-- ============================================

-- Tags para diet_templates
ALTER TABLE diet_templates ADD COLUMN IF NOT EXISTS goal_tag TEXT CHECK (goal_tag IN ('fat_loss', 'maintain', 'muscle_gain'));
ALTER TABLE diet_templates ADD COLUMN IF NOT EXISTS level_tag TEXT CHECK (level_tag IN ('beginner', 'intermediate', 'advanced'));

-- Tags para workout_templates  
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS goal_tag TEXT CHECK (goal_tag IN ('fat_loss', 'maintain', 'muscle_gain'));
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS level_tag TEXT CHECK (level_tag IN ('beginner', 'intermediate', 'advanced'));

-- Actualizar templates existentes con tags por defecto
UPDATE diet_templates SET goal_tag = 'fat_loss', level_tag = 'intermediate' WHERE goal_tag IS NULL;
UPDATE workout_templates SET goal_tag = 'fat_loss', level_tag = 'intermediate' WHERE goal_tag IS NULL;

-- ============================================
-- 3. HABILITAR RLS
-- ============================================

ALTER TABLE admin_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_assistant_action_logs ENABLE ROW LEVEL SECURITY;

-- Solo admin puede acceder
DROP POLICY IF EXISTS "admin_conversations_policy" ON admin_assistant_conversations;
CREATE POLICY "admin_conversations_policy" ON admin_assistant_conversations
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_messages_policy" ON admin_assistant_messages;
CREATE POLICY "admin_messages_policy" ON admin_assistant_messages
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_action_logs_policy" ON admin_assistant_action_logs;
CREATE POLICY "admin_action_logs_policy" ON admin_assistant_action_logs
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 4. RPCs PARA TOOLS DEL ASISTENTE
-- ============================================

-- Helper: Verificar que el usuario es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Buscar miembro por nombre o email
CREATE OR REPLACE FUNCTION rpc_find_member(p_search TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    trainer_name TEXT,
    has_diet BOOLEAN,
    has_workout BOOLEAN
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.email,
        t.name as trainer_name,
        EXISTS(SELECT 1 FROM member_diets md WHERE md.member_id = p.id) as has_diet,
        EXISTS(SELECT 1 FROM member_workouts mw WHERE mw.member_id = p.id) as has_workout
    FROM profiles p
    LEFT JOIN trainer_members tm ON tm.member_id = p.id
    LEFT JOIN profiles t ON t.id = tm.trainer_id
    WHERE p.role = 'member'
    AND (p.name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Obtener resumen de un miembro
CREATE OR REPLACE FUNCTION rpc_get_member_summary(p_member_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    SELECT jsonb_build_object(
        'member', jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'email', p.email,
            'created_at', p.created_at
        ),
        'trainer', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('id', t.id, 'name', t.name) ELSE NULL END,
        'diet', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object(
            'name', d.name,
            'calories', d.calories,
            'protein_g', d.protein_g,
            'carbs_g', d.carbs_g,
            'fat_g', d.fat_g
        ) ELSE NULL END,
        'workout', CASE WHEN w.id IS NOT NULL THEN jsonb_build_object('name', w.name) ELSE NULL END,
        'latest_weight', (
            SELECT pr.weight_kg FROM progress_records pr 
            WHERE pr.member_id = p.id AND pr.weight_kg IS NOT NULL 
            ORDER BY pr.date DESC LIMIT 1
        ),
        'total_checkins', (SELECT COUNT(*) FROM workout_checkins wc WHERE wc.member_id = p.id),
        'active_challenges', (
            SELECT COUNT(*) FROM challenge_participants cp 
            JOIN challenges c ON c.id = cp.challenge_id 
            WHERE cp.member_id = p.id AND c.is_active = true
        )
    ) INTO result
    FROM profiles p
    LEFT JOIN trainer_members tm ON tm.member_id = p.id
    LEFT JOIN profiles t ON t.id = tm.trainer_id
    LEFT JOIN member_diets md ON md.member_id = p.id
    LEFT JOIN diet_templates d ON d.id = md.diet_template_id
    LEFT JOIN member_workouts mw ON mw.member_id = p.id
    LEFT JOIN workout_templates w ON w.id = mw.workout_template_id
    WHERE p.id = p_member_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Asignar dieta a miembro
CREATE OR REPLACE FUNCTION rpc_assign_diet_to_member(
    p_member_id UUID,
    p_diet_template_id UUID,
    p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_assigned_by UUID;
    v_diet_name TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    v_assigned_by := COALESCE(p_assigned_by, auth.uid());
    
    SELECT name INTO v_diet_name FROM diet_templates WHERE id = p_diet_template_id;
    IF v_diet_name IS NULL THEN
        RAISE EXCEPTION 'Dieta no encontrada';
    END IF;
    
    INSERT INTO member_diets (member_id, diet_template_id, assigned_by, assigned_at)
    VALUES (p_member_id, p_diet_template_id, v_assigned_by, NOW())
    ON CONFLICT (member_id) DO UPDATE SET 
        diet_template_id = EXCLUDED.diet_template_id,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = NOW();
    
    RETURN jsonb_build_object('success', true, 'diet_name', v_diet_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Asignar rutina a miembro
CREATE OR REPLACE FUNCTION rpc_assign_workout_to_member(
    p_member_id UUID,
    p_workout_template_id UUID,
    p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_assigned_by UUID;
    v_workout_name TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    v_assigned_by := COALESCE(p_assigned_by, auth.uid());
    
    SELECT name INTO v_workout_name FROM workout_templates WHERE id = p_workout_template_id;
    IF v_workout_name IS NULL THEN
        RAISE EXCEPTION 'Rutina no encontrada';
    END IF;
    
    INSERT INTO member_workouts (member_id, workout_template_id, assigned_by, assigned_at)
    VALUES (p_member_id, p_workout_template_id, v_assigned_by, NOW())
    ON CONFLICT (member_id) DO UPDATE SET 
        workout_template_id = EXCLUDED.workout_template_id,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = NOW();
    
    RETURN jsonb_build_object('success', true, 'workout_name', v_workout_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Asignar entrenador a miembro
CREATE OR REPLACE FUNCTION rpc_assign_trainer_to_member(
    p_member_id UUID,
    p_trainer_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_trainer_name TEXT;
    v_member_name TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    SELECT name INTO v_trainer_name FROM profiles WHERE id = p_trainer_id AND role = 'trainer';
    IF v_trainer_name IS NULL THEN
        RAISE EXCEPTION 'Entrenador no encontrado';
    END IF;
    
    SELECT name INTO v_member_name FROM profiles WHERE id = p_member_id AND role = 'member';
    IF v_member_name IS NULL THEN
        RAISE EXCEPTION 'Miembro no encontrado';
    END IF;
    
    INSERT INTO trainer_members (trainer_id, member_id)
    VALUES (p_trainer_id, p_member_id)
    ON CONFLICT (trainer_id, member_id) DO NOTHING;
    
    RETURN jsonb_build_object('success', true, 'trainer_name', v_trainer_name, 'member_name', v_member_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Crear código de invitación
CREATE OR REPLACE FUNCTION rpc_create_invitation_code(
    p_trainer_id UUID,
    p_max_uses INT DEFAULT 10,
    p_expire_days INT DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    v_code TEXT;
    v_trainer_name TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    SELECT name INTO v_trainer_name FROM profiles WHERE id = p_trainer_id AND role = 'trainer';
    IF v_trainer_name IS NULL THEN
        RAISE EXCEPTION 'Entrenador no encontrado';
    END IF;
    
    v_code := 'NLVIP-' || upper(substr(md5(random()::text), 1, 8));
    
    INSERT INTO invitation_codes (code, trainer_id, max_uses, expires_at, is_active)
    VALUES (v_code, p_trainer_id, p_max_uses, NOW() + (p_expire_days || ' days')::interval, true);
    
    RETURN jsonb_build_object('success', true, 'code', v_code, 'trainer_name', v_trainer_name, 'max_uses', p_max_uses, 'expires_in_days', p_expire_days);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Crear aviso
CREATE OR REPLACE FUNCTION rpc_create_notice(
    p_title TEXT,
    p_message TEXT,
    p_priority TEXT DEFAULT 'normal',
    p_member_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_notice_id UUID;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    v_admin_id := auth.uid();
    
    INSERT INTO trainer_notices (trainer_id, member_id, title, message, priority)
    VALUES (v_admin_id, p_member_id, p_title, p_message, p_priority)
    RETURNING id INTO v_notice_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'notice_id', v_notice_id,
        'is_global', p_member_id IS NULL,
        'title', p_title
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Ocultar post del feed
CREATE OR REPLACE FUNCTION rpc_hide_post(p_post_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_author_name TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    UPDATE feed_posts SET is_hidden = true WHERE id = p_post_id
    RETURNING (SELECT name FROM profiles WHERE id = author_id) INTO v_author_name;
    
    IF v_author_name IS NULL THEN
        RAISE EXCEPTION 'Post no encontrado';
    END IF;
    
    RETURN jsonb_build_object('success', true, 'post_id', p_post_id, 'author', v_author_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mostrar post oculto
CREATE OR REPLACE FUNCTION rpc_unhide_post(p_post_id UUID)
RETURNS JSONB AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    UPDATE feed_posts SET is_hidden = false WHERE id = p_post_id;
    
    RETURN jsonb_build_object('success', true, 'post_id', p_post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Obtener dashboard del gimnasio
CREATE OR REPLACE FUNCTION rpc_get_gym_dashboard()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    SELECT jsonb_build_object(
        'total_members', (SELECT COUNT(*) FROM profiles WHERE role = 'member'),
        'total_trainers', (SELECT COUNT(*) FROM profiles WHERE role = 'trainer'),
        'new_members_this_month', (
            SELECT COUNT(*) FROM profiles 
            WHERE role = 'member' 
            AND created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'active_challenges', (SELECT COUNT(*) FROM challenges WHERE is_active = true),
        'total_checkins_this_week', (
            SELECT COUNT(*) FROM workout_checkins 
            WHERE checked_in_at >= date_trunc('week', CURRENT_DATE)
        ),
        'posts_today', (
            SELECT COUNT(*) FROM feed_posts 
            WHERE created_at >= CURRENT_DATE AND is_hidden = false
        ),
        'reported_posts', (
            SELECT COUNT(DISTINCT post_id) FROM feed_reports
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Aplicar plan completo a miembro (dieta + rutina + macros automáticos)
CREATE OR REPLACE FUNCTION rpc_apply_full_member_plan(
    p_member_id UUID,
    p_goal TEXT DEFAULT 'fat_loss',
    p_diet_template_id UUID DEFAULT NULL,
    p_workout_template_id UUID DEFAULT NULL,
    p_weight_kg NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_diet_id UUID;
    v_workout_id UUID;
    v_diet_name TEXT;
    v_workout_name TEXT;
    v_member_name TEXT;
    v_weight NUMERIC;
    v_calories INT;
    v_protein INT;
    v_carbs INT;
    v_fat INT;
    v_trainer_id UUID;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    -- Obtener nombre del miembro
    SELECT name INTO v_member_name FROM profiles WHERE id = p_member_id AND role = 'member';
    IF v_member_name IS NULL THEN
        RAISE EXCEPTION 'Miembro no encontrado';
    END IF;
    
    -- Obtener peso (del parámetro o del último registro)
    IF p_weight_kg IS NOT NULL THEN
        v_weight := p_weight_kg;
    ELSE
        SELECT weight_kg INTO v_weight FROM progress_records 
        WHERE member_id = p_member_id AND weight_kg IS NOT NULL 
        ORDER BY date DESC LIMIT 1;
    END IF;
    
    IF v_weight IS NULL THEN
        v_weight := 70; -- Peso por defecto
    END IF;
    
    -- Calcular macros según objetivo
    IF p_goal = 'fat_loss' THEN
        v_calories := (v_weight * 24 * 0.85)::INT; -- Déficit 15%
    ELSIF p_goal = 'muscle_gain' THEN
        v_calories := (v_weight * 24 * 1.15)::INT; -- Superávit 15%
    ELSE
        v_calories := (v_weight * 24)::INT; -- Mantenimiento
    END IF;
    
    v_protein := (v_weight * 2)::INT; -- 2g por kg
    v_fat := (v_weight * 0.8)::INT; -- 0.8g por kg
    v_carbs := ((v_calories - (v_protein * 4) - (v_fat * 9)) / 4)::INT;
    
    -- Seleccionar dieta (si no se especifica, buscar por goal_tag)
    IF p_diet_template_id IS NOT NULL THEN
        v_diet_id := p_diet_template_id;
    ELSE
        SELECT id INTO v_diet_id FROM diet_templates 
        WHERE goal_tag = p_goal 
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    -- Seleccionar rutina (si no se especifica, buscar por goal_tag)
    IF p_workout_template_id IS NOT NULL THEN
        v_workout_id := p_workout_template_id;
    ELSE
        SELECT id INTO v_workout_id FROM workout_templates 
        WHERE goal_tag = p_goal 
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    -- Obtener trainer asignado
    SELECT trainer_id INTO v_trainer_id FROM trainer_members WHERE member_id = p_member_id LIMIT 1;
    IF v_trainer_id IS NULL THEN
        SELECT id INTO v_trainer_id FROM profiles WHERE role = 'trainer' LIMIT 1;
    END IF;
    
    -- Asignar dieta si existe
    IF v_diet_id IS NOT NULL THEN
        SELECT name INTO v_diet_name FROM diet_templates WHERE id = v_diet_id;
        
        INSERT INTO member_diets (member_id, diet_template_id, assigned_by)
        VALUES (p_member_id, v_diet_id, auth.uid())
        ON CONFLICT (member_id) DO UPDATE SET 
            diet_template_id = EXCLUDED.diet_template_id,
            assigned_by = EXCLUDED.assigned_by,
            assigned_at = NOW();
    END IF;
    
    -- Asignar rutina si existe
    IF v_workout_id IS NOT NULL THEN
        SELECT name INTO v_workout_name FROM workout_templates WHERE id = v_workout_id;
        
        INSERT INTO member_workouts (member_id, workout_template_id, assigned_by)
        VALUES (p_member_id, v_workout_id, auth.uid())
        ON CONFLICT (member_id) DO UPDATE SET 
            workout_template_id = EXCLUDED.workout_template_id,
            assigned_by = EXCLUDED.assigned_by,
            assigned_at = NOW();
    END IF;
    
    -- Log de auditoría
    INSERT INTO admin_assistant_action_logs (
        admin_id, action_type, action_params, target_entities, result, success
    ) VALUES (
        auth.uid(),
        'apply_full_member_plan',
        jsonb_build_object('goal', p_goal, 'weight_kg', v_weight, 'notes', p_notes),
        jsonb_build_object('member_id', p_member_id),
        jsonb_build_object('diet_id', v_diet_id, 'workout_id', v_workout_id, 'calories', v_calories),
        true
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'member_name', v_member_name,
        'goal', p_goal,
        'macros', jsonb_build_object(
            'calories', v_calories,
            'protein_g', v_protein,
            'carbs_g', v_carbs,
            'fat_g', v_fat
        ),
        'diet', v_diet_name,
        'workout', v_workout_name,
        'weight_used', v_weight
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Listar entrenadores
CREATE OR REPLACE FUNCTION rpc_list_trainers()
RETURNS TABLE (id UUID, name TEXT, email TEXT, member_count BIGINT) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    RETURN QUERY
    SELECT p.id, p.name, p.email, COUNT(tm.member_id) as member_count
    FROM profiles p
    LEFT JOIN trainer_members tm ON tm.trainer_id = p.id
    WHERE p.role = 'trainer'
    GROUP BY p.id
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Listar dietas disponibles
CREATE OR REPLACE FUNCTION rpc_list_diets()
RETURNS TABLE (id UUID, name TEXT, calories INT, goal_tag TEXT) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    RETURN QUERY
    SELECT dt.id, dt.name, dt.calories, dt.goal_tag
    FROM diet_templates dt
    ORDER BY dt.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Listar rutinas disponibles
CREATE OR REPLACE FUNCTION rpc_list_workouts()
RETURNS TABLE (id UUID, name TEXT, goal_tag TEXT) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden usar esta función';
    END IF;
    
    RETURN QUERY
    SELECT wt.id, wt.name, wt.goal_tag
    FROM workout_templates wt
    ORDER BY wt.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. SEED DATA PARA DEMO
-- ============================================

-- Asegurar que hay templates con tags
UPDATE diet_templates SET goal_tag = 'fat_loss' WHERE name ILIKE '%definición%' OR name ILIKE '%pérdida%' OR calories < 2000;
UPDATE diet_templates SET goal_tag = 'muscle_gain' WHERE name ILIKE '%volumen%' OR name ILIKE '%ganancia%' OR calories > 2500;
UPDATE diet_templates SET goal_tag = 'maintain' WHERE goal_tag IS NULL;

UPDATE workout_templates SET goal_tag = 'fat_loss' WHERE name ILIKE '%cardio%' OR name ILIKE '%hiit%';
UPDATE workout_templates SET goal_tag = 'muscle_gain' WHERE name ILIKE '%fuerza%' OR name ILIKE '%hipertrofia%';
UPDATE workout_templates SET goal_tag = 'maintain' WHERE goal_tag IS NULL;

-- ============================================
-- VERIFICACIÓN
-- ============================================

SELECT '=== TABLAS CREADAS ===' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'admin_assistant%' AND table_schema = 'public';

SELECT '=== FUNCIONES RPC CREADAS ===' as info;
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE 'rpc_%' AND routine_schema = 'public';
