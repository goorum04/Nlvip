-- ============================================
-- FASE 3: SEED DATA - RETOS Y BADGES
-- NL VIP CLUB - Datos Demo
-- ============================================
-- EJECUTAR DESPUÉS DE FASE3-RETOS-BADGES.sql

-- ============================================
-- 1. OBTENER IDs DE USUARIOS DEMO
-- ============================================

-- Primero verificamos los usuarios existentes
-- SELECT id, email, name, role FROM profiles;

-- ============================================
-- 2. CREAR BADGES (7 LOGROS)
-- ============================================

INSERT INTO badges (title, description, icon, color, condition_type, condition_value) VALUES
    ('Primer Paso', 'Completaste tu primer entrenamiento', 'footprints', 'bronze', 'first_workout', 1),
    ('En Racha', 'Mantuviste una racha de 7 días', 'flame', 'orange', 'streak', 7),
    ('Dedicación', 'Completaste 10 entrenamientos', 'dumbbell', 'silver', 'workouts_count', 10),
    ('Imparable', 'Completaste 25 entrenamientos', 'trophy', 'gold', 'workouts_count', 25),
    ('Leyenda', 'Completaste 50 entrenamientos', 'crown', 'platinum', 'workouts_count', 50),
    ('Retador', 'Completaste tu primer reto', 'target', 'green', 'challenge_completed', 1),
    ('Campeón', 'Completaste 5 retos', 'medal', 'gold', 'challenge_completed', 5)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CREAR RETOS ACTIVOS
-- ============================================

-- Obtener ID del trainer (Didac) para crear retos
DO $$
DECLARE
    trainer_id UUID;
    admin_id UUID;
    member_id UUID;
    challenge1_id UUID;
    challenge2_id UUID;
    challenge3_id UUID;
    challenge4_id UUID;
    badge_primer_paso UUID;
    badge_racha UUID;
    badge_dedicacion UUID;
    badge_retador UUID;
BEGIN
    -- Obtener IDs
    SELECT id INTO trainer_id FROM profiles WHERE role = 'trainer' LIMIT 1;
    SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;
    SELECT id INTO member_id FROM profiles WHERE role = 'member' LIMIT 1;
    
    -- Obtener IDs de badges
    SELECT id INTO badge_primer_paso FROM badges WHERE title = 'Primer Paso' LIMIT 1;
    SELECT id INTO badge_racha FROM badges WHERE title = 'En Racha' LIMIT 1;
    SELECT id INTO badge_dedicacion FROM badges WHERE title = 'Dedicación' LIMIT 1;
    SELECT id INTO badge_retador FROM badges WHERE title = 'Retador' LIMIT 1;

    -- RETO 1: 10 Entrenamientos en 2 semanas (ACTIVO)
    INSERT INTO challenges (title, description, type, target_value, start_date, end_date, created_by, is_active)
    VALUES (
        '💪 Desafío de Fuerza',
        'Completa 10 entrenamientos en las próximas 2 semanas. ¡Demuestra tu compromiso!',
        'workouts',
        10,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '11 days',
        trainer_id,
        true
    ) RETURNING id INTO challenge1_id;

    -- RETO 2: Consistencia 14 días (ACTIVO)
    INSERT INTO challenges (title, description, type, target_value, start_date, end_date, created_by, is_active)
    VALUES (
        '🔥 Racha de Fuego',
        'Entrena al menos 1 vez cada día durante 14 días consecutivos. ¡Sin excusas!',
        'consistency',
        14,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '9 days',
        admin_id,
        true
    ) RETURNING id INTO challenge2_id;

    -- RETO 3: Meta de peso (ACTIVO)
    INSERT INTO challenges (title, description, type, target_value, start_date, end_date, created_by, is_active)
    VALUES (
        '⚖️ Transformación Total',
        'Pierde 3kg de grasa manteniendo tu masa muscular. ¡El verano se acerca!',
        'weight',
        3,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE + INTERVAL '50 days',
        trainer_id,
        true
    ) RETURNING id INTO challenge3_id;

    -- RETO 4: Completado (HISTÓRICO)
    INSERT INTO challenges (title, description, type, target_value, start_date, end_date, created_by, is_active)
    VALUES (
        '🏆 Desafío del Mes Pasado',
        '5 entrenamientos en una semana. ¡Lo conseguiste!',
        'workouts',
        5,
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '23 days',
        trainer_id,
        false
    ) RETURNING id INTO challenge4_id;

    -- ============================================
    -- 4. INSCRIBIR AL SOCIO DEMO EN RETOS
    -- ============================================

    -- Participación en reto 1 (progreso parcial)
    INSERT INTO challenge_participants (challenge_id, member_id, progress_value, completed, joined_at)
    VALUES (challenge1_id, member_id, 6, false, CURRENT_DATE - INTERVAL '3 days')
    ON CONFLICT (challenge_id, member_id) DO NOTHING;

    -- Participación en reto 2 (progreso parcial)
    INSERT INTO challenge_participants (challenge_id, member_id, progress_value, completed, joined_at)
    VALUES (challenge2_id, member_id, 8, false, CURRENT_DATE - INTERVAL '5 days')
    ON CONFLICT (challenge_id, member_id) DO NOTHING;

    -- Participación en reto 3 (recién empezado)
    INSERT INTO challenge_participants (challenge_id, member_id, progress_value, completed, joined_at)
    VALUES (challenge3_id, member_id, 0.8, false, CURRENT_DATE - INTERVAL '10 days')
    ON CONFLICT (challenge_id, member_id) DO NOTHING;

    -- Participación en reto 4 (COMPLETADO)
    INSERT INTO challenge_participants (challenge_id, member_id, progress_value, completed, completed_at, joined_at)
    VALUES (challenge4_id, member_id, 5, true, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '30 days')
    ON CONFLICT (challenge_id, member_id) DO NOTHING;

    -- ============================================
    -- 5. ASIGNAR BADGES AL SOCIO DEMO
    -- ============================================

    -- Badge: Primer Paso
    INSERT INTO user_badges (badge_id, member_id, awarded_at)
    VALUES (badge_primer_paso, member_id, CURRENT_DATE - INTERVAL '45 days')
    ON CONFLICT (badge_id, member_id) DO NOTHING;

    -- Badge: En Racha
    INSERT INTO user_badges (badge_id, member_id, awarded_at)
    VALUES (badge_racha, member_id, CURRENT_DATE - INTERVAL '30 days')
    ON CONFLICT (badge_id, member_id) DO NOTHING;

    -- Badge: Dedicación (10 entrenos)
    INSERT INTO user_badges (badge_id, member_id, awarded_at)
    VALUES (badge_dedicacion, member_id, CURRENT_DATE - INTERVAL '20 days')
    ON CONFLICT (badge_id, member_id) DO NOTHING;

    -- Badge: Retador (completó un reto)
    INSERT INTO user_badges (badge_id, member_id, awarded_at)
    VALUES (badge_retador, member_id, CURRENT_DATE - INTERVAL '25 days')
    ON CONFLICT (badge_id, member_id) DO NOTHING;

    -- ============================================
    -- 6. CREAR WORKOUT CHECK-INS PARA GRÁFICAS
    -- ============================================

    -- Check-ins de los últimos 30 días para el socio demo
    INSERT INTO workout_checkins (member_id, checked_in_at, duration_minutes, notes) VALUES
        (member_id, CURRENT_DATE - INTERVAL '1 day', 65, 'Día de pierna intenso'),
        (member_id, CURRENT_DATE - INTERVAL '2 days', 55, 'Upper body'),
        (member_id, CURRENT_DATE - INTERVAL '4 days', 70, 'Full body'),
        (member_id, CURRENT_DATE - INTERVAL '5 days', 45, 'Cardio y core'),
        (member_id, CURRENT_DATE - INTERVAL '7 days', 60, 'Push day'),
        (member_id, CURRENT_DATE - INTERVAL '8 days', 55, 'Pull day'),
        (member_id, CURRENT_DATE - INTERVAL '10 days', 50, 'Legs'),
        (member_id, CURRENT_DATE - INTERVAL '12 days', 65, 'Upper body'),
        (member_id, CURRENT_DATE - INTERVAL '14 days', 60, 'Full body'),
        (member_id, CURRENT_DATE - INTERVAL '15 days', 45, 'Cardio'),
        (member_id, CURRENT_DATE - INTERVAL '17 days', 70, 'Push day'),
        (member_id, CURRENT_DATE - INTERVAL '19 days', 55, 'Pull day'),
        (member_id, CURRENT_DATE - INTERVAL '21 days', 60, 'Legs'),
        (member_id, CURRENT_DATE - INTERVAL '23 days', 50, 'Upper body'),
        (member_id, CURRENT_DATE - INTERVAL '25 days', 65, 'Full body'),
        (member_id, CURRENT_DATE - INTERVAL '28 days', 55, 'Push day')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Seed completado para member_id: %', member_id;
