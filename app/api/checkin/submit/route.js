import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNativeApplePush } from '@/lib/apn'
import { sendPushToUser } from '@/lib/webpush'
import { adaptExistingDiet } from '@/lib/dietGeneration'
import { compareProgressPhotos } from '@/lib/photoAnalysis'
import { generateRoutineForMember, GOAL_FROM_ONBOARDING } from '@/lib/routineGeneration'

const schema = z.object({
  memberId: z.string().uuid(),
  groupId: z.string().uuid(),
  weight: z.number().positive(),
  measurements: z.object({
    neck: z.number().nullable().optional(),
    chest: z.number().nullable().optional(),
    waist: z.number().nullable().optional(),
    hips: z.number().nullable().optional(),
    arms: z.number().nullable().optional(),
    legs: z.number().nullable().optional(),
    glutes: z.number().nullable().optional(),
    calves: z.number().nullable().optional(),
  }).optional().default({}),
  feeling: z.object({
    dietAdherence: z.boolean().nullable().optional(),
    activityAdherence: z.boolean().nullable().optional(),
    mood: z.string().nullable().optional(),
    digestion: z.string().nullable().optional(),
    stressLevel: z.string().nullable().optional(),
    appetite: z.string().nullable().optional(),
    sleepQuality: z.string().nullable().optional(),
  }).optional().default({}),
  notes: z.string().max(2000).optional().default(''),
  photos: z.array(z.object({
    type: z.enum(['front', 'side', 'back']),
    path: z.string().min(1),
  })).length(3),
})

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function buildFeelingNotes(feeling, notes) {
  const parts = []
  if (feeling.dietAdherence !== null && feeling.dietAdherence !== undefined) {
    parts.push(`Seguimiento dieta: ${feeling.dietAdherence ? 'Sí' : 'No'}`)
  }
  if (feeling.activityAdherence !== null && feeling.activityAdherence !== undefined) {
    parts.push(`Seguimiento pasos/actividad: ${feeling.activityAdherence ? 'Sí' : 'No'}`)
  }
  if (feeling.mood) parts.push(`Estado anímico: ${feeling.mood}`)
  if (feeling.digestion) parts.push(`Digestiones: ${feeling.digestion}`)
  if (feeling.stressLevel) parts.push(`Estrés semanal: ${feeling.stressLevel}`)
  if (feeling.appetite) parts.push(`Apetito: ${feeling.appetite}`)
  if (feeling.sleepQuality) parts.push(`Calidad del sueño: ${feeling.sleepQuality}`)
  if (notes) parts.push(`Observaciones: ${notes}`)
  return parts.join(' | ')
}

