import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authUtils'
import { sendPushToUser } from '@/lib/webpush'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// POST /api/messages/send
// Inserts a chat message and sends a Web Push notification to all other participants.
export async function POST(req) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const { conversationId, text, type = 'text', audioPath = null, imagePath = null } = await req.json()

    if (!conversationId) {
      return NextResponse.json({ error: 'Falta conversationId' }, { status: 400 })
    }

    // Insert the message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: user.id,
        text: text || '',
        type,
        audio_path: audioPath,
        image_path: imagePath
      }])
      .select()
      .single()

    if (insertError) throw new Error(insertError.message)

    // Get sender name for the notification title
    const { data: sender } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const senderName = sender?.name || 'Nuevo mensaje'

    // Get all conversation participants except the sender
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', user.id)

    // Build notification body based on message type
    const notifBody =
      type === 'audio' ? '🎤 Mensaje de voz'
      : type === 'image' ? '📷 Foto'
      : text?.length > 80 ? text.slice(0, 80) + '…'
      : text || 'Nuevo mensaje'

    // Send push to each recipient (fire-and-forget — don't block response)
    if (participants?.length) {
      Promise.allSettled(
        participants.map(p =>
          sendPushToUser(supabase, p.user_id, {
            title: senderName,
            body: notifBody,
            url: '/chat',
            icon: '/icons/icon-192x192.png'
          })
        )
      )
    }

    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error('messages/send error:', error)
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 })
  }
}
