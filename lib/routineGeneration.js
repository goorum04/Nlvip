import OpenAI from 'openai'
import * as Sentry from '@sentry/nextjs'
import {
  INJURY_BLOCKED_MUSCLES,
  INJURY_SAFE_FALLBACK,
  INJURY_LABELS_ES,
  detectInjuries,
  getBlockedMuscles
} from './injuryValidation'
import { gatherActivityContext } from './activityContext'
import { getLatestPhysiqueAnalysis } from './photoAnalysis'

// El split de referencia usa "Pecho" como eje del día empuje/tríceps para
// hombres. Para socias (u "otro"), la regla 6 prohíbe ejercicios de pecho —
// por eso ese mismo día se plantea directamente como "Hombro y Tríceps"
// (empuje sin banca/press plano), evitando el bug de que el día se quede
// TITULADO "Pecho y Tríceps" aunque luego no lleve ni un ejercicio de pecho.
const buildPlanningPrompt = (allowChest) => `Eres un entrenador personal de élite con 20 años de experiencia diseñando rutinas para hipertrofia, fuerza, definición y rehabilitación. Tu trabajo en este paso es DISEÑAR la rutina razonando paso a paso, en lenguaje natural — todavía NO en JSON.

OBJETIVO DEL PASO: producir un plan claro que después un formateador convertirá a JSON usando un catálogo. Por eso debes ser PRECISO con nombres de ejercicios (que se parezcan a los del catálogo que se te dará abajo) y con sets/reps/descansos.

REGLAS DE DISEÑO QUE DEBES APLICAR:

1. AGRUPACIÓN DE GRUPOS MUSCULARES POR DÍA (split sinergista — OBLIGATORIO salvo override en notas):${allowChest ? `
   - Pecho → siempre con TRÍCEPS (sinérgico del press).` : `
   - NO incluyas pecho (ver regla 6). El día de "empuje" es HOMBRO + TRÍCEPS, y se TITULA "Hombro y Tríceps" (nunca "Pecho y Tríceps", ni ese nombre ni ningún derivado).`}
   - Espalda → siempre con BÍCEPS (sinérgico de remos/dominadas).
   - Hombros → aparte o con PIERNAS o CORE.
   - Piernas (cuádriceps + femoral + glúteo + gemelos) → día propio.
   - Abdomen / core → al final de cualquier día.
   Plantillas por días/semana:
   - 2 días → A: Torso completo | B: Tren inferior + core
   - 3 días → A: ${allowChest ? 'Pecho' : 'Hombro'}+tríceps+hombros | B: Espalda+bíceps | C: Piernas+core
   - 4 días → A: ${allowChest ? 'Pecho' : 'Hombro'}+tríceps | B: Espalda+bíceps | C: Piernas+core | D: Hombros+brazos
   - 5 días → A: ${allowChest ? 'Pecho' : 'Hombro'}+tríceps | B: Espalda+bíceps | C: Piernas | D: Hombros+core | E: Brazos+abs
   - 6 días → PPL ×2: Push, Pull, Legs, Push, Pull, Legs.
   PROHIBIDO: pecho+bíceps, espalda+tríceps, mismo grupo grande dos días seguidos.
   Si las "Notas adicionales" piden expresamente otro split (full-body, upper/lower, bro-split), respétalo.

   PRIORIDAD ABSOLUTA — ESTRUCTURA DETALLADA EN NOTAS: si las "Notas adicionales" especifican EXACTAMENTE qué entrenar cada día (ej: "lunes espalda y hombro posterior con gemelos biseriados, martes pecho y hombro lateral y frontal con abs, miércoles cuádriceps 3 ejercicios y femoral 2 con biserie de aductor/abductor..."), esa estructura manda por completo sobre las plantillas y sinergias de arriba. Reglas al aplicarla:
   - Sigue cada día LITERALMENTE: si ese día no se pidió un grupo muscular, NO lo metas — aunque tu plantilla interna diga que "espalda va con bíceps" o "hombro va con pecho", si las notas dicen que el martes es pecho+hombro sin espalda, el martes NO lleva ningún remo/jalón/dominada.
   - Respeta el número de ejercicios por grupo si se especifica: "3 ejercicios de cuádriceps y 2 de femoral" son exactamente 3 y 2, ni más ni menos.
   - Respeta qué va en biserie/triserie y qué no: si dice "biserie solo para tocar" en un grupo secundario, ese grupo lleva solo 1-2 ejercicios ligeros en biserie, no una tanda completa.
   - Las reglas de sinergia (pecho+tríceps, espalda+bíceps) y las plantillas por número de días de arriba SOLO se aplican para los días o grupos que las notas NO detallen.

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

6. PECHO POR SEXO: si el socio es HOMBRE, incluye pecho. Si es MUJER u OTRO, NO incluyas NINGÚN ejercicio de pecho NI titules ningún día "Pecho" o "Pecho y Tríceps" — ese día pasa a llamarse "Hombro y Tríceps" (ver regla 1).

7. BI-SERIES / TRI-SERIES: si el goal es definición/resistencia, la duración es corta, o "permitir_supersets" es true, agrupa 2-3 ejercicios consecutivos como bi/tri-serie. Indica el grupo (1, 2, 3...) y el descanso entre ejercicios del grupo es 0-15s. NO bi-series en rutinas de rehab.

8. NÚMERO DE EJERCICIOS: 5-8 por día normalmente; 4-6 en rehab.

9. NO ELIMINES EJERCICIOS POR "REDUNDANCIA": dos ejercicios que suenen parecidos NO son intercambiables — entrenan ángulos, músculos o énfasis distintos y ambos deben coexistir en el día salvo que el admin pida expresamente quitar uno o haya un veto por lesión (regla 4). Ejemplos que NO son redundantes entre sí: elevaciones laterales (deltoide lateral) vs elevaciones frontales (deltoide anterior); abducción de cadera en máquina (glúteo medio) vs hip thrust/sentadilla búlgara (glúteo mayor/femoral). Si las "Notas adicionales" dan una lista de ejercicios concreta, inclúyelos TODOS tal cual — nunca recortes la lista por tu cuenta asumiendo solapamiento.

FORMATO DE TU RESPUESTA EN ESTE PASO (PLAN, no JSON):

  RAZONAMIENTO GENERAL:
  - Split que voy a usar y por qué (referencia a la regla 1 + notas).
  - Rangos de reps/sets/descanso que aplican (referencia a la regla 2/3).
  - Lesiones/condiciones que voy a respetar.

  PLAN POR DÍAS:
  Día 1 — [nombre del día, ej: "${allowChest ? 'Pecho y Tríceps' : 'Hombro y Tríceps'}"]:
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

// Alias en singular/plural (y sinónimos comunes de nombres de día) para cada
// muscle_primary del catálogo. Los nombres de día que escribe la IA a veces
// usan singular ("Hombro y Tríceps") y muscle_primary suele estar en plural
// ("hombros") — sin esto, un día como "Cuádriceps + Hombro / Tríceps" nunca
// se detectaba como relacionado con hombro.
const MUSCLE_ALIASES = {
  espalda: ['espalda'],
  pecho: ['pecho'],
  hombros: ['hombro', 'hombros'],
  bíceps: ['biceps', 'bíceps'],
  tríceps: ['triceps', 'tríceps'],
  cuádriceps: ['cuadriceps', 'cuádriceps', 'pierna', 'piernas'],
  femoral: ['femoral', 'pierna', 'piernas'],
  glúteo: ['gluteo', 'glúteo', 'glúteos'],
  gemelos: ['gemelo', 'gemelos'],
  abdomen: ['abdomen', 'abs', 'core'],
  lumbares: ['lumbar', 'lumbares']
}

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

function dayMatchesMuscle(dayName, musclePrimary) {
  const n = normalize(dayName)
  const aliases = MUSCLE_ALIASES[musclePrimary] || [musclePrimary]
  return aliases.some(a => n.includes(a))
}

// Un día puede entrenar varios grupos musculares a la vez (p.ej. "Cuádriceps
// + Hombro / Tríceps"), así que devolvemos TODOS los que coincidan en vez de
// solo el primero — antes, con un único match, el orden del array de músculos
// decidía cuál "ganaba" y podía devolver el grupo equivocado como fallback.
function musclesFromDayName(dayName) {
  return Object.keys(MUSCLE_ALIASES).filter(m => dayMatchesMuscle(dayName, m))
}

/**
 * Recopila el historial de entrenamiento del socio para dárselo a la IA:
 * rutina anterior (para no repetir y progresar), récords/pesos (PRs) y
 * adherencia (sesiones registradas el último mes).
 *
 * TODO va envuelto en try/catch individuales: si algo falla, ese trozo queda
 * en null y la generación continúa exactamente igual que sin historial.
 *
 * @returns {Promise<{ previousRoutine: string|null, prs: string|null, adherence: string|null, activity: object|null }>}
 */
export async function gatherMemberTrainingContext(supabase, member_id) {
  const ctx = { previousRoutine: null, prs: null, adherence: null, setLogs: null, activity: null }
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

  // 2b. Series registradas por el socio (registro opcional en su rutina). Es
  // la carga REAL que mueve sesión a sesión, más fiable que un PR puntual para
  // decidir progresión. Si no registra nada, queda en null y todo sigue igual.
  try {
    const since = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: logs } = await supabase
      .from('workout_set_logs')
      .select('exercise_name, performed_on, set_number, weight_kg, reps')
      .eq('member_id', member_id)
      .gte('performed_on', since)
      .order('performed_on', { ascending: false })
      .limit(500)

    if (Array.isArray(logs) && logs.length > 0) {
      // Última sesión registrada de cada ejercicio, con sus series.
      const byExercise = new Map()
      for (const row of logs) {
        const key = (row.exercise_name || '').trim()
        if (!key) continue
        if (!byExercise.has(key)) byExercise.set(key, { date: row.performed_on, sets: [] })
        const entry = byExercise.get(key)
        if (row.performed_on !== entry.date) continue // solo la sesión más reciente
        entry.sets.push(row)
      }

      const lines = []
      for (const [name, entry] of byExercise) {
        const sets = entry.sets
          .sort((a, b) => a.set_number - b.set_number)
          .map(s => `${s.weight_kg ?? '?'}kg×${s.reps ?? '?'}`)
          .join(', ')
        lines.push(`${name}: ${sets}`)
        if (lines.length >= 15) break
      }
      if (lines.length > 0) {
        ctx.setLogs = lines.join(' | ')
      }
    }
  } catch (e) {
    console.warn('gatherMemberTrainingContext setLogs error:', e.message)
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

  // 4. Actividad diaria real (pasos de daily_activity, vía Apple Health o
  // manual). Sirve para decidir cuánto cardio prescribir y para no cargar de
  // volumen a alguien que ya se mueve mucho fuera del gimnasio.
  try {
    ctx.activity = await gatherActivityContext(supabase, member_id)
  } catch (e) {
    console.warn('gatherMemberTrainingContext activity error:', e.message)
  }

  return ctx
}

// Memoria persistente del asistente (ver migración assistant_memory): notas
// duraderas de este socio + preferencias generales de cómo trabaja el admin.
// Fallo silencioso si las RPCs fallan — la generación sigue igual que sin memoria.
async function getAssistantMemory(supabase, member_id) {
  const [memberNotesResult, adminPrefsResult] = await Promise.all([
    member_id
      ? Promise.resolve(supabase.rpc('rpc_get_member_notes_text', { p_member_id: member_id })).catch(e => { console.warn('rpc_get_member_notes_text falló:', e.message); return { data: '' } })
      : Promise.resolve({ data: '' }),
    Promise.resolve(supabase.rpc('rpc_get_admin_preferences_text')).catch(e => { console.warn('rpc_get_admin_preferences_text falló:', e.message); return { data: '' } })
  ])
  return {
    memberNotes: memberNotesResult?.data || '',
    adminPreferences: adminPrefsResult?.data || ''
  }
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
        const muscles = musclesFromDayName(day.day_name)
        const candidates = muscles.flatMap(m => catalogByMuscle.get(m) || [])
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

// Si el admin pidió explícitamente un ejercicio concreto del catálogo en las
// notas/corrección (p.ej. "elevaciones frontales con disco"), nos aseguramos
// de que quede en la rutina final aunque el modelo no lo haya propuesto —
// sin esto, el resumen que le da la IA al admin podía "prometer" un ejercicio
// que el JSON final no llevaba realmente. Solo actúa sobre menciones
// inequívocas (todas las palabras del nombre del ejercicio, en el texto)
// para no forzar ejercicios que el admin no pidió de verdad.
function ensureRequestedExercises(routineJson, requestText, filteredCatalog) {
  const text = normalize(requestText)
  const added = []
  if (!text || !Array.isArray(routineJson.days) || routineJson.days.length === 0) return added

  for (const ex of filteredCatalog) {
    const exTokens = tokens(ex.name)
    if (exTokens.length < 2) continue
    if (!exTokens.every(t => text.includes(t))) continue

    const alreadyPresent = routineJson.days.some(d =>
      (d.exercises || []).some(e => normalize(e.exercise_name) === normalize(ex.name))
    )
    if (alreadyPresent) continue

    const targetDay = routineJson.days.find(d => dayMatchesMuscle(d.day_name, ex.muscle_primary))
    if (!targetDay) continue
    if (!Array.isArray(targetDay.exercises)) targetDay.exercises = []

    targetDay.exercises.push({
      exercise_name: ex.name,
      sets: ex.default_sets || 3,
      reps: String(ex.default_reps || '10-12'),
      rest_seconds: ex.default_rest_seconds || 60,
      superset_group: 0,
      notes: null
    })
    added.push({ exercise: ex.name, day: targetDay.day_name })
  }
  return added
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
  let trainingContext = { previousRoutine: null, prs: null, adherence: null, setLogs: null, activity: null }

  if (member_id) {
    // OJO: 'age' e 'injuries' NO son columnas de profiles — pedirlas hacía
    // que PostgREST fallara la consulta ENTERA en silencio (data: null), así
    // que memberProfile era siempre null: memberSex y memberAge nunca
    // llegaban a usarse de verdad. Esto rompía allowChest (siempre false →
    // "Pecho y Tríceps" nunca se generaba, ni para socios varones reales, y
    // los ejercicios marcados only_male quedaban excluidos siempre) y la
    // consideración de edad 55+ (nunca se aplicaba). Mismo bug que ya se
    // arregló en dietGeneration.js para el mismo motivo.
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('sex, name, birth_date, medical_conditions')
      .eq('id', member_id)
      .maybeSingle()
    memberSex = memberProfile?.sex || null
    memberName = memberProfile?.name || null
    memberAge = memberProfile?.birth_date
      ? Math.floor((Date.now() - new Date(memberProfile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null
    // Las condiciones médicas del perfil se suman a las del onboarding para
    // que el detector de lesiones tenga el máximo de contexto disponible.
    const profileConditions = [memberProfile?.medical_conditions]
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

  // Análisis visual de sus fotos de progreso más recientes: sin esto, un
  // punto débil visible (ej. gemelo poco desarrollado) solo se tenía en
  // cuenta si el admin lo escribía a mano — el sistema nunca "miraba" al
  // socio, solo leía texto.
  const physiqueAnalysis = member_id ? await getLatestPhysiqueAnalysis(supabase, member_id) : null

  const memory = await getAssistantMemory(supabase, member_id)

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
    `Restricciones / alergias: ${memberRestrictions || 'ninguna indicada'}`,
    memory.memberNotes ? `Notas guardadas sobre este socio (memoria del asistente, respétalas siempre):\n${memory.memberNotes}` : null
  ].filter(Boolean).join('\n') : 'Rutina genérica (sin socio asociado).'

  const adminPreferencesBlock = memory.adminPreferences
    ? `\n═══ CÓMO TRABAJA ESTE ADMIN (memoria del asistente, aplícalo siempre) ═══\n${memory.adminPreferences}\n`
    : ''

  // Bloque de HISTORIAL (solo si hay datos). Guía a la IA para progresar sobre
  // lo anterior, usar las cargas reales del socio y ajustar a su adherencia.
  const historyParts = []
  if (trainingContext.previousRoutine) {
    historyParts.push(`RUTINA ANTERIOR DEL SOCIO (NO la copies tal cual: introduce VARIACIÓN de ejercicios y, si procede, PROGRESIÓN respecto a esta):\n${trainingContext.previousRoutine}`)
  }
  if (trainingContext.prs) {
    historyParts.push(`PESOS/RÉCORDS RECIENTES DEL SOCIO (úsalos como referencia del nivel real de fuerza; menciona cargas orientativas coherentes con estos números cuando sea útil):\n${trainingContext.prs}`)
  }
  if (trainingContext.setLogs) {
    historyParts.push(`SERIES REALES REGISTRADAS POR EL SOCIO (última sesión de cada ejercicio, últimas 6 semanas — es la carga que mueve DE VERDAD, más fiable que un récord puntual):\n${trainingContext.setLogs}\nÚsalo para progresar de forma realista: si viene cumpliendo el rango alto de repeticiones con un peso, plantea subir carga; si se queda corto, mantén o baja. No propongas cargas desconectadas de estos números.`)
  }
  if (trainingContext.adherence) {
    historyParts.push(`ADHERENCIA: ${trainingContext.adherence} Ajusta el volumen a lo que realmente es capaz de cumplir: si entrena poco, prioriza ejercicios multiarticulares de alto rendimiento; si entrena mucho, puedes ampliar volumen y accesorios.`)
  }
  if (trainingContext.activity?.summary) {
    const act = trainingContext.activity
    // Los pasos son actividad FUERA del gimnasio (NEAT). Importan para decidir
    // cuánto cardio añadir y para no sumar fatiga a quien ya se mueve mucho.
    const activityParts = [`ACTIVIDAD DIARIA FUERA DEL GIMNASIO: ${act.summary}`]
    if (act.measuredActivity === 'sedentary' || act.measuredActivity === 'light') {
      activityParts.push('Se mueve poco en el día a día: te sobra margen para prescribir cardio de baja intensidad o trabajo de acondicionamiento sin comprometer la recuperación.')
    } else if (act.measuredActivity === 'very_active') {
      activityParts.push('Ya acumula mucha actividad diaria: NO añadas cardio extra ni volumen excesivo de piernas, o irá acumulando fatiga sin darse cuenta.')
    }
    if (act.trend === 'bajando') {
      activityParts.push('Además se está moviendo menos que hace dos semanas: puede indicar falta de tiempo o de motivación, así que mantén la rutina realista y fácil de cumplir.')
    }
    historyParts.push(activityParts.join(' '))
  }
  if (physiqueAnalysis) {
    historyParts.push(`ANÁLISIS VISUAL DE SUS FOTOS DE PROGRESO MÁS RECIENTES (esto es lo que se VE, úsalo para detectar puntos débiles o fuertes visibles y ajustar énfasis/volumen por grupo muscular en consecuencia — ej. si un grupo se ve visiblemente menos desarrollado que el resto, dale más presencia/series en la semana; si algo ya se ve muy trabajado, no sobrecargues más ese grupo):\n${physiqueAnalysis}`)
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
${historyBlock}${adminPreferencesBlock}
${injuryRestrictionBlock}CATÁLOGO DE EJERCICIOS DISPONIBLES (escoge entre estos al diseñar; usa nombres lo más cercanos posible al catálogo):
${catalogLines}

Diseña exactamente ${days_per_week} días siguiendo el FORMATO DE TU RESPUESTA del system prompt (texto plano, NO JSON).${rationaleInstruction}`

  const openai = new OpenAI({ apiKey })

  // PASS 1 — Razonamiento: el modelo planea la rutina en lenguaje natural
  const planningResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildPlanningPrompt(allowChest) },
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

  // Red de seguridad: si a pesar de las reglas 1 y 6 del prompt el modelo
  // tituló algún día "Pecho..." para una socia (u "otro"), lo renombramos —
  // ya no debería llevar ejercicios de pecho (regla 6), así que dejar el
  // nombre tal cual sería engañoso.
  if (!allowChest) {
    for (const day of routineJson.days) {
      if (/pecho/i.test(day.day_name || '')) {
        day.day_name = day.day_name.replace(/pecho/gi, 'Hombro')
      }
    }
  }

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

  // Si el admin pidió un ejercicio concreto en las notas (p.ej. "elevaciones
  // frontales con disco") y el modelo no lo incluyó, lo añadimos ahora — así
  // el JSON final siempre coincide con lo que se le prometió al admin.
  const forcedExercises = ensureRequestedExercises(routineJson, notes, filteredCatalog)

  if (replaced.length > 0) {
    Sentry.captureMessage('generate-routine: ejercicios fuera de catálogo reemplazados', {
      level: 'warning',
      extra: { replaced, member_id, trainer_id, injuries: [...injuries] }
    })
  }
  if (forcedExercises.length > 0) {
    Sentry.captureMessage('generate-routine: ejercicios pedidos explícitamente añadidos', {
      level: 'info',
      extra: { forcedExercises, member_id, trainer_id }
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
    physique_analysis: physiqueAnalysis || null,
    member_meta: {
      sex: memberSex,
      name: memberName,
      age: memberAge,
      onboarding_goal: memberGoal,
      conditions: memberConditions,
      dislikes: memberDislikes,
      restrictions: memberRestrictions,
      has_history: Boolean(trainingContext.previousRoutine || trainingContext.prs || trainingContext.adherence || trainingContext.setLogs),
      avg_steps: trainingContext.activity?.avgSteps ?? null
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

  const physiqueAnalysis = member_id ? await getLatestPhysiqueAnalysis(supabase, member_id) : null

  const memory = await getAssistantMemory(supabase, member_id)
  const memoryBlock = [
    memory.memberNotes ? `NOTAS GUARDADAS SOBRE ESTE SOCIO (memoria del asistente, respétalas siempre):\n${memory.memberNotes}` : null,
    memory.adminPreferences ? `CÓMO TRABAJA ESTE ADMIN (memoria del asistente, aplícalo siempre):\n${memory.adminPreferences}` : null
  ].filter(Boolean).join('\n\n')

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
${memoryBlock ? `\n${memoryBlock}\n` : ''}${physiqueAnalysis ? `\nANÁLISIS VISUAL DE SUS FOTOS DE PROGRESO MÁS RECIENTES (ten esto en cuenta si la corrección tiene que ver con énfasis/volumen de algún grupo muscular):\n${physiqueAnalysis}\n` : ''}
CATÁLOGO DE EJERCICIOS DISPONIBLES (usa SOLO estos nombres, exactos):
${catalogLines}

INSTRUCCIONES:
1. Aplica ÚNICAMENTE la corrección indicada. Conserva el resto de la rutina EXACTAMENTE igual (mismos días, mismo orden, mismos sets/reps/descansos salvo que la corrección los afecte).
2. NO ELIMINES NI SUSTITUYAS ejercicios existentes alegando que son "redundantes" o "similares" al que añades/pides. Dos ejercicios parecidos por nombre entrenan ángulos o músculos distintos (ej: elevaciones laterales ≠ elevaciones frontales; abducción de cadera en máquina ≠ hip thrust/sentadilla búlgara) y deben coexistir. Solo quita un ejercicio si la corrección lo pide EXPLÍCITAMENTE.
3. Usa nombres de ejercicio EXACTOS del catálogo.
4. Responde ÚNICAMENTE con el JSON completo de la rutina corregida, mismo formato que la rutina actual (routine_name, routine_description, days[].day_number/day_name/exercises[].exercise_name/sets/reps/rest_seconds/superset_group/notes). Sin texto adicional, sin markdown.`

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

  // Misma red de seguridad que en generateRoutineForMember: un día no debe
  // quedar titulado "Pecho..." para una socia si ya no lleva ejercicios de
  // pecho (regla 6 del prompt de planificación).
  if (!allowChest) {
    for (const day of routineJson.days) {
      if (/pecho/i.test(day.day_name || '')) {
        day.day_name = day.day_name.replace(/pecho/gi, 'Hombro')
      }
    }
  }

  // Igual que en generateRoutineForMember: si la corrección pide un ejercicio
  // concreto del catálogo y el modelo no lo incluyó, lo añadimos.
  ensureRequestedExercises(routineJson, correction, filteredCatalog)

  // Resumen breve, en primera persona, de qué se cambió y por qué — para que
  // el admin lo lea de un vistazo tras pedir el ajuste, sin releer toda la rutina.
  let changeSummary = ''
  try {
    const summaryPrompt = `Acabas de aplicar una corrección a la rutina de un socio, pedida por su entrenador.

PETICIÓN DEL ENTRENADOR: "${correction}"
RUTINA ANTES (JSON): ${JSON.stringify(currentRoutine)}
RUTINA DESPUÉS (JSON): ${JSON.stringify(routineJson)}

Devuelve 2-5 bullets muy breves, en primera persona (uso interno para el entrenador, el socio nunca los ve), explicando qué cambiaste exactamente y cómo responde a su petición. Empieza cada uno con "• ". Sin título ni despedida.`
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: summaryPrompt }],
      max_tokens: 300,
      temperature: 0.4,
    })
    changeSummary = summaryResponse.choices[0]?.message?.content?.trim() || ''
  } catch (e) {
    console.warn('refineRoutineDraft changeSummary error:', e.message)
  }

  return { routine: routineJson, changeSummary, physique_analysis: physiqueAnalysis || null }
}
