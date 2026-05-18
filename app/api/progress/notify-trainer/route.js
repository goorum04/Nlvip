import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativeApplePush } from '@/lib/apn'
import { sendPushToUser } from '@/lib/webpush'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/progress/notify-trainer
// Called by a member after saving progress (measurements + photos).
// Notifies their assigned trainer and the gym admin.
export async function POST(req) {
  const supabaseAdmin = getSupabase()
  try {
    const token = req.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Obtener nombre del socio
    const { data: memberProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()
    const memberName = memberProfile?.name || memberProfile?.email?.split('@')[0] || 'Un socio'

    const notifPayload = {
      title: `📊 ${memberName} completó su revisión`,
      body: 'Ha subido sus fotos y medidas. Revisa su progreso.',
      url: '/admin',
    }

    const notifiedIds = new Set()

    // Notificar al trainer asignado
    const { data: trainerLink } = await supabaseAdmin
      .from('trainer_members')
      .select('trainer_id')
      .eq('member_id', user.id)
      .maybeSingle()

    if (trainerLink?.trainer_id) {
      const trainerId = trainerLink.trainer_id
      notifiedIds.add(trainerId)
      await sendNativeApplePush(supabaseAdmin, trainerId, { ...notifPayload, url: '/trainer' })
      await sendPushToUser(supabaseAdmin, trainerId, { ...notifPayload, url: '/trainer', icon: '/icons/icon-192x192.png' })
      await supabaseAdmin.from('trainer_notices').insert({
        trainer_id: trainerId,
        member_id: user.id,
        title: notifPayload.title,
        message: notifPayload.body,
        priority: 'normal',
      })
    }

    // Notificar al admin (si no es el mismo que el trainer)
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (adminProfile?.id && !notifiedIds.has(adminProfile.id)) {
      await sendNativeApplePush(supabaseAdmin, adminProfile.id, notifPayload)
      await sendPushToUser(supabaseAdmin, adminProfile.id, { ...notifPayload, icon: '/icons/icon-192x192.png' })
      await supabaseAdmin.from('trainer_notices').insert({
        trainer_id: adminProfile.id,
        member_id: user.id,
        title: notifPayload.title,
        message: notifPayload.body,
        priority: 'normal',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notify-trainer] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
