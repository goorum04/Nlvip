-- =============================================
-- TODAS LAS POLÍTICAS RLS PARA NL VIP CLUB
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- ============================================
-- 1. WORKOUT_DAYS (Días de entrenamiento)
-- ============================================
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access workout_days"
ON workout_days FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden gestionar sus días
CREATE POLICY "Trainers manage own workout_days"
ON workout_days FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = workout_days.workout_template_id
    AND wt.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver días de rutinas asignadas
CREATE POLICY "Members view assigned workout_days"
ON workout_days FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_days.workout_template_id
    AND mw.member_id = auth.uid()
  )
);

-- ============================================
-- 2. WORKOUT_EXERCISES (Ejercicios)
-- ============================================
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access workout_exercises"
ON workout_exercises FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden gestionar ejercicios de sus rutinas
CREATE POLICY "Trainers manage own exercises"
ON workout_exercises FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN workout_templates wt ON wt.id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id
    AND wt.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver ejercicios de rutinas asignadas
CREATE POLICY "Members view assigned exercises"
ON workout_exercises FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN member_workouts mw ON mw.workout_template_id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id
    AND mw.member_id = auth.uid()
  )
);

-- ============================================
-- 3. PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver su propio perfil
CREATE POLICY "Users view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Admins pueden actualizar todos los perfiles
CREATE POLICY "Admins update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden ver perfiles de sus miembros
CREATE POLICY "Trainers view assigned members"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = profiles.id
    AND tm.trainer_id = auth.uid()
  )
);

-- Permitir insertar perfil propio al registrarse
CREATE POLICY "Users insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================
-- 4. WORKOUT_TEMPLATES (Rutinas)
-- ============================================
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access workout_templates"
ON workout_templates FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden gestionar sus rutinas
CREATE POLICY "Trainers manage own workouts"
ON workout_templates FOR ALL
TO authenticated
USING (trainer_id = auth.uid());

-- Miembros pueden ver rutinas asignadas
CREATE POLICY "Members view assigned workouts"
ON workout_templates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_templates.id
    AND mw.member_id = auth.uid()
  )
);

-- ============================================
-- 5. DIET_TEMPLATES (Dietas)
-- ============================================
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access diet_templates"
ON diet_templates FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden gestionar sus dietas
CREATE POLICY "Trainers manage own diets"
ON diet_templates FOR ALL
TO authenticated
USING (trainer_id = auth.uid());

-- Miembros pueden ver dietas asignadas
CREATE POLICY "Members view assigned diets"
ON diet_templates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_diets md
    WHERE md.diet_template_id = diet_templates.id
    AND md.member_id = auth.uid()
  )
);

-- ============================================
-- 6. MEMBER_WORKOUTS (Asignación de rutinas)
-- ============================================
ALTER TABLE member_workouts ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access member_workouts"
ON member_workouts FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden asignar a sus miembros
CREATE POLICY "Trainers manage member_workouts"
ON member_workouts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = member_workouts.member_id
    AND tm.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver sus asignaciones
CREATE POLICY "Members view own workout assignments"
ON member_workouts FOR SELECT
TO authenticated
USING (member_id = auth.uid());

-- ============================================
-- 7. MEMBER_DIETS (Asignación de dietas)
-- ============================================
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access member_diets"
ON member_diets FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden asignar a sus miembros
CREATE POLICY "Trainers manage member_diets"
ON member_diets FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = member_diets.member_id
    AND tm.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver sus asignaciones
CREATE POLICY "Members view own diet assignments"
ON member_diets FOR SELECT
TO authenticated
USING (member_id = auth.uid());

-- ============================================
-- 8. CHALLENGES (Retos)
-- ============================================
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver retos
CREATE POLICY "Anyone can view challenges"
ON challenges FOR SELECT
TO authenticated
USING (true);

-- Admins pueden hacer todo
CREATE POLICY "Admins full access challenges"
ON challenges FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden crear retos
CREATE POLICY "Trainers create challenges"
ON challenges FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
);

