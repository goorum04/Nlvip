import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { refineRoutineDraft } from '@/lib/routineGeneration'
import { refineDietDraft } from '@/lib/dietGeneration'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  checkinId: z.string().uuid(),
  target: z.enum(['diet', 'routine']),
  correction: z.string().min(1).max(1000),
})

// POST /api/checkin/refine-draft
// Ajusta el borrador de dieta O de rutina de una revisión ya generada, sin
// regenerar el otro borrador. Mismo patrón que diet-onboarding/refine-draft.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (!['admin', 'trainer'].includes(callerProfile?.role)) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const limit = await checkRateLimit(getIdentifier(req), 20, 60_000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { checkinId, target, correction } = parsed.data

    const { data: checkin, error: fetchError } = await supabase
      .from('member_checkins')
      .select('*')
      .eq('id', checkinId)
      .single()
    if (fetchError || !checkin) return NextResponse.json({ error: 'Revisión no encontrada' }, { status: 404 })
    if (checkin.status !== 'draft_ready') {
      return NextResponse.json({ error: 'Esta revisión no tiene un borrador listo para ajustar' }, { status: 400 })
    }

    if (target === 'diet') {
      if (!checkin.draft_diet_content) {
        return NextResponse.json({ error: 'Esta revisión no tiene borrador de dieta' }, { status: 400 })
      }
      const { content, macros, changeSummary } = await refineDietDraft({
        currentContent: checkin.draft_diet_content,
        currentMacros: {
          calories: checkin.draft_calories,
          protein_g: checkin.draft_protein_g,
          carbs_g: checkin.draft_carbs_g,
          fat_g: checkin.draft_fat_g,
        },
        correction,
      })

      await supabase.from('member_checkins').update({
        draft_diet_content: content,
        draft_calories: macros.calories,
        draft_protein_g: macros.protein_g,
        draft_carbs_g: macros.carbs_g,
        draft_fat_g: macros.fat_g,
        diet_change_summary: changeSummary || checkin.diet_change_summary,
      }).eq('id', checkinId)
      return NextResponse.json({ success: true, target: 'diet', draftDietContent: content, macros, changeSummary })
    }

    // target === 'routine'
    if (!checkin.draft_routine_data) {
      return NextResponse.json({ error: 'Esta revisión no tiene borrador de rutina' }, { status: 400 })
    }
    const { routine: updatedRoutine, changeSummary } = await refineRoutineDraft({
      supabase,
      member_id: checkin.member_id,
      currentRoutine: checkin.draft_routine_data,
      correction,
    })
    await supabase.from('member_checkins').update({
      draft_routine_data: updatedRoutine,
      routine_change_summary: changeSummary || checkin.routine_change_summary,
    }).eq('id', checkinId)
    return NextResponse.json({ success: true, target: 'routine', draftRoutineData: updatedRoutine, changeSummary })
  } catch (error) {
    console.error('checkin/refine-draft error:', error)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
