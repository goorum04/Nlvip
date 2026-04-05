import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Verifica el Bearer token del request.
 * Si allowedRoles != null, también comprueba que el usuario tenga uno de esos roles.
 *
 * Devuelve { user, role? } si OK.
 * Devuelve { error: NextResponse } si falla (401 o 403).
 */
export async function requireAuth(request, allowedRoles = null) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()

  if (!token) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) }
  }

  if (allowedRoles) {
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !allowedRoles.includes(profile.role)) {
      return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
    }

    return { user, role: profile.role }
  }

  return { user }
}
