-- Migration: Add glute and calf measurements to progress_records
-- Description: Adds columns to track glute and calf measurements in centimeters.

ALTER TABLE progress_records 
ADD COLUMN IF NOT EXISTS glutes_cm NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS calves_cm NUMERIC(5,2);

-- Update RLS if necessary (usually not needed for new columns if policy is on table)
-- But just in case, ensure the table is still enabled for RLS (it should be)
-- ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
