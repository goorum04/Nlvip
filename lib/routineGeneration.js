import OpenAI from 'openai'
import * as Sentry from '@sentry/nextjs'
import {
  INJURY_BLOCKED_MUSCLES,
  INJURY_SAFE_FALLBACK,
  INJURY_LABELS_ES,
  detectInjuries,
  getBlockedMuscles
} from './injuryValidation'

const PLANNING_PROMPT = `Eres un entrenador personal de élite con 20 años de experiencia diseñando rutinas para hipertrofia, fuerza, definición y rehabilitación. Tu trabajo en este paso es DISEÑAR la rutina razonando paso a paso, en lenguaje natural — todavía NO en JSON.

OBJETIVO DEL PASO: producir un plan claro que después un formateador convertirá a JSON usando un catálogo. Por eso debes ser PRECISO con nombres de ejercicios (que se parezcan a los del catálogo que se te dará abajo) y con sets/reps/descansos.

REGLAS DE DISEÑO QUE DEBES APLICAR:

1. AGRUPACIÓN DE GRUPOS MUSCULARES POR DÍA (split sinergista — OBLIGATORIO salvo override en notas):
   - Pecho → siempre con TRÍCEPS (sinérgico del press).
   - Espalda → siempre con BÍCEPS (sinérgico de remos/dominadas).
   - Hombros → aparte o con PIERNAS o CORE.
   - Piernas (cuádriceps + femoral + glúteo + gemelos) → día propio.
   - Abdomen / core → al final de cualquier día.
   Plantillas por días/semana:
   - 2 días → A: Torso completo | B: Tren inferior + core
   - 3 días → A: Pecho+tríceps+hombros | B: Espalda+bíceps | C: Piernas+core
   - 4 días → A: Pecho+tríceps | B: Espalda+bíceps | C: Piernas+core | D: Hombros+brazos
   - 5 días → A: Pecho+tríceps | B: Espalda+bíceps | C: Piernas | D: Hombros+core | E: Brazos+abs
   - 6 días → PPL ×2: Push, Pull, Legs, Push, Pull, Legs.
   PROHIBIDO: pecho+bíceps, espalda+tríceps, mismo grupo grande dos días seguidos.
   Si las "Notas adicionales" piden expresamente otro split (full-body, upper/lower, bro-split), respétalo.

2. RANGOS POR OBJETIVO (OBLIGATORIO salvo override en notas):
   - hipertrofia / volumen / ganar músculo → 3-4 series, 8-12 reps, 60-90s descanso.
   - fuerza → 4-5 series, 4-6 reps, 120-180s descanso.
   - definición / pérdida de grasa → 3-4 series, 10-15 reps, 45-60s descanso.
   - resistencia / cardio → 2-3 series, 15-20 reps, 30-45s descanso.
   - rehabilitación / vuelta a la actividad / suave → 2-3 series, 12-15 reps, 60-90s descanso.
   En auxiliares/aislamiento puedes subir 1-2 reps. NO mezcles objetivos.

3. OVERRIDE POR NOTAS DEL ADMIN: si las "Notas adicionales" mencionan un rango distinto (ej: "5x5", "8 reps", "descanso 2 minutos"), aplícalo con prioridad sobre la regla 2.

4. LESIONES Y CONDICIONES MÉDICAS — PRIORIDAD ABSOLUTA: si en el bloque "RESTRICCIONES OBLIGATORIAS DETECTADAS" hay grupos vetados, NO los entrenes. Sustituye por alternativas seguras.
   - Hombro: evita TODOS los press de pecho/hombro, aperturas, fondos, pull-overs, elevaciones pesadas.
   - Rodilla: evita sentadilla profunda, zancadas, búlgara, prensas pesadas con recorrido completo.
   - Lumbar: evita peso muerto rumano, buenos días, hiperextensiones cargadas, remos con barra libre.
   - Codo: evita extensiones de tríceps pesadas, press francés, curls con barra recta. Prefiere máquina/mancuernas.
   - Muñeca: prefiere mancuernas y máquinas; evita barra recta forzada.

5. RUTINAS DE REHABILITACIÓN / VUELTA A LA ACTIVIDAD: si el goal o las notas indican post-hospital, post-cirugía, recuperación, "empezar suave", aplica:
   - 4-6 ejercicios por día (no 7-8), priorizando máquinas guiadas y movilidad.
   - Sets bajos (2-3), reps moderadas-altas (12-15), descanso 60-90s.
   - NUNCA bi-series ni tri-series.
   - Evita sentadillas profundas con barra, peso muerto, prensas pesadas, dominadas estrictas, fondos en paralelas, cualquier explosivo o pliométrico.
   - Nombre de la rutina coherente ("Readaptación suave", "Vuelta a la actividad").

6. PECHO POR SEXO: si el socio es HOMBRE, incluye pecho. Si es MUJER u OTRO, NO incluyas pecho.

7. BI-SERIES / TRI-SERIES: si el goal es definición/resistencia, la duración es corta, o "permitir_supersets" es true, agrupa 2-3 ejercicios consecutivos como bi/tri-serie. Indica el grupo (1, 2, 3...) y el descanso entre ejercicios del grupo es 0-15s. NO bi-series en rutinas de rehab.

8. NÚMERO DE EJERCICIOS: 5-8 por día normalmente; 4-6 en rehab.

FORMATO DE TU RESPUESTA EN ESTE PASO (PLAN, no JSON):

  RAZONAMIENTO GENERAL:
  - Split que voy a usar y por qué (referencia a la regla 1 + notas).
  - Rangos de reps/sets/descanso que aplican (referencia a la regla 2/3).
  - Lesiones/condiciones que voy a respetar.

  PLAN POR DÍAS:
  Día 1 — [nombre del día, ej: "Pecho y Tríceps"]:
  - Ejercicio 1: [nombre similar al del catálogo] — [sets]x[reps], [descanso]s. [breve justificación opcional]
  - Ejercicio 2: ...
  - ...

  Día 2 — ...
  ...

NO devuelvas JSON. NO uses bloques de código. Solo texto plano con la estructura indicada arriba.`