export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { memberId, groupId, weight, measurements, feeling, notes, photos } = parsed.data

    if (user.id !== memberId) {
      return NextResponse.json({ error: 'Solo puedes enviar tu propia revisión' }, { status: 403 })
    }

    // 1. progress_records: peso + medidas + estado, mismo registro que alimenta
    // los gráficos de evolución del socio.
    const feelingNotes = buildFeelingNotes(feeling, notes)
    const { data: progressRecord, error: prError } = await supabase
      .from('progress_records')
      .insert({
        member_id: memberId,
        date: new Date().toISOString(),
        weight_kg: weight,
        neck_cm: measurements.neck ?? null,
        chest_cm: measurements.chest ?? null,
        waist_cm: measurements.waist ?? null,
        hips_cm: measurements.hips ?? null,
        arms_cm: measurements.arms ?? null,
        legs_cm: measurements.legs ?? null,
        glutes_cm: measurements.glutes ?? null,
        calves_cm: measurements.calves ?? null,
        diet_adherence: feeling.dietAdherence ?? null,
        activity_adherence: feeling.activityAdherence ?? null,
        mood: feeling.mood || null,
        digestion: feeling.digestion || null,
        stress_level: feeling.stressLevel || null,
        appetite: feeling.appetite || null,
        sleep_quality: feeling.sleepQuality || null,
        notes: notes || null,
      })
      .select()
      .single()
    if (prError) throw new Error(`Error guardando medidas: ${prError.message}`)

    // Mantiene sincronizado profiles.weight_kg (usado en cálculo de macros),
    // igual que hace MemberDashboard.handleAddProgress.
    await supabase.from('profiles').update({ weight_kg: weight }).eq('id', memberId)

    // 2. Buscar el group_id de la sesión de fotos anterior (si la hay) ANTES
    // de insertar la nueva, para no compararla consigo misma.
    const { data: previousPhotoRow } = await supabase
      .from('progress_photos')
      .select('group_id, date')
      .eq('member_id', memberId)
      .not('group_id', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    const previousGroupId = previousPhotoRow?.group_id || null

    // 3. progress_photos: las 3 fotos ya subidas al bucket por el cliente.
    const { error: photosError } = await supabase.from('progress_photos').insert(
      photos.map(p => ({
        member_id: memberId,
        photo_url: p.path,
        photo_type: p.type,
        group_id: groupId,
        date: new Date().toISOString(),
      }))
    )
    if (photosError) throw new Error(`Error guardando fotos: ${photosError.message}`)

    // 4. Dieta y rutina actualmente asignadas.
    const [{ data: currentDiet }, { data: currentWorkout }] = await Promise.all([
      supabase
        .from('member_diets')
        .select('diet_template_id, diet_templates(id, content, calories, protein_g, carbs_g, fat_g, goal_tag)')
        .eq('member_id', memberId)
        .maybeSingle(),
      supabase
        .from('member_workouts')
        .select('workout_template_id, workout_templates(id, name)')
        .eq('member_id', memberId)
        .maybeSingle(),
    ])

    // 5. Crear la fila de la revisión ya con lo que sabemos; el resto (fotos
    // comparadas + borradores) se rellena a continuación.
    const { data: checkin, error: checkinError } = await supabase
      .from('member_checkins')
      .insert({
        member_id: memberId,
        progress_record_id: progressRecord.id,
        photo_group_id: groupId,
        previous_photo_group_id: previousGroupId,
        status: 'analyzing',
        current_diet_id: currentDiet?.diet_templates?.id || null,
        current_workout_template_id: currentWorkout?.workout_templates?.id || null,
      })
      .select()
      .single()
    if (checkinError) throw new Error(`Error creando la revisión: ${checkinError.message}`)

    // 6. Análisis de fotos + adaptación de dieta y rutina. Si algo falla aquí,
    // se marca la revisión como 'failed' con el motivo, pero YA quedan
    // guardadas las medidas/fotos del socio (nada se pierde).
    try {
      const newSignedUrls = await supabase.storage
        .from('progress_photos')
        .createSignedUrls(photos.map(p => p.path), 600)
      const newPhotosForAI = (newSignedUrls.data || [])
        .map((s, i) => ({ type: photos[i].type, url: s?.signedUrl }))
        .filter(p => p.url)

      let previousPhotosForAI = []
      if (previousGroupId) {
        const { data: prevPhotoRows } = await supabase
          .from('progress_photos')
          .select('photo_url, photo_type')
          .eq('group_id', previousGroupId)
        if (Array.isArray(prevPhotoRows) && prevPhotoRows.length > 0) {
          const prevSigned = await supabase.storage
            .from('progress_photos')
            .createSignedUrls(prevPhotoRows.map(p => p.photo_url), 600)
          previousPhotosForAI = (prevSigned.data || [])
            .map((s, i) => ({ type: prevPhotoRows[i].photo_type, url: s?.signedUrl }))
            .filter(p => p.url)
        }
      }

      const photoAnalysis = await compareProgressPhotos({
        newPhotos: newPhotosForAI,
        previousPhotos: previousPhotosForAI,
      })

      const checkinNotes = feelingNotes || 'sin notas adicionales'

      // Dieta y rutina se adaptan en paralelo — son independientes.
      const dietPromise = currentDiet?.diet_templates
        ? adaptExistingDiet({
            supabase,
            memberId,
            currentDietContent: currentDiet.diet_templates.content,
            currentMacros: {
              calories: currentDiet.diet_templates.calories,
              protein_g: currentDiet.diet_templates.protein_g,
              carbs_g: currentDiet.diet_templates.carbs_g,
              fat_g: currentDiet.diet_templates.fat_g,
            },
            goalTag: currentDiet.diet_templates.goal_tag || '',
            checkinNotes,
            photoAnalysis: photoAnalysis || '',
          })
        : Promise.resolve(null)

      const routinePromise = currentWorkout?.workout_templates
        ? (async () => {
            const { data: days } = await supabase
              .from('workout_days')
              .select('id')
              .eq('workout_template_id', currentWorkout.workout_templates.id)
            const { data: memberProfile } = await supabase
              .from('profiles')
              .select('goal')
              .eq('id', memberId)
              .maybeSingle()
            const routineGoal = GOAL_FROM_ONBOARDING[memberProfile?.goal] || 'hipertrofia'
            const routineNotes = `Revisión periódica del socio. ${checkinNotes}.${photoAnalysis ? ` Análisis visual de fotos: ${photoAnalysis}` : ''} Ajusta variedad de ejercicios y/o intensidad en consecuencia (sube si hay buena adherencia y evolución, baja/simplifica si hay fatiga, mala adherencia o molestias).`
            return generateRoutineForMember({
              supabase,
              member_id: memberId,
              criteria: {
                days_per_week: Math.max(1, days?.length || 4),
                goal: routineGoal,
                level: 'intermedio',
                session_duration_min: 60,
                notes: routineNotes,
                allow_supersets: true,
                equipment: [],
              },
            })
          })()
        : Promise.resolve(null)

      const [dietResult, routineResult] = await Promise.all([dietPromise, routinePromise])

      const updatePayload = { status: 'draft_ready', photo_analysis: photoAnalysis || null }
      if (dietResult) {
        updatePayload.draft_diet_content = dietResult.adaptedContent
        updatePayload.draft_calories = dietResult.macros?.calories || null
        updatePayload.draft_protein_g = dietResult.macros?.protein_g || null
        updatePayload.draft_carbs_g = dietResult.macros?.carbs_g || null
        updatePayload.draft_fat_g = dietResult.macros?.fat_g || null
        updatePayload.diet_change_summary = dietResult.changeSummary || null
      }
      if (routineResult) {
        updatePayload.draft_routine_data = routineResult.routine
        updatePayload.routine_change_summary = routineResult.rationale || null
      }

      await supabase.from('member_checkins').update(updatePayload).eq('id', checkin.id)
    } catch (analysisErr) {
      console.error('checkin/submit analysis error:', analysisErr)
      await supabase.from('member_checkins').update({
        status: 'failed',
        error_message: analysisErr.message,
      }).eq('id', checkin.id)
    }

    // 7. Notificar a admin + entrenador asignado.
    try {
      const { data: memberProfile } = await supabase
        .from('profiles').select('name, email').eq('id', memberId).single()
      const memberName = memberProfile?.name || memberProfile?.email?.split('@')[0] || 'Un socio'

      const { data: adminProfile } = await supabase
        .from('profiles').select('id').eq('role', 'admin').limit(1).single()

      const { data: trainerLink } = await supabase
        .from('trainer_members').select('trainer_id').eq('member_id', memberId).maybeSingle()
      const trainerId = trainerLink?.trainer_id || null

      const payload = {
        title: '📈 Nueva revisión recibida',
        body: `${memberName} ha enviado su revisión periódica. Revisa la propuesta de dieta y rutina.`,
        url: '/checkins',
      }

      const notifRows = []
      if (adminProfile?.id) {
        await sendNativeApplePush(supabase, adminProfile.id, payload)
        await sendPushToUser(supabase, adminProfile.id, { ...payload, icon: '/icons/icon-192x192.png' })
        notifRows.push({ user_id: adminProfile.id, title: payload.title, body: payload.body, type: 'checkin_submitted', reference_id: checkin.id, url: payload.url })
      }
      if (trainerId && trainerId !== adminProfile?.id) {
        await sendNativeApplePush(supabase, trainerId, payload)
        await sendPushToUser(supabase, trainerId, { ...payload, icon: '/icons/icon-192x192.png' })
        notifRows.push({ user_id: trainerId, title: payload.title, body: payload.body, type: 'checkin_submitted', reference_id: checkin.id, url: payload.url })
      }
      if (notifRows.length > 0) {
        await supabase.from('notifications').insert(notifRows)
      }
    } catch (notifErr) {
      console.warn('[Push] Error notificando revisión:', notifErr.message)
    }

    return NextResponse.json({
      success: true,
      checkinId: checkin.id,
      message: 'Tu revisión ha sido enviada. Te avisaremos cuando tu entrenador la haya revisado.',
    })
  } catch (error) {
    console.error('checkin/submit error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
