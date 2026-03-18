-- ================================================
-- NL VIP CLUB - ESQUEMA COMPLETO DE BASE DE DATOS
-- ================================================
-- Este script crea todas las tablas necesarias para la aplicación
-- Ejecuta este script en el SQL Editor de Supabase

-- Eliminar tablas existentes si es necesario (para desarrollo)
DROP TABLE IF EXISTS notice_reads CASCADE;
DROP TABLE IF EXISTS trainer_notices CASCADE;
DROP TABLE IF EXISTS progress_photos CASCADE;
DROP TABLE IF EXISTS progress_records CASCADE;
DROP TABLE IF EXISTS workout_logs CASCADE;
DROP TABLE IF EXISTS member_goals CASCADE;
DROP TABLE IF EXISTS member_diets CASCADE;
DROP TABLE IF EXISTS member_workouts CASCADE;
DROP TABLE IF EXISTS diet_templates CASCADE;
DROP TABLE IF EXISTS workout_exercises CASCADE;
DROP TABLE IF EXISTS workout_days CASCADE;
DROP TABLE IF EXISTS workout_templates CASCADE;
DROP TABLE IF EXISTS feed_reports CASCADE;
DROP TABLE IF EXISTS feed_likes CASCADE;
DROP TABLE IF EXISTS feed_comments CASCADE;
DROP TABLE IF EXISTS feed_posts CASCADE;
DROP TABLE IF EXISTS trainer_members CASCADE;
DROP TABLE IF EXISTS invitation_codes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ================================================
-- TABLA: profiles
-- ================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'trainer', 'member')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- TABLA: invitation_codes
-- ================================================
CREATE TABLE invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_uses INTEGER NOT NULL DEFAULT 10,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- TABLA: trainer_members (Asignación inmutable)
-- ================================================
CREATE TABLE trainer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id)
);

-- ================================================
-- FEED SOCIAL
-- ================================================
CREATE TABLE feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  commenter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE feed_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RUTINAS
-- ================================================
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  day_name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  notes TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asignación de rutinas a socios
CREATE TABLE member_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- DIETAS
-- ================================================
CREATE TABLE diet_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE member_diets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  diet_template_id UUID NOT NULL REFERENCES diet_templates(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- PROGRESO DEL SOCIO
-- ================================================
CREATE TABLE progress_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  weight_kg DECIMAL(5,2),
  chest_cm DECIMAL(5,2),
  waist_cm DECIMAL(5,2),
  hips_cm DECIMAL(5,2),
  arms_cm DECIMAL(5,2),
  legs_cm DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- AVISOS
-- ================================================
CREATE TABLE trainer_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notice_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES trainer_notices(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(notice_id, member_id)
);

-- ================================================
-- OBJETIVOS DE MACROS
-- ================================================
CREATE TABLE member_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  target_calories INTEGER,
  target_protein_g INTEGER,
  target_carbs_g INTEGER,
  target_fat_g INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- LOGS DE ENTRENAMIENTOS
-- ================================================
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- ================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ================================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_invitation_codes_trainer ON invitation_codes(trainer_id);
CREATE INDEX idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX idx_trainer_members_trainer ON trainer_members(trainer_id);
CREATE INDEX idx_trainer_members_member ON trainer_members(member_id);
CREATE INDEX idx_feed_posts_author ON feed_posts(author_id);
CREATE INDEX idx_feed_posts_created ON feed_posts(created_at DESC);
CREATE INDEX idx_feed_comments_post ON feed_comments(post_id);
CREATE INDEX idx_feed_likes_post ON feed_likes(post_id);
CREATE INDEX idx_workout_templates_trainer ON workout_templates(trainer_id);
CREATE INDEX idx_diet_templates_trainer ON diet_templates(trainer_id);
CREATE INDEX idx_progress_records_member ON progress_records(member_id);
CREATE INDEX idx_progress_records_date ON progress_records(date DESC);
CREATE INDEX idx_trainer_notices_trainer ON trainer_notices(trainer_id);
CREATE INDEX idx_trainer_notices_member ON trainer_notices(member_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- ================================================
-- POLÍTICAS RLS - PROFILES
-- ================================================
CREATE POLICY "Profiles son visibles para usuarios autenticados"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin puede insertar profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- POLÍTICAS RLS - INVITATION_CODES
-- ================================================
CREATE POLICY "Códigos visibles para trainers y admins"
  ON invitation_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'trainer')
    )
  );