const SYSTEM_PROMPT = `Eres un FORMATEADOR. Recibes un plan de rutina diseñado por un entrenador experto y debes convertirlo a JSON estricto usando los nombres EXACTOS de un catálogo de ejercicios. NO añadas ni quites ejercicios respecto al plan. NO cambies sets/reps/descansos del plan.

REGLAS:
1. Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.
2. Usa exclusivamente nombres LITERALES del catálogo de ejercicios proporcionado. Si un ejercicio del plan no aparece literalmente en el catálogo, escoge el ejercicio del catálogo más equivalente del MISMO grupo muscular.
3. El nombre del ejercicio en el JSON debe coincidir EXACTAMENTE con el del catálogo (mayúsculas, tildes y espacios incluidos).
4. Conserva el orden de los ejercicios dentro de cada día tal como están en el plan.
5. Conserva los sets / reps / rest_seconds / superset_group exactos del plan. No los recalcules.
6. Los valores de "reps" pueden ser: "10", "8-12", "15-20", "al fallo", "30s".
7. Si el plan menciona bi-series / tri-series, asigna superset_group entero (1, 2, 3...) a los ejercicios agrupados (mismo número = mismo grupo). Usa 0 o null en ejercicios individuales.

FORMATO JSON DE RESPUESTA:
{
  "routine_name": "string",
  "routine_description": "string",
  "days": [
    {
      "day_number": 1,
      "day_name": "string (ej: Pecho y Tríceps)",
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

const STOPWORDS = new Set(['en', 'de', 'con', 'la', 'el', 'los', 'las', 'al', 'por', 'para', 'una', 'un', 'y', 'o', 'sobre'])
const MUSCLES = ['espalda', 'pecho', 'hombros', 'bíceps', 'biceps', 'tríceps', 'triceps', 'cuádriceps', 'cuadriceps', 'femoral', 'glúteo', 'gluteo', 'gemelos', 'abdomen', 'lumbares']

const normalize = (s) => (s || '').toString().trim().toLowerCase()

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

function muscleFromDayName(dayName) {
  const n = normalize(dayName)
  for (const m of MUSCLES) {
    if (n.includes(m)) {
      return m.replace('biceps', 'bíceps').replace('triceps', 'tríceps').replace('cuadriceps', 'cuádriceps').replace('gluteo', 'glúteo')
    }
  }
  return null
}

/**
 * Generate a personalized routine for a member, applying onboarding context,
 * catalog filtering, and injury-based safety substitutions.
 *
 * @param {object} args
 * @param {SupabaseClient} args.supabase - Supabase service-role client
 * @param {string|null} args.member_id - UUID of the member (or null for generic)
 * @param {string|null} args.trainer_id - Reserved for caller use (not used here)
 * @param {object} args.criteria - { days_per_week, goal, level, equipment, session_duration_min, notes, allow_supersets }
 * @returns {Promise<{ routine, replaced, injuries, member_meta }>}
 */
export async function generateRoutineForMember({ supabase, member_id = null, trainer_id = null, criteria }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY no configurada')
    err.status = 500
    throw err
  }

  const {
    days_per_week,
    goal,
    level,
    equipment = [],
    session_duration_min = 60,
    notes = '',
    allow_supersets = true
  } = criteria

  let memberSex = null
  let memberGoal = null
  let memberConditions = null
  let memberDislikes = null
  let memberRestrictions = null
  let memberName = null

  if (member_id) {
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('sex, name')
      .eq('id', member_id)
      .maybeSingle()
    memberSex = memberProfile?.sex || null
    memberName = memberProfile?.name || null

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
    const err = new Error('No se pudo cargar el catálogo de ejercicios. Asegúrate de haber ejecutado el seed.')
    err.status = 500
    throw err
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
  const blockedMuscles = getBlockedMuscles(injuries)
  const injuryRestrictionBlock = injuries.size > 0
    ? `RESTRICCIONES OBLIGATORIAS DETECTADAS (PRIORIDAD ABSOLUTA):
