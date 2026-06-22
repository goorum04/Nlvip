-- =========================================================================
-- NL VIP CLUB — Security fix: restrict food aversion RPCs to authenticated
-- 20260622000001_fix_food_aversion_rls.sql
--
-- PROBLEM: The migration 20260615000001 granted SELECT/INSERT on
-- member_food_aversions and EXECUTE on all four RPCs to the 'anon' role.
-- All RPCs are SECURITY DEFINER (bypass RLS) and have no internal auth
-- check, so any unauthenticated caller with the public anon key could
-- read, add, or delete any member's food aversions by hitting the
-- Supabase REST API directly.
--
-- FIX:
--   1. Revoke INSERT/EXECUTE grants from 'anon'.
--   2. Enable RLS on the table (policies added below).
--   3. Add RLS policies so:
--      - admin/trainer can manage all aversions (via service-role or their
--        own JWT — service-role bypasses RLS already, policies cover JWT).
--      - No direct table access is needed by regular authenticated users
--        because the SECURITY DEFINER RPCs handle writes.
-- =========================================================================

-- 1. Revoke write access from anon
REVOKE INSERT ON public.member_food_aversions FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_add_food_aversion(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_get_food_aversions(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_list_food_aversions(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_remove_food_aversion(UUID, TEXT) FROM anon;

-- Also revoke SELECT from anon — aversions are personal health data
REVOKE SELECT ON public.member_food_aversions FROM anon;

-- 2. Enable RLS
ALTER TABLE public.member_food_aversions ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies — only authenticated staff (admin/trainer) and the
--    member themselves can read their own aversions through direct table
--    access. The SECURITY DEFINER RPCs bypass RLS so they still work for
--    any caller with a valid JWT that the app passes.

-- Admin/trainer can read all aversions
CREATE POLICY "food_aversions_staff_select"
  ON public.member_food_aversions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'trainer')
    )
  );

-- Members can only read their own aversions
CREATE POLICY "food_aversions_member_select"
  ON public.member_food_aversions FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Only staff can insert (members use the RPC which runs as SECURITY DEFINER)
CREATE POLICY "food_aversions_staff_insert"
  ON public.member_food_aversions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'trainer')
    )
  );

-- Only staff can delete
CREATE POLICY "food_aversions_staff_delete"
  ON public.member_food_aversions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'trainer')
    )
  );
