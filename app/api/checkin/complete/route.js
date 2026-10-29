import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'
import { persistRoutine } from '@/lib/routinePersistence'
import { generateTrainerMessage, resolveTrainerName } from '@/lib/trainerVoice'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  checkinId: z.string().uuid(),
  approveDiet: z.boolean().optional().default(false),
  approveRoutine: z.boolean().optional().default(false),
})

// POST /api/checkin/complete
// Aprueba la dieta y/o la rutina propuestas en una revisión. No es todo-o-nada:
// el admin puede aprobar solo una de las dos.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!callerProfile || !['admin', 'trainer'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { checkinId, approveDiet, approveRoutine } = parsed.data
    if (!approveDiet && !approveRoutine) {
      return NextResponse.json({ error: 'Debes aprobar al menos la dieta o la rutina' }, { status: 400 })
    }

    const { data: checkin, error: fetchError } = await supabase
      .from('member_checkins').select('*').eq('id', checkinId).single()
    if (fetchError || !checkin) return NextResponse.json({ error: 'Revisión no encontrada' }, { status: 404 })
    if (!['draft_ready', 'approved'].includes(checkin.status)) {
      return NextResponse.json({ error: 'Esta revisión no está lista para aprobar' }, { status: 400 })
    }

    const { data: memberProfile } = await supabase
      .from('profiles').select('name, email').eq('id', checkin.member_id).single()
    const rawName = (memberProfile?.name && memberProfile.name.trim() !== '')
      ? memberProfile.name.trim()
      : (memberProfile?.email ? memberProfile.email.split('@')[0] : 'Socio')
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()

    const updatePayload = { status: 'approved', reviewed_by: user.id, completed_at: new Date().toISOString() }
    const appliedParts = []

    if (approveDiet) {
      if (!checkin.draft_diet_content) {
        return NextResponse.json({ error: 'Esta revisión no tiene borrador de dieta que aprobar' }, { status: 400 })
      }
      const { data: template, error: tError } = await supabase
        .from('diet_templates')
        .insert({
          trainer_id: user.id,
          name: `Dieta adaptada (revisión) — ${name}`,
          content: checkin.draft_diet_content,
          calories: checkin.draft_calories,
          protein_g: checkin.draft_protein_g,
          carbs_g: checkin.draft_carbs_g,
          fat_g: checkin.draft_fat_g,
        })
        .select()
        .single()
      if (tError) throw new Error(`Error creando la dieta adaptada: ${tError.message}`)

      const { error: aError } = await supabase
        .from('member_diets')
        .upsert({
          member_id: checkin.member_id,
          diet_template_id: template.id,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
        }, { onConflict: 'member_id' })
      if (aError) throw new Error(`Error asignando la dieta adaptada: ${aError.message}`)

      const { error: mError } = await supabase.from('macro_goals').upsert({
        member_id: checkin.member_id,
        calories: template.calories,
        protein_g: template.protein_g,
        carbs_g: template.carbs_g,
        fat_g: template.fat_g,
        assigned_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' })
      if (mError) console.warn('checkin/complete: no se pudieron actualizar macro_goals:', mError.message)

      updatePayload.new_diet_id = template.id
      appliedParts.push('dieta')

      try {
        await fetch(new URL('/api/generate-recipe-plan', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ memberId: checkin.member_id, dietId: template.id, trainerId: user.id }),
        })
      } catch (e) {
        console.warn('checkin/complete: could not generate recipe plan:', e.message)
      }
    }

    if (approveRoutine) {
      if (!checkin.draft_routine_data) {
        return NextResponse.json({ error: 'Esta revisión no tiene borrador de rutina que aprobar' }, { status: 400 })
      }
      const routineData = { ...checkin.draft_routine_data }
      if (!routineData.routine_name) routineData.routine_name = `Rutina adaptada (revisión) — ${name}`

      const template = await persistRoutine(supabase, { trainerId: user.id, routine: routineData })

      const { error: wError } = await supabase
        .from('member_workouts')
        .upsert({
          member_id: checkin.member_id,
          workout_template_id: template.id,
          routine_slot: 'principal',
          assigned_at: new Date().toISOString(),
        }, { onConflict: 'member_id,routine_slot' })
      if (wError) throw new Error(`Error asignando la rutina adaptada: ${wError.message}`)

      updatePayload.new_workout_template_id = template.id
      appliedParts.push('rutina')
    }

    const { error: updateError } = await supabase.from('member_checkins').update(updatePayload).eq('id', checkinId)
    if (updateError) throw new Error(`Error actualizando la revisión: ${updateError.message}`)

    // Aviso al socio con un mensaje personal en la voz del entrenador (varía
    // en cada aprobación y respeta el género). Se guarda en `notifications`
    // (type trainer_message) para que el socio lo vea también dentro de la app.
    try {
      const [{ data: memberFull }, { data: records }, { data: notes }, trainerName] = await Promise.all([
        supabase.from('profiles').select('sex, name, email').eq('id', checkin.member_id).maybeSingle(),
        supabase.from('progress_records').select('date, weight_kg').eq('member_id', checkin.member_id).not('weight_kg', 'is', null).order('date', { ascending: false }).limit(2),
        supabase.from('member_notes').select('note').eq('member_id', checkin.member_id).order('created_at', { ascending: false }).limit(4),
        resolveTrainerName(supabase, checkin.member_id, user.id),
      ])

      let weightDelta = null
      let weightDeltaWeeks = null
      if (records?.length === 2 && records[0].weight_kg != null && records[1].weight_kg != null) {
        weightDelta = Number(records[0].weight_kg) - Number(records[1].weight_kg)
        weightDeltaWeeks = Math.max(1, Math.round((new Date(records[0].date) - new Date(records[1].date)) / (7 * 24 * 3600 * 1000)))
      }

      const message = await generateTrainerMessage({
        supabase,
        kind: 'approval',
        member: { id: checkin.member_id, name: memberFull?.name || name, email: memberFull?.email, sex: memberFull?.sex },
        trainerName,
        context: {
          dietChanged: appliedParts.includes('dieta'),
          routineChanged: appliedParts.includes('rutina'),
          dietSummary: checkin.diet_change_summary || '',
          routineSummary: checkin.routine_change_summary || '',
          weightDelta,
          weightDeltaWeeks,
          memberNotes: (notes || []).map(n => n.note),
        },
      })

      const payload = {
        title: `💬 ${trainerName} te ha dejado un mensaje`,
        body: message,
        url: appliedParts.includes('dieta') ? '/nutrition' : '/workout',
        icon: '/icons/icon-192x192.png',
      }
      await supabase.from('notifications').insert({
        user_id: checkin.member_id,
        title: `Mensaje de ${trainerName}`,
        body: message,
        type: 'trainer_message',
        reference_id: checkinId,
        url: payload.url,
      })
      await sendNativePush(supabase, checkin.member_id, payload)
      await sendPushToUser(supabase, checkin.member_id, payload)
    } catch (e) {
      console.warn('checkin/complete: could not notify member:', e.message)
    }

    return NextResponse.json({
      success: true,
      message: `✅ Revisión aprobada: ${appliedParts.join(' y ')} actualizada(s) para ${name}.`,
      newDietId: updatePayload.new_diet_id || null,
      newWorkoutTemplateId: updatePayload.new_workout_template_id || null,
    })
  } catch (error) {
    console.error('checkin/complete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
