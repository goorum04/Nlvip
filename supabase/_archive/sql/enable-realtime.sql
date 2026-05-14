-- =========================================================================
-- NL VIP CLUB - Enable Supabase Realtime on notification-relevant tables
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- IMPORTANT: Without this, Supabase Realtime subscriptions in the app
-- will NOT receive events even if the channel is subscribed correctly.
-- =========================================================================

-- Enable REPLICA IDENTITY FULL so Supabase Realtime sends complete row data
-- (required for postgres_changes subscriptions to include old/new values)
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE trainer_notices REPLICA IDENTITY FULL;
ALTER TABLE diet_onboarding_requests REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;

-- Add tables to the Supabase Realtime publication
-- (supabase_realtime is the default publication created by Supabase)
DO $$
BEGIN
  -- messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- trainer_notices
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trainer_notices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_notices;
  END IF;

  -- diet_onboarding_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'diet_onboarding_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE diet_onboarding_requests;
  END IF;

  -- conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
END $$;

-- =========================================================================
-- VERIFY: Check which tables are in the realtime publication
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- =========================================================================
