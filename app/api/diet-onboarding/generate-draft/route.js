import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { generateNLEliteDiet } from '@/lib/dietGeneration'

const schema = z.object({
  requestId: z.string().uuid(),
  memberId: z.string().uuid(),
  responses: z.record(z.string(), z.unknown()).nullable().optional()
})

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// POST /api/diet-onboarding/generate-draft
// Llama a OpenAI y genera el borrador de la dieta, pero no lo guarda en BBDD.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    // Auth: solo admin/trainer pueden generar borradores de dieta (consume OpenAI
    // y accede al perfil del socio). Mismo patrón que /api/generate-routine.
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

    // Rate limiting: límite por usuario autenticado (staff verificado arriba)
    const identifier = getIdentifier(req)
    const baseLimit = 200
    const limit = await checkRateLimit(identifier, baseLimit, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Como medida de seguridad, hay un límite de ${baseLimit} peticiones por minuto.` },
        { status: 429 }
      )
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { memberId, responses: rawResponses } = parsed.data
    const responses = rawResponses || {}

    // Extraer valores del cuestionario de onboarding para pasarlos como overrides
    const weightFromForm = parseFloat(responses['Medida - Peso']) || undefined
    const heightFromForm = parseFloat(responses['Medida - Altura']) || undefined
    const waist = parseFloat(responses['Medida - Cintura']) || null
    const goal = responses.objetivo || undefined
    const intensidadTrabajo = responses['Trabajo - Intensidad'] || responses.intensidad_trabajo || ''
    const numMeals = parseInt(responses.num_comidas || responses['Comidas - Número']) || 5
    const formRestrictions = responses.restricciones || ''
    const preferences = responses.preferencias || ''
    const dislikes = responses.no_me_gusta || ''
    const favorites = responses.favoritos || ''
    const trainTime = responses.horario_entreno || responses['Entreno - Momento'] || 'tarde'
    const trainSchedule = responses['Entreno - Horario Detalle'] || ''
    const workSchedule = responses['Trabajo - Horario'] || ''
    const mealSchedule = responses['Comidas - Horario'] || ''
    const formMedical = responses.condicion_medica || ''

    const result = await generateNLEliteDiet({
      supabase,
      memberId,
      weight: weightFromForm,
      height: heightFromForm,
      waist,
      goal,
      numMeals,
      restrictions: formRestrictions,
      preferences,
      dislikes,
      favorites,
      intensidadTrabajo,
      trainTime,
      trainSchedule,
      workSchedule,
      mealSchedule,
      medConditions: formMedical,
    })

    return NextResponse.json({
      success: true,
      message: 'Borrador generado con éxito.',
      macros: result.macros,
      fullDietContent: result.fullDietContent,
      rationale: result.rationale,
    })

  } catch (error) {
    console.error('diet-onboarding/generate-draft error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
