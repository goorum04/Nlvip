-- Socios que conviven (pareja/familia): comparten el mismo menú semanal
-- (mismos platos, mismos días) en vez de que cada uno reciba recetas
-- distintas, porque en la práctica cocinan un único plato. Lo que varía
-- por persona es la ración, ajustada a sus propios macros objetivo.
--
-- household_members.member_id es UNIQUE: un socio pertenece como mucho a
-- un hogar, lo que permite vincular/mover con un simple upsert(onConflict
-- member_id) desde el panel del entrenador.

CREATE TABLE IF NOT EXISTS households (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  added_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (household_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage households" ON households;
CREATE POLICY "Staff manage households" ON households FOR ALL USING (
  is_admin() OR is_trainer()
) WITH CHECK (
  is_admin() OR is_trainer()
);

-- Igual que macro_goals: un entrenador solo puede vincular/desvincular a
-- socios que tiene asignados en trainer_members; un admin, a cualquiera.
DROP POLICY IF EXISTS "Staff manage household members" ON household_members;
CREATE POLICY "Staff manage household members" ON household_members FOR ALL USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = household_members.member_id)
) WITH CHECK (
  is_admin() OR
  EXISTS (SELECT 1 FROM trainer_members WHERE trainer_id = (SELECT auth.uid()) AND member_id = household_members.member_id)
);

-- Item de plan: cuánto se desvía la ración de este socio respecto al menú
-- "base" del hogar (1 = igual) y, si se desvía, la lista de ingredientes
-- reescrita con las cantidades ya ajustadas para él/ella (generada por IA
-- en generate-recipe-plan). NULL = usar los ingredientes tal cual del
-- recipe_catalog (caso normal, socio sin hogar o ración base del hogar).
ALTER TABLE member_recipe_plan_items ADD COLUMN IF NOT EXISTS portion_scale numeric(4,2) NOT NULL DEFAULT 1;
ALTER TABLE member_recipe_plan_items ADD COLUMN IF NOT EXISTS adjusted_ingredients text[];
