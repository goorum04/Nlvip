-- =========================================================================
-- NL VIP CLUB - Enable Supabase Realtime (auto-applied on deploy)
-- This migration creates a reusable function that the Next.js server
-- also calls on startup via instrumentation.js, so no manual steps needed.
-- =========================================================================

-- Create idempotent function to configure realtime on all relevant tables.
-- SECURITY DEFINER so it runs with owner (postgres) permissions for DDL.
CREATE OR REPLACE FUNCTION setup_nlvip_realtime()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set REPLICA IDENTITY FULL so Supabase Realtime sends full row data
  -- on INSERT/UPDATE/DELETE (required for postgres_changes subscriptions)
  EXECUTE 'ALTER TABLE messages REPLICA IDENTITY FULL';
  EXECUTE 'ALTER TABLE trainer_notices REPLICA IDENTITY FULL';
  EXECUTE 'ALTER TABLE diet_onboarding_requests REPLICA IDENTITY FULL';
  EXECUTE 'ALTER TABLE conversations REPLICA IDENTITY FULL';
  EXECUTE 'ALTER TABLE conversation_participants REPLICA IDENTITY FULL';

  -- Add each table to the supabase_realtime publication.
  -- Wrapped in BEGIN/EXCEPTION so re-running is safe (already-added = no error).
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE messages';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE trainer_notices';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE diet_onboarding_requests';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE conversations';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- Execute immediately when this migration runs (supabase db push / deploy)
SELECT setup_nlvip_realtime();
