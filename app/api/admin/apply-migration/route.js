import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST /api/admin/apply-migration
// Aplica la migración de member_food_aversions manualmente (para cuando supabase CLI no disponible)
export async function POST(req) {
  try {
    // Auth: solo admin
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    // Lee el SQL de la migración
    const migrationSQL = `-- Tabla para registrar aversiones permanentes de alimentos por socio
-- Las aversiones se ACUMULAN (nunca se borran) para crear una "memoria" de preferencias
CREATE TABLE IF NOT EXISTS public.member_food_aversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, food_name)
);

-- Índice para búsquedas rápidas por member_id
CREATE INDEX IF NOT EXISTS idx_member_food_aversions_member_id ON public.member_food_aversions(member_id);

-- RPC para añadir una aversión sin borrar las anteriores
CREATE OR REPLACE FUNCTION public.rpc_add_food_aversion(
  p_member_id UUID,
  p_food_name TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_count INT;
BEGIN
  -- Insertar o ignorar si ya existe (UNIQUE constraint)
  INSERT INTO public.member_food_aversions (member_id, food_name, reason)
  VALUES (p_member_id, TRIM(p_food_name), p_reason)
  ON CONFLICT (member_id, food_name) DO NOTHING;

  -- Contar aversiones actuales para este socio
  SELECT COUNT(*) INTO v_count
  FROM public.member_food_aversions
  WHERE member_id = p_member_id;

  v_result := jsonb_build_object(
    'success', TRUE,
    'message', CONCAT('Aversión "', p_food_name, '" añadida al socio. Total de aversiones: ', v_count),
    'total_aversions', v_count
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC para obtener todas las aversiones de un socio (como lista CSV)
CREATE OR REPLACE FUNCTION public.rpc_get_food_aversions(p_member_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_aversions TEXT;
BEGIN
  SELECT STRING_AGG(food_name, ', ')
  INTO v_aversions
  FROM public.member_food_aversions
  WHERE member_id = p_member_id
  ORDER BY food_name;

  RETURN COALESCE(v_aversions, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC para listar todas las aversiones de un socio con detalles
CREATE OR REPLACE FUNCTION public.rpc_list_food_aversions(p_member_id UUID)
RETURNS TABLE (
  food_name TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mfa.food_name,
    mfa.reason,
    mfa.created_at
  FROM public.member_food_aversions mfa
  WHERE mfa.member_id = p_member_id
  ORDER BY mfa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC para eliminar UNA aversión específica (si el admin se equivoca)
CREATE OR REPLACE FUNCTION public.rpc_remove_food_aversion(
  p_member_id UUID,
  p_food_name TEXT
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_count INT;
BEGIN
  DELETE FROM public.member_food_aversions
  WHERE member_id = p_member_id AND food_name = TRIM(p_food_name);

  SELECT COUNT(*) INTO v_count
  FROM public.member_food_aversions
  WHERE member_id = p_member_id;

  v_result := jsonb_build_object(
    'success', TRUE,
    'message', CONCAT('Aversión "', p_food_name, '" eliminada. Aversiones restantes: ', v_count),
    'total_aversions', v_count
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Dar permisos a anon y authenticated
GRANT SELECT, INSERT ON public.member_food_aversions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_add_food_aversion(UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_food_aversions(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_list_food_aversions(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_remove_food_aversion(UUID, TEXT) TO authenticated, anon;`

    // Ejecutar el SQL
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error: sqlError } = await adminClient.rpc('exec_raw_sql', { sql: migrationSQL }).catch(e => ({ error: e }))

    if (sqlError) {
      // Si exec_raw_sql no existe, intentar usar directamente Postgres
      // (fallback: la migración probablemente ya está aplicada o necesita manual)
      console.warn('exec_raw_sql no disponible, intentando alternativa...')

      // Verificar si la tabla ya existe
      const { data: tableExists, error: checkErr } = await adminClient
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'member_food_aversions')
        .maybeSingle()

      if (tableExists) {
        return NextResponse.json({
          success: true,
          message: 'La tabla member_food_aversions ya existe. Migración ya aplicada.'
        })
      }

      // Si no existe, la migración necesita ser aplicada manualmente
      return NextResponse.json({
        success: false,
        error: 'No se puede ejecutar SQL directamente. Ejecuta manualmente: supabase db push --linked'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Migración aplicada correctamente. Tabla member_food_aversions creada.'
    })

  } catch (error) {
    console.error('apply-migration error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
