-- Fix rpc_create_notice: previous version inserted into the non-existent
-- column "content"; the real column in trainer_notices is "message". This
-- broke the admin assistant's create_notice tool (lib/adminAssistantTools.js).
-- CREATE OR REPLACE keeps the oid, signature and SECURITY DEFINER unchanged.

CREATE OR REPLACE FUNCTION public.rpc_create_notice(
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_notice_id UUID;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden usar esta función'; END IF;
  INSERT INTO trainer_notices (trainer_id, member_id, title, message, priority)
  VALUES (auth.uid(), p_member_id, p_title, p_message, p_priority)
  RETURNING id INTO v_notice_id;
  RETURN jsonb_build_object(
    'success', true,
    'notice_id', v_notice_id,
    'is_global', p_member_id IS NULL,
    'title', p_title
  );
END;
$$;
