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

export const GOAL_FROM_ONBOARDING = {
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
 * Recopila el historial de entrenamiento del socio para dárselo a la IA:
 * rutina anterior (para no repetir y progresar), récords/pesos (PRs) y
 * adherencia (sesiones registradas el último mes).
 *
 * TODO va envuelto en try/catch individuales: si algo falla, ese trozo queda
 * en null y la generación continúa exactamente igual que sin historial.
 *
 * @returns {Promise<{ previousRoutine: string|null, prs: string|null, adherence: string|null }>}
 */
export async function gatherMemberTrainingContext(supabase, member_id) {
  const ctx = { previousRoutine: null, prs: null, adherence: null }
  if (!member_id) return ctx

  // 1. Rutina principal actualmente asignada (un socio puede tener además
  // una rutina "alternativa" — días sin tiempo/vacaciones — que no se usa
  // como base para generar/adaptar la rutina principal).
  try {
    const { data: assigned } = await supabase
      .from('member_workouts')
      .select('workout_template_id')
      .eq('member_id', member_id)
      .eq('routine_slot', 'principal')
      .maybeSingle()
    const templateId = assigned?.workout_template_id
    if (templateId) {
      const { data: tpl } = await supabase
        .from('workout_templates')
        .select('name')
        .eq('id', templateId)
        .maybeSingle()
      const { data: days } = await supabase
        .from('workout_days')
        .select('name, day_number, workout_exercises(name, order_index)')
        .eq('workout_template_id', templateId)
        .order('day_number', { ascending: true })
      if (Array.isArray(days) && days.length > 0) {
        const lines = days.map(d => {
          const exs = (d.workout_exercises || [])
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map(e => e.name)
            .filter(Boolean)
          return `  ${d.name}: ${exs.join(', ') || '—'}`
        })
        ctx.previousRoutine = `Rutina actual "${tpl?.name || 'sin nombre'}":\n${lines.join('\n')}`
      }
    }
  } catch (e) {
    console.warn('gatherMemberTrainingContext previousRoutine error:', e.message)
  }

  // 2. Récords / pesos recientes (último por ejercicio).
  try {
    const { data: prs } = await supabase
      .from('member_prs')
      .select('exercise_name, weight_kg, reps, estimated_1rm, date')
      .eq('member_id', member_id)
      .order('date', { ascending: false })
      .limit(50)
    if (Array.isArray(prs) && prs.length > 0) {
      const seen = new Set()
      const latest = []
      for (const p of prs) {
        const key = (p.exercise_name || '').toLowerCase().trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        const rm = p.estimated_1rm ? ` (1RM~${Math.round(p.estimated_1rm)}kg)` : ''
        latest.push(`${p.exercise_name}: ${p.weight_kg}kg x${p.reps || '?'}${rm}`)
        if (latest.length >= 12) break
      }
      if (latest.length > 0) ctx.prs = latest.join('; ')
    }
  } catch (e) {
    console.warn('gatherMemberTrainingContext prs error:', e.message)
  }

  // 3. Adherencia: nº de entrenos registrados en los últimos 28 días.
  try {
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('workout_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member_id)
      .gte('checked_in_at', since)
    if (typeof count === 'number') {
      const perWeek = (count / 4).toFixed(1)
      ctx.adherence = `${count} entrenos registrados en las últimas 4 semanas (~${perWeek} sesiones/semana).`
    }
  } catch (e) {
    console.warn('gatherMemberTrainingContext adherence error:', e.message)
  }

  return ctx
}

// Sustituye in-place cualquier nombre de ejercicio que no exista literalmente
// en el catálogo por el más parecido (o uno del mismo grupo muscular/día como
// último recurso). Devuelve la lista de sustituciones hechas (para Sentry/log).
// Compartido entre generateRoutineForMember y refineRoutineDraft.
function enforceCatalogNames(routineJson, filteredCatalog, equipment, { catalogByName, catalogByMuscle }) {
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
  return replaced
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
  let memberAge = null
  // Contexto de entrenamiento (historial). Se carga "a prueba de fallos": si
  // alguna consulta falla, se queda en null y la rutina se genera igual que antes.
  let trainingContext = { previousRoutine: null, prs: null, adherence: null }

  if (member_id) {
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('sex, name, age, injuries, medical_conditions')
      .eq('id', member_id)
      .maybeSingle()
    memberSex = memberProfile?.sex || null
    memberName = memberProfile?.name || null
    memberAge = memberProfile?.age || null
    // Las lesiones/condiciones del perfil se suman a las del onboarding para
    // que el detector de lesiones tenga el máximo de contexto disponible.
    const profileConditions = [memberProfile?.injuries, memberProfile?.medical_conditions]
      .filter(v => v && String(v).trim() && String(v).trim().toLowerCase() !== 'ninguna')
      .join('; ') || null

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
    // Combina condiciones del onboarding + del perfil (sin duplicar nulls).
    memberConditions = [memberConditions, profileConditions].filter(Boolean).join('; ') || null

    trainingContext = await gatherMemberTrainingContext(supabase, member_id)
  }

  const allowChest = memberSex === 'male'

  const { data: catalog, error: catalogError } = await supabase
    .from('exercises')
    .select('id, name, muscle_primary, muscle_secondary, equipment, difficulty, default_sets, default_reps, default_rest_seconds, only_male')
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
    `Edad: ${memberAge ? `${memberAge} años` : 'no especificada'}`,
    `Objetivo del socio (onboarding): ${memberGoal ? (GOAL_FROM_ONBOARDING[memberGoal] || memberGoal) : 'no especificado'}`,
    `Condiciones médicas / lesiones: ${memberConditions || 'ninguna indicada'}`,
    `Cosas que no le gustan: ${memberDislikes || 'ninguna indicada'}`,
    `Restricciones / alergias: ${memberRestrictions || 'ninguna indicada'}`
  ].join('\n') : 'Rutina genérica (sin socio asociado).'

  // Bloque de HISTORIAL (solo si hay datos). Guía a la IA para progresar sobre
  // lo anterior, usar las cargas reales del socio y ajustar a su adherencia.
  const historyParts = []
  if (trainingContext.previousRoutine) {
    historyParts.push(`RUTINA ANTERIOR DEL SOCIO (NO la copies tal cual: introduce VARIACIÓN de ejercicios y, si procede, PROGRESIÓN respecto a esta):\n${trainingContext.previousRoutine}`)
  }
  if (trainingContext.prs) {
    historyParts.push(`PESOS/RÉCORDS RECIENTES DEL SOCIO (úsalos como referencia del nivel real de fuerza; menciona cargas orientativas coherentes con estos números cuando sea útil):\n${trainingContext.prs}`)
  }
  if (trainingContext.adherence) {
    historyParts.push(`ADHERENCIA: ${trainingContext.adherence} Ajusta el volumen a lo que realmente es capaz de cumplir: si entrena poco, prioriza ejercicios multiarticulares de alto rendimiento; si entrena mucho, puedes ampliar volumen y accesorios.`)
  }
  const edadRule = (memberAge && memberAge >= 55)
    ? `\n\nCONSIDERACIÓN POR EDAD (${memberAge} años): prioriza calentamiento, máquinas guiadas y rangos controlados; evita cargas máximas (1-3 reps) y movimientos explosivos/pliométricos salvo que el objetivo lo pida expresamente.`
    : ''
  const historyBlock = historyParts.length > 0
    ? `\n═══ HISTORIAL Y CONTEXTO DE ENTRENAMIENTO ═══\n${historyParts.join('\n\n')}\n`
    : ''

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
${memberContextLines}${edadRule}
${historyBlock}
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

  const replaced = enforceCatalogNames(routineJson, filteredCatalog, equipment, { catalogByName, catalogByMuscle })

  if (injuries.size > 0) {
    const injuryReason = `injury:${[...injuries].join(',')}`
    const safeMuscles = new Set()
    for (const zone of injuries) {
      for (const m of (INJURY_SAFE_FALLBACK[zone] || [])) safeMuscles.add(m)
    }
    // Un ejercicio es inseguro si su músculo PRINCIPAL o alguno SECUNDARIO está
    // vetado por la lesión (antes solo se miraba el principal → se colaban
    // ejercicios que cargaban la zona lesionada "de rebote").
    const isSafeExercise = (ex) => {
      if (!ex) return false
      if (blockedMuscles.has(ex.muscle_primary)) return false
      const secondary = Array.isArray(ex.muscle_secondary) ? ex.muscle_secondary : []
      return !secondary.some(m => blockedMuscles.has(m))
    }
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

  // Volumen semanal por grupo muscular: suma de series por músculo PRIMARIO,
  // asumiendo que cada día se entrena una vez por semana. Sirve para que el
  // entrenador detecte de un vistazo desequilibrios (referencia ~10-20 series/sem).
  const volumePerMuscle = {}
  for (const day of routineJson.days) {
    if (!Array.isArray(day.exercises)) continue
    for (const ex of day.exercises) {
      const cat = catalogByName.get(normalize(ex.exercise_name))
      if (!cat) continue
      const sets = Number(ex.sets) || 0
      volumePerMuscle[cat.muscle_primary] = (volumePerMuscle[cat.muscle_primary] || 0) + sets
    }
  }
  const volumeWarnings = []
  for (const [muscle, sets] of Object.entries(volumePerMuscle)) {
    if (sets > 22) volumeWarnings.push(`${muscle}: ${sets} series/semana (alto)`)
  }
  const volumeSummary = Object.entries(volumePerMuscle)
    .sort((a, b) => b[1] - a[1])
    .map(([m, s]) => `${m}: ${s}`)
    .join(' | ')

  // Explicación SOLO para el admin/entrenador de por qué la IA ha tomado cada
  // decisión. Llamada SEPARADA (no toca los prompts de diseño/formateo) y nunca
  // se persiste con la rutina del socio → el socio jamás la recibe ni la ve.
  let rationale = ''
  try {
    const daysSummary = routineJson.days.map(d => {
      const exs = (d.exercises || [])
        .map(e => `${e.exercise_name} (${e.sets}x${e.reps}, ${e.rest_seconds}s)`)
        .join('; ')
      return `Día ${d.day_number} — ${d.day_name}: ${exs}`
    }).join('\n')

    const rationalePrompt = `Eres un entrenador de élite. Acabas de diseñar la siguiente rutina para un socio.
Explica de forma BREVE y PROFESIONAL a OTRO ENTRENADOR/ADMINISTRADOR (uso interno, el socio NUNCA verá esto) por qué has tomado las decisiones clave.

CRITERIOS: ${days_per_week} días/semana, objetivo "${goal}", nivel ${level}, ${session_duration_min} min/sesión. Notas: ${notes || 'ninguna'}.
CONTEXTO DEL SOCIO:
${memberContextLines}
${injuries.size > 0 ? `Lesiones detectadas: ${[...injuries].map(z => INJURY_LABELS_ES[z]).join(', ')}.` : ''}

RUTINA GENERADA:
${daysSummary}

VOLUMEN SEMANAL POR MÚSCULO (series/semana): ${volumeSummary || 'n/d'}${volumeWarnings.length > 0 ? `\nAVISO de volumen alto en: ${volumeWarnings.join(', ')}.` : ''}

Devuelve 4-7 puntos concisos (máximo ~2 frases cada uno) explicando:
- Por qué ese split y la agrupación de grupos musculares para sus días y objetivo
- Por qué esos rangos de series/reps/descanso
- Decisiones por lesiones, condiciones médicas o cosas que no le gustan
- Si hay historial: cómo progresa/varía respecto a la rutina anterior y cómo encaja con sus pesos/adherencia
- Cualquier ajuste especial (sexo, edad, nivel, duración de sesión, volumen)

Escribe SOLO los puntos, en español, empezando cada uno con "• ". Sin título ni despedida.`

    const rationaleResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: rationalePrompt }],
      max_tokens: 600,
      temperature: 0.4
    })
    rationale = rationaleResponse.choices[0]?.message?.content?.trim() || ''
  } catch (rationaleErr) {
    // No bloqueante: si falla, devolvemos la rutina igualmente sin explicación.
    console.warn('generate-routine rationale error:', rationaleErr.message)
  }

  return {
    routine: routineJson,
    replaced,
    rationale,
    injuries: [...injuries],
    volumePerMuscle,
    volumeWarnings,
    member_meta: {
      sex: memberSex,
      name: memberName,
      age: memberAge,
      onboarding_goal: memberGoal,
      conditions: memberConditions,
      dislikes: memberDislikes,
      restrictions: memberRestrictions,
      has_history: Boolean(trainingContext.previousRoutine || trainingContext.prs || trainingContext.adherence)
    }
  }
}

