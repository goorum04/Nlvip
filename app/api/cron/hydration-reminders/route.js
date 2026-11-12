import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'

// Recordatorio de hidratación (petición de Nacho): un aviso al empezar el día
// y otro a mediodía para que el socio beba agua repartida (2,5-4 litros) y
// evite la retención de líquidos. Dos pushes al día como máximo por socio
// (profiles.last_hydration_reminder guarda "YYYY-MM-DD:am|pm"); el socio
// puede desactivarlos en su perfil (profiles.hydration_reminders_enabled).
//
// Vercel programa los crons en UTC y Madrid cambia de hora dos veces al año:
// el cron corre a las 7:30, 8:30, 11:30 y 12:30 UTC y aquí se comprueba que
// en Madrid sean las 9 (mañana) o las 13 (mediodía).
const SLOTS = {
  9: 'am',
  13: 'pm',
}

const MESSAGES = {
  am: [
    { title: '💧 Empieza el día hidratándote', body: 'Un vaso de agua ahora y ve repartiendo entre 2,5 y 4 litros a lo largo del día. Tu cuerpo lo nota.' },
    { title: '💧 Agua antes que nada', body: 'Arranca el día con un buen vaso de agua. Objetivo: 2,5 a 4 litros repartidos, para hidratarte y no retener líquidos.' },
    { title: '💧 Hidratación del día', body: 'Ten la botella a mano desde ya. Entre 2,5 y 4 litros repartidos en el día, sin atracones de agua.' },
    { title: '💧 Buenos días, a beber agua', body: 'Primer vaso del día ahora. El resto, repartido: 2,5 a 4 litros ayudan a que no retengas líquidos.' },
  ],
  pm: [
    { title: '💧 ¿Cómo vas de agua?', body: 'A media jornada deberías llevar ya más de un litro. Bebe un vaso ahora y sigue repartiendo hasta la noche.' },
    { title: '💧 Toca beber agua', body: 'Revisa la botella: entre 2,5 y 4 litros al día, repartidos. Un vaso con la comida y otro después.' },
    { title: '💧 Pausa para hidratarte', body: 'Mediodía: buen momento para un vaso de agua. Repartida en el día es como mejor se absorbe y evitas retener líquidos.' },
    { title: '💧 Agua a mediodía', body: 'Si llevas pocos vasos, ponte al día ahora y sigue hasta la noche. El objetivo son 2,5 a 4 litros repartidos.' },
  ],
}

function madridHour() {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()), 10)
}

function madridDate() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t) => parts.find(p => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export async function GET(request) {
  if (process.env.STATIC_EXPORT === 'true') return NextResponse.json({ static: true })

  const auth = request['headers']?.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const hour = madridHour()
  // Cabecera x-force: am|pm permite probarlo a mano fuera de hora (con el secreto).
  const forced = request['headers']?.get('x-force')
  const slot = forced === 'am' || forced === 'pm' ? forced : SLOTS[hour]
  if (!slot) return NextResponse.json({ skipped: true, madridHour: hour })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = madridDate()
  const marker = `${today}:${slot}`
  const { data: members, error } = await supabase
    .from('profiles')
    .select('id, last_hydration_reminder')
    .eq('role', 'member')
    .eq('hydration_reminders_enabled', true)
    .not('email', 'like', '%@nlvipnutrition.internal')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const candidates = (members || []).filter(m => m.last_hydration_reminder !== marker)
  const results = { slot, checked: candidates.length, sent: 0, errors: [] }
  for (const m of candidates) {
    try {
      const msg = MESSAGES[slot][Math.floor(Math.random() * MESSAGES[slot].length)]
      const payload = { title: msg.title, body: msg.body, url: '/' }
      const native = await sendNativePush(supabase, m.id, payload).catch(e => { console.warn('[hydration] APN', m.id, e.message); return { sent: 0 } })
      const web = await sendPushToUser(supabase, m.id, { ...payload, icon: '/icons/icon-192x192.png' }).catch(e => { console.warn('[hydration] WebPush', m.id, e.message); return null })
      await supabase.from('profiles').update({ last_hydration_reminder: marker }).eq('id', m.id)
      if ((native?.sent || 0) > 0 || web) results.sent++
    } catch (e) {
      results.errors.push({ memberId: m.id, error: e.message })
    }
  }
  return NextResponse.json(results)
}
