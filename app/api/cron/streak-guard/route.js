import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'
import { getActiveDates, computeStreak, isoDateMadrid, addDaysIso } from '@/lib/memberActivity'

// Aviso de "racha en peligro": a las 20:00 (Europe/Madrid), a los socios que
// llevan una racha de >= MIN_STREAK días registrando algo y hoy aún no han
// marcado nada. Un aviso al día como máximo (profiles.last_streak_reminder_date).
//
// Vercel programa los crons en UTC y Madrid cambia de hora dos veces al año,
// así que el cron corre a las 18 y a las 19 UTC y aquí se comprueba que en
// Madrid sean las 20.
const MIN_STREAK = 2
const TARGET_HOUR_MADRID = 20

const PHRASES = [
  (n) => `Llevas ${n} días seguidos y hoy aún no has marcado nada. Una comida marcada y la racha sigue viva.`,
  (n) => `${n} días de racha en juego. Todavía estás a tiempo: marca lo que has comido hoy o apunta el entreno.`,
  (n) => `No dejes que ${n} días seguidos se pierdan por hoy. Entra, marca una comida y listo.`,
  (n) => `Racha de ${n} días. Hoy no hay nada registrado todavía... ¿lo arreglamos en 10 segundos?`,
]

function madridHour() {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()), 10)
}

export async function GET(request) {
  if (process.env.STATIC_EXPORT === 'true') return NextResponse.json({ static: true })

  const auth = request['headers']?.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const hour = madridHour()
  // Cabecera x-force: 1 permite probarlo a mano fuera de hora (con el secreto).
  if (hour !== TARGET_HOUR_MADRID && request['headers']?.get('x-force') !== '1') {
    return NextResponse.json({ skipped: true, madridHour: hour })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = isoDateMadrid()
  const { data: members, error } = await supabase
    .from('profiles')
    .select('id, name, last_streak_reminder_date')
    .eq('role', 'member')
    .not('email', 'like', '%@nlvipnutrition.internal')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const candidates = (members || []).filter(m => m.last_streak_reminder_date !== today)
  const dates = await getActiveDates(supabase, candidates.map(m => m.id), addDaysIso(today, -45))

  const results = { checked: candidates.length, sent: 0, errors: [] }
  for (const m of candidates) {
    try {
      const { current, todayDone } = computeStreak(dates.get(m.id) || new Set(), today)
      if (todayDone || current < MIN_STREAK) continue

      const body = PHRASES[Math.floor(Math.random() * PHRASES.length)](current)
      const payload = { title: '🔥 Tu racha está en juego', body, url: '/' }
      await sendNativePush(supabase, m.id, payload).catch(e => console.warn('[streak-guard] APN', m.id, e.message))
      await sendPushToUser(supabase, m.id, { ...payload, icon: '/icons/icon-192x192.png' }).catch(e => console.warn('[streak-guard] WebPush', m.id, e.message))
      await supabase.from('profiles').update({ last_streak_reminder_date: today }).eq('id', m.id)
      results.sent++
    } catch (e) {
      results.errors.push({ memberId: m.id, error: e.message })
    }
  }
  return NextResponse.json(results)
}
