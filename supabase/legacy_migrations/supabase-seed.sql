-- ================================================
-- SCRIPT DE SEED PARA DATOS DEMO
-- ================================================
-- Ejecuta este script DESPUÉS de crear las cuentas demo en Supabase Auth
-- y DESPUÉS de ejecutar supabase-schema.sql

-- ================================================
-- VERIFICAR QUE LAS CUENTAS EXISTEN
-- ================================================
-- Primero verifica que los usuarios existan:
-- SELECT * FROM auth.users WHERE email IN ('admin@demo.com', 'entrenador@demo.com', 'socio@demo.com');

-- ================================================
-- 1. CREAR CÓDIGOS DE INVITACIÓN
-- ================================================
INSERT INTO invitation_codes (code, trainer_id, max_uses, uses_count, is_active, expires_at)
SELECT 
  'NLVIP-DEMO01', 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  10,
  1,
  true,
  NOW() + INTERVAL '30 days'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com');

INSERT INTO invitation_codes (code, trainer_id, max_uses, uses_count, is_active, expires_at)
SELECT 
  'NLVIP-DEMO02', 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  5,
  0,
  true,
  NOW() + INTERVAL '60 days'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com');

-- ================================================
-- 2. CREAR RUTINAS DE EJEMPLO
-- ================================================
INSERT INTO workout_templates (trainer_id, name, description)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  'Rutina Full Body - Principiante',
  E'Rutina completa de cuerpo entero ideal para principiantes.

DÍA 1 - FULL BODY A:
• Sentadillas con barra: 3x12
• Press de banca: 3x10
• Remo con barra: 3x12
• Press militar: 3x10
• Curl de bíceps: 3x12
• Extensiones de tríceps: 3x12
• Plancha: 3x30seg

DÍA 2 - DESCANSO O CARDIO LIGERO

DÍA 3 - FULL BODY B:
• Peso muerto rumano: 3x10
• Press inclinado con mancuernas: 3x12
• Dominadas asistidas: 3x8
• Elevaciones laterales: 3x15
• Curl martillo: 3x12
• Fondos de tríceps: 3x10
• Abdominales: 3x15'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com');

INSERT INTO workout_templates (trainer_id, name, description)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  'Rutina Hipertrofia - Intermedio',
  E'Rutina diseñada para maximizar la ganancia muscular.

LUNES - PECHO/TRÍCEPS:
• Press banca plano: 4x8-10
• Press inclinado mancuernas: 4x10-12
• Aperturas en polea: 3x12-15
• Press francés: 3x10-12
• Extensiones en polea: 3x12-15

MIÉRCOLES - ESPALDA/BÍCEPS:
• Peso muerto: 4x6-8
• Dominadas: 4x8-10
• Remo con barra: 4x10-12
• Curl con barra: 4x10-12
• Curl concentrado: 3x12-15

VIERNES - PIERNA/HOMBRO:
• Sentadilla: 4x8-10
• Prensa: 4x12-15
• Peso muerto rumano: 3x10-12
• Press militar: 4x8-10
• Elevaciones laterales: 4x12-15'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com');

-- ================================================
-- 3. ASIGNAR RUTINA AL SOCIO DEMO
-- ================================================
INSERT INTO member_workouts (member_id, workout_template_id, assigned_by)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  (SELECT id FROM workout_templates WHERE name = 'Rutina Full Body - Principiante' LIMIT 1),
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com')
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com')
AND EXISTS (SELECT 1 FROM workout_templates WHERE name = 'Rutina Full Body - Principiante');

-- ================================================
-- 4. CREAR DIETAS DE EJEMPLO
-- ================================================
INSERT INTO diet_templates (trainer_id, name, calories, protein_g, carbs_g, fat_g, content)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  'Dieta Definición 2000 kcal',
  2000,
  150,
  200,
  60,
  E'DESAYUNO (500 kcal):
• 3 claras de huevo + 1 huevo entero
• 60g avena con canela
• 1 plátano
• Café negro

ALMUERZO (600 kcal):
• 150g pechuga de pollo
• 100g arroz integral
• Ensalada mixta con aceite de oliva
• Verduras al vapor

MERIENDA (300 kcal):
• Batido de proteína (30g)
• 1 manzana
• 20g almendras

CENA (600 kcal):
• 180g salmón o pescado blanco
• 150g batata o patata
• Brócoli al vapor
• Ensalada verde

NOTAS:
- Beber mínimo 3L de agua al día
- Ajustar porciones según hambre y progreso
- Día libre los domingos (manteniendo proteína)'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com');

