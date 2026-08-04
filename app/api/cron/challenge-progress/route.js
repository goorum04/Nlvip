import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// progress_value en challenge_participants nunca se actualizaba en ningún
// sitio (ni código de la app ni triggers de base de datos) — un socio se
// apuntaba a un reto y la barra de progreso se quedaba en 0% para siempre.
// Este cron recalcula el progreso de todos los retos activos cada día,
// mismo patrón que cron/progress-reminders.
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

  const today = new Date().toISOString().split('T')[0]

  const { data: challenges, error: challengesError } = await supabase
    .from('challenges')
    .select('id, type, target_value, start_date, end_date')
    .eq('is_active', true)
    .lte('start_date', today)
    .gte('end_date', today)

  if (challengesError) {
    console.error('[cron/challenge-progress] no se pudieron cargar los retos:', challengesError)
    return NextResponse.json({ error: challengesError.message }, { status: 500 })
  }

  const results = { challenges: challenges?.length || 0, participants: 0, updated: 0, completed: 0, errors: [] }

  for (const challenge of challenges || []) {
    const { data: participants, error: partError } = await supabase
      .from('challenge_participants')
      .select('id, member_id, progress_value, completed, joined_at')
      .eq('challenge_id', challenge.id)
      .eq('completed', false)

    if (partError) {
      results.errors.push({ challengeId: challenge.id, error: partError.message })
      continue
    }

    for (const participant of participants || []) {
      results.participants++
      try {
        const joinedDate = (participant.joined_at || challenge.start_date).slice(0, 10)
        const rangeStart = joinedDate > challenge.start_date ? joinedDate : challenge.start_date
        const rangeEnd = challenge.end_date < today ? challenge.end_date : today

        const newProgress = await computeProgress(supabase, challenge, participant, rangeStart, rangeEnd)
        if (newProgress === null) continue // sin datos suficientes todavía (ej. reto de peso sin ningún registro)

        const nowCompleted = newProgress >= Number(challenge.target_value)
        if (newProgress === Number(participant.progress_value) && nowCompleted === participant.completed) continue

        const update = { progress_value: newProgress }
        if (nowCompleted && !participant.completed) {
          update.completed = true
          update.completed_at = new Date().toISOString()
          results.completed++
        }

        const { error: updateError } = await supabase
          .from('challenge_participants')
          .update(update)
          .eq('id', participant.id)

        if (updateError) throw updateError
        results.updated++
      } catch (err) {
        results.errors.push({ participantId: participant.id, error: err.message })
      }
    }
  }

  return NextResponse.json(results)
}

async function computeProgress(supabase, challenge, participant, rangeStart, rangeEnd) {
  if (challenge.type === 'workouts') {
    const { count } = await supabase
      .from('workout_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', participant.member_id)
      .gte('checked_in_at', `${rangeStart}T00:00:00`)
      .lte('checked_in_at', `${rangeEnd}T23:59:59`)
    return count || 0
  }

  if (challenge.type === 'consistency') {
    // "Día activo" = entrenó (workout_checkins) o registró actividad con
    // pasos (daily_activity) — lo primero que ocurra ese día ya cuenta.
    const [{ data: checkins }, { data: activity }] = await Promise.all([
      supabase.from('workout_checkins').select('checked_in_at')
        .eq('member_id', participant.member_id)
        .gte('checked_in_at', `${rangeStart}T00:00:00`)
        .lte('checked_in_at', `${rangeEnd}T23:59:59`),
      supabase.from('daily_activity').select('activity_date')
        .eq('member_id', participant.member_id)
        .gt('steps', 0)
        .gte('activity_date', rangeStart)
        .lte('activity_date', rangeEnd),
    ])
    const activeDays = new Set([
      ...(checkins || []).map(c => c.checked_in_at.slice(0, 10)),
      ...(activity || []).map(a => a.activity_date),
    ])
    return activeDays.size
  }

  if (challenge.type === 'weight') {
    // Peso de partida: el registro más cercano a la fecha en que se apuntó
    // (el primero desde entonces; si no hay ninguno posterior, el último
    // anterior). Sin ningún registro de peso todavía no hay base — se deja
    // en null y se reintenta en el próximo cron, no se fuerza a 0.
    // 'date' es de tipo DATE (sin hora) — dos pesajes el mismo día empatan
    // en ese orden y Postgres no garantiza cuál de los dos gana el LIMIT 1
    // sin desempate. created_at (timestamptz, con hora) desempata siempre
    // por cuál se registró antes/después de verdad.
    const { data: afterJoin } = await supabase
      .from('progress_records')
      .select('weight_kg, date')
      .eq('member_id', participant.member_id)
      .not('weight_kg', 'is', null)
      .gte('date', rangeStart)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let baseline = afterJoin?.weight_kg
    if (baseline == null) {
      const { data: beforeJoin } = await supabase
        .from('progress_records')
        .select('weight_kg, date')
        .eq('member_id', participant.member_id)
        .not('weight_kg', 'is', null)
        .lt('date', rangeStart)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      baseline = beforeJoin?.weight_kg
    }
    if (baseline == null) return null

    const { data: latest } = await supabase
      .from('progress_records')
      .select('weight_kg')
      .eq('member_id', participant.member_id)
      .not('weight_kg', 'is', null)
      .lte('date', rangeEnd)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.weight_kg == null) return null

    return Math.max(0, Number(baseline) - Number(latest.weight_kg))
  }

  return null
}
