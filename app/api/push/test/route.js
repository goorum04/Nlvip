import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativeApplePush, getApnStatus } from '@/lib/apn'

// POST /api/push/test
// Sends a test push to the authenticated user's own iOS devices and returns
// the server-side APN status + exact delivery result, so we can diagnose
// why notifications aren't arriving in TestFlight.
// Auth: Authorization: Bearer <supabase_jwt>
export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const status = getApnStatus()
    const result = await sendNativeApplePush(supabase, user.id, {
      title: 'NL VIP — Prueba',
      body: 'Si ves esta notificación con la app cerrada, todo funciona ✅',
      url: '/',
    })

    return NextResponse.json({ success: true, apn: status, result })
  } catch (err) {
    console.error('push/test error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
