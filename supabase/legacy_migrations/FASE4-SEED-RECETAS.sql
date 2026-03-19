-- ============================================
-- FASE 4: SEED DATA - RECETAS Y PLANES
-- NL VIP CLUB - Datos Demo
-- ============================================

-- ============================================
-- 1. INSERTAR RECETAS DEMO (15 recetas variadas)
-- ============================================

INSERT INTO recipes (name, description, instructions, prep_time_minutes, cook_time_minutes, servings, calories, protein_g, carbs_g, fat_g, category) VALUES
-- DESAYUNOS (breakfast)
('Tortilla de Claras con Espinacas', 'Tortilla alta en proteína con espinacas frescas', 'Batir 4 claras con espinacas. Cocinar a fuego medio 3 min por lado.', 5, 8, 1, 180, 28, 4, 2, 'breakfast'),
('Avena con Plátano y Almendras', 'Bowl de avena energético para empezar el día', 'Cocinar 50g avena con agua. Añadir plátano troceado y 15g almendras.', 5, 10, 1, 380, 12, 58, 10, 'breakfast'),
('Tostadas Integrales con Aguacate', 'Desayuno saludable con grasas buenas', '2 tostadas integrales con medio aguacate machacado y tomate.', 5, 3, 1, 320, 8, 35, 16, 'breakfast'),
('Yogur Griego con Frutos Rojos', 'Proteína con antioxidantes naturales', 'Mezclar 200g yogur griego con mix de frutos rojos frescos.', 3, 0, 1, 180, 20, 15, 5, 'breakfast'),
('Batido de Proteína y Avena', 'Shake perfecto post-entreno mañanero', 'Batir proteína whey, 30g avena, plátano y leche de almendras.', 5, 0, 1, 350, 35, 38, 6, 'breakfast'),

-- COMIDAS (lunch)
('Pechuga de Pollo a la Plancha', 'Proteína magra con guarnición de verduras', 'Marinar pechuga 30 min. Cocinar 6 min por lado. Servir con brócoli.', 35, 12, 1, 420, 45, 12, 18, 'lunch'),
('Arroz Integral con Salmón', 'Omega-3 y carbohidratos complejos', 'Cocinar arroz. Hornear salmón 15 min a 180°C. Servir con espárragos.', 10, 25, 1, 520, 38, 48, 16, 'lunch'),
('Ensalada César con Pollo', 'Clásica ensalada alta en proteína', 'Mezclar lechuga, pollo a la plancha, parmesano y aderezo ligero.', 15, 10, 1, 380, 35, 12, 20, 'lunch'),
('Bowl de Quinoa y Verduras', 'Superalimento con proteína vegetal completa', 'Cocinar quinoa. Añadir garbanzos, pepino, tomate, aceite de oliva.', 10, 15, 1, 450, 18, 55, 14, 'lunch'),
('Tacos de Carne Magra', 'Proteína con tortillas de maíz', '150g carne picada 5% grasa, 3 tortillas maíz, pico de gallo.', 15, 12, 1, 420, 35, 40, 12, 'lunch'),

-- CENAS (dinner)
('Merluza al Horno con Patata', 'Pescado blanco bajo en grasa', 'Hornear merluza 20 min con patata y pimiento asado.', 10, 25, 1, 350, 32, 28, 10, 'dinner'),
('Pavo con Verduras Salteadas', 'Cena ligera alta en proteína', 'Saltear pechuga de pavo con calabacín, zanahoria y setas.', 10, 15, 1, 320, 38, 15, 8, 'dinner'),
('Tortilla Francesa con Ensalada', 'Opción rápida y nutritiva', '3 huevos enteros en tortilla. Acompañar con ensalada mixta.', 5, 8, 1, 280, 22, 8, 18, 'dinner'),

-- SNACKS
('Batido de Caseína', 'Proteína de absorción lenta para la noche', 'Batir caseína con agua o leche desnatada.', 2, 0, 1, 120, 24, 4, 1, 'snack'),
('Mix de Frutos Secos', '30g de nueces, almendras y anacardos', 'Porción controlada de frutos secos variados.', 1, 0, 1, 180, 5, 8, 16, 'snack')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. VINCULAR RECETAS A DIETA DEMO
-- ============================================

DO $$
DECLARE
    diet_id UUID;
    trainer_id UUID;
    member_id UUID;
    recipe_rec RECORD;
    plan_id UUID;
    day_idx INT;
    current_week_start DATE;
