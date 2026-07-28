import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Endpoint público (sin auth): la app lo consulta al abrir para saber si hay
// una versión más nueva publicada, sin que el admin tenga que avisar a cada
// socio manualmente. GET /api/app-version?platform=ios
export async function GET(request) {
  try {
    const platform = new URL(request.url).searchParams.get('platform') || 'ios'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabase
      .from('app_release_config')
      .select('latest_version, update_message, store_url')
      .eq('platform', platform)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ configured: false })

    return NextResponse.json({ configured: true, ...data })
  } catch (error) {
    console.error('app-version error:', error)
    // Fallo silencioso: si esto falla, la app sigue funcionando igual, solo
    // no muestra el aviso de actualización.
    return NextResponse.json({ configured: false }, { status: 200 })
  }
}
