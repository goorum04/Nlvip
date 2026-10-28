import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { classifyAndStoreCorrection } from '@/lib/correctionMemory'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  checkinId: z.string().uuid(),
  // Vacío = descarte por error / sin motivo del que aprender.
  reason: z.string().max(1000).optional().default(''),
})

// POST /api/checkin/dismiss
// Descarta un borrador de revisión. Si el entrenador da un motivo, se guarda
// como memoria del asistente (nota del socio o preferencia general) para que
// la próxima propuesta no repita el mismo fallo.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (!['admin', 'trainer'].includes(callerProfile?.role)) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { checkinId, reason } = parsed.data

    const { data: checkin } = await supabase
      .from('member_checkins').select('id, member_id, status').eq('id', checkinId).maybeSingle()
    if (!checkin) return NextResponse.json({ error: 'Revisión no encontrada' }, { status: 404 })

    const { error } = await supabase
      .from('member_checkins')
      .update({ status: 'dismissed', reviewed_by: caller.id })
      .eq('id', checkinId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const memoryUpdate = reason.trim()
      ? await classifyAndStoreCorrection({
          correction: `Propuesta de dieta/rutina descartada por el entrenador. Motivo: ${reason.trim()}`,
          supabase,
          memberId: checkin.member_id,
          createdBy: caller.id,
        })
      : null

    return NextResponse.json({ success: true, memoryUpdate })
  } catch (error) {
    console.error('checkin/dismiss error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
