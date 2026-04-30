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
5. PRIORIDAD ABSOLUTA — LESIONES Y CONDICIONES MÉDICAS: si las notas adicionales o las condiciones médicas indicadas mencionan dolor, molestia o lesión en cualquier zona, esta restricción tiene prioridad sobre cualquier otra regla, incluida la regla 6 sobre pecho. Si en el bloque "RESTRICCIONES OBLIGATORIAS DETECTADAS" aparecen grupos musculares vetados, NO incluyas NINGÚN ejercicio cuyo músculo primario esté en esa lista, aunque el catálogo lo permita. Adapta la rutina evitando ejercicios que puedan agravar la lesión y sustitúyelos por alternativas equivalentes del catálogo. Guía orientativa:
   - Lesión / dolor de HOMBRO: evita TODOS los press de pecho (banca, inclinado, declinado, en máquina, en Smith), aperturas, fondos, pull-overs, press de hombros y elevaciones frontales/laterales pesadas. El press de pecho carga el hombro como estabilizador y es contraindicado.
   - Lesión / dolor de RODILLA: evita Sentadilla en multipower, Zancadas, Sentadilla búlgara y prensas pesadas con recorrido completo.
   - Lesión / dolor LUMBAR: evita Peso muerto rumano, Buenos días en polea baja, hiperextensiones cargadas y remos con barra libre.
   - Lesión / dolor de CODO: evita extensiones de tríceps pesadas, press francés y curls con barra recta. Prefiere variantes en máquina o con mancuernas.
   - Lesión / dolor de MUÑECA: prefiere mancuernas y máquinas; evita ejercicios con barra recta que fuercen extensión de muñeca.
6. PECHO por sexo (solo aplica si NO hay lesiones que afecten al hombro/codo/muñeca/pecho): si el socio es HOMBRE, SIEMPRE incluye ejercicios de pecho del catálogo; si es MUJER u OTRO, NUNCA incluyas pecho aunque esté en el catálogo. El catálogo ya ha sido filtrado según el sexo del socio. Esta regla queda anulada por la regla 5.
7. Incluye entre 5 y 8 ejercicios por día según la duración indicada.
8. Los valores de "reps" pueden ser: "10", "8-12", "15-20", "al fallo", "30s".
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

const INJURY_PATTERNS = {
  shoulder: /\b(hombro|hombros|shoulder|shoulders|manguito|rotador|rotadores|acromion|deltoid(?:e|es)?)\b/i,
  knee: /\b(rodilla|rodillas|knee|knees|menisco|meniscos|ligamento.{0,20}rodilla)\b/i,
  lumbar: /\b(lumbar|lumbares|espalda baja|hernia(?:.{0,20}disc)?|ci[áa]tica|lower back)\b/i,
  elbow: /\b(codo|codos|elbow|elbows|epicondil(?:itis|algia)?|tendinitis.{0,15}codo)\b/i,
  wrist: /\b(mu[ñn]eca|mu[ñn]ecas|wrist|wrists|carpo|t[úu]nel carpiano)\b/i
}

const INJURY_BLOCKED_MUSCLES = {
  shoulder: ['pecho', 'hombros'],
  knee: ['cuádriceps', 'femoral'],
  lumbar: ['lumbares', 'femoral'],
  elbow: ['tríceps', 'bíceps'],
  wrist: []
}

const INJURY_SAFE_FALLBACK = {
  shoulder: ['espalda', 'bíceps', 'tríceps', 'abdomen', 'gemelos'],
  knee: ['espalda', 'pecho', 'hombros', 'bíceps', 'tríceps', 'abdomen', 'glúteo'],
  lumbar: ['pecho', 'hombros', 'bíceps', 'tríceps', 'cuádriceps', 'abdomen', 'gemelos'],
  elbow: ['espalda', 'pecho', 'hombros', 'cuádriceps', 'femoral', 'glúteo', 'abdomen', 'gemelos'],
  wrist: ['cuádriceps', 'femoral', 'glúteo', 'gemelos', 'abdomen']
}

const INJURY_LABELS_ES = {
  shoulder: 'hombro',
  knee: 'rodilla',
  lumbar: 'zona lumbar',
  elbow: 'codo',
  wrist: 'muñeca'
}

