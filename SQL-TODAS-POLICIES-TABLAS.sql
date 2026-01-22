-- =============================================
-- SCRIPT COMPLETO: TODAS LAS POLÍTICAS DE LA APP NL VIP CLUB
-- Elimina TODAS las existentes y crea TODAS las nuevas
-- Ejecutar en Supabase SQL Editor
-- =============================================


-- ============================================
-- PASO 1: ELIMINAR ABSOLUTAMENTE TODAS LAS POLÍTICAS
-- ============================================

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Eliminar todas las políticas de todas las tablas
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ============================================
-- PASO 2: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS member_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trainer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS member_badges ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PASO 3: CREAR TODAS LAS POLÍTICAS
-- ============================================

-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ PROFILES (Perfiles de usuario)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos los autenticados pueden ver todos los perfiles (para ver nombres, fotos en feed, etc)
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT TO authenticated
USING (true);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

-- Usuarios pueden insertar su propio perfil al registrarse
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Admins pueden actualizar cualquier perfil
CREATE POLICY "profiles_admin_update"
ON profiles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins pueden eliminar perfiles
CREATE POLICY "profiles_admin_delete"
ON profiles FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Usuarios pueden eliminar su propio perfil
CREATE POLICY "profiles_delete_own"
ON profiles FOR DELETE TO authenticated
USING (id = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ WORKOUT_TEMPLATES (Plantillas de rutinas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo con rutinas
CREATE POLICY "workout_templates_admin_all"
ON workout_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden crear rutinas
CREATE POLICY "workout_templates_trainer_insert"
ON workout_templates FOR INSERT TO authenticated
WITH CHECK (
  trainer_id = auth.uid() AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
);

-- Trainers pueden ver y editar sus propias rutinas
CREATE POLICY "workout_templates_trainer_select"
ON workout_templates FOR SELECT TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "workout_templates_trainer_update"
ON workout_templates FOR UPDATE TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "workout_templates_trainer_delete"
ON workout_templates FOR DELETE TO authenticated
USING (trainer_id = auth.uid());

-- Miembros pueden ver rutinas asignadas a ellos
CREATE POLICY "workout_templates_member_select"
ON workout_templates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_templates.id AND mw.member_id = auth.uid()
  )
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ WORKOUT_DAYS (Días de entrenamiento)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo
CREATE POLICY "workout_days_admin_all"
ON workout_days FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden gestionar días de sus rutinas
CREATE POLICY "workout_days_trainer_all"
ON workout_days FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = workout_days.workout_template_id AND wt.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver días de rutinas asignadas
CREATE POLICY "workout_days_member_select"
ON workout_days FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_workouts mw
    WHERE mw.workout_template_id = workout_days.workout_template_id AND mw.member_id = auth.uid()
  )
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ WORKOUT_EXERCISES (Ejercicios)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo
CREATE POLICY "workout_exercises_admin_all"
ON workout_exercises FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden gestionar ejercicios de sus rutinas
CREATE POLICY "workout_exercises_trainer_all"
ON workout_exercises FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN workout_templates wt ON wt.id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id AND wt.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver ejercicios de rutinas asignadas
CREATE POLICY "workout_exercises_member_select"
ON workout_exercises FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd
    JOIN member_workouts mw ON mw.workout_template_id = wd.workout_template_id
    WHERE wd.id = workout_exercises.workout_day_id AND mw.member_id = auth.uid()
  )
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ DIET_TEMPLATES (Plantillas de dietas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo
CREATE POLICY "diet_templates_admin_all"
ON diet_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden crear dietas
CREATE POLICY "diet_templates_trainer_insert"
ON diet_templates FOR INSERT TO authenticated
WITH CHECK (
  trainer_id = auth.uid() AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
);

-- Trainers pueden ver y gestionar sus propias dietas
CREATE POLICY "diet_templates_trainer_select"
ON diet_templates FOR SELECT TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "diet_templates_trainer_update"
ON diet_templates FOR UPDATE TO authenticated
USING (trainer_id = auth.uid());

CREATE POLICY "diet_templates_trainer_delete"
ON diet_templates FOR DELETE TO authenticated
USING (trainer_id = auth.uid());

-- Miembros pueden ver dietas asignadas
CREATE POLICY "diet_templates_member_select"
ON diet_templates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_diets md
    WHERE md.diet_template_id = diet_templates.id AND md.member_id = auth.uid()
  )
);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ MEMBER_WORKOUTS (Asignación de rutinas a miembros)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo
CREATE POLICY "member_workouts_admin_all"
ON member_workouts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden asignar rutinas a sus miembros
CREATE POLICY "member_workouts_trainer_all"
ON member_workouts FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = member_workouts.member_id AND tm.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver sus propias asignaciones
CREATE POLICY "member_workouts_member_select"
ON member_workouts FOR SELECT TO authenticated
USING (member_id = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ MEMBER_DIETS (Asignación de dietas a miembros)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo
CREATE POLICY "member_diets_admin_all"
ON member_diets FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden asignar dietas a sus miembros
CREATE POLICY "member_diets_trainer_all"
ON member_diets FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = member_diets.member_id AND tm.trainer_id = auth.uid()
  )
);