BEGIN
    -- Obtener IDs
    SELECT id INTO trainer_id FROM profiles WHERE role = 'trainer' LIMIT 1;
    SELECT id INTO member_id FROM profiles WHERE role = 'member' AND name = 'Said' LIMIT 1;
    SELECT id INTO diet_id FROM diet_templates WHERE trainer_id = trainer_id LIMIT 1;
    
    -- Calcular lunes de esta semana
    current_week_start := date_trunc('week', CURRENT_DATE)::date;
    
    -- Si no hay dieta, crear una
    IF diet_id IS NULL THEN
        INSERT INTO diet_templates (trainer_id, name, calories, protein_g, carbs_g, fat_g, content)
        VALUES (trainer_id, 'Plan Definición Premium', 2200, 165, 220, 73, 
            'Plan nutricional personalizado para definición muscular. 5-6 comidas al día.')
        RETURNING id INTO diet_id;
    END IF;

    -- Vincular recetas a la dieta
    FOR recipe_rec IN SELECT id, category FROM recipes LOOP
        INSERT INTO diet_recipes (diet_template_id, recipe_id, meal_slot)
        VALUES (diet_id, recipe_rec.id, recipe_rec.category)
        ON CONFLICT (diet_template_id, recipe_id) DO NOTHING;
    END LOOP;

    -- ============================================
    -- 3. CREAR PLAN SEMANAL PARA SOCIO DEMO
    -- ============================================

    IF member_id IS NOT NULL AND trainer_id IS NOT NULL THEN
        -- Archivar planes anteriores
        UPDATE member_recipe_plans 
        SET status = 'archived', updated_at = NOW()
        WHERE member_id = member_id AND status = 'active';

        -- Crear nuevo plan
        INSERT INTO member_recipe_plans (
            member_id, trainer_id, diet_template_id, week_start,
            target_calories, target_protein_g, target_carbs_g, target_fat_g, status
        ) VALUES (
            member_id, trainer_id, diet_id, current_week_start,
            2200, 165, 220, 73, 'active'
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO plan_id;

        -- Si se creó el plan, añadir items
        IF plan_id IS NOT NULL THEN
            -- Generar items para 7 días
            FOR day_idx IN 1..7 LOOP
                -- Desayuno
                INSERT INTO member_recipe_plan_items (plan_id, day_index, meal_slot, recipe_id, notes)
                SELECT plan_id, day_idx, 'breakfast', id, 
                    CASE WHEN day_idx IN (1,3,5) THEN 'Día de entreno - extra proteína' ELSE NULL END
                FROM recipes WHERE category = 'breakfast'
                ORDER BY RANDOM() LIMIT 1
                ON CONFLICT (plan_id, day_index, meal_slot) DO NOTHING;

                -- Comida
                INSERT INTO member_recipe_plan_items (plan_id, day_index, meal_slot, recipe_id, notes)
                SELECT plan_id, day_idx, 'lunch', id,
                    CASE WHEN day_idx = 7 THEN 'Día libre - puedes variar porciones' ELSE NULL END
                FROM recipes WHERE category = 'lunch'
                ORDER BY RANDOM() LIMIT 1
                ON CONFLICT (plan_id, day_index, meal_slot) DO NOTHING;

                -- Cena
                INSERT INTO member_recipe_plan_items (plan_id, day_index, meal_slot, recipe_id, notes)
                SELECT plan_id, day_idx, 'dinner', id, NULL
                FROM recipes WHERE category = 'dinner'
                ORDER BY RANDOM() LIMIT 1
                ON CONFLICT (plan_id, day_index, meal_slot) DO NOTHING;

                -- Snack (solo algunos días)
                IF day_idx IN (1, 2, 4, 5, 6) THEN
                    INSERT INTO member_recipe_plan_items (plan_id, day_index, meal_slot, recipe_id, notes)
                    SELECT plan_id, day_idx, 'snack', id, 'Entre comidas o antes de dormir'
                    FROM recipes WHERE category = 'snack'
                    ORDER BY RANDOM() LIMIT 1
                    ON CONFLICT (plan_id, day_index, meal_slot) DO NOTHING;
                END IF;
            END LOOP;

            RAISE NOTICE 'Plan semanal creado para member_id: % con plan_id: %', member_id, plan_id;
        END IF;
    END IF;
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

SELECT '=== RECETAS CREADAS ===' as info;
SELECT name, category, calories, protein_g FROM recipes ORDER BY category;

SELECT '=== PLAN SEMANAL DEL SOCIO ===' as info;
SELECT 
    mrp.week_start,
    mrp.target_calories,
    p.name as member_name,
    COUNT(mrpi.id) as total_items
FROM member_recipe_plans mrp
JOIN profiles p ON p.id = mrp.member_id
LEFT JOIN member_recipe_plan_items mrpi ON mrpi.plan_id = mrp.id
GROUP BY mrp.id, p.name
ORDER BY mrp.week_start DESC;

SELECT '=== ITEMS DEL PLAN ===' as info;
SELECT 
    mrpi.day_index,
    mrpi.meal_slot,
    r.name as recipe,
    r.calories,
    mrpi.notes
FROM member_recipe_plan_items mrpi
JOIN member_recipe_plans mrp ON mrp.id = mrpi.plan_id
JOIN recipes r ON r.id = mrpi.recipe_id
WHERE mrp.status = 'active'
ORDER BY mrpi.day_index, 
    CASE mrpi.meal_slot 
        WHEN 'breakfast' THEN 1 
        WHEN 'lunch' THEN 2 
        WHEN 'dinner' THEN 3 
        WHEN 'snack' THEN 4 
    END;