INSERT INTO diet_templates (trainer_id, name, calories, protein_g, carbs_g, fat_g, content)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  'Dieta Volumen 3000 kcal',
  3000,
  180,
  400,
  80,
  E'DESAYUNO (700 kcal):
• 4 huevos revueltos
• 100g avena
• 1 plátano + fresas
• Leche entera
• Café con azúcar

ALMUERZO (900 kcal):
• 200g carne roja magra
• 150g arroz blanco
• 100g pasta
• Ensalada con aguacate
• Pan integral

MERIENDA 1 (400 kcal):
• Batido: proteína + avena + mantequilla de maní
• 1 plátano

MERIENDA 2 (400 kcal):
• Sándwich de atún
• Yogur griego con miel

CENA (600 kcal):
• 200g pollo o pescado
• 200g arroz o pasta
• Vegetales salteados
• Aceite de oliva

NOTAS:
- Superávit calórico controlado
- Proteína en cada comida
- Carbohidratos alrededor del entrenamiento
- Aumentar gradualmente si no hay progreso'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com');

-- ================================================
-- 5. ASIGNAR DIETA AL SOCIO DEMO
-- ================================================
INSERT INTO member_diets (member_id, diet_template_id, assigned_by)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  (SELECT id FROM diet_templates WHERE name = 'Dieta Definición 2000 kcal' LIMIT 1),
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com')
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com')
AND EXISTS (SELECT 1 FROM diet_templates WHERE name = 'Dieta Definición 2000 kcal');

-- ================================================
-- 6. CREAR PROGRESO PARA EL SOCIO DEMO
-- ================================================
INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  NOW() - INTERVAL '30 days',
  78.5,
  98.0,
  85.0,
  96.0,
  34.0,
  58.0,
  'Primera medición. Me siento motivado para empezar!'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  NOW() - INTERVAL '15 days',
  77.2,
  99.0,
  83.5,
  96.0,
  35.0,
  58.5,
  'Viendo resultados! Más energía en los entrenamientos'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

INSERT INTO progress_records (member_id, date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  NOW(),
  76.0,
  100.0,
  82.0,
  95.5,
  35.5,
  59.0,
  'Excelente progreso! Siguiendo la dieta al 100%'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

-- ================================================
-- 7. CREAR AVISOS DEL ENTRENADOR
-- ================================================
INSERT INTO trainer_notices (trainer_id, member_id, title, message, priority)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  '¡Bienvenido al NL VIP CLUB!',
  'Hola! Soy Carlos, tu entrenador personal. Ya tienes tu rutina y dieta asignadas. Recuerda registrar tu progreso semanalmente. Cualquier duda, no dudes en contactarme. ¡Vamos a por esos objetivos! 💪',
  'high'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com')
AND EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

INSERT INTO trainer_notices (trainer_id, member_id, title, message, priority)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  'Recordatorio: Hidratación',
  'No olvides beber al menos 3 litros de agua al día. La hidratación es clave para tu rendimiento y recuperación.',
  'normal'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'entrenador@demo.com')
AND EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

-- ================================================
-- 8. CREAR POSTS EN EL FEED
-- ================================================
INSERT INTO feed_posts (author_id, content)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  '¡Primera semana completada! 💪 Me siento genial con la rutina que me asignó mi entrenador. La dieta está siendo más fácil de seguir de lo que pensaba. ¡Vamos por más!'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

INSERT INTO feed_posts (author_id, content)
SELECT 
  (SELECT id FROM profiles WHERE email = 'socio@demo.com'),
  'Nuevo PR en sentadillas hoy! 🎯 Subí 5kg más que la semana pasada. El trabajo duro da resultados. ¡Gracias Carlos por el plan!'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'socio@demo.com');

-- ================================================
-- VERIFICACIÓN FINAL
-- ================================================
-- Ejecuta estas queries para verificar que todo se creó correctamente:

-- Ver profiles creados:
-- SELECT * FROM profiles ORDER BY created_at;

-- Ver códigos de invitación:
-- SELECT * FROM invitation_codes;

-- Ver rutinas:
-- SELECT * FROM workout_templates;

-- Ver dietas:
-- SELECT * FROM diet_templates;

-- Ver asignaciones:
-- SELECT * FROM member_workouts;
-- SELECT * FROM member_diets;

-- Ver progreso:
-- SELECT * FROM progress_records ORDER BY date;

-- Ver avisos:
-- SELECT * FROM trainer_notices ORDER BY created_at;

-- Ver posts:
-- SELECT * FROM feed_posts ORDER BY created_at;

COMMIT;
