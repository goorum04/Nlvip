-- =============================================================================
-- WELLNESS EXPANSION - Módulo Bienestar Femenino NLVIP
-- EJECUTAR EN SUPABASE > SQL Editor
-- =============================================================================

-- 1. Nuevas columnas en profiles (etapa de vida + embarazo/postparto)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS life_stage text DEFAULT 'cycle',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS postpartum_date date;

-- 2. Tabla de síntomas diarios del ciclo
CREATE TABLE IF NOT EXISTS cycle_symptoms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  energy_level integer CHECK (energy_level BETWEEN 1 AND 5),
  mood text CHECK (mood IN ('happy','calm','irritable','anxious','sad','motivated','tired')),
  pain_level integer CHECK (pain_level BETWEEN 0 AND 5),
  pain_locations text[],
  flow_intensity text CHECK (flow_intensity IN ('none','spotting','light','moderate','heavy')),
  extra_symptoms text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3. Tabla de sesiones de lactancia
CREATE TABLE IF NOT EXISTS lactation_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_type text CHECK (session_type IN ('breastfeed','pump','bottle')) NOT NULL,
  breast_side text CHECK (breast_side IN ('left','right','both')),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  amount_ml integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- cycle_symptoms: solo la propia usuaria
ALTER TABLE cycle_symptoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own symptoms" ON cycle_symptoms
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- lactation_sessions: solo la propia usuaria
ALTER TABLE lactation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lactation sessions" ON lactation_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- GRANT acceso (por si acaso)
-- =============================================================================
GRANT ALL ON cycle_symptoms TO authenticated;
GRANT ALL ON lactation_sessions TO authenticated;
