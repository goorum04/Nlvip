import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

const criteriaSchema = z.object({
  days_per_week: z.number().int().min(1).max(7),
  goal: z.string().min(1),
  level: z.enum(['principiante', 'intermedio', 'avanzado']),
  equipment: z.array(z.string()).optional(),
  session_duration_min: z.number().int().min(15).max(180).optional(),
  notes: z.string().max(500).optional(),
  allow_supersets: z.boolean().optional()
})

const bodySchema = z.object({
  trainer_id: z.string().uuid().optional().nullable(),
  member_id: z.string().uuid().optional().nullable(),
  criteria: criteriaSchema
})

const SYSTEM_PROMPT = `Eres un entrenador personal experto en diseño de rutinas de hipertrofia y fuerza.
Tu tarea es generar una rutina de entrenamiento estructurada en formato JSON.

REGLAS:
1. Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.
2. Usa exclusivamente nombres LITERALES del catálogo de ejercicios proporcionado. No inventes variantes ni sustituyas con ejercicios que no aparezcan en el catálogo.
3. El nombre del ejercicio debe coincidir EXACTAMENTE con el del catálogo (mayúsculas, tildes y espacios incluidos).
4. Distribuye los grupos musculares inteligentemente para evitar sobreentrenar músculos sinérgicos en días consecutivos.
5. Los ejercicios de PECHO solo se incluirán si el catálogo proporcionado contiene ejercicios de pecho. NUNCA asignes pecho si no aparece en el catálogo (las rutinas de mujeres no llevan pecho).
6. Incluye entre 5 y 8 ejercicios por día según la duración indicada.
7. Los valores de "reps" pueden ser: "10", "8-12", "15-20", "al fallo", "30s".
8. Adapta la rutina a las condiciones médicas o lesiones indicadas. Evita ejercicios que las puedan agravar (p. ej., si hay problemas de rodilla evita Sentadilla en multipower, Zancadas y Sentadilla búlgara; si hay problemas lumbares evita Peso muerto rumano y Buenos días en polea baja; si hay problemas de hombro evita Press de hombros y elevaciones frontales pesadas). Sustitúyelos por alternativas equivalentes del catálogo.
9. Si el socio quiere perder grasa o se trabaja resistencia, o si la duración es corta, o si el campo "permitir_supersets" es true, agrupa 2 o 3 ejercicios consecutivos como bi-serie o tri-serie. Para indicarlo añade un campo numérico "superset_group" (entero) en cada ejercicio: ejercicios con el mismo número pertenecen al mismo grupo. Usa 0 o null en ejercicios individuales. El descanso "rest_seconds" dentro del grupo será 0–15s; el descanso normal solo va en el último ejercicio del grupo.

FORMATO JSON DE RESPUESTA:
{
  "routine_name": "string",
  "routine_description": "string",
  "days": [
    {
      "day_number": 1,
      "day_name": "string (ej: Espalda y Bíceps)",
      "exercises": [
        {
          "exercise_name": "string (nombre exacto del catálogo)",
          "sets": 4,
          "reps": "10-12",
          "rest_seconds": 90,
          "superset_group": 0,
          "notes": "string o null"
        }
      ]
    }
  ]
}`

const GOAL_FROM_ONBOARDING = {
  perder_grasa: 'definición',
  mantenimiento: 'hipertrofia',
  ganar_masa: 'hipertrofia'
}

const normalize = (s) => (s || '').toString().trim().toLowerCase()

const STOPWORDS = new Set(['en', 'de', 'con', 'la', 'el', 'los', 'las', 'al', 'por', 'para', 'una', 'un', 'y', 'o', 'sobre'])

function tokens(name) {
  return normalize(name)
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t))
}