END $$;

-- ============================================
-- 7. CREAR/ACTUALIZAR PROGRESS RECORDS PARA GRÁFICAS DE PESO
-- (Si no existen, los añadimos)
-- ============================================

-- Añadir registros de peso si la tabla existe
DO $$
DECLARE
    member_id UUID;
BEGIN
    SELECT id INTO member_id FROM profiles WHERE role = 'member' LIMIT 1;
    
    -- Verificar si existe la tabla progress_records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'progress_records') THEN
        -- Insertar datos de progreso de peso
        INSERT INTO progress_records (member_id, date, weight_kg, notes) VALUES
            (member_id, CURRENT_DATE - INTERVAL '30 days', 82.5, 'Inicio del programa'),
            (member_id, CURRENT_DATE - INTERVAL '25 days', 82.0, 'Primera semana'),
            (member_id, CURRENT_DATE - INTERVAL '20 days', 81.3, 'Buen progreso'),
            (member_id, CURRENT_DATE - INTERVAL '15 days', 80.8, 'Manteniéndome'),
            (member_id, CURRENT_DATE - INTERVAL '10 days', 80.2, 'Bajando bien'),
            (member_id, CURRENT_DATE - INTERVAL '5 days', 79.5, 'Excelente semana'),
            (member_id, CURRENT_DATE, 79.0, 'Objetivo casi alcanzado')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar badges creados
SELECT '=== BADGES CREADOS ===' as info;
SELECT title, icon, color, condition_type, condition_value FROM badges;

-- Verificar retos creados
SELECT '=== RETOS CREADOS ===' as info;
SELECT title, type, target_value, is_active, start_date, end_date FROM challenges;

-- Verificar participaciones
SELECT '=== PARTICIPACIONES ===' as info;
SELECT c.title, p.name as member, cp.progress_value, cp.completed 
FROM challenge_participants cp
JOIN challenges c ON c.id = cp.challenge_id
JOIN profiles p ON p.id = cp.member_id;

-- Verificar badges del socio
SELECT '=== BADGES DEL SOCIO ===' as info;
SELECT b.title, b.icon, ub.awarded_at 
FROM user_badges ub
JOIN badges b ON b.id = ub.badge_id;

-- Verificar check-ins
SELECT '=== CHECK-INS ===' as info;
SELECT COUNT(*) as total_checkins, 
       MIN(checked_in_at) as primer_checkin, 
       MAX(checked_in_at) as ultimo_checkin 
FROM workout_checkins;
