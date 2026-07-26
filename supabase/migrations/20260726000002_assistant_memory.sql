-- Memoria persistente del asistente de IA admin, en dos niveles:
-- 1. member_notes: hechos duraderos sobre UN socio (no cubiertos ya por
--    member_food_aversions), ej. "prefiere barra recta en curl", "hombro
--    sensible al hacer press".
-- 2. gym_assistant_preferences: preferencias generales de cómo el admin
--    quiere que se trabaje (agrupaciones musculares, terminología, formato
--    de resúmenes...), no ligadas a un socio concreto.
--
-- Ambas tablas se acceden SOLO a través de RPCs SECURITY DEFINER que
-- verifican rol admin/trainer internamente; RLS está activo sin políticas
-- para bloquear cualquier acceso directo a la tabla desde el cliente.

CREATE TABLE IF NOT EXISTS public.member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_notes_member_id ON public.member_notes(member_id);
ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gym_assistant_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE public.gym_assistant_preferences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._assert_admin_or_trainer()
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===== member_notes =====

CREATE OR REPLACE FUNCTION public.rpc_add_member_note(p_member_id UUID, p_note TEXT)
RETURNS JSON AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM public._assert_admin_or_trainer();
  INSERT INTO public.member_notes (member_id, note, created_by)
  VALUES (p_member_id, TRIM(p_note), auth.uid());
  SELECT COUNT(*) INTO v_count FROM public.member_notes WHERE member_id = p_member_id;
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CONCAT('Nota guardada. Total de notas de este socio: ', v_count),
    'total_notes', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rpc_list_member_notes(p_member_id UUID)
RETURNS TABLE (note TEXT, created_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  PERFORM public._assert_admin_or_trainer();
  RETURN QUERY
  SELECT mn.note, mn.created_at
  FROM public.member_notes mn
  WHERE mn.member_id = p_member_id
  ORDER BY mn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Usada internamente por la generación de rutinas/dietas (llamada con el
-- cliente de service-role, sin sesión de usuario) — sin chequeo de rol.
CREATE OR REPLACE FUNCTION public.rpc_get_member_notes_text(p_member_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_text TEXT;
BEGIN
  SELECT STRING_AGG('• ' || note, E'\n')
  INTO v_text
  FROM (
    SELECT note FROM public.member_notes
    WHERE member_id = p_member_id
    ORDER BY created_at DESC
    LIMIT 20
  ) sub;
  RETURN COALESCE(v_text, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rpc_remove_member_note(p_member_id UUID, p_note_text TEXT)
RETURNS JSON AS $$
DECLARE
  v_id UUID;
  v_count INT;
BEGIN
  PERFORM public._assert_admin_or_trainer();
  SELECT id INTO v_id FROM public.member_notes
  WHERE member_id = p_member_id AND note ILIKE '%' || p_note_text || '%'
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    DELETE FROM public.member_notes WHERE id = v_id;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.member_notes WHERE member_id = p_member_id;
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CASE WHEN v_id IS NOT NULL THEN 'Nota eliminada.' ELSE 'No se encontró ninguna nota que coincida.' END,
    'total_notes', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===== gym_assistant_preferences =====

CREATE OR REPLACE FUNCTION public.rpc_add_admin_preference(p_note TEXT)
RETURNS JSON AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM public._assert_admin_or_trainer();
  INSERT INTO public.gym_assistant_preferences (note, created_by)
  VALUES (TRIM(p_note), auth.uid());
  SELECT COUNT(*) INTO v_count FROM public.gym_assistant_preferences;
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CONCAT('Preferencia guardada. Total: ', v_count),
    'total_preferences', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rpc_list_admin_preferences()
RETURNS TABLE (note TEXT, created_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  PERFORM public._assert_admin_or_trainer();
  RETURN QUERY
  SELECT p.note, p.created_at
  FROM public.gym_assistant_preferences p
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Usada internamente por la generación de rutinas/dietas y por el system
-- prompt del asistente — sin chequeo de rol (se llama con service-role).
CREATE OR REPLACE FUNCTION public.rpc_get_admin_preferences_text()
RETURNS TEXT AS $$
DECLARE
  v_text TEXT;
BEGIN
  SELECT STRING_AGG('• ' || note, E'\n')
  INTO v_text
  FROM (
    SELECT note FROM public.gym_assistant_preferences
    ORDER BY created_at DESC
    LIMIT 30
  ) sub;
  RETURN COALESCE(v_text, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rpc_remove_admin_preference(p_note_text TEXT)
RETURNS JSON AS $$
DECLARE
  v_id UUID;
  v_count INT;
BEGIN
  PERFORM public._assert_admin_or_trainer();
  SELECT id INTO v_id FROM public.gym_assistant_preferences
  WHERE note ILIKE '%' || p_note_text || '%'
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    DELETE FROM public.gym_assistant_preferences WHERE id = v_id;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.gym_assistant_preferences;
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CASE WHEN v_id IS NOT NULL THEN 'Preferencia eliminada.' ELSE 'No se encontró ninguna preferencia que coincida.' END,
    'total_preferences', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.rpc_add_member_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_list_member_notes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_member_notes_text(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_remove_member_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_add_admin_preference(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_list_admin_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_admin_preferences_text() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_remove_admin_preference(TEXT) TO authenticated;