${[...injuries].map(z => `- Lesión / dolor de ${INJURY_LABELS_ES[z]}: NO incluyas ningún ejercicio cuyo músculo primario sea ${INJURY_BLOCKED_MUSCLES[z].length ? INJURY_BLOCKED_MUSCLES[z].map(m => `"${m}"`).join(' ni ') : '(sin restricción por grupo)'}.`).join('\n')}
Si vas a incluir un ejercicio dudoso, descártalo y elige otro del catálogo de un grupo muscular seguro.

`
    : ''

  // Detección de condición especial → pediremos a la IA un campo medical_rationale
  const REHAB_GOAL_RX = /(rehabilit|acondicionamiento|vuelta\s+a\s+la\s+actividad|suave|principiante\s+absoluto)/i
  const REHAB_NOTES_RX = /(hospital|cirug[ií]a|operaci[oó]n|post[\s-]?operatorio|embarazo|lesi[oó]n|dolor\s+de|mayor|rehab|suave|vuelta\s+a\s+la\s+actividad|reciente)/i
  const hasSpecialCondition = (
    injuries.size > 0 ||
    (memberConditions && memberConditions.trim().length > 0) ||
    (notes && REHAB_NOTES_RX.test(notes)) ||
    (goal && REHAB_GOAL_RX.test(goal))
  )

  const conditionSummary = hasSpecialCondition
    ? [
        injuries.size > 0 ? `lesiones detectadas: ${[...injuries].map(z => INJURY_LABELS_ES[z]).join(', ')}` : null,
        memberConditions ? `condiciones médicas del onboarding: ${memberConditions}` : null,
        (notes && REHAB_NOTES_RX.test(notes)) ? `notas del admin: ${notes}` : null,
        (goal && REHAB_GOAL_RX.test(goal)) ? `objetivo: ${goal}` : null
      ].filter(Boolean).join(' / ')
    : ''

  const rationaleInstruction = hasSpecialCondition
    ? `\n\nIMPORTANTE — EXPLICACIÓN MÉDICA REQUERIDA:
