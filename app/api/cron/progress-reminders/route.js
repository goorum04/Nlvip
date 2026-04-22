import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativeApplePush } from '@/lib/apn'
import { sendPushToUser } from '@/lib/webpush'

export const dynamic = 'force-dynamic'

// GET /api/cron/progress-reminders
//
// Runs once a day from Vercel Cron. For every member that has
// profiles.progress_reminder_days set, check when they last filed a
// COMPLETE progress check-in (full measurements + 3 photos of the same
// day). If it has been at least `progress_reminder_days` days since
// then — or they have never done one — send a push reminder.
//
// An internal 2-day anti-spam window prevents re-sending if the cron
// runs repeatedly without the member having done the review.
//
// Auth: header `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sets
// this automatically when deployed. Local/manual callers must set the
// same env var and pass it in the header.

export async function GET(request) {
  const auth = request.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const nowIso = new Date().toISOString()

  const { data: candidates, error: loadError } = await supabase
    .from('profiles')
    .select('id, name, progress_reminder_days, last_progress_reminder_at')
    .not('progress_reminder_days', 'is', null)

  if (loadError) {
    console.error('[cron/progress-reminders] could not load candidates:', loadError)
    return NextResponse.json({ error: loadError.message }, { status: 500 })
  }

  const results = { checked: candidates?.length || 0, sent: 0, skipped: 0, errors: [] }

  for (const profile of candidates || []) {
    try {
      const frequencyMs = profile.progress_reminder_days * 24 * 60 * 60 * 1000

      // Anti-spam: only re-nag after a full cadence has passed since the
      // previous reminder. Semanal => 7 días entre pings.
      if (profile.last_progress_reminder_at
          && Date.now() - new Date(profile.last_progress_reminder_at).getTime() < frequencyMs) {
        results.skipped++
        continue
      }

      const dueThreshold = new Date(Date.now() - frequencyMs).toISOString()

      // Latest COMPLETE progress record: weight and every measurement set.
      const { data: latestRecords } = await supabase
        .from('progress_records')
        .select('date, weight_kg, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, glutes_cm, calves_cm')
        .eq('member_id', profile.id)
        .order('date', { ascending: false })
        .limit(10)

      const isCompleteMeasurement = (r) => r
        && r.weight_kg != null
        && r.chest_cm != null
        && r.waist_cm != null
        && r.hips_cm != null
        && r.arms_cm != null
        && r.legs_cm != null
        && r.glutes_cm != null
        && r.calves_cm != null

      const latestCompleteMeasurement = (latestRecords || []).find(isCompleteMeasurement)

      // Also require 3 photos (front/side/back) from the same day as that measurement.
      let hasFullSession = false
      if (latestCompleteMeasurement) {
        const dayStart = new Date(latestCompleteMeasurement.date)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const { data: photosSameDay } = await supabase
          .from('progress_photos')
          .select('photo_type')
          .eq('member_id', profile.id)
          .gte('date', dayStart.toISOString())
          .lt('date', dayEnd.toISOString())

        const types = new Set((photosSameDay || []).map(p => p.photo_type))
        hasFullSession = ['front', 'side', 'back'].every(t => types.has(t))
          && latestCompleteMeasurement.date > dueThreshold
      }

      if (hasFullSession) {
        results.skipped++
        continue
      }

      const payload = {
        title: '📸 Toca hacer revisión',
        body: 'Sube tus 3 fotos y todas las medidas en la pestaña Progreso.',
        url: '/',
      }

      await sendNativeApplePush(supabase, profile.id, payload).catch(err =>
        console.warn('[cron/progress-reminders] APN error:', profile.id, err.message)
      )
      await sendPushToUser(supabase, profile.id, { ...payload, icon: '/icons/icon-192x192.png' }).catch(err =>
        console.warn('[cron/progress-reminders] WebPush error:', profile.id, err.message)
      )

      await supabase
        .from('profiles')
        .update({ last_progress_reminder_at: nowIso })
        .eq('id', profile.id)

      results.sent++
    } catch (err) {
      console.error('[cron/progress-reminders] member error:', profile.id, err)
      results.errors.push({ memberId: profile.id, error: err.message })
    }
  }

  return NextResponse.json(results)
}
