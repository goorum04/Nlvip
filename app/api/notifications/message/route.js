import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativeApplePush } from '@/lib/apn'
import { sendPushToUser } from '@/lib/webpush'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// POST /api/notifications/message
// Called by a Postgres trigger via pg_net (or directly) when a new message is inserted.
// Body: { conversationId, senderId, text }
// This endpoint is protected by a shared secret to avoid public abuse.
export async function POST(req) {
  try {
    // Verify session
    const token = req.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { conversationId, senderId, text, messageType } = await req.json()
    if (!conversationId || !senderId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Get the OTHER participant in the conversation (the recipient)
    const { data: participants } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId)

    if (!participants?.length) {
      return NextResponse.json({ success: true, message: 'Sin destinatarios' })
    }

    // Get sender name
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, role')
      .eq('id', senderId)
      .single()

    const senderName = senderProfile?.name || 'Alguien'
    const msgBody = messageType === 'audio'
      ? '🎤 Mensaje de voz'
      : messageType === 'image'
        ? '📷 Imagen'
        : text || 'Te ha enviado un mensaje'

    const notifPayload = {
      title: `💬 ${senderName}`,
      body: msgBody.length > 80 ? msgBody.substring(0, 80) + '…' : msgBody,
      url: '/',
    }

    // Send to all recipients
    await Promise.all(
      participants.map(async ({ user_id }) => {
        try {
          await sendNativeApplePush(supabaseAdmin, user_id, notifPayload)
          await sendPushToUser(supabaseAdmin, user_id, { ...notifPayload, icon: '/icons/icon-192x192.png' })
        } catch (e) {
          console.warn('[Push] Error enviando a', user_id, e.message)
        }
      })
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('notifications/message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
