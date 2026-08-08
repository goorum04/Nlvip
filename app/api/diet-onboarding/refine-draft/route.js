import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { refineDietDraft } from '@/lib/dietGeneration'

// refineDietDraft ahora también analiza por visión las fotos de progreso más
// recientes del socio — una llamada extra que no existía antes.
export const maxDuration = 60

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  originalDraft: z.string().min(1),
  correction: z.string().min(1).max(1000),
  macros: z.object({
    calories: z.number().optional(),
    protein_g: z.number().optional(),
    carbs_g: z.number().optional(),
    fat_g: z.number().optional()
  }).optional(),
  memberId: z.string().uuid().optional().nullable(),
})

// POST /api/diet-onboarding/refine-draft
// Ajusta el borrador de dieta del onboarding a partir de una corrección de
// texto libre del entrenador. Usa la misma función compartida que
// checkin/refine-draft (lib/dietGeneration.js → refineDietDraft): Claude
// Sonnet 5, red de seguridad de dirección ("seguir X" no intensifica), tope
// de ±15% en correcciones vagas sin cifra concreta, y datos físicos del
// socio (peso/altura/edad/%grasa/TDEE) para que no se le pidan al
// entrenador cuando ya están en la ficha. Antes esta ruta tenía su propia
// implementación duplicada en GPT-4o sin ninguna de esas protecciones.
export async function POST(req) {
  try {
    const supabase = getSupabase()
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr) {
      console.error('refine-draft auth error:', authErr.status, authErr.message)
      const status = authErr.status === 401 ? 401 : 503
      const msg = authErr.status === 401 ? 'Token inválido o expirado' : 'Error de autenticación, inténtalo de nuevo'
      return NextResponse.json({ error: msg }, { status })
    }
    if (!caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    if (!['admin', 'trainer'].includes(callerProfile?.role)) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const limit = await checkRateLimit(getIdentifier(req), 20, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Inténtalo de nuevo más tarde.` },
        { status: 429 }
      )
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { originalDraft, correction, macros, memberId } = parsed.data

    const { content, macros: updatedMacros, changeSummary, explanation } = await refineDietDraft({
      currentContent: originalDraft,
      currentMacros: macros || {},
      correction,
      supabase,
      memberId: memberId || null,
    })

    return NextResponse.json({
      success: true,
      updatedDietContent: content,
      explanation: explanation || changeSummary || 'Ajuste aplicado según las indicaciones.',
      changeSummary: changeSummary || explanation,
      macros: updatedMacros,
    })

  } catch (error) {
    console.error('diet-onboarding/refine-draft error:', error)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
