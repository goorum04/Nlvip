-- =========================================================================
-- NL VIP CLUB — Security fix: drop overly-permissive invitation_codes UPDATE
-- 20260611000001_drop_permissive_invitation_update.sql
--
-- PROBLEM: "invitation_codes_update_usage" allowed ANY authenticated user to
-- UPDATE any active invitation code (USING: is_active = true, WITH CHECK:
-- auth.uid() IS NOT NULL). A logged-in member could reset current_uses,
-- raise max_uses, change trainer_id, etc.
--
-- WHY IT IS NOT NEEDED:
-- - /api/redeem-premium-code uses supabaseAdmin (service-role key) →
--   bypasses RLS entirely, so no RLS policy is needed for the counter bump.
-- - AdminDashboard.jsx toggleCodeStatus uses the Supabase client AS ADMIN:
--   already covered by "invitation_codes_update" which requires is_admin()
--   or ownership of the code (trainer_id = auth.uid()).
--
-- SAFE: DROP POLICY IF EXISTS is idempotent — no error if already gone.
-- =========================================================================

DROP POLICY IF EXISTS "Update code usage on register" ON invitation_codes;
DROP POLICY IF EXISTS "invitation_codes_update_usage"  ON invitation_codes;
