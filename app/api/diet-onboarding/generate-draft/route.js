import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { waitUntil } from '@vercel/functions'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { generateNLEliteDiet } from '@/lib/dietGeneration'

// Puede tardar bastante (llamada a Claude generando un menú completo). En
// modo background (waitUntil) el trabajo real sigue después de responder,
// así que necesita el mismo margen o más que en modo síncrono.
export const maxDuration = 60

const schema = z.object({
  requestId: z.string().uuid(),
  memberId: z.string().uuid(),
  responses: z.record(z.string(), z.unknown()).nullable().optional(),
  background: z.boolean().optional(),
})

// Traduce el error técnico de rechazo del modelo (visto en producción: el
// modelo se niega 3 veces seguidas ante cierto perfil, algo raro pero
// posible con datos médicos/edad sensibles) a algo que un entrenador
// entienda, en vez del mensaje crudo con la respuesta del modelo en inglés.
function friendlyDraftError(error) {
  const raw = error?.message || ''
  if (/rechazó generar la dieta/i.test(raw)) {
    return 'La IA no pudo generar la dieta para este perfil (puede pasar con ciertos datos médicos o de edad). Inténtalo de nuevo — si vuelve a fallar, avisa al desarrollador.'
  }
  return raw || 'Error generando el borrador'
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/diet-onboarding/generate-draft
// Llama a Claude y genera el borrador de la dieta, pero no lo guarda en BBDD.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    // Auth: solo admin/trainer pueden generar borradores de dieta (consume Claude
    // y accede al perfil del socio). Mismo patrón que /api/generate-routine.
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr) {
      console.error('generate-draft auth error:', authErr.status, authErr.message)
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
    const { memberId, responses: rawResponses, background = false } = parsed.data
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

    // Registrar el job (para trazabilidad / consulta) y procesar.
    //
    // IMPORTANTE — compatibilidad con la app YA instalada: ese JS quedó
    // fijado en la última build de Xcode y espera recibir el resultado
    // directamente en la respuesta del POST, tal como funcionaba antes — no
    // sabe preguntar por un jobId. Por eso el modo asíncrono de verdad SOLO
    // se activa si el cliente manda `background: true` en el body, cosa que
    // la app antigua nunca hace. Sin ese flag, esta ruta se comporta
    // exactamente igual que siempre (síncrona, resultado completo en la
    // misma respuesta) — cero riesgo para dispositivos sin la próxima build.
    const { data: job } = await supabase
      .from('assistant_jobs')
      .insert({ created_by: caller.id, status: 'processing', request: { type: 'diet_onboarding_generate_draft', memberId } })
      .select('id')
      .single()

    const runAndFinish = async () => {
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

      const payload = {
        success: true,
        message: 'Borrador generado con éxito.',
        macros: result.macros,
        fullDietContent: result.fullDietContent,
        rationale: result.rationale,
      }

      if (job?.id) {
        await supabase
          .from('assistant_jobs')
          .update({ status: 'done', result: payload, updated_at: new Date().toISOString() })
          .eq('id', job.id)
      }
      return payload
    }

    if (background && job?.id) {
      // Responde YA con el jobId; waitUntil mantiene la función viva después
      // de responder para terminar el trabajo real (puede tardar bastante) —
      // así minimizar o cerrar la app no corta la generación, y el cliente
      // la recoge sondeando GET ?jobId=... (o solo, al volver, gracias al id
      // guardado en localStorage).
      waitUntil(
        runAndFinish().catch(async (error) => {
          console.error('diet-onboarding/generate-draft background error:', error)
          await supabase
            .from('assistant_jobs')
            .update({ status: 'error', error: friendlyDraftError(error), updated_at: new Date().toISOString() })
            .eq('id', job.id)
        })
      )
      return NextResponse.json({ jobId: job.id })
    }

    // Modo síncrono (comportamiento de siempre): se espera aquí mismo.
    const result = await runAndFinish()
    return NextResponse.json(result)

  } catch (error) {
    console.error('diet-onboarding/generate-draft error:', error)
    return NextResponse.json({ error: friendlyDraftError(error) }, { status: 500 })
  }
}

// GET /api/diet-onboarding/generate-draft?jobId=... — consulta el estado de
// un job en curso. El cliente lo sondea cada pocos segundos (y al volver del
// segundo plano) hasta que status pase a 'done' o 'error'.
export async function GET(request) {
  const supabase = getSupabase()
  try {
    const jobId = new URL(request.url).searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId requerido' }, { status: 400 })

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: job, error } = await supabase
      .from('assistant_jobs')
      .select('id, status, result, error, created_by')
      .eq('id', jobId)
      .maybeSingle()

    if (error || !job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    if (job.created_by !== user.id) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

    return NextResponse.json({ status: job.status, result: job.result, error: job.error })
  } catch (error) {
    console.error('diet-onboarding/generate-draft job-status error:', error)
    return NextResponse.json({ error: error.message || 'Error consultando el job' }, { status: 500 })
  }
}