Esta rutina aplica a una persona con condición especial (${conditionSummary}). Incluye en el JSON un campo adicional "medical_rationale" (string, máximo 400 caracteres) explicando en español, en tono cercano y en SEGUNDA PERSONA (de tú), por qué esta rutina es beneficiosa para esa condición.
Formato exacto: 1 frase introductoria + 3 bullets que empiecen por "• ".
- En los bullets explica: (1) qué se está EVITANDO y por qué, (2) qué se está PRIORIZANDO y por qué, (3) cómo PROGRESAR de forma segura.
- NO repitas el listado de ejercicios. NO uses tecnicismos médicos. Habla como un entrenador empático.
Si NO aplica condición especial, omite el campo o ponlo a null.`
    : ''

  const planningCriteria = `CRITERIOS DE LA RUTINA:
- Días por semana: ${days_per_week}
- Objetivo: ${goal}
- Nivel: ${level}
- Equipamiento disponible: ${equipment.length > 0 ? equipment.join(', ') : 'todo el equipamiento del catálogo'}
- Duración aproximada por sesión: ${session_duration_min} minutos
- Notas adicionales: ${notes || 'ninguna'}
- Permitir bi-series / tri-series: ${allow_supersets ? 'sí' : 'no'}

CONTEXTO DEL SOCIO:
${memberContextLines}

${injuryRestrictionBlock}CATÁLOGO DE EJERCICIOS DISPONIBLES (escoge entre estos al diseñar; usa nombres lo más cercanos posible al catálogo):
${catalogLines}

Diseña exactamente ${days_per_week} días siguiendo el FORMATO DE TU RESPUESTA del system prompt (texto plano, NO JSON).${rationaleInstruction}`

  const openai = new OpenAI({ apiKey })

  // PASS 1 — Razonamiento: el modelo planea la rutina en lenguaje natural
  const planningResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PLANNING_PROMPT },
      { role: 'user', content: planningCriteria }
    ],
    temperature: 0.7,
    max_tokens: 3500
  })
  const planText = planningResponse.choices[0]?.message?.content || ''
  if (!planText.trim()) {
    const err = new Error('No se pudo planificar la rutina (paso 1). Inténtalo de nuevo.')
    err.status = 500
    throw err
  }

  // PASS 2 — Formalización: convierte el plan a JSON estricto usando el catálogo
  const formattingMessage = `PLAN DE LA RUTINA (diseñado por el entrenador en el paso anterior):
${planText}

CATÁLOGO DE EJERCICIOS (usa SOLO estos nombres, exactos):
${catalogLines}

Convierte el plan anterior en JSON siguiendo el FORMATO JSON DE RESPUESTA del system prompt. Conserva sets/reps/descansos del plan literalmente. ${rationaleInstruction ? '\n\n' + rationaleInstruction : ''}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: formattingMessage }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000
  })

  const content = response.choices[0]?.message?.content || ''
  let routineJson
  try {
    routineJson = JSON.parse(content)
  } catch {
    const err = new Error('No se pudo generar la rutina. Inténtalo de nuevo.')
    err.status = 400
    throw err
  }

  if (!routineJson.days || !Array.isArray(routineJson.days)) {
    const err = new Error('Formato de rutina incorrecto. Inténtalo de nuevo.')
    err.status = 400
    throw err
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

  return {
    routine: routineJson,
    replaced,
    injuries: [...injuries],
    member_meta: {
      sex: memberSex,
      name: memberName,
      onboarding_goal: memberGoal,
      conditions: memberConditions,
      dislikes: memberDislikes,
      restrictions: memberRestrictions
    }
  }
}
