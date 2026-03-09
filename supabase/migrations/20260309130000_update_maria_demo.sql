-- Update Maria demo account with cycle tracking enabled
UPDATE profiles 
SET 
  sex = 'female',
  cycle_enabled = true,
  cycle_start_date = '2026-03-01',
  cycle_length_days = 28,
  period_length_days = 5,
  weight_kg = 65,
  height_cm = 165
WHERE email = 'maria@demo.com';
