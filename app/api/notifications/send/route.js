import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/webpush'
import { sendNativeApplePush } from '@/lib/apn'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// POST /api/notifications/send
// Sends a push notification to a specific user.
// Only callable by admin or trainer.
// Body: { targetUserId, title, body, url? }
// Auth: Authorization: Bearer <supabase_jwt>
export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Only admin or trainer can send push notifications
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'trainer'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { targetUserId, title, body, url } = await req.json()
    if (!targetUserId || !title || !body) {
      return NextResponse.json({ error: 'targetUserId, title y body son requeridos' }, { status: 400 })
    }

    await sendPushToUser(supabaseAdmin, targetUserId, {
      title,
      body,
      url: url || '/',
      icon: '/icons/icon-192x192.png',
    })

    // Native Apple Push
    await sendNativeApplePush(supabaseAdmin, targetUserId, {
      title,
      body,
      url: url || '/',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('notifications/send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