// Ajusta un borrador de rutina ya generado a partir de una corrección de texto
// del entrenador/admin (mismo patrón que refine-draft de dietas, pero sobre
// JSON en vez de texto plano). Usado en la revisión periódica de un socio
// cuando Nacho quiere pedir un ajuste puntual sin regenerar toda la rutina.
export async function refineRoutineDraft({ supabase, member_id = null, currentRoutine, correction }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY no configurada')
    err.status = 500
    throw err
  }

  let allowChest = true
  if (member_id) {
    const { data: memberProfile } = await supabase.from('profiles').select('sex').eq('id', member_id).maybeSingle()
    allowChest = memberProfile?.sex === 'male'
  }

  const { data: catalog, error: catalogError } = await supabase
    .from('exercises')
    .select('id, name, muscle_primary, muscle_secondary, equipment, difficulty, default_sets, default_reps, default_rest_seconds, only_male')
    .eq('is_global', true)
    .order('muscle_primary')
    .order('name')
  if (catalogError || !catalog?.length) {
    const err = new Error('No se pudo cargar el catálogo de ejercicios.')
    err.status = 500
    throw err
  }
  const filteredCatalog = catalog.filter(e => allowChest ? true : !e.only_male)
  const catalogLines = filteredCatalog
    .map(e => `- ${e.name} (músculo: ${e.muscle_primary}, equipo: ${e.equipment})`)
    .join('\n')

  const prompt = `Eres un entrenador personal de élite. El administrador está revisando el siguiente borrador de rutina y quiere aplicar una corrección puntual.

RUTINA ACTUAL (JSON):
${JSON.stringify(currentRoutine, null, 2)}

CORRECCIÓN SOLICITADA:
"${correction}"

CATÁLOGO DE EJERCICIOS DISPONIBLES (usa SOLO estos nombres, exactos):
${catalogLines}

INSTRUCCIONES:
1. Aplica ÚNICAMENTE la corrección indicada. Conserva el resto de la rutina EXACTAMENTE igual (mismos días, mismo orden, mismos sets/reps/descansos salvo que la corrección los afecte).
2. Usa nombres de ejercicio EXACTOS del catálogo.
3. Responde ÚNICAMENTE con el JSON completo de la rutina corregida, mismo formato que la rutina actual (routine_name, routine_description, days[].day_number/day_name/exercises[].exercise_name/sets/reps/rest_seconds/superset_group/notes). Sin texto adicional, sin markdown.`

  const openai = new OpenAI({ apiKey })
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000,
  })

  let routineJson
  try {
    routineJson = JSON.parse(response.choices[0]?.message?.content || '')
  } catch {
    const err = new Error('No se pudo aplicar la corrección. Inténtalo de nuevo.')
    err.status = 400
    throw err
  }
  if (!routineJson.days || !Array.isArray(routineJson.days)) {
    const err = new Error('Formato de rutina corregida incorrecto.')
    err.status = 400
    throw err
  }

  const catalogByName = new Map(filteredCatalog.map(e => [normalize(e.name), e]))
  const catalogByMuscle = new Map()
  for (const e of filteredCatalog) {
    if (!catalogByMuscle.has(e.muscle_primary)) catalogByMuscle.set(e.muscle_primary, [])
    catalogByMuscle.get(e.muscle_primary).push(e)
  }
  enforceCatalogNames(routineJson, filteredCatalog, [], { catalogByName, catalogByMuscle })

  return routineJson
}
