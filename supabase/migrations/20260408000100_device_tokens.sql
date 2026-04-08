-- =========================================================================
-- NL VIP CLUB - Device Tokens Table
-- Stores native APNs/FCM device tokens for native push notifications
-- (Different from push_subscriptions which is for Web Push API)
-- =========================================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token       text        NOT NULL,
  platform    text        NOT NULL DEFAULT 'ios',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own device tokens
CREATE POLICY "Users manage own device tokens"
  ON device_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all tokens (for sending notifications)
CREATE POLICY "Admins read all device tokens"
  ON device_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_device_tokens_updated_at();