function detectInjuries(...sources) {
  const text = sources.filter(Boolean).join(' ')
  if (!text.trim()) return new Set()
  const found = new Set()
  for (const [zone, regex] of Object.entries(INJURY_PATTERNS)) {
    if (regex.test(text)) found.add(zone)
  }
  return found
}

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

    const injuries = detectInjuries(notes, memberConditions)
    const blockedMuscles = new Set()
    for (const zone of injuries) {
      for (const m of (INJURY_BLOCKED_MUSCLES[zone] || [])) blockedMuscles.add(m)
    }
    const injuryRestrictionBlock = injuries.size > 0
      ? `RESTRICCIONES OBLIGATORIAS DETECTADAS (PRIORIDAD ABSOLUTA):
${[...injuries].map(z => `- Lesión / dolor de ${INJURY_LABELS_ES[z]}: NO incluyas ningún ejercicio cuyo músculo primario sea ${INJURY_BLOCKED_MUSCLES[z].length ? INJURY_BLOCKED_MUSCLES[z].map(m => `"${m}"`).join(' ni ') : '(sin restricción por grupo)'}.`).join('\n')}
Si vas a incluir un ejercicio dudoso, descártalo y elige otro del catálogo de un grupo muscular seguro.

`
      : ''

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

${injuryRestrictionBlock}CATÁLOGO DE EJERCICIOS DISPONIBLES (los ÚNICOS que puedes usar):
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

    if (injuries.size > 0) {
      const injuryReason = `injury:${[...injuries].join(',')}`
      const safeMuscles = new Set()
      for (const zone of injuries) {
        for (const m of (INJURY_SAFE_FALLBACK[zone] || [])) safeMuscles.add(m)
      }
      const isSafeExercise = (ex) => ex && !blockedMuscles.has(ex.muscle_primary)
      const usedAcrossWeek = new Set()
      for (const day of routineJson.days) {
        if (!Array.isArray(day.exercises)) continue
        for (const ex of day.exercises) {
          const cat = catalogByName.get(normalize(ex.exercise_name))
          if (cat) usedAcrossWeek.add(normalize(cat.name))
        }
      }

      const pickSafeReplacement = (usedThisDay, preferredEquipment) => {
        const candidates = []
        for (const muscle of safeMuscles) {
          for (const c of (catalogByMuscle.get(muscle) || [])) {
            if (!isSafeExercise(c)) continue
            if (usedThisDay.has(normalize(c.name))) continue
            candidates.push(c)
          }
        }
        const matchEquip = candidates.find(c =>
          (!preferredEquipment || c.equipment === preferredEquipment) &&
          !usedAcrossWeek.has(normalize(c.name))
        )
        if (matchEquip) return matchEquip
        const fresh = candidates.find(c => !usedAcrossWeek.has(normalize(c.name)))
        if (fresh) return fresh
        return candidates[0] || null
      }

      for (const day of routineJson.days) {
        if (!Array.isArray(day.exercises)) continue
        const usedThisDay = new Set()
        const filtered = []
        for (const ex of day.exercises) {
          const cat = catalogByName.get(normalize(ex.exercise_name))
          if (cat && isSafeExercise(cat)) {
            usedThisDay.add(normalize(cat.name))
            filtered.push(ex)
            continue
          }
          const original = ex.exercise_name
          const preferredEquip = cat?.equipment || null
          const replacement = pickSafeReplacement(usedThisDay, preferredEquip)
          if (replacement) {
            ex.exercise_name = replacement.name
            usedThisDay.add(normalize(replacement.name))
            usedAcrossWeek.add(normalize(replacement.name))
            replaced.push({ original, replacement: replacement.name, day: day.day_name, reason: injuryReason })
            filtered.push(ex)
          } else {
            replaced.push({ original, replacement: null, day: day.day_name, dropped: true, reason: injuryReason })
          }
        }

        while (filtered.length < 3) {
          const replacement = pickSafeReplacement(usedThisDay, null)
          if (!replacement) break
          usedThisDay.add(normalize(replacement.name))
          usedAcrossWeek.add(normalize(replacement.name))
          filtered.push({
            exercise_name: replacement.name,
            sets: replacement.default_sets || 3,
            reps: String(replacement.default_reps || '10-12'),
            rest_seconds: replacement.default_rest_seconds || 60,
            superset_group: 0,
            notes: null
          })
        }

        day.exercises = filtered
      }
    }

    if (replaced.length > 0) {
      Sentry.captureMessage('generate-routine: ejercicios fuera de catálogo reemplazados', {
        level: 'warning',
        extra: { replaced, member_id, trainer_id, injuries: [...injuries] }
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
