import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const { userId } = await request.json()

    if (!userId || !adminToken) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // 1. Verificar que el token proporcionado pertenece a un admin real
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(adminToken)
    
    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Token de administrador inválido' }, { status: 401 })
    }

    // 2. Comprobar el rol de admin en la base de datos
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos de administrador' }, { status: 403 })
    }

    // 3. Obtener el perfil de la víctima para asegurar que es un socio
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!targetProfile || targetProfile.role === 'admin') {
      return NextResponse.json({ error: 'No se puede eliminar a este usuario' }, { status: 403 })
    }

    // 4. Limpiar datos relacionados de la API (para evitar romper constraints)
    await Promise.all([
      supabaseAdmin.from('member_workouts').delete().eq('member_id', userId),
      supabaseAdmin.from('member_diets').delete().eq('member_id', userId),
      supabaseAdmin.from('food_logs').delete().eq('member_id', userId),
      supabaseAdmin.from('progress_photos').delete().eq('member_id', userId),
      supabaseAdmin.from('feed_posts').delete().eq('author_id', userId),
      supabaseAdmin.from('challenge_participants').delete().eq('member_id', userId),
      supabaseAdmin.from('diet_onboarding_requests').delete().eq('member_id', userId)
    ])

    // 5. Eliminar el usuario de Supabase Auth (esto eliminará automáticamente Profiles si existe el CASCADE trigger)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteAuthError) {
      throw deleteAuthError
    }

    // Por seguridad, intentar eliminar el perfil por si acaso no hay CASCADE
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true, message: 'Socio eliminado permanentemente' })

  } catch (error) {
    console.error('Error al intentar eliminar socio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
