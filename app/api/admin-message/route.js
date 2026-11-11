import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'
import { resolveTrainerName } from '@/lib/trainerVoice'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  memberId: z.string().uuid(),
  body: z.string().trim().min(2).max(500),
})

// POST /api/admin-message  { memberId, body }
// Mensaje escrito a mano por el entrenador/admin para un socio: push al
// móvil + tarjeta "Mensaje de Nacho" en la pantalla principal de la app
// (notifications, type trainer_message). Pensado para sustituir el WhatsApp
// en avisos como "te he subido 250 kcal": así el socio entra en la app.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: caller } = await supabase.from('profiles').select('role, name').eq('id', user.id).maybeSingle()
    if (!caller || !['admin', 'trainer'].includes(caller.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    const { memberId, body } = parsed.data

    if (caller.role === 'trainer') {
      const { data: link } = await supabase.from('trainer_members').select('id').eq('trainer_id', user.id).eq('member_id', memberId).maybeSingle()
      if (!link) return NextResponse.json({ error: 'Este socio no es tuyo' }, { status: 403 })
    }

    const { data: member } = await supabase.from('profiles').select('id, role').eq('id', memberId).maybeSingle()
    if (!member || member.role !== 'member') return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

    // Firma con el nombre del entrenador asignado; si quien escribe es otro
    // (p. ej. el admin), con el suyo.
    const assignedName = await resolveTrainerName(supabase, memberId, user.id)
    const callerFirst = (caller.name || '').trim().split(/\s+/)[0]
    const signer = caller.role === 'admin' && callerFirst ? callerFirst.charAt(0).toUpperCase() + callerFirst.slice(1).toLowerCase() : assignedName

    await supabase.from('notifications').insert({
      user_id: memberId,
      title: `Mensaje de ${signer}`,
      body,
      type: 'trainer_message',
      url: '/',
    })
    const payload = { title: `💬 ${signer} te ha escrito`, body, url: '/', icon: '/icons/icon-192x192.png' }
    const native = await sendNativePush(supabase, memberId, payload).catch(() => ({ sent: 0 }))
    await sendPushToUser(supabase, memberId, payload).catch(() => {})

    return NextResponse.json({ success: true, pushSent: native?.sent || 0 })
  } catch (error) {
    console.error('admin-message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
