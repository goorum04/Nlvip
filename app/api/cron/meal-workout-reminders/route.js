import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativeApplePush } from '@/lib/apn'
import { sendPushToUser } from '@/lib/webpush'

// Ventana de aviso: se notifica si la hora objetivo cae entre 0 y
// REMINDER_LEAD_MINUTES minutos por delante de "ahora" (Europe/Madrid).
// El cron corre cada 10 minutos (ver vercel.json), así que 15 min de
// ventana asegura que ningún objetivo se cuele entre dos pasadas.
const REMINDER_LEAD_MINUTES = 15

const MEAL_LABELS = {
  breakfast: { field: 'breakfast_time', title: '🌅 Hora del desayuno', name: 'el desayuno' },
  lunch: { field: 'lunch_time', title: '☀️ Hora de comer', name: 'la comida' },
  snack: { field: 'snack_time', title: '🍎 Hora de la merienda', name: 'la merienda' },
  dinner: { field: 'dinner_time', title: '🌙 Hora de cenar', name: 'la cena' },
}

function madridNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (type) => parts.find(p => p.type === type)?.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutesSinceMidnight: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  }
}

function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ¿Cae `targetMinutes` dentro de la ventana [nowMinutes, nowMinutes + lead]?
function isDue(targetMinutes, nowMinutes, lead) {
  if (targetMinutes == null) return false
  const diff = targetMinutes - nowMinutes
  return diff >= 0 && diff < lead
}

export async function GET(request) {
  if (process.env.STATIC_EXPORT === 'true') {
    return NextResponse.json({ static: true })
  }

  const req = request
  const headers = req['headers']
  const auth = headers ? headers.get('authorization') : ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { date: today, minutesSinceMidnight: nowMinutes } = madridNow()

  const { data: candidates, error: loadError } = await supabase
    .from('profiles')
    .select('id, name, role, breakfast_time, lunch_time, snack_time, dinner_time, workout_time, meal_reminders_enabled, workout_reminder_enabled, last_workout_reminder_date')
    .eq('role', 'member')
    .not('email', 'like', '%@nlvipnutrition.internal')
    .or('meal_reminders_enabled.eq.true,workout_reminder_enabled.eq.true')

  if (loadError) {
    console.error('[cron/meal-workout-reminders] could not load candidates:', loadError)
    return NextResponse.json({ error: loadError.message }, { status: 500 })
  }

  const results = { checked: candidates?.length || 0, mealsSent: 0, workoutsSent: 0, skipped: 0, errors: [] }

  for (const profile of candidates || []) {
    try {
      // Comidas: hasta 4 avisos independientes por socio y día.
      if (profile.meal_reminders_enabled) {
        for (const [slot, { field, title, name }] of Object.entries(MEAL_LABELS)) {
          const target = timeToMinutes(profile[field])
          if (!isDue(target, nowMinutes, REMINDER_LEAD_MINUTES)) continue

          // Si ya se avisó hoy de esta comida, o el socio ya la marcó como
          // comida, no se repite el push.
          const { data: already } = await supabase
            .from('meal_reminders_sent')
            .select('id')
            .eq('member_id', profile.id)
            .eq('date', today)
            .eq('meal_slot', slot)
            .maybeSingle()
          if (already) { results.skipped++; continue }

          const { data: eaten } = await supabase
            .from('meal_logs')
            .select('id')
            .eq('member_id', profile.id)
            .eq('date', today)
            .eq('meal_slot', slot)
            .maybeSingle()
          if (eaten) { results.skipped++; continue }

          const payload = { title, body: `Se acerca ${name}. Márcala como hecha cuando termines.`, url: '/' }
          await sendNativeApplePush(supabase, profile.id, payload).catch(err =>
            console.warn('[cron/meal-workout-reminders] APN error:', profile.id, slot, err.message)
          )
          await sendPushToUser(supabase, profile.id, { ...payload, icon: '/icons/icon-192x192.png' }).catch(err =>
            console.warn('[cron/meal-workout-reminders] WebPush error:', profile.id, slot, err.message)
          )

          await supabase.from('meal_reminders_sent').insert({ member_id: profile.id, date: today, meal_slot: slot })
          results.mealsSent++
        }
      }

      // Entreno: como mucho un aviso al día.
      if (profile.workout_reminder_enabled && profile.last_workout_reminder_date !== today) {
        const target = timeToMinutes(profile.workout_time)
        if (isDue(target, nowMinutes, REMINDER_LEAD_MINUTES)) {
          const payload = { title: '💪 Hora de entrenar', body: 'Tu entreno está a punto de empezar. ¡Vamos!', url: '/' }
          await sendNativeApplePush(supabase, profile.id, payload).catch(err =>
            console.warn('[cron/meal-workout-reminders] APN error (workout):', profile.id, err.message)
          )
          await sendPushToUser(supabase, profile.id, { ...payload, icon: '/icons/icon-192x192.png' }).catch(err =>
            console.warn('[cron/meal-workout-reminders] WebPush error (workout):', profile.id, err.message)
          )
          await supabase.from('profiles').update({ last_workout_reminder_date: today }).eq('id', profile.id)
          results.workoutsSent++
        }
      }
    } catch (err) {
      console.error('[cron/meal-workout-reminders] member error:', profile.id, err)
      results.errors.push({ memberId: profile.id, error: err.message })
    }
  }

  return NextResponse.json(results)
}