function bestCatalogMatch(proposedName, catalog, allowedMuscle = null) {
  const propTokens = tokens(proposedName)
  if (propTokens.length === 0) return null
  let best = null
  let bestScore = 0
  for (const ex of catalog) {
    if (allowedMuscle && ex.muscle_primary !== allowedMuscle) continue
    const exTokens = tokens(ex.name)
    const overlap = propTokens.filter(t => exTokens.includes(t)).length
    const score = overlap / Math.max(propTokens.length, exTokens.length)
    if (score > bestScore) {
      bestScore = score
      best = ex
    }
  }
  return bestScore >= 0.4 ? best : null
}

const MUSCLES = ['espalda', 'pecho', 'hombros', 'bíceps', 'biceps', 'tríceps', 'triceps', 'cuádriceps', 'cuadriceps', 'femoral', 'glúteo', 'gluteo', 'gemelos', 'abdomen', 'lumbares']

function muscleFromDayName(dayName) {
  const n = normalize(dayName)
  for (const m of MUSCLES) {
    if (n.includes(m)) {
      return m.replace('biceps', 'bíceps').replace('triceps', 'tríceps').replace('cuadriceps', 'cuádriceps').replace('gluteo', 'glúteo')
    }
  }
  return null
}

export async function POST(request) {
  try {
    const limit = await checkRateLimit(getIdentifier(request), 10, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Inténtalo de nuevo más tarde.` },
        { status: 429 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { trainer_id, member_id, criteria } = parsed.data
    const { days_per_week, goal, level, equipment = [], session_duration_min = 60, notes = '', allow_supersets = true } = criteria

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    const callerRole = callerProfile?.role
    if (callerRole !== 'admin' && callerRole !== 'trainer') {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    if (trainer_id && callerRole !== 'admin' && trainer_id !== caller.id) {
      return NextResponse.json({ error: 'No puedes asignar rutinas a otro entrenador' }, { status: 403 })
    }

    let memberSex = null
    let memberGoal = null
    let memberConditions = null
    let memberDislikes = null
    let memberRestrictions = null

    if (member_id) {
      const { data: memberProfile } = await supabase
        .from('profiles')
        .select('sex')
        .eq('id', member_id)
        .maybeSingle()
      memberSex = memberProfile?.sex || null

      const { data: lastOnboarding } = await supabase
        .from('diet_onboarding_requests')
        .select('responses')
        .eq('member_id', member_id)
        .in('status', ['completed', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const responses = lastOnboarding?.responses || null
      if (responses) {
        memberGoal = responses.objetivo || null
        memberConditions = responses?.extras?.condicion_medica || null
        memberDislikes = responses?.extras?.no_me_gusta || null
        memberRestrictions = Array.isArray(responses.restricciones)
          ? responses.restricciones.join(', ')
          : (responses.restricciones || null)
      }
    }

    const allowChest = memberSex === 'male'

    const { data: catalog, error: catalogError } = await supabase
      .from('exercises')
      .select('id, name, muscle_primary, equipment, difficulty, default_sets, default_reps, default_rest_seconds, only_male')
      .eq('is_global', true)
      .order('muscle_primary')
      .order('name')

    if (catalogError || !catalog?.length) {
      return NextResponse.json({
        error: 'No se pudo cargar el catálogo de ejercicios. Asegúrate de haber ejecutado el seed.'
      }, { status: 500 })
    }

    const filteredCatalog = catalog.filter(e => allowChest ? true : !e.only_male)

    const catalogLines = filteredCatalog
      .map(e => `- ${e.name} (músculo: ${e.muscle_primary}, equipo: ${e.equipment}, dificultad: ${e.difficulty}, series: ${e.default_sets}, reps: ${e.default_reps})`)
      .join('\n')

    const memberContextLines = member_id ? [
      `Sexo del socio: ${memberSex || 'no especificado'}`,
      `Objetivo del socio (onboarding): ${memberGoal ? (GOAL_FROM_ONBOARDING[memberGoal] || memberGoal) : 'no especificado'}`,
      `Condiciones médicas / lesiones: ${memberConditions || 'ninguna indicada'}`,
      `Cosas que no le gustan: ${memberDislikes || 'ninguna indicada'}`,
      `Restricciones / alergias: ${memberRestrictions || 'ninguna indicada'}`
    ].join('\n') : 'Rutina genérica (sin socio asociado).'

    const userMessage = `Genera una rutina de entrenamiento con los siguientes criterios:
- Días por semana: ${days_per_week}
- Objetivo: ${goal}
- Nivel: ${level}
- Equipamiento disponible: ${equipment.length > 0 ? equipment.join(', ') : 'todo el equipamiento del catálogo'}
- Duración aproximada por sesión: ${session_duration_min} minutos
- Notas adicionales: ${notes || 'ninguna'}
- Permitir bi-series / tri-series: ${allow_supersets ? 'sí' : 'no'}

CONTEXTO DEL SOCIO:
${memberContextLines}

CATÁLOGO DE EJERCICIOS DISPONIBLES (los ÚNICOS que puedes usar):
${catalogLines}

Genera exactamente ${days_per_week} días. Responde solo con el JSON.`

    const openai = new OpenAI({ apiKey })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000
    })

    const content = response.choices[0]?.message?.content || ''
    let routineJson
    try {
      routineJson = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'No se pudo generar la rutina. Inténtalo de nuevo.' }, { status: 400 })
    }

    if (!routineJson.days || !Array.isArray(routineJson.days)) {
      return NextResponse.json({ error: 'Formato de rutina incorrecto. Inténtalo de nuevo.' }, { status: 400 })
    }

    const catalogByName = new Map(filteredCatalog.map(e => [normalize(e.name), e]))
    const catalogByMuscle = new Map()
    for (const e of filteredCatalog) {
      if (!catalogByMuscle.has(e.muscle_primary)) catalogByMuscle.set(e.muscle_primary, [])
      catalogByMuscle.get(e.muscle_primary).push(e)
    }

    const replaced = []

    for (const day of routineJson.days) {
      if (!Array.isArray(day.exercises)) continue
      const usedThisDay = new Set()
      const newExercises = []
      for (const ex of day.exercises) {
        const proposed = ex.exercise_name || ''
        const key = normalize(proposed)
        if (catalogByName.has(key)) {
          const canonical = catalogByName.get(key).name
          ex.exercise_name = canonical
          usedThisDay.add(normalize(canonical))
          newExercises.push(ex)
          continue
        }

        let replacement = bestCatalogMatch(proposed, filteredCatalog) || null
        if (!replacement) {
          const muscle = muscleFromDayName(day.day_name)
          const candidates = muscle ? (catalogByMuscle.get(muscle) || []) : []
          const filteredByEquip = equipment.length > 0
            ? candidates.filter(c => equipment.includes(c.equipment))
            : candidates
          replacement = (filteredByEquip.find(c => !usedThisDay.has(normalize(c.name))))
            || (candidates.find(c => !usedThisDay.has(normalize(c.name))))
            || null
        }

        if (replacement && !usedThisDay.has(normalize(replacement.name))) {
          replaced.push({ original: proposed, replacement: replacement.name, day: day.day_name })
          ex.exercise_name = replacement.name
          usedThisDay.add(normalize(replacement.name))
          newExercises.push(ex)
        } else {
          replaced.push({ original: proposed, replacement: null, day: day.day_name, dropped: true })
        }
      }
      day.exercises = newExercises
    }

    if (replaced.length > 0) {
      Sentry.captureMessage('generate-routine: ejercicios fuera de catálogo reemplazados', {
        level: 'warning',
        extra: { replaced, member_id, trainer_id }
      })
    }

    return NextResponse.json({
      success: true,
      preview: routineJson,
      replaced
    })

  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'generate-routine' } })
    console.error('Generate routine error:', error)
    let errorMessage = 'Error al generar la rutina'
    let statusCode = 500

    if (error.status === 401) {
      errorMessage = 'API key de OpenAI inválida o expirada.'
      statusCode = 401
    } else if (error.status === 429) {
      errorMessage = 'Límite de uso de OpenAI alcanzado. Inténtalo más tarde.'
      statusCode = 429
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode })
  }
}
