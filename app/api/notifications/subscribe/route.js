import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/notifications/subscribe
// Body: { subscription: { endpoint, keys: { p256dh, auth } } }
// Auth: Authorization: Bearer <supabase_jwt>
export async function POST(req) {
  const supabaseAdmin = getSupabase()
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { subscription } = await req.json()
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('notifications/subscribe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