-- Miembros pueden ver sus propias asignaciones
CREATE POLICY "member_diets_member_select"
ON member_diets FOR SELECT TO authenticated
USING (member_id = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ CHALLENGES (Retos/Desafíos)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos los autenticados pueden ver retos
CREATE POLICY "challenges_select_all"
ON challenges FOR SELECT TO authenticated
USING (true);

-- Admins pueden hacer todo
CREATE POLICY "challenges_admin_all"
ON challenges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden crear retos
CREATE POLICY "challenges_trainer_insert"
ON challenges FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'));

-- Trainers pueden editar/eliminar sus retos
CREATE POLICY "challenges_trainer_update"
ON challenges FOR UPDATE TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "challenges_trainer_delete"
ON challenges FOR DELETE TO authenticated
USING (created_by = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ CHALLENGE_PARTICIPANTS (Participantes en retos)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden ver participantes (para rankings)
CREATE POLICY "challenge_participants_select_all"
ON challenge_participants FOR SELECT TO authenticated
USING (true);

-- Miembros pueden unirse a retos
CREATE POLICY "challenge_participants_member_insert"
ON challenge_participants FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

-- Miembros pueden actualizar su progreso
CREATE POLICY "challenge_participants_member_update"
ON challenge_participants FOR UPDATE TO authenticated
USING (member_id = auth.uid());

-- Miembros pueden abandonar retos
CREATE POLICY "challenge_participants_member_delete"
ON challenge_participants FOR DELETE TO authenticated
USING (member_id = auth.uid());

-- Admins pueden hacer todo
CREATE POLICY "challenge_participants_admin_all"
ON challenge_participants FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ FEED_POSTS (Posts del feed social)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos los autenticados pueden ver posts
CREATE POLICY "feed_posts_select_all"
ON feed_posts FOR SELECT TO authenticated
USING (true);

-- Usuarios pueden crear sus propios posts
CREATE POLICY "feed_posts_insert_own"
ON feed_posts FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());

-- Usuarios pueden editar sus propios posts
CREATE POLICY "feed_posts_update_own"
ON feed_posts FOR UPDATE TO authenticated
USING (author_id = auth.uid());

-- Usuarios pueden eliminar sus propios posts
CREATE POLICY "feed_posts_delete_own"
ON feed_posts FOR DELETE TO authenticated
USING (author_id = auth.uid());

-- Admins pueden eliminar cualquier post (moderación)
CREATE POLICY "feed_posts_admin_delete"
ON feed_posts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ FEED_LIKES (Likes en posts)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden ver likes
CREATE POLICY "feed_likes_select_all"
ON feed_likes FOR SELECT TO authenticated
USING (true);

-- Usuarios pueden dar like
CREATE POLICY "feed_likes_insert_own"
ON feed_likes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden quitar su like
CREATE POLICY "feed_likes_delete_own"
ON feed_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ FEED_COMMENTS (Comentarios en posts)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden ver comentarios
CREATE POLICY "feed_comments_select_all"
ON feed_comments FOR SELECT TO authenticated
USING (true);

-- Usuarios pueden comentar
CREATE POLICY "feed_comments_insert_own"
ON feed_comments FOR INSERT TO authenticated
WITH CHECK (commenter_id = auth.uid());

-- Usuarios pueden editar sus comentarios
CREATE POLICY "feed_comments_update_own"
ON feed_comments FOR UPDATE TO authenticated
USING (commenter_id = auth.uid());

-- Usuarios pueden eliminar sus comentarios
CREATE POLICY "feed_comments_delete_own"
ON feed_comments FOR DELETE TO authenticated
USING (commenter_id = auth.uid());

-- Admins pueden eliminar cualquier comentario
CREATE POLICY "feed_comments_admin_delete"
ON feed_comments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ PROGRESS_PHOTOS (Fotos de progreso)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Miembros pueden ver sus propias fotos
CREATE POLICY "progress_photos_member_select_own"
ON progress_photos FOR SELECT TO authenticated
USING (member_id = auth.uid());

-- Miembros pueden subir sus fotos
CREATE POLICY "progress_photos_member_insert"
ON progress_photos FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

-- Miembros pueden eliminar sus fotos
CREATE POLICY "progress_photos_member_delete"
ON progress_photos FOR DELETE TO authenticated
USING (member_id = auth.uid());

-- SOLO Admins pueden ver TODAS las fotos de progreso
CREATE POLICY "progress_photos_admin_select"
ON progress_photos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ PROGRESS_RECORDS (Registros de peso/medidas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Miembros pueden ver sus propios registros
CREATE POLICY "progress_records_member_select"
ON progress_records FOR SELECT TO authenticated
USING (member_id = auth.uid());

-- Miembros pueden crear registros
CREATE POLICY "progress_records_member_insert"
ON progress_records FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

-- Miembros pueden actualizar sus registros
CREATE POLICY "progress_records_member_update"
ON progress_records FOR UPDATE TO authenticated
USING (member_id = auth.uid());

-- Miembros pueden eliminar sus registros
CREATE POLICY "progress_records_member_delete"
ON progress_records FOR DELETE TO authenticated
USING (member_id = auth.uid());

-- Trainers pueden ver registros de sus miembros
CREATE POLICY "progress_records_trainer_select"
ON progress_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trainer_members tm
    WHERE tm.member_id = progress_records.member_id AND tm.trainer_id = auth.uid()
  )
);

