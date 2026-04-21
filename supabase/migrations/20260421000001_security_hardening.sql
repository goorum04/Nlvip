-- =========================================================================
-- NL VIP CLUB - Migration: Security hardening + missing buckets/tables
-- 20260421000001_security_hardening.sql
-- SAFE: fully idempotent (IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS)
-- =========================================================================

-- =========================================================================
-- PART 1: admin_assistant_conversations + admin_assistant_messages
-- The admin_assistant_action_logs table in migration 1 has FK references
-- to these tables, but they were only defined in the legacy sql/master-schema.
-- Create here with IF NOT EXISTS so no data is lost if they already exist.
-- =========================================================================

CREATE TABLE IF NOT EXISTS admin_assistant_conversations (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_assistant_conv_admin
  ON admin_assistant_conversations(admin_id);

ALTER TABLE admin_assistant_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_assistant_conv_owner" ON admin_assistant_conversations;
CREATE POLICY "admin_assistant_conv_owner"
  ON admin_assistant_conversations
  FOR ALL
  USING (admin_id = (SELECT auth.uid()))
  WITH CHECK (admin_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS admin_assistant_messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES admin_assistant_conversations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content         text,
  tool_calls      jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_assistant_msg_conv
  ON admin_assistant_messages(conversation_id, created_at);

ALTER TABLE admin_assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_assistant_msg_conv_owner" ON admin_assistant_messages;
CREATE POLICY "admin_assistant_msg_conv_owner"
  ON admin_assistant_messages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_assistant_conversations c
    WHERE c.id = admin_assistant_messages.conversation_id
      AND c.admin_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_assistant_conversations c
    WHERE c.id = admin_assistant_messages.conversation_id
      AND c.admin_id = (SELECT auth.uid())
  ));

-- =========================================================================
-- PART 2: avatars storage bucket
-- UserProfile.jsx uploads avatars here. Path: {userId}/{filename}
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_upload"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"  ON storage.objects;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

-- =========================================================================
-- PART 3: progress_photos storage bucket
-- ProgressPhotos.jsx / MemberDashboard uploads member progress photos.
-- Path convention: {userId}/{filename}
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('progress_photos', 'progress_photos', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "progress_photos_owner_read"   ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_staff_read"   ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_owner_delete" ON storage.objects;

-- Owner reads their own photos (folder = userId)
CREATE POLICY "progress_photos_owner_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'progress_photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- Admin or assigned trainer can read any member's photos
CREATE POLICY "progress_photos_staff_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'progress_photos'
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM trainer_members tm
      WHERE tm.trainer_id = (SELECT auth.uid())
        AND tm.member_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "progress_photos_owner_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'progress_photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "progress_photos_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'progress_photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- =========================================================================
-- PART 4: Harden chat_audios SELECT policy
-- Previous policy: any authenticated user could download any audio by path.
-- New policy: only participants of the conversation that contains a message
-- pointing at this object can read it.
-- =========================================================================

DROP POLICY IF EXISTS "Chat audios read participants" ON storage.objects;
CREATE POLICY "Chat audios read participants" ON storage.objects FOR SELECT USING (
  bucket_id = 'chat_audios'
  AND EXISTS (
    SELECT 1
    FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.audio_path = storage.objects.name
      AND cp.user_id = (SELECT auth.uid())
  )
);

-- =========================================================================
-- PART 5: Harden member_badges SELECT policy
-- Previous policy: USING (true) let anyone enumerate any member's badges.
-- New policy: members see their own, admins/trainers of the member see theirs.
-- =========================================================================

DROP POLICY IF EXISTS "member_badges_select_all"         ON member_badges;
DROP POLICY IF EXISTS "member_badges_select_own_or_staff" ON member_badges;
CREATE POLICY "member_badges_select_own_or_staff" ON member_badges FOR SELECT TO authenticated USING (
  member_id = (SELECT auth.uid())
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM trainer_members
    WHERE trainer_id = (SELECT auth.uid())
      AND member_id  = member_badges.member_id
  )
);