-- ============================================
-- 9. CHALLENGE_PARTICIPANTS
-- ============================================
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver participantes
CREATE POLICY "Anyone view challenge_participants"
ON challenge_participants FOR SELECT
TO authenticated
USING (true);

-- Miembros pueden unirse a retos
CREATE POLICY "Members join challenges"
ON challenge_participants FOR INSERT
TO authenticated
WITH CHECK (member_id = auth.uid());

-- Miembros pueden actualizar su progreso
CREATE POLICY "Members update own progress"
ON challenge_participants FOR UPDATE
TO authenticated
USING (member_id = auth.uid());

-- Admins pueden hacer todo
CREATE POLICY "Admins full access challenge_participants"
ON challenge_participants FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 10. FEED_POSTS
-- ============================================
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver posts
CREATE POLICY "Anyone view feed_posts"
ON feed_posts FOR SELECT
TO authenticated
USING (true);

-- Usuarios pueden crear posts
CREATE POLICY "Users create own posts"
ON feed_posts FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

-- Usuarios pueden editar/eliminar sus posts
CREATE POLICY "Users manage own posts"
ON feed_posts FOR UPDATE
TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Users delete own posts"
ON feed_posts FOR DELETE
TO authenticated
USING (author_id = auth.uid());

-- Admins pueden eliminar cualquier post
CREATE POLICY "Admins delete any post"
ON feed_posts FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 11. PROGRESS_PHOTOS
-- ============================================
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Miembros pueden ver sus propias fotos
CREATE POLICY "Members view own progress_photos"
ON progress_photos FOR SELECT
TO authenticated
USING (member_id = auth.uid());

-- Miembros pueden subir sus fotos
CREATE POLICY "Members upload own progress_photos"
ON progress_photos FOR INSERT
TO authenticated
WITH CHECK (member_id = auth.uid());

-- Solo admins pueden ver todas las fotos
CREATE POLICY "Admins view all progress_photos"
ON progress_photos FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 12. TRAINER_MEMBERS (Relación trainer-miembro)
-- ============================================
ALTER TABLE trainer_members ENABLE ROW LEVEL SECURITY;

-- Admins pueden hacer todo
CREATE POLICY "Admins full access trainer_members"
ON trainer_members FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trainers pueden ver sus asignaciones
CREATE POLICY "Trainers view own assignments"
ON trainer_members FOR SELECT
TO authenticated
USING (trainer_id = auth.uid());

-- Miembros pueden ver su trainer
CREATE POLICY "Members view own trainer"
ON trainer_members FOR SELECT
TO authenticated
USING (member_id = auth.uid());

-- ============================================
-- 13. DAILY_ACTIVITY
-- ============================================
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver su actividad
CREATE POLICY "Users view own activity"
ON daily_activity FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden insertar su actividad
CREATE POLICY "Users insert own activity"
ON daily_activity FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden actualizar su actividad
CREATE POLICY "Users update own activity"
ON daily_activity FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Admins/Trainers pueden ver actividad de miembros
CREATE POLICY "Staff view member activity"
ON daily_activity FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);

-- ============================================
-- 14. FOOD_LOGS
-- ============================================
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver sus logs
CREATE POLICY "Users view own food_logs"
ON food_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden crear logs
CREATE POLICY "Users insert own food_logs"
ON food_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden eliminar sus logs
CREATE POLICY "Users delete own food_logs"
ON food_logs FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- 15. INVITATION_CODES
-- ============================================
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer códigos (para validar)
CREATE POLICY "Anyone can read codes"
ON invitation_codes FOR SELECT
TO authenticated
USING (true);

-- Solo admins pueden crear/editar códigos
CREATE POLICY "Admins manage invitation_codes"
ON invitation_codes FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Permitir actualizar uses_count al registrarse
CREATE POLICY "Update code usage on register"
ON invitation_codes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- =============================================
-- FIN DE POLÍTICAS DE TABLAS
-- =============================================