-- Admins pueden ver todos los registros
CREATE POLICY "progress_records_admin_select"
ON progress_records FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ TRAINER_MEMBERS (Relación trainer-miembro)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Admins pueden hacer todo
CREATE POLICY "trainer_members_admin_all"
ON trainer_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden ver sus asignaciones
CREATE POLICY "trainer_members_trainer_select"
ON trainer_members FOR SELECT TO authenticated
USING (trainer_id = auth.uid());

-- Miembros pueden ver su trainer asignado
CREATE POLICY "trainer_members_member_select"
ON trainer_members FOR SELECT TO authenticated
USING (member_id = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ DAILY_ACTIVITY (Actividad diaria - pasos, etc)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Usuarios pueden ver su propia actividad
CREATE POLICY "daily_activity_select_own"
ON daily_activity FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden registrar su actividad
CREATE POLICY "daily_activity_insert_own"
ON daily_activity FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden actualizar su actividad
CREATE POLICY "daily_activity_update_own"
ON daily_activity FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Staff puede ver actividad de todos los miembros
CREATE POLICY "daily_activity_staff_select"
ON daily_activity FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ FOOD_LOGS (Registro de comidas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Usuarios pueden ver sus propios logs
CREATE POLICY "food_logs_select_own"
ON food_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden crear logs
CREATE POLICY "food_logs_insert_own"
ON food_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden actualizar sus logs
CREATE POLICY "food_logs_update_own"
ON food_logs FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden eliminar sus logs
CREATE POLICY "food_logs_delete_own"
ON food_logs FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Staff puede ver logs de todos
CREATE POLICY "food_logs_staff_select"
ON food_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ INVITATION_CODES (Códigos de invitación)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden leer códigos (para validar al registrarse)
CREATE POLICY "invitation_codes_select_all"
ON invitation_codes FOR SELECT TO authenticated
USING (true);

-- También permitir lectura anónima (para validar antes de registrarse)
CREATE POLICY "invitation_codes_select_anon"
ON invitation_codes FOR SELECT TO anon
USING (true);

-- Admins pueden crear códigos
CREATE POLICY "invitation_codes_admin_insert"
ON invitation_codes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins pueden actualizar códigos
CREATE POLICY "invitation_codes_admin_update"
ON invitation_codes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins pueden eliminar códigos
CREATE POLICY "invitation_codes_admin_delete"
ON invitation_codes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Permitir actualizar uses_count al registrarse (para cualquier usuario)
CREATE POLICY "invitation_codes_update_usage"
ON invitation_codes FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ RECIPES (Recetas)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- TODOS los autenticados pueden ver recetas
CREATE POLICY "recipes_select_all"
ON recipes FOR SELECT TO authenticated
USING (true);

-- Admins pueden crear recetas
CREATE POLICY "recipes_admin_insert"
ON recipes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden crear recetas
CREATE POLICY "recipes_trainer_insert"
ON recipes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'));

-- Admins pueden actualizar cualquier receta
CREATE POLICY "recipes_admin_update"
ON recipes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden actualizar sus recetas
CREATE POLICY "recipes_trainer_update"
ON recipes FOR UPDATE TO authenticated
USING (created_by = auth.uid());

-- Admins pueden eliminar cualquier receta
CREATE POLICY "recipes_admin_delete"
ON recipes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trainers pueden eliminar sus recetas
CREATE POLICY "recipes_trainer_delete"
ON recipes FOR DELETE TO authenticated
USING (created_by = auth.uid());


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ TRAINING_VIDEOS (Videos de entrenamiento)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden ver videos
CREATE POLICY "training_videos_select_all"
ON training_videos FOR SELECT TO authenticated
USING (true);

-- Staff puede crear videos
CREATE POLICY "training_videos_staff_insert"
ON training_videos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- Staff puede actualizar videos
CREATE POLICY "training_videos_staff_update"
ON training_videos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));

-- Staff puede eliminar videos
CREATE POLICY "training_videos_staff_delete"
ON training_videos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ BADGES (Medallas/Insignias)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden ver badges
CREATE POLICY "badges_select_all"
ON badges FOR SELECT TO authenticated
USING (true);

-- Solo admins pueden gestionar badges
CREATE POLICY "badges_admin_all"
ON badges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- ██ MEMBER_BADGES (Badges ganados por miembros)
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- Todos pueden ver badges ganados (para mostrar en perfiles)
CREATE POLICY "member_badges_select_all"
ON member_badges FOR SELECT TO authenticated
USING (true);

-- Admins y sistema pueden asignar badges
CREATE POLICY "member_badges_admin_insert"
ON member_badges FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins pueden eliminar badges
CREATE POLICY "member_badges_admin_delete"
ON member_badges FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- =============================================
-- FIN DE POLÍTICAS DE TABLAS
-- =============================================
