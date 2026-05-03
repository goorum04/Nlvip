-- Premium messaging gate: solo socios premium o staff (trainer/admin) pueden
-- enviar mensajes en chat 1-a-1, subir imágenes al chat o subir audios al chat.
-- feed_posts y feed_comments ya están restringidos a premium en migraciones
-- previas — no se tocan.
--
-- Aplicado por fases (cada bloque BEGIN/COMMIT en migraciones separadas en
-- producción), pero unificado en un solo archivo de migración para que un
-- install desde cero quede coherente.

-- =========================================================================
-- 1. messages: dejar UNA sola policy INSERT con check premium-or-staff
-- =========================================================================
BEGIN;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Participants send messages"        ON public.messages;
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = (SELECT auth.uid())
  )
  AND (public.is_premium() OR public.is_staff())
);
COMMIT;

-- =========================================================================
-- 2. storage.objects (chat_images bucket): una sola policy INSERT premium-or-staff
-- =========================================================================
BEGIN;
DROP POLICY IF EXISTS "Chat images upload auth"        ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat images"   ON storage.objects;
DROP POLICY IF EXISTS "Chat images upload premium"     ON storage.objects;
CREATE POLICY "Chat images upload premium" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat_images'
  AND auth.uid() IS NOT NULL
  AND (public.is_premium() OR public.is_staff())
);
COMMIT;

-- =========================================================================
-- 3. storage.objects (chat_audios bucket): una sola policy INSERT premium-or-staff
-- =========================================================================
BEGIN;
DROP POLICY IF EXISTS "Admin Upload"                   ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat audios"   ON storage.objects;
DROP POLICY IF EXISTS "Chat audios upload admin"       ON storage.objects;
DROP POLICY IF EXISTS "Chat audios upload premium"     ON storage.objects;
CREATE POLICY "Chat audios upload premium" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat_audios'
  AND auth.uid() IS NOT NULL
  AND (public.is_premium() OR public.is_staff())
);
COMMIT;
