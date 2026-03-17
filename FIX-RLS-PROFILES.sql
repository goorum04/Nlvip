-- ============================================================
-- FIX: Políticas RLS de profiles + Trigger auto-creación
-- Ejecuta esto en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Eliminar política restrictiva que bloquea el registro
DROP POLICY IF EXISTS "Admin puede insertar profiles" ON profiles;

-- 2. Permitir que cada usuario cree su propio perfil
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON profiles;
CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Crear trigger para auto-crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, has_premium)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verificar resultado
SELECT id, email, name, role, has_premium FROM profiles ORDER BY created_at DESC LIMIT 10;
