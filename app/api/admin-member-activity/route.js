import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getLastActivity, getActiveDates, computeStreak, isoDateMadrid, addDaysIso } from '@/lib/memberActivity'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({ memberIds: z.array(z.string().uuid()).min(1).max(500) })

// POST /api/admin-member-activity  { memberIds }
// Devuelve, por socio, la última actividad en la app (fecha, qué fue, días
// sin actividad), la racha actual y la fecha del último "toque" enviado.
// Admin: cualquier socio. Entrenador: solo los suyos.
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

    let memberIds = parsed.data.memberIds
    if (caller.role === 'trainer') {
      const { data: mine } = await supabase.from('trainer_members').select('member_id').eq('trainer_id', user.id)
      const allowed = new Set((mine || []).map(r => r.member_id))
      memberIds = memberIds.filter(id => allowed.has(id))
    }

    const today = isoDateMadrid()
    const [last, dates, { data: nudges }] = await Promise.all([
      getLastActivity(supabase, memberIds),
      getActiveDates(supabase, memberIds, addDaysIso(today, -60)),
      supabase.from('notifications').select('user_id, created_at').in('user_id', memberIds).eq('type', 'trainer_nudge').order('created_at', { ascending: false }).limit(1000),
    ])

    const lastNudge = {}
    for (const n of nudges || []) if (!lastNudge[n.user_id]) lastNudge[n.user_id] = n.created_at

    const activity = {}
    for (const id of memberIds) {
      const streak = computeStreak(dates.get(id) || new Set(), today)
      activity[id] = { ...last[id], streak: streak.current, lastNudgeAt: lastNudge[id] || null }
    }
    return NextResponse.json({ activity })
  } catch (error) {
    console.error('admin-member-activity error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
