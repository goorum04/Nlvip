-- ================================================
-- NL VIP CLUB - FASE 2: SEED DEMO DATA
-- ================================================
-- Añade datos demo para:
-- - Vídeos de rutinas
-- - Posts con imágenes
-- - Fotos de progreso del socio
-- 
-- EJECUTAR DESPUÉS DE FASE2-TABLAS-RLS.sql y FASE2-STORAGE-POLICIES.sql
-- ================================================

-- ================================================
-- OBTENER IDs DE USUARIOS DEMO
-- ================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_trainer_id UUID;
  v_member_id UUID;
  v_workout_id UUID;
  v_workout_id_2 UUID;
BEGIN
  -- Obtener IDs de los usuarios demo
  SELECT id INTO v_admin_id FROM profiles WHERE email = 'admin@demo.com';
  SELECT id INTO v_trainer_id FROM profiles WHERE email = 'entrenador@demo.com';
  SELECT id INTO v_member_id FROM profiles WHERE email = 'socio@demo.com';
  
  -- Verificar que existen
  IF v_admin_id IS NULL OR v_trainer_id IS NULL OR v_member_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los usuarios demo. Ejecuta primero el seed inicial.';
  END IF;
  
  RAISE NOTICE 'Admin ID: %', v_admin_id;
  RAISE NOTICE 'Trainer ID: %', v_trainer_id;
  RAISE NOTICE 'Member ID: %', v_member_id;

  -- ================================================
  -- CREAR RUTINAS DE DEMO SI NO EXISTEN
  -- ================================================
  
  -- Obtener o crear primera rutina
  SELECT id INTO v_workout_id 
  FROM workout_templates 
  WHERE trainer_id = v_trainer_id 
  LIMIT 1;
  
  IF v_workout_id IS NULL THEN
    INSERT INTO workout_templates (id, trainer_id, name, description)
    VALUES (
      gen_random_uuid(),
      v_trainer_id,
      'Push Day - Pecho y Tríceps',
      'Día de empuje enfocado en pecho, hombros y tríceps.

🏋️ CALENTAMIENTO (10 min)
- Rotaciones de hombros
- Flexiones en pared
- Movilidad torácica

💪 EJERCICIOS PRINCIPALES

1. Press Banca: 4x8-10
   - Bajar controlado, explotar arriba
   - 90 seg descanso

2. Press Inclinado Mancuernas: 3x10-12
   - 30° inclinación
   - 60 seg descanso

3. Aperturas Cable: 3x12-15
   - Squeeze al centro
   - 45 seg descanso

4. Press Militar: 3x8-10
   - Core activado
   - 90 seg descanso

5. Fondos en Paralelas: 3xFallo
   - Inclinación adelante para pecho

6. Extensiones Tríceps Polea: 3x12-15
   - Codos fijos

🧘 ESTIRAMIENTOS (5 min)'
    )
    RETURNING id INTO v_workout_id;
    
    RAISE NOTICE 'Rutina 1 creada: %', v_workout_id;
  END IF;
  
  -- Crear segunda rutina
  SELECT id INTO v_workout_id_2 
  FROM workout_templates 
  WHERE trainer_id = v_trainer_id 
  AND id != v_workout_id
  LIMIT 1;
  
  IF v_workout_id_2 IS NULL THEN
    INSERT INTO workout_templates (id, trainer_id, name, description)
    VALUES (
      gen_random_uuid(),
      v_trainer_id,
      'Pull Day - Espalda y Bíceps',
      'Día de tirón enfocado en espalda y bíceps.

🏋️ CALENTAMIENTO (10 min)
- Rotaciones escapulares
- Band pull-aparts
- Dead hang

💪 EJERCICIOS PRINCIPALES

1. Dominadas: 4x6-10
   - Grip pronado
   - 120 seg descanso

2. Remo con Barra: 4x8-10
   - Espalda neutral
   - 90 seg descanso

3. Remo Mancuerna: 3x10-12 c/lado
   - Squeeze escápula
   - 60 seg descanso

4. Jalón al Pecho: 3x12-15
   - Codos hacia atrás
   - 45 seg descanso

5. Face Pulls: 3x15-20
   - Rotación externa al final

6. Curl Bíceps Barra: 3x10-12
   - Sin balanceo

🧘 ESTIRAMIENTOS (5 min)'
    )
    RETURNING id INTO v_workout_id_2;
    
    RAISE NOTICE 'Rutina 2 creada: %', v_workout_id_2;
  END IF;

  -- ================================================
  -- ASIGNAR RUTINA AL SOCIO SI NO ESTÁ ASIGNADA
  -- ================================================
  
  INSERT INTO member_workouts (member_id, workout_template_id, assigned_by)
  VALUES (v_member_id, v_workout_id, v_trainer_id)
  ON CONFLICT (member_id) DO UPDATE SET
    workout_template_id = v_workout_id,
    assigned_at = NOW();
  
  RAISE NOTICE 'Rutina asignada a Said';

  -- ================================================
  -- INSERTAR VÍDEOS DE DEMO EN RUTINAS
  -- ================================================
  
  -- Eliminar vídeos demo anteriores
  DELETE FROM workout_videos WHERE title LIKE '%Demo%' OR title LIKE '%Técnica%';
  
  -- Vídeo 1: Press Banca
  INSERT INTO workout_videos (workout_template_id, uploaded_by, video_path, duration_seconds, title, description)
  VALUES (
    v_workout_id,
    v_trainer_id,
    'workouts/' || v_workout_id || '/press-banca-tecnica.mp4',
    87,
    'Técnica Press Banca',
    'Tutorial completo de la técnica correcta del press banca. Puntos clave: agarre, arqueo, trayectoria de la barra.'
  );
  
  -- Vídeo 2: Dominadas
  INSERT INTO workout_videos (workout_template_id, uploaded_by, video_path, duration_seconds, title, description)
  VALUES (
    v_workout_id_2,
    v_trainer_id,
    'workouts/' || v_workout_id_2 || '/dominadas-progresion.mp4',
    112,
    'Progresión Dominadas',
    'Cómo progresar desde cero hasta hacer dominadas estrictas. Incluye ejercicios de asistencia.'
  );
  
  -- Vídeo 3: Forma correcta del Remo
  INSERT INTO workout_videos (workout_template_id, uploaded_by, video_path, duration_seconds, title, description)
  VALUES (
    v_workout_id_2,
    v_trainer_id,
    'workouts/' || v_workout_id_2 || '/remo-barra-forma.mp4',
    65,
    'Remo Barra - Forma Correcta',
    'Evita lesiones de espalda baja con esta técnica de remo. Posición neutral y activación correcta.'
  );
  
  RAISE NOTICE '3 vídeos de demo insertados';

  -- ================================================
  -- INSERTAR POSTS CON IMÁGENES
  -- ================================================
  
  -- Eliminar posts demo con imágenes anteriores
  DELETE FROM feed_posts WHERE image_url IS NOT NULL AND content LIKE '%Demo%';
  
  -- Post de Nacho (Admin) con imagen
  INSERT INTO feed_posts (author_id, content, image_url, is_hidden)
  VALUES (
    v_admin_id,
    '¡Bienvenidos a NL VIP CLUB! 🖤✨ Estamos emocionados de tener esta comunidad de élite. Recuerden que el éxito está en la consistencia. #NLVIPClub #Fitness',
    'feed/' || v_admin_id || '/bienvenida-gym.jpg',
    false
  );
  
  -- Post de Didac (Trainer) con imagen
  INSERT INTO feed_posts (author_id, content, image_url, is_hidden)
  VALUES (
    v_trainer_id,
    '💪 Nuevo PR en peso muerto: 180kg! La técnica lo es todo. Si quieres mejorar tus levantamientos, pregúntame en el chat. #PersonalRecord #Deadlift',
    'feed/' || v_trainer_id || '/pr-deadlift.jpg',
    false
  );
  
  -- Post de Said (Member) con imagen
  INSERT INTO feed_posts (author_id, content, image_url, is_hidden)
  VALUES (
    v_member_id,
    '3 meses de transformación 🔥 Gracias Didac por el plan personalizado. De 85kg a 78kg manteniendo la masa muscular. ¡El proceso vale la pena! #Transformacion #Fitness',
    'feed/' || v_member_id || '/transformacion-3meses.jpg',
    false
  );
  
  -- Post adicional de Said sin imagen
  INSERT INTO feed_posts (author_id, content, image_url, is_hidden)
  VALUES (
    v_member_id,
    'Día de piernas completado ✅ Las sentadillas ya no me dan miedo jajaja. ¿Alguien más entrena hoy?',
    NULL,
    false
  );
  
  RAISE NOTICE '4 posts de demo insertados (3 con imágenes)';

  -- ================================================
  -- INSERTAR FOTOS DE PROGRESO PARA SAID
  -- ================================================
  
  -- Eliminar fotos de progreso demo anteriores
  DELETE FROM progress_photos WHERE member_id = v_member_id;
  
  -- Foto progreso semana 1
  INSERT INTO progress_photos (member_id, image_path, taken_at, notes)
  VALUES (
    v_member_id,
    'progress/' || v_member_id || '/semana-01-frente.jpg',
    CURRENT_DATE - INTERVAL '12 weeks',
    'Inicio del programa. Peso: 85kg. Motivación al 100%!'
  );
  
  -- Foto progreso semana 4
  INSERT INTO progress_photos (member_id, image_path, taken_at, notes)
  VALUES (
    v_member_id,
    'progress/' || v_member_id || '/semana-04-frente.jpg',
    CURRENT_DATE - INTERVAL '8 weeks',
    'Primer mes completado. Peso: 82kg. Ya se nota la diferencia en la cintura.'
  );
  
  -- Foto progreso semana 8
  INSERT INTO progress_photos (member_id, image_path, taken_at, notes)
  VALUES (
    v_member_id,
    'progress/' || v_member_id || '/semana-08-frente.jpg',
    CURRENT_DATE - INTERVAL '4 weeks',
    'Segundo mes. Peso: 79.5kg. Los abdominales empiezan a marcarse!'
  );
  
  -- Foto progreso semana 12 (actual)
  INSERT INTO progress_photos (member_id, image_path, taken_at, notes)
  VALUES (
    v_member_id,
    'progress/' || v_member_id || '/semana-12-frente.jpg',
    CURRENT_DATE,
    'Mes 3 completado! Peso: 78kg. Increíble transformación. Gracias Didac!'
  );
  
  -- Foto lateral
  INSERT INTO progress_photos (member_id, image_path, taken_at, notes)
  VALUES (
    v_member_id,
    'progress/' || v_member_id || '/semana-12-lateral.jpg',
    CURRENT_DATE,
    'Vista lateral - la postura ha mejorado muchísimo.'
  );
  
  RAISE NOTICE '5 fotos de progreso insertadas para Said';

  -- ================================================
  -- INSERTAR REGISTROS DE PROGRESO (medidas)
  -- ================================================
  
  -- Eliminar registros demo anteriores
  DELETE FROM progress_records WHERE member_id = v_member_id;
  
  -- Semana 1
  INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
  VALUES (
    v_member_id,
    CURRENT_DATE - INTERVAL '12 weeks',
    85.0, 102.0, 92.0, 104.0, 36.0, 58.0,
    'Medidas iniciales. Objetivo: bajar grasa y ganar definición.'
  );
  
  -- Semana 4
  INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
  VALUES (
    v_member_id,
    CURRENT_DATE - INTERVAL '8 weeks',
    82.0, 101.0, 88.0, 102.0, 36.5, 58.5,
    'Buen progreso en cintura! El déficit calórico está funcionando.'
  );
  
  -- Semana 8
  INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
  VALUES (
    v_member_id,
    CURRENT_DATE - INTERVAL '4 weeks',
    79.5, 100.0, 84.0, 100.0, 37.0, 59.0,
    'Los brazos están creciendo a pesar del déficit. La proteína alta ayuda.'
  );
  
  -- Semana 12 (actual)
  INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
  VALUES (
    v_member_id,
    CURRENT_DATE,
    78.0, 99.0, 81.0, 98.0, 37.5, 60.0,
    '¡Meta alcanzada! -7kg en 3 meses. Ahora a fase de mantenimiento.'
  );
  
  RAISE NOTICE '4 registros de progreso insertados para Said';
  
  RAISE NOTICE '✅ SEED FASE 2 COMPLETADO';

END $$;


-- ================================================
-- VERIFICAR DATOS INSERTADOS
-- ================================================

-- Ver vídeos
SELECT wv.title, wv.duration_seconds, wt.name as workout_name, p.name as uploaded_by
FROM workout_videos wv
JOIN workout_templates wt ON wv.workout_template_id = wt.id
JOIN profiles p ON wv.uploaded_by = p.id;

-- Ver posts con imágenes
SELECT p.name as author, fp.content, fp.image_url
FROM feed_posts fp
JOIN profiles p ON fp.author_id = p.id
WHERE fp.image_url IS NOT NULL
ORDER BY fp.created_at DESC;

-- Ver fotos de progreso
SELECT p.name as member, pp.taken_at, pp.notes
FROM progress_photos pp
JOIN profiles p ON pp.member_id = p.id
ORDER BY pp.taken_at;

-- Ver registros de progreso
SELECT p.name as member, pr.date, pr.weight_kg, pr.waist_cm
FROM progress_records pr
JOIN profiles p ON pr.member_id = p.id
ORDER BY pr.date;


COMMIT;
