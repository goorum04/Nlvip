-- =============================================================================
-- CICLO MENSTRUAL - Columnas para profiles
-- Añadir a la tabla profiles
-- =============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sex text,
ADD COLUMN IF NOT EXISTS cycle_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cycle_start_date date,
ADD COLUMN IF NOT EXISTS cycle_length_days integer DEFAULT 28,
ADD COLUMN IF NOT EXISTS period_length_days integer DEFAULT 5;

-- =============================================================================
-- POLICIAS RLS (Row Level Security) para columnas del ciclo
-- =============================================================================

-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can update their own cycle data
CREATE POLICY "Users can update own cycle data" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can read their own cycle data
CREATE POLICY "Users can read own cycle data" ON profiles
  FOR SELECT
  USING (auth.uid() = id);
