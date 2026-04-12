-- =========================================================================
-- NL VIP CLUB - Migration 5: Fix invitation_codes schema
-- 20260412000005_invitation_codes_fix.sql
-- SAFE: Only additive ALTER TABLE. No data loss.
--
-- master-schema.sql has: code TEXT PRIMARY KEY (no id, no is_active, no expires_at)
-- Code uses: code.id (UUID), is_active BOOLEAN, expires_at TIMESTAMPTZ
-- Legacy MASTER-DATABASE-SETUP.sql has the correct schema — this migration
-- brings the production table up to that standard.
-- =========================================================================

-- Add id UUID column if missing (code uses .eq('id', codeId) everywhere)
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Make sure existing rows get a UUID (back-fill)
UPDATE invitation_codes SET id = gen_random_uuid() WHERE id IS NULL;

-- Add unique index on id so .eq('id', ...) works efficiently
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_codes_id ON invitation_codes(id);

-- Add is_active (used to toggle/filter codes in AdminDashboard and AdminCodesTab)
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add expires_at (shown in UI and used in inserts)
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- current_uses: needed by rpc_create_invitation_code usage pattern
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0;

-- Update RLS to allow admins full access and trainers to manage their own codes
DROP POLICY IF EXISTS "Trainers can view own codes"   ON invitation_codes;
DROP POLICY IF EXISTS "Trainers can create codes"     ON invitation_codes;
DROP POLICY IF EXISTS "invitation_codes_select"       ON invitation_codes;
DROP POLICY IF EXISTS "invitation_codes_insert"       ON invitation_codes;
DROP POLICY IF EXISTS "invitation_codes_update"       ON invitation_codes;
DROP POLICY IF EXISTS "invitation_codes_delete"       ON invitation_codes;

CREATE POLICY "invitation_codes_select" ON invitation_codes FOR SELECT USING (
  trainer_id = (SELECT auth.uid()) OR is_admin()
);
CREATE POLICY "invitation_codes_insert" ON invitation_codes FOR INSERT WITH CHECK (
  (trainer_id = (SELECT auth.uid()) AND is_trainer()) OR is_admin()
);
CREATE POLICY "invitation_codes_update" ON invitation_codes FOR UPDATE USING (
  trainer_id = (SELECT auth.uid()) OR is_admin()
);
CREATE POLICY "invitation_codes_delete" ON invitation_codes FOR DELETE USING (
  trainer_id = (SELECT auth.uid()) OR is_admin()
);
