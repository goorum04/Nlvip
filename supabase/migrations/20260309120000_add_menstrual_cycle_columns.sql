-- Add menstrual cycle columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS sex text,
ADD COLUMN IF NOT EXISTS cycle_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cycle_start_date date,
ADD COLUMN IF NOT EXISTS cycle_length_days integer DEFAULT 28,
ADD COLUMN IF NOT EXISTS period_length_days integer DEFAULT 5;
