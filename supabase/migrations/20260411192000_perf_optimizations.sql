-- 20260411192000_perf_optimizations.sql
-- Optimización de rendimiento: Índices, funciones STABLE y refactorización de RLS

-- 1. Índices para claves foráneas y búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON public.exercises(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_clasificados_propiedad_interes ON public.leads_clasificados(propiedad_interes);

-- 2. Optimización de Funciones de Seguridad
-- Marcadas como STABLE y usando (SELECT auth.uid()) para evitar re-evaluación por fila

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role = 'admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_trainer()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role = 'trainer'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_premium()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) 
    AND (has_premium = true OR role = 'admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) 
    AND (role = 'trainer' OR role = 'admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_participant(p_conversation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = (SELECT auth.uid())
  );
END;
$function$;

-- 3. Refactorización de Políticas RLS (Startup & Modules)

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Members can see their assigned trainer's profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;

CREATE POLICY "Users can manage own profile" ON public.profiles
FOR ALL USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Members can see their assigned trainer's profile" ON public.profiles
FOR SELECT USING (
  id IN (
    SELECT trainer_id FROM public.trainer_members 
    WHERE member_id = (SELECT auth.uid())
  )
);

-- daily_activity
DROP POLICY IF EXISTS "Trainers view assigned activity" ON public.daily_activity;
DROP POLICY IF EXISTS "Users manage own activity" ON public.daily_activity;
DROP POLICY IF EXISTS "daily_activity_staff_select_restricted" ON public.daily_activity;
DROP POLICY IF EXISTS "Users view own activity" ON public.daily_activity;
DROP POLICY IF EXISTS "Staff view assigned member activity" ON public.daily_activity;

CREATE POLICY "Users view own activity" ON public.daily_activity
FOR SELECT USING (member_id = (SELECT auth.uid()));

CREATE POLICY "Users manage own activity" ON public.daily_activity
FOR ALL WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY "Staff view assigned member activity" ON public.daily_activity
FOR SELECT USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM trainer_members 
    WHERE trainer_id = (SELECT auth.uid()) 
    AND member_id = daily_activity.member_id
  )
);

-- trainer_members
DROP POLICY IF EXISTS "Members see who trains them" ON public.trainer_members;
DROP POLICY IF EXISTS "Trainers see own assignments" ON public.trainer_members;
DROP POLICY IF EXISTS "Members see assigned trainer" ON public.trainer_members;
DROP POLICY IF EXISTS "Trainers see assignments" ON public.trainer_members;

CREATE POLICY "Members see assigned trainer" ON public.trainer_members
FOR SELECT USING (member_id = (SELECT auth.uid()));

CREATE POLICY "Trainers see assignments" ON public.trainer_members
FOR SELECT USING (
  is_admin() OR 
  trainer_id = (SELECT auth.uid())
);

-- macro_goals
DROP POLICY IF EXISTS "macro_goals_own" ON public.macro_goals;
DROP POLICY IF EXISTS "Staff manage member macro goals" ON public.macro_goals;
DROP POLICY IF EXISTS "Users view own macros" ON public.macro_goals;
DROP POLICY IF EXISTS "Users manage own macros" ON public.macro_goals;
DROP POLICY IF EXISTS "Staff manage member macros" ON public.macro_goals;

CREATE POLICY "Users view own macros" ON public.macro_goals
FOR SELECT USING (member_id = (SELECT auth.uid()));

CREATE POLICY "Users manage own macros" ON public.macro_goals
FOR ALL WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY "Staff manage member macros" ON public.macro_goals
FOR ALL USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM trainer_members 
    WHERE trainer_id = (SELECT auth.uid()) 
    AND member_id = macro_goals.member_id
  )
);

-- member_workouts
DROP POLICY IF EXISTS "Premium members see their workouts" ON public.member_workouts;
DROP POLICY IF EXISTS "Trainers manage member workouts" ON public.member_workouts;
DROP POLICY IF EXISTS "Users view own workouts" ON public.member_workouts;
DROP POLICY IF EXISTS "Staff manage workouts" ON public.member_workouts;

CREATE POLICY "Users view own workouts" ON public.member_workouts
FOR SELECT USING (
  (member_id = (SELECT auth.uid()) AND is_premium()) OR is_admin()
);

CREATE POLICY "Staff manage workouts" ON public.member_workouts
FOR ALL USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM trainer_members 
    WHERE trainer_id = (SELECT auth.uid()) 
    AND member_id = member_workouts.member_id
  )
);

-- progress_records
DROP POLICY IF EXISTS "Premium users manage own progress" ON public.progress_records;
DROP POLICY IF EXISTS "Trainers view assigned member progress" ON public.progress_records;
DROP POLICY IF EXISTS "Users manage own progress" ON public.progress_records;
DROP POLICY IF EXISTS "Staff view progress" ON public.progress_records;

CREATE POLICY "Users manage own progress" ON public.progress_records
FOR ALL USING (
  (member_id = (SELECT auth.uid()) AND is_premium())
) WITH CHECK (
  (member_id = (SELECT auth.uid()) AND is_premium())
);

CREATE POLICY "Staff view progress" ON public.progress_records
FOR SELECT USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM trainer_members 
    WHERE trainer_id = (SELECT auth.uid()) 
    AND member_id = progress_records.member_id
  )
);

-- feed_posts
DROP POLICY IF EXISTS "Only Premium can post to feed" ON public.feed_posts;
DROP POLICY IF EXISTS "Everyone sees public posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Everyone viewable posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Premium users can post" ON public.feed_posts;

CREATE POLICY "Everyone viewable posts" ON public.feed_posts
FOR SELECT USING (NOT is_hidden OR is_admin());

CREATE POLICY "Premium users can post" ON public.feed_posts
FOR INSERT WITH CHECK (
  (author_id = (SELECT auth.uid()) AND is_premium())
);

-- member_prs
DROP POLICY IF EXISTS "member_prs_staff_select" ON public.member_prs;
DROP POLICY IF EXISTS "members_own_prs" ON public.member_prs;
DROP POLICY IF EXISTS "Admins can manage all PRs" ON public.member_prs;
DROP POLICY IF EXISTS "Admins can view all PRs" ON public.member_prs;
DROP POLICY IF EXISTS "Users manage own prs" ON public.member_prs;
DROP POLICY IF EXISTS "Staff view member prs" ON public.member_prs;

CREATE POLICY "Users manage own prs" ON public.member_prs
FOR ALL USING (member_id = (SELECT auth.uid())) WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY "Staff view member prs" ON public.member_prs
FOR SELECT USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM trainer_members 
    WHERE trainer_id = (SELECT auth.uid()) 
    AND member_id = member_prs.member_id
  )
);

-- workout_checkins
DROP POLICY IF EXISTS "Users manage own checkins" ON public.workout_checkins;
DROP POLICY IF EXISTS "Staff view member checkins" ON public.workout_checkins;
DROP POLICY IF EXISTS "Staff view checkins" ON public.workout_checkins;

CREATE POLICY "Users manage own checkins" ON public.workout_checkins
FOR ALL USING (member_id = (SELECT auth.uid())) WITH CHECK (member_id = (SELECT auth.uid()));

CREATE POLICY "Staff view checkins" ON public.workout_checkins
FOR SELECT USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM trainer_members 
    WHERE trainer_id = (SELECT auth.uid()) 
    AND member_id = workout_checkins.member_id
  )
);
