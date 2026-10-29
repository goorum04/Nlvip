import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'
import { generateTrainerMessage, resolveTrainerName } from '@/lib/trainerVoice'
import { getLastActivity, getActiveDates, computeStreak, isoDateMadrid, addDaysIso } from '@/lib/memberActivity'

export const dynamic = 'force-dynamic'

// Como mucho un "toque" por socio cada 3 días: si no, deja de tener gracia.
const NUDGE_COOLDOWN_DAYS = 3

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({ memberId: z.string().uuid() })

// POST /api/admin-nudge  { memberId }
// "Dar un toque": push + mensaje en la app, redactado en la voz del
// entrenador, para un socio que lleva días sin actividad.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!caller || !['admin', 'trainer'].includes(caller.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    const { memberId } = parsed.data

    if (caller.role === 'trainer') {
      const { data: link } = await supabase.from('trainer_members').select('id').eq('trainer_id', user.id).eq('member_id', memberId).maybeSingle()
      if (!link) return NextResponse.json({ error: 'Este socio no es tuyo' }, { status: 403 })
    }

    const { data: member } = await supabase.from('profiles').select('id, name, email, sex, role').eq('id', memberId).maybeSingle()
    if (!member || member.role !== 'member') return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

    const { data: lastNudge } = await supabase
      .from('notifications').select('created_at').eq('user_id', memberId).eq('type', 'trainer_nudge')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (lastNudge && Date.now() - new Date(lastNudge.created_at).getTime() < NUDGE_COOLDOWN_DAYS * 86400000) {
      const when = new Date(lastNudge.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      return NextResponse.json({ error: `Ya le diste un toque el ${when}. Espera ${NUDGE_COOLDOWN_DAYS} días entre toques.` }, { status: 409 })
    }

    const today = isoDateMadrid()
    const [last, dates, { data: notes }, trainerName] = await Promise.all([
      getLastActivity(supabase, [memberId]),
      getActiveDates(supabase, [memberId], addDaysIso(today, -60)),
      supabase.from('member_notes').select('note').eq('member_id', memberId).order('created_at', { ascending: false }).limit(4),
      resolveTrainerName(supabase, memberId, user.id),
    ])
    const info = last[memberId]
    // Racha que tenía justo antes de parar (desde el último día activo hacia atrás).
    const activeSet = dates.get(memberId) || new Set()
    const lastActiveIso = [...activeSet].sort().pop() || null
    const streakBefore = lastActiveIso ? computeStreak(activeSet, lastActiveIso).current : 0

    const message = await generateTrainerMessage({
      supabase,
      kind: 'nudge',
      member,
      trainerName,
      context: {
        daysInactive: info.daysInactive,
        lastActivityLabel: info.label ? `${info.label} hace ${info.daysInactive} días` : null,
        streakBefore: streakBefore >= 3 ? streakBefore : null,
        memberNotes: (notes || []).map(n => n.note),
      },
    })

    const payload = { title: `💬 ${trainerName} te ha escrito`, body: message, url: '/', icon: '/icons/icon-192x192.png' }
    await supabase.from('notifications').insert({
      user_id: memberId,
      title: `Mensaje de ${trainerName}`,
      body: message,
      type: 'trainer_nudge',
      url: '/',
    })
    const native = await sendNativePush(supabase, memberId, payload).catch(e => ({ sent: 0, error: e.message }))
    await sendPushToUser(supabase, memberId, payload).catch(() => {})

    return NextResponse.json({ success: true, message, pushSent: native?.sent || 0, voiceVersion: 2 })
  } catch (error) {
    console.error('admin-nudge error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
