import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// user_badges nunca se escribía en ningún sitio — 7 insignias definidas con
// condiciones claras (badges.condition_type/condition_value) pero ninguna
// lógica que las comprobara ni las otorgara jamás. Mismo patrón exacto que
// el cron de progreso de retos: cron diario, service role, calcula y
// otorga lo que corresponda.
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

  const { data: badges, error: badgesError } = await supabase
    .from('badges')
    .select('id, condition_type, condition_value')

  if (badgesError) {
    console.error('[cron/award-badges] no se pudieron cargar las insignias:', badgesError)
    return NextResponse.json({ error: badgesError.message }, { status: 500 })
  }

  const { data: members, error: membersError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'member')

  if (membersError) {
    console.error('[cron/award-badges] no se pudieron cargar los socios:', membersError)
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  const results = { members: members?.length || 0, badges: badges?.length || 0, awarded: 0, errors: [] }

  for (const member of members || []) {
    try {
      const { data: already } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('member_id', member.id)
      const alreadyIds = new Set((already || []).map(b => b.badge_id))

      const pending = (badges || []).filter(b => !alreadyIds.has(b.id))
      if (pending.length === 0) continue

      // Una sola pasada de stats por socio, reutilizada para todas sus
      // insignias pendientes (evita repetir las mismas consultas 7 veces).
      const stats = await computeMemberStats(supabase, member.id, pending)

      for (const badge of pending) {
        if (meetsCondition(badge, stats)) {
          const { error: insertError } = await supabase
            .from('user_badges')
            .insert({ member_id: member.id, badge_id: badge.id, awarded_at: new Date().toISOString() })
          if (insertError) {
            // 23505 = unique_violation: otra ejecución concurrente ya la otorgó, no es un fallo real.
            if (insertError.code !== '23505') throw insertError
          } else {
            results.awarded++
          }
        }
      }
    } catch (err) {
      results.errors.push({ memberId: member.id, error: err.message })
    }
  }

  return NextResponse.json(results)
}

function meetsCondition(badge, stats) {
  switch (badge.condition_type) {
    case 'first_workout':
      return stats.totalWorkouts >= 1
    case 'workouts_count':
      return stats.totalWorkouts >= Number(badge.condition_value)
    case 'streak':
      return stats.longestStreak >= Number(badge.condition_value)
    case 'challenge_completed':
      return stats.challengesCompleted >= Number(badge.condition_value)
    default:
      return false
  }
}

async function computeMemberStats(supabase, memberId, pendingBadges) {
  const needsWorkouts = pendingBadges.some(b => ['first_workout', 'workouts_count'].includes(b.condition_type))
  const needsStreak = pendingBadges.some(b => b.condition_type === 'streak')
  const needsChallenges = pendingBadges.some(b => b.condition_type === 'challenge_completed')

  const stats = { totalWorkouts: 0, longestStreak: 0, challengesCompleted: 0 }

  if (needsWorkouts) {
    const { count } = await supabase
      .from('workout_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
    stats.totalWorkouts = count || 0
  }

  if (needsStreak) {
    const [{ data: checkins }, { data: activity }] = await Promise.all([
      supabase.from('workout_checkins').select('checked_in_at').eq('member_id', memberId),
      supabase.from('daily_activity').select('activity_date').eq('member_id', memberId).gt('steps', 0),
    ])
    const activeDays = new Set([
      ...(checkins || []).map(c => c.checked_in_at.slice(0, 10)),
      ...(activity || []).map(a => a.activity_date),
    ])
    stats.longestStreak = longestConsecutiveStreak(activeDays)
  }

  if (needsChallenges) {
    const { count } = await supabase
      .from('challenge_participants')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('completed', true)
    stats.challengesCompleted = count || 0
  }

  return stats
}

// Racha más larga JAMÁS conseguida (no solo la actual): una insignia, una
// vez ganada, no debería "perderse" porque el socio rompa la racha después.
function longestConsecutiveStreak(dateSet) {
  if (dateSet.size === 0) return 0
  const sorted = [...dateSet].sort()
  let longest = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00Z')
    const cur = new Date(sorted[i] + 'T00:00:00Z')
    const diffDays = Math.round((cur - prev) / (24 * 60 * 60 * 1000))
    current = diffDays === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
  }
  return longest
}
