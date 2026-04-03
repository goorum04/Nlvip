-- =========================================================================
-- NL VIP CLUB - Health & Measurements Columns Migration
-- Run this script in Supabase SQL Editor to add persistent health data
-- to the profiles table. This script is SAFE and additive (no data lost).
-- =========================================================================

-- Add health & persistent data columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS injuries TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_notes TEXT;

-- Ensure weight and height are present (already in schema but just in case)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2);

-- Add age column for better macro calculations (Deurenberg body fat formula)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;

-- =========================================================================
-- VERIFY: Run this SELECT to confirm columns were added
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- ORDER BY ordinal_position;
-- =========================================================================
