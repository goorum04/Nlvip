-- =========================================================================
-- Limpieza de rendimiento SEGURA (sin cambios de comportamiento)
-- 20260710000001_safe_perf_cleanup.sql
--
-- Resultado de la auditoría de advisors de Supabase. Contiene ÚNICAMENTE
-- cambios que no alteran el comportamiento de la app ni de las queries:
--   PARTE 1: fijar search_path en 3 funciones (preserva el cuerpo intacto).
--   PARTE 2: borrar índices DUPLICADOS redundantes (copias idénticas).
--
-- Diseño defensivo: todo va con guardas en tiempo de ejecución. Es
-- imposible que esta migración borre un índice que respalde una PRIMARY KEY
-- o una constraint UNIQUE — si un nombre coincidiera con uno de esos, se
-- SALTA en vez de fallar. Idempotente: se puede re-ejecutar sin efecto.
-- =========================================================================

-- =========================================================================
-- PARTE 1: search_path inmutable en funciones marcadas por el advisor
-- (function_search_path_mutable). Usamos ALTER FUNCTION ... SET search_path,
-- que NO reescribe el cuerpo de la función: solo fija la configuración.
-- El bucle recorre TODAS las sobrecargas de cada nombre (rpc_update_daily_steps
-- tiene varias firmas) sin necesidad de conocer sus argumentos.
-- =========================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'start_conversation',
        'rpc_update_daily_steps',
        'calculate_activity_metrics'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    RAISE NOTICE 'search_path fijado en %', r.sig;
  END LOOP;
END $$;

-- =========================================================================
-- PARTE 2: borrar índices duplicados redundantes
-- Para cada par de índices idénticos detectado por el advisor
-- (duplicate_index) conservamos UNO y borramos el otro. La lista de abajo
-- son los que se borran; su gemelo permanece cubriendo la misma columna,
-- así que ninguna query pierde su índice.
--
-- Guarda de seguridad: solo se borra si el índice existe, NO es de una
-- PRIMARY KEY y NO respalda ninguna constraint. Cualquier nombre que
-- resultara respaldar una constraint se salta silenciosamente.
--
-- Reversible: cada índice borrado es una copia exacta de su gemelo, que
-- sigue en la tabla. Si se quisiera recrear, basta clonar la definición
-- del gemelo restante.
-- =========================================================================
DO $$
DECLARE
  target text;
  redundant text[] := ARRAY[
    'idx_action_logs_admin',                    -- gemelo: idx_assistant_action_logs_admin
    'idx_challenge_participants_member',        -- gemelo: idx_challenge_participants_member_id
    'idx_participants_conv',                    -- gemelo: idx_conv_participants_conv
    'idx_participants_user',                    -- gemelo: idx_conv_participants_user
    'idx_cycle_symptoms_user_date',             -- gemelo: cycle_symptoms_user_id_date_key (constraint, se conserva)
    'idx_diet_onboarding_requests_member_id',   -- gemelo: idx_diet_onboarding_member
    'idx_invitation_codes_id',                  -- gemelo: invitation_codes_pkey (PK, se conserva)
    'idx_macro_goal_history_member_id',         -- gemelo: idx_macro_goal_history_member
    'idx_member_badges_member_id',              -- gemelo: idx_member_badges_member
    'idx_member_diets_unique_member',           -- gemelo: member_diets_member_id_key (si es constraint, se salta)
    'idx_member_prs_member_id',                 -- gemelo: idx_member_prs_member
    'idx_member_workouts_unique_member',        -- gemelo: member_workouts_member_id_key (si es constraint, se salta)
    'idx_messages_sender_id',                   -- gemelo: idx_messages_sender
    'progress_photos_member_id_idx',            -- gemelo: idx_progress_photos_member
    'idx_training_videos_uploaded_by',          -- gemelo: idx_training_videos_uploaded
    'idx_user_badges_member_id',                -- gemelo: idx_user_badges_member
    'idx_workout_days_workout_template_id',     -- gemelo: idx_workout_days_template
    'idx_workout_exercises_workout_day_id',     -- gemelo: idx_workout_exercises_day
    'idx_workout_logs_member_id'                -- gemelo: idx_workout_logs_member
  ];
BEGIN
  FOREACH target IN ARRAY redundant LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_index i ON i.indexrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relname = target
        AND NOT i.indisprimary
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint con WHERE con.conindid = c.oid
        )
    ) THEN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', target);
      RAISE NOTICE 'Índice duplicado borrado: %', target;
    ELSE
      RAISE NOTICE 'SALTADO % (no existe, es PK o respalda constraint)', target;
    END IF;
  END LOOP;
END $$;
