-- =========================================================================
-- NL VIP CLUB - Sistema de Chat con Conversaciones
-- Crea las tablas conversations, conversation_participants y messages que
-- reemplazan el antiguo chat_messages con un modelo multi-participante
-- que soporta mensajes de texto, audio e imagen.
-- También crea los storage buckets chat_audios y chat_images, y la
-- función RPC start_conversation para crear/recuperar conversaciones.
-- =========================================================================

-- -------------------------------------------------------------------------
-- TABLAS
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text        NOT NULL CHECK (type IN ('trainer_member', 'admin_member')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  text            text,
  type            text        NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'audio', 'image')),
  audio_path      text,
  image_path      text,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- -------------------------------------------------------------------------
-- ÍNDICES
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv
  ON conversation_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user
  ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages(conversation_id, is_read)
  WHERE is_read = false;

-- -------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------------------------

ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;

-- conversations: sólo visibles para los participantes
CREATE POLICY "Ver conversaciones propias"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );

-- La inserción se hace sólo a través del RPC start_conversation (SECURITY DEFINER)
CREATE POLICY "RPC puede crear conversaciones"
  ON conversations FOR INSERT
  WITH CHECK (true);

-- conversation_participants: cada usuario ve sus participaciones y las de su conversación
CREATE POLICY "Ver participaciones de mis conversaciones"
  ON conversation_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.user_id = auth.uid()
    )
  );

-- La inserción se hace sólo a través del RPC (SECURITY DEFINER)
CREATE POLICY "RPC puede insertar participantes"
  ON conversation_participants FOR INSERT
  WITH CHECK (true);

-- messages: sólo los participantes de la conversación pueden leer/escribir
CREATE POLICY "Participantes leen mensajes"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participantes envían mensajes"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participantes marcan mensajes como leídos"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------------------
-- RPC: start_conversation
-- Crea una conversación entre los participantes dados (p_participant_ids).
-- Si ya existe una conversación del mismo tipo entre esos usuarios, devuelve
-- su id en lugar de crear una nueva. SECURITY DEFINER para poder saltar
-- las políticas RLS al insertar en conversations/conversation_participants.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION start_conversation(
  p_type            text,
  p_participant_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id uuid;
  v_uid     uuid;
BEGIN
  IF array_length(p_participant_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Se necesitan al menos 2 participantes';
  END IF;

  -- Buscar conversación existente del mismo tipo entre los dos primeros participantes
  SELECT cp.conversation_id INTO v_conv_id
  FROM conversation_participants cp
  JOIN conversations c ON c.id = cp.conversation_id
  WHERE c.type = p_type
    AND cp.user_id = p_participant_ids[1]
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = cp.conversation_id
        AND cp2.user_id = p_participant_ids[2]
    )
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Crear nueva conversación
  INSERT INTO conversations (type) VALUES (p_type) RETURNING id INTO v_conv_id;

  -- Añadir todos los participantes
  FOREACH v_uid IN ARRAY p_participant_ids LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_uid)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_conv_id;
END;
$$;

-- -------------------------------------------------------------------------
-- STORAGE BUCKETS para medios de chat
-- Nota: chat_audios es público porque el AudioPlayer usa la URL pública
-- directamente. chat_images igual. Si en el futuro se quiere mayor
-- seguridad, cambiar a private y usar signed URLs.
-- -------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_audios',
  'chat_audios',
  true,
  10485760,  -- 10 MB
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_images',
  'chat_images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para chat_audios
-- El nombre del fichero sigue el patrón: {userId}_{timestamp}.webm
CREATE POLICY "chat_audios_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_audios');

CREATE POLICY "chat_audios_public_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat_audios');

CREATE POLICY "chat_audios_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat_audios' AND auth.uid()::text = LEFT(name, 36));

-- Políticas de storage para chat_images
CREATE POLICY "chat_images_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_images');

CREATE POLICY "chat_images_public_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat_images');

CREATE POLICY "chat_images_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat_images' AND auth.uid()::text = LEFT(name, 36));
