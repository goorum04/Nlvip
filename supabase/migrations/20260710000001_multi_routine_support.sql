-- Permite que un socio tenga más de una rutina asignada a la vez (p.ej.
-- "Principal" y "Días sin tiempo" / "Vacaciones"). Antes, member_workouts
-- tenía UNIQUE(member_id), forzando una única rutina por socio.

ALTER TABLE member_workouts
  ADD COLUMN IF NOT EXISTS routine_slot text NOT NULL DEFAULT 'principal';

-- Además del índice idx_member_workouts_unique_member, la tabla tenía una
-- constraint UNIQUE(member_id) propia de la definición original de la
-- tabla (member_workouts_member_id_key). Hay que tumbar también esa.
ALTER TABLE member_workouts DROP CONSTRAINT IF EXISTS member_workouts_member_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_workouts_routine_slot_check'
  ) THEN
    ALTER TABLE member_workouts
      ADD CONSTRAINT member_workouts_routine_slot_check
      CHECK (routine_slot IN ('principal', 'alternativa'));
  END IF;
END $$;

DROP INDEX IF EXISTS idx_member_workouts_unique_member;
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_workouts_unique_member_slot
  ON member_workouts(member_id, routine_slot);

-- rpc_assign_workout_to_member: acepta ahora el slot de la rutina.
CREATE OR REPLACE FUNCTION public.rpc_assign_workout_to_member(
  p_member_id uuid,
  p_workout_template_id uuid,
  p_assigned_by uuid DEFAULT NULL::uuid,
  p_routine_slot text DEFAULT 'principal'
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_workout_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  IF p_routine_slot NOT IN ('principal', 'alternativa') THEN RAISE EXCEPTION 'routine_slot inválido: %', p_routine_slot; END IF;
  SELECT name INTO v_workout_name FROM workout_templates WHERE id = p_workout_template_id;
  IF v_workout_name IS NULL THEN RAISE EXCEPTION 'Rutina no encontrada'; END IF;
  INSERT INTO member_workouts (member_id, workout_template_id, assigned_by, assigned_at, routine_slot)
  VALUES (p_member_id, p_workout_template_id, COALESCE(p_assigned_by, auth.uid()), NOW(), p_routine_slot)
  ON CONFLICT (member_id, routine_slot) DO UPDATE SET
    workout_template_id = EXCLUDED.workout_template_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = NOW();
  RETURN jsonb_build_object('success', true, 'workout_name', v_workout_name, 'routine_slot', p_routine_slot);
END;
$function$;

-- rpc_apply_full_member_plan: el "plan completo" sigue asignando siempre a
-- la rutina "principal" (no toca la alternativa del socio, si la tuviera).
CREATE OR REPLACE FUNCTION public.rpc_apply_full_member_plan(p_member_id uuid, p_goal text DEFAULT 'fat_loss'::text, p_diet_template_id uuid DEFAULT NULL::uuid, p_workout_template_id uuid DEFAULT NULL::uuid, p_weight_kg numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_diet_id    UUID; v_workout_id UUID;
  v_diet_name  TEXT; v_workout_name TEXT; v_member_name TEXT;
  v_weight     NUMERIC;
  v_calories   INT; v_protein INT; v_carbs INT; v_fat INT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT name INTO v_member_name FROM profiles WHERE id = p_member_id AND role = 'member';
  IF v_member_name IS NULL THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  v_weight := COALESCE(p_weight_kg, (SELECT weight_kg FROM progress_records WHERE member_id = p_member_id AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1), 70);

  IF    p_goal = 'fat_loss'    THEN v_calories := (v_weight * 24 * 0.85)::INT;
  ELSIF p_goal = 'muscle_gain' THEN v_calories := (v_weight * 24 * 1.15)::INT;
  ELSE                               v_calories := (v_weight * 24)::INT;
  END IF;
  v_protein := (v_weight * 2)::INT;
  v_fat     := (v_weight * 0.8)::INT;
  v_carbs   := ((v_calories - (v_protein * 4) - (v_fat * 9)) / 4)::INT;

  v_diet_id    := COALESCE(p_diet_template_id,    (SELECT id FROM diet_templates    WHERE goal_tag = p_goal ORDER BY created_at DESC LIMIT 1));
  v_workout_id := COALESCE(p_workout_template_id, (SELECT id FROM workout_templates WHERE goal_tag = p_goal ORDER BY created_at DESC LIMIT 1));

  IF v_diet_id IS NOT NULL THEN
    SELECT name INTO v_diet_name FROM diet_templates WHERE id = v_diet_id;
    INSERT INTO member_diets (member_id, diet_template_id, assigned_by)
    VALUES (p_member_id, v_diet_id, auth.uid())
    ON CONFLICT (member_id) DO UPDATE SET diet_template_id = EXCLUDED.diet_template_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW();
  END IF;

  IF v_workout_id IS NOT NULL THEN
    SELECT name INTO v_workout_name FROM workout_templates WHERE id = v_workout_id;
    INSERT INTO member_workouts (member_id, workout_template_id, assigned_by, routine_slot)
    VALUES (p_member_id, v_workout_id, auth.uid(), 'principal')
    ON CONFLICT (member_id, routine_slot) DO UPDATE SET workout_template_id = EXCLUDED.workout_template_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW();
  END IF;

  -- Audit log
  INSERT INTO admin_assistant_action_logs (admin_id, action_type, action_params, target_entities, result, success)
  VALUES (auth.uid(), 'apply_full_member_plan',
    jsonb_build_object('goal', p_goal, 'weight_kg', v_weight, 'notes', p_notes),
    jsonb_build_object('member_id', p_member_id),
    jsonb_build_object('diet_id', v_diet_id, 'workout_id', v_workout_id, 'calories', v_calories),
    true);

  RETURN jsonb_build_object(
    'success', true, 'member_name', v_member_name, 'goal', p_goal,
    'macros', jsonb_build_object('calories', v_calories, 'protein_g', v_protein, 'carbs_g', v_carbs, 'fat_g', v_fat),
    'diet', v_diet_name, 'workout', v_workout_name, 'weight_used', v_weight,
    'diet_id', v_diet_id, 'workout_id', v_workout_id
  );
END;
$function$;

-- rpc_get_member_summary: devuelve todas las rutinas del socio (array),
-- manteniendo 'workout' (la principal) para no romper nada que ya lo lea.
CREATE OR REPLACE FUNCTION public.rpc_get_member_summary(p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSONB;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  SELECT jsonb_build_object(
    'member',   jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'created_at', p.created_at),
    'trainer',  CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('id', t.id, 'name', t.name) ELSE NULL END,
    'diet',     CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('name', d.name, 'calories', d.calories, 'protein_g', d.protein_g, 'carbs_g', d.carbs_g, 'fat_g', d.fat_g) ELSE NULL END,
    'workout',  CASE WHEN w.id IS NOT NULL THEN jsonb_build_object('name', w.name) ELSE NULL END,
    'workouts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('slot', mw2.routine_slot, 'name', w2.name) ORDER BY mw2.routine_slot)
      FROM member_workouts mw2
      JOIN workout_templates w2 ON w2.id = mw2.workout_template_id
      WHERE mw2.member_id = p.id
    ), '[]'::jsonb),
    'latest_weight',    (SELECT pr.weight_kg  FROM progress_records pr WHERE pr.member_id = p.id AND pr.weight_kg IS NOT NULL ORDER BY pr.date DESC LIMIT 1),
    'total_checkins',   (SELECT COUNT(*)       FROM workout_checkins  wc WHERE wc.member_id = p.id),
    'active_challenges',(SELECT COUNT(*) FROM challenge_participants cp JOIN challenges c ON c.id = cp.challenge_id WHERE cp.member_id = p.id AND c.is_active = true)
  ) INTO result
  FROM profiles p
  LEFT JOIN trainer_members tm ON tm.member_id = p.id
  LEFT JOIN profiles t ON t.id = tm.trainer_id
  LEFT JOIN member_diets md ON md.member_id = p.id
  LEFT JOIN diet_templates d ON d.id = md.diet_template_id
  LEFT JOIN member_workouts mw ON mw.member_id = p.id AND mw.routine_slot = 'principal'
  LEFT JOIN workout_templates w ON w.id = mw.workout_template_id
  WHERE p.id = p_member_id;
  RETURN result;
END;
$function$;