CREATE POLICY "Admin puede gestionar códigos"
  ON invitation_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Cualquiera puede leer códigos para registro"
  ON invitation_codes FOR SELECT
  TO anon
  USING (is_active = true);

-- ================================================
-- POLÍTICAS RLS - TRAINER_MEMBERS
-- ================================================
CREATE POLICY "Trainer ve sus socios"
  ON trainer_members FOR SELECT
  TO authenticated
  USING (
    trainer_id = auth.uid() OR
    member_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Solo admin puede asignar socios"
  ON trainer_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================
-- POLÍTICAS RLS - FEED
-- ================================================
CREATE POLICY "Socios ven posts no ocultos"
  ON feed_posts FOR SELECT
  TO authenticated
  USING (
    is_hidden = false OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

CREATE POLICY "Socios pueden crear posts"
  ON feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'member')
  );

CREATE POLICY "Admin puede actualizar posts"
  ON feed_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comentarios visibles para autenticados"
  ON feed_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden comentar"
  ON feed_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Likes visibles para autenticados"
  ON feed_likes FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Reportes visibles para admin"
  ON feed_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Usuarios pueden reportar"
  ON feed_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ================================================
-- POLÍTICAS RLS - WORKOUTS
-- ================================================
CREATE POLICY "Trainers ven sus rutinas"
  ON workout_templates FOR SELECT
  TO authenticated
  USING (
    trainer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Trainers crean rutinas"
  ON workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

CREATE POLICY "Días y ejercicios visibles"
  ON workout_days FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Ejercicios visibles"
  ON workout_exercises FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Socios ven sus rutinas asignadas"
  ON member_workouts FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = member_workouts.member_id
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Trainers asignan rutinas"
  ON member_workouts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = member_workouts.member_id
    )
  );

-- ================================================
-- POLÍTICAS RLS - DIETS
-- ================================================
CREATE POLICY "Trainers ven sus dietas"
  ON diet_templates FOR SELECT
  TO authenticated
  USING (
    trainer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Trainers crean dietas"
  ON diet_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

CREATE POLICY "Socios ven sus dietas asignadas"
  ON member_diets FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = member_diets.member_id
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Trainers asignan dietas"
  ON member_diets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = member_diets.member_id
    )
  );

-- ================================================
-- POLÍTICAS RLS - PROGRESS
-- ================================================
CREATE POLICY "Socio ve su progreso"
  ON progress_records FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = progress_records.member_id
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Socio registra progreso"
  ON progress_records FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = auth.uid()
  );

CREATE POLICY "Fotos privadas"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = progress_photos.member_id
    )
  );

CREATE POLICY "Socio sube fotos"
  ON progress_photos FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ================================================
-- POLÍTICAS RLS - NOTICES
-- ================================================
CREATE POLICY "Trainers ven sus avisos"
  ON trainer_notices FOR SELECT
  TO authenticated
  USING (
    trainer_id = auth.uid() OR
    member_id = auth.uid() OR
    (member_id IS NULL AND EXISTS (
      SELECT 1 FROM trainer_members WHERE trainer_id = trainer_notices.trainer_id AND member_id = auth.uid()
    )) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Trainers crean avisos"
  ON trainer_notices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

CREATE POLICY "Notice reads para socios"
  ON notice_reads FOR ALL
  TO authenticated
  USING (member_id = auth.uid());

-- ================================================
-- POLÍTICAS RLS - MEMBER_GOALS & WORKOUT_LOGS
-- ================================================
CREATE POLICY "Socios ven sus objetivos"
  ON member_goals FOR ALL
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = member_goals.member_id
    )
  );

CREATE POLICY "Socios ven sus logs"
  ON workout_logs FOR ALL
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trainer_members 
      WHERE trainer_id = auth.uid() AND member_id = workout_logs.member_id
    )
  );

-- ================================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- INSERTAR DATOS DEMO
-- ================================================
-- Este bloque se ejecutará automáticamente para crear las cuentas demo
-- Nota: Las contraseñas deben ser creadas manualmente en Supabase Auth
-- o mediante el admin SDK

-- Los datos demo se cargarán mediante un script separado después de crear las cuentas

COMMIT;
