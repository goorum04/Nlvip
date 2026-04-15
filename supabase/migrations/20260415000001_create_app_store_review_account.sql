-- =========================================================================
-- App Store Review Demo Account
-- 20260415000001_create_app_store_review_account.sql
--
-- Crea una cuenta demo de socio para que los revisores de App Store
-- puedan acceder y verificar la función "Actividad de Hoy".
--
-- Credenciales:
--   Email:      revisor@demo.com
--   Contraseña: NLVip2026!
--
-- Ubicación de la función en la app:
--   Al iniciar sesión → primera pestaña "Actividad" (ícono de huella/pasos)
--   Título en pantalla: "Actividad de Hoy"
--
-- IDEMPOTENTE: No hace nada si la cuenta ya existe.
-- =========================================================================

DO $$
DECLARE
  v_user_id        UUID;
  v_has_provider_id BOOLEAN;
BEGIN

  -- -----------------------------------------------------------------------
  -- Solo ejecutar si la cuenta no existe todavía
  -- -----------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'revisor@demo.com') THEN
    RAISE NOTICE 'La cuenta revisor@demo.com ya existe — sin cambios.';
    RETURN;
  END IF;

  -- Generar UUID fresco para evitar colisiones con perfiles huérfanos
  v_user_id := gen_random_uuid();

  -- -----------------------------------------------------------------------
  -- 1. Crear usuario en auth.users
  -- -----------------------------------------------------------------------
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'revisor@demo.com',
    crypt('NLVip2026!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    '',
    ''
  );

  -- -----------------------------------------------------------------------
  -- 2. Crear identidad (necesaria para login con email/contraseña)
  --    Supabase ≥ 2023-12 añade la columna provider_id a auth.identities.
  --    Se detecta dinámicamente para compatibilidad.
  -- -----------------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name   = 'identities'
      AND column_name  = 'provider_id'
  ) INTO v_has_provider_id;

  IF v_has_provider_id THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      format('{"sub": "%s", "email": "revisor@demo.com"}', v_user_id)::jsonb,
      'email',
      'revisor@demo.com',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      format('{"sub": "%s", "email": "revisor@demo.com"}', v_user_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  -- -----------------------------------------------------------------------
  -- 3. Crear/actualizar perfil de socio con datos completos
  --    weight_kg + height_cm son necesarios para has_complete_profile = true
  --    (ver función calculate_activity_metrics en CUENTA-PASOS.sql)
  --    Hombre, 78 kg, 178 cm → zancada = 178 × 0.415 / 100 = 0.7387 m
  --
  --    Se usa ON CONFLICT porque el trigger on_auth_user_created puede haber
  --    creado ya una fila vacía en profiles al insertar en auth.users.
  -- -----------------------------------------------------------------------
  INSERT INTO profiles (
    id,
    email,
    name,
    role,
    sex,
    weight_kg,
    height_cm,
    steps_goal
  ) VALUES (
    v_user_id,
    'revisor@demo.com',
    'Revisor Demo',
    'member',
    'male',
    78.0,
    178,
    8000
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    name       = EXCLUDED.name,
    role       = EXCLUDED.role,
    sex        = EXCLUDED.sex,
    weight_kg  = EXCLUDED.weight_kg,
    height_cm  = EXCLUDED.height_cm,
    steps_goal = EXCLUDED.steps_goal;

  -- -----------------------------------------------------------------------
  -- 4. Sembrar historial de actividad de los últimos 7 días
  --    Valores pre-calculados para 78 kg, 178 cm (zancada 0.7387 m):
  --      distance_km  = steps × 0.7387 / 1000
  --      calories_kcal = weight_kg × distance_km × 1.036
  --
  --    El día de hoy muestra 6 400 pasos (80 % del objetivo de 8 000).
  -- -----------------------------------------------------------------------
  INSERT INTO daily_activity (
    member_id,
    activity_date,
    steps,
    distance_km,
    calories_kcal,
    source,
    updated_at
  ) VALUES
    (v_user_id, CURRENT_DATE - 6, 7823, 5.779, 467, 'manual', NOW()),
    (v_user_id, CURRENT_DATE - 5, 5210, 3.849, 311, 'manual', NOW()),
    (v_user_id, CURRENT_DATE - 4, 9145, 6.756, 546, 'manual', NOW()),
    (v_user_id, CURRENT_DATE - 3, 6302, 4.655, 376, 'manual', NOW()),
    (v_user_id, CURRENT_DATE - 2, 8471, 6.257, 506, 'manual', NOW()),
    (v_user_id, CURRENT_DATE - 1, 4890, 3.612, 292, 'manual', NOW()),
    (v_user_id, CURRENT_DATE,     6400, 4.728, 382, 'manual', NOW());

  RAISE NOTICE '=========================================================';
  RAISE NOTICE 'Cuenta App Store Review creada correctamente.';
  RAISE NOTICE '  Email:      revisor@demo.com';
  RAISE NOTICE '  Contraseña: NLVip2026!';
  RAISE NOTICE '  Función:    Actividad de Hoy (1ª pestaña al iniciar sesión)';
  RAISE NOTICE '=========================================================';

END $$;
