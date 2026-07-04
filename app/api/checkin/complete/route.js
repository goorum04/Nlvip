import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendPushToUser } from '@/lib/webpush'
import { persistRoutine } from '@/lib/routinePersistence'

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

      await supabase.from('macro_goals').upsert({
        member_id: checkin.member_id,
        calories: template.calories,
        protein_g: template.protein_g,
        carbs_g: template.carbs_g,
        fat_g: template.fat_g,
        assigned_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' })

      updatePayload.new_diet_id = template.id
      appliedParts.push('dieta')

      try {
        await fetch(new URL('/api/generate-recipe-plan', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          assigned_at: new Date().toISOString(),
        }, { onConflict: 'member_id' })
      if (wError) throw new Error(`Error asignando la rutina adaptada: ${wError.message}`)

      updatePayload.new_workout_template_id = template.id
      appliedParts.push('rutina')
    }

    const { error: updateError } = await supabase.from('member_checkins').update(updatePayload).eq('id', checkinId)
    if (updateError) throw new Error(`Error actualizando la revisión: ${updateError.message}`)

    try {
      const label = appliedParts.length === 2 ? 'plan (dieta y rutina)' : appliedParts[0]
      await sendPushToUser(supabase, checkin.member_id, {
        title: '¡Tu plan se ha actualizado!',
        body: `Tras tu última revisión, hemos actualizado tu ${label}. ¡Échale un vistazo!`,
        url: appliedParts.includes('dieta') ? '/nutrition' : '/workout',
        icon: '/icons/icon-192x192.png',
      })
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
