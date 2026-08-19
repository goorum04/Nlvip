import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { refineRoutineDraft } from '@/lib/routineGeneration'

// refineRoutineDraft ahora también analiza por visión las fotos de progreso
// más recientes del socio — una llamada extra que no existía antes.
export const maxDuration = 60

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  routine: z.object({}).passthrough(),
  correction: z.string().min(1).max(1000),
  memberId: z.string().uuid().optional().nullable(),
})

// POST /api/refine-routine
// Aplica una corrección de texto/voz a la rutina generada en el generador
// standalone (components/AIRoutineGenerator.jsx). Usa la misma función que
// las herramientas de edición del chat del admin y checkin/refine-draft
// (lib/routineGeneration.js → refineRoutineDraft): Claude Sonnet 5, catálogo
// real de ejercicios (enforceCatalogNames), memoria del asistente, análisis
// visual de fotos de progreso y las mismas redes de seguridad que la
// generación normal. Antes esta ruta tenía su propia implementación
// duplicada en GPT-4o sin ninguna de esas protecciones — el mismo patrón que
// ya se corrigió para dietas en diet-onboarding/refine-draft.
export async function POST(req) {
  try {
    const identifier = getIdentifier(req)
    const limit = await checkRateLimit(identifier, 30, 60_000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })
    }

    // Auth: solo admin/trainer pueden refinar rutinas (consume Claude).
    const supabase = getSupabase()
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    if (!['admin', 'trainer'].includes(callerProfile?.role)) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { routine, correction, memberId } = parsed.data

    const { routine: updatedRoutine, changeSummary } = await refineRoutineDraft({
      supabase,
      member_id: memberId || null,
      currentRoutine: routine,
      correction,
    })

    return NextResponse.json({ success: true, updatedRoutine, changeSummary })
  } catch (error) {
    console.error('refine-routine error:', error)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
