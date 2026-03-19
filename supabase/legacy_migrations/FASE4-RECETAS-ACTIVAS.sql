-- ============================================
-- FASE 4: RECETAS ACTIVAS - PLANES SEMANALES
-- NL VIP CLUB - Sistema de Nutrición Avanzado
-- ============================================

-- ============================================
-- 1. CREAR TIPOS ENUM
-- ============================================

-- Enum para estado del plan
DO $$ BEGIN
    CREATE TYPE recipe_plan_status AS ENUM ('active', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para slots de comida
DO $$ BEGIN
    CREATE TYPE meal_slot_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. CREAR TABLA DE RECETAS (si no existe)
-- ============================================

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    prep_time_minutes INT,
    cook_time_minutes INT,
    servings INT DEFAULT 1,
    calories INT,
    protein_g NUMERIC(6,2),
    carbs_g NUMERIC(6,2),
    fat_g NUMERIC(6,2),
    image_url TEXT,
    category TEXT, -- breakfast, lunch, dinner, snack, any
    is_global BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREAR TABLA diet_recipes (si no existe)
-- ============================================

CREATE TABLE IF NOT EXISTS diet_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_template_id UUID REFERENCES diet_templates(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    meal_slot TEXT, -- suggested slot
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diet_template_id, recipe_id)
);

-- ============================================
-- 4. CREAR TABLA member_recipe_plans
-- ============================================

CREATE TABLE IF NOT EXISTS member_recipe_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    nutrition_plan_id UUID,
    diet_template_id UUID REFERENCES diet_templates(id) ON DELETE SET NULL,
    week_start DATE NOT NULL, -- Lunes de la semana
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    target_calories INT,
    target_protein_g NUMERIC(6,2),
    target_carbs_g NUMERIC(6,2),
    target_fat_g NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único: máximo 1 plan activo por semana por member
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_recipe_plans_unique_active 
ON member_recipe_plans(member_id, week_start) 
WHERE status = 'active';

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_member_recipe_plans_member ON member_recipe_plans(member_id);
CREATE INDEX IF NOT EXISTS idx_member_recipe_plans_trainer ON member_recipe_plans(trainer_id);
CREATE INDEX IF NOT EXISTS idx_member_recipe_plans_week ON member_recipe_plans(week_start);

-- ============================================
-- 5. CREAR TABLA member_recipe_plan_items
-- ============================================

CREATE TABLE IF NOT EXISTS member_recipe_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES member_recipe_plans(id) ON DELETE CASCADE,
    day_index INT NOT NULL CHECK (day_index >= 1 AND day_index <= 7), -- 1=Lun, 7=Dom
    meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_id, day_index, meal_slot)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON member_recipe_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_recipe ON member_recipe_plan_items(recipe_id);

-- ============================================
-- 6. HABILITAR RLS
-- ============================================

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_recipe_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_recipe_plan_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. POLÍTICAS RLS PARA recipes
-- ============================================

DROP POLICY IF EXISTS "recipes_select_all" ON recipes;
CREATE POLICY "recipes_select_all" ON recipes FOR SELECT USING (true);

DROP POLICY IF EXISTS "recipes_insert_admin_trainer" ON recipes;
CREATE POLICY "recipes_insert_admin_trainer" ON recipes FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

DROP POLICY IF EXISTS "recipes_update_admin_trainer" ON recipes;
CREATE POLICY "recipes_update_admin_trainer" ON recipes FOR UPDATE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- ============================================
-- 8. POLÍTICAS RLS PARA diet_recipes
-- ============================================

DROP POLICY IF EXISTS "diet_recipes_select_all" ON diet_recipes;
CREATE POLICY "diet_recipes_select_all" ON diet_recipes FOR SELECT USING (true);

DROP POLICY IF EXISTS "diet_recipes_insert_admin_trainer" ON diet_recipes;
CREATE POLICY "diet_recipes_insert_admin_trainer" ON diet_recipes FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- ============================================
-- 9. POLÍTICAS RLS PARA member_recipe_plans
-- ============================================

DROP POLICY IF EXISTS "plans_select_own_or_assigned" ON member_recipe_plans;
CREATE POLICY "plans_select_own_or_assigned" ON member_recipe_plans FOR SELECT USING (
    member_id = auth.uid()
    OR trainer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = member_recipe_plans.member_id)
);

DROP POLICY IF EXISTS "plans_insert_trainer_admin" ON member_recipe_plans;
CREATE POLICY "plans_insert_trainer_admin" ON member_recipe_plans FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = member_recipe_plans.member_id)
);

DROP POLICY IF EXISTS "plans_update_trainer_admin" ON member_recipe_plans;
CREATE POLICY "plans_update_trainer_admin" ON member_recipe_plans FOR UPDATE USING (
    trainer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = member_recipe_plans.member_id)
);

DROP POLICY IF EXISTS "plans_delete_trainer_admin" ON member_recipe_plans;
CREATE POLICY "plans_delete_trainer_admin" ON member_recipe_plans FOR DELETE USING (
    trainer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 10. POLÍTICAS RLS PARA member_recipe_plan_items
-- ============================================

DROP POLICY IF EXISTS "items_select" ON member_recipe_plan_items;
CREATE POLICY "items_select" ON member_recipe_plan_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM member_recipe_plans p 
        WHERE p.id = member_recipe_plan_items.plan_id 
        AND (
            p.member_id = auth.uid()
            OR p.trainer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
            OR EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = p.member_id)
        )
    )
);

DROP POLICY IF EXISTS "items_insert" ON member_recipe_plan_items;
CREATE POLICY "items_insert" ON member_recipe_plan_items FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM member_recipe_plans p 
        WHERE p.id = member_recipe_plan_items.plan_id 
        AND (
            p.trainer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
            OR EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = p.member_id)
        )
    )
);

DROP POLICY IF EXISTS "items_update" ON member_recipe_plan_items;
CREATE POLICY "items_update" ON member_recipe_plan_items FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM member_recipe_plans p 
        WHERE p.id = member_recipe_plan_items.plan_id 
        AND (
            p.trainer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
            OR EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = auth.uid() AND member_id = p.member_id)
        )
    )
);

DROP POLICY IF EXISTS "items_delete" ON member_recipe_plan_items;
CREATE POLICY "items_delete" ON member_recipe_plan_items FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM member_recipe_plans p 
        WHERE p.id = member_recipe_plan_items.plan_id 
        AND (
            p.trainer_id = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
);

-- ============================================
-- FIN DEL SCRIPT DE ESTRUCTURA
-- ============================================
