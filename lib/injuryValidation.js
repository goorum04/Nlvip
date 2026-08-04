// Shared injury detection used by /api/generate-routine and /api/save-routine.
// Keep these tables in one place so prompt warnings, post-hoc generation
// substitution, and save-time guard rails stay consistent.

// Palabras que indican que el body part mencionado es un problema/lesión,
// no solo un grupo muscular que se está entrenando con normalidad (ej. las
// "notes" que describen la estructura de una rutina dicen cosas como "día 1
// hombro y tríceps" constantemente — eso NO es una lesión). Body parts
// mencionados en el vacío (sin ninguna de estas palabras cerca) ya NO
// cuentan como lesión: antes "hombro" solo, en cualquier contexto, bastaba
// para bloquear ejercicios de pecho/hombro sin que hubiera lesión real.
const INJURY_CONTEXT = '(?:lesi[óo]n(?:ad[oa])?|dolor(?:oso|osa)?|duele|molest(?:ia|o|a)|sensible|inflamaci[óo]n|inflamad[oa]|operad[oa]|cirug[íi]a|recuper[áa]ndose|rehabilitaci[óo]n|desgarr[oa]|rotur[a]|esguince|contractur[a]|problema|limitaci[óo]n|cuidado con|evitar|no puede|contraindicad[oa]|pinzamiento)'

// Términos médicos específicos que ya implican lesión por sí solos (nadie
// dice "menisco" o "túnel carpiano" hablando de un día de entrenamiento
// normal), así que estos SÍ disparan detección sin necesitar INJURY_CONTEXT
// al lado.
const SPECIFIC_CONDITION_TERMS = {
  shoulder: 'manguito|rotador(?:es)?|acromion|subacromial|luxaci[óo]n.{0,15}hombro|bursitis.{0,15}hombro|tendinitis.{0,15}hombro',
  knee: 'menisco|meniscos|rotul(?:a|iano|iana)|patelar|lca|lcm|ligamento.{0,20}rodilla|condromalacia',
  lumbar: 'lumbago|hernia(?:.{0,20}disc)?|discopat[íi]a|protrusi[óo]n|ci[áa]tic[ao]',
  elbow: 'epicondil(?:itis|algia)|epitr[óo]clea|codo.{0,10}(?:tenista|golfista)|tendinitis.{0,15}codo',
  wrist: 't[úu]nel carpiano|tendinitis.{0,15}mu[ñn]eca|esguince.{0,15}mu[ñn]eca'
}

// Nombres genéricos del grupo/zona — SOLO cuentan como lesión si
// INJURY_CONTEXT aparece cerca (antes o después) en el mismo texto.
const BODY_PART_TERMS = {
  shoulder: 'hombro|hombros|shoulder|shoulders',
  knee: 'rodilla|rodillas|knee|knees',
  lumbar: 'lumbar|lumbares|espalda baja|sacro|lower back',
  elbow: 'codo|codos|elbow|elbows',
  wrist: 'mu[ñn]eca|mu[ñn]ecas|wrist|wrists|carpo'
}

const buildInjuryPattern = (zone) => {
  const specific = SPECIFIC_CONDITION_TERMS[zone]
  const bodyPart = BODY_PART_TERMS[zone]
  const contextNear = `(?:${INJURY_CONTEXT}.{0,25}(?:${bodyPart})|(?:${bodyPart}).{0,25}${INJURY_CONTEXT})`
  return new RegExp(`\\b(?:${specific})\\b|${contextNear}`, 'i')
}

export const INJURY_PATTERNS = {
  shoulder: buildInjuryPattern('shoulder'),
  knee: buildInjuryPattern('knee'),
  lumbar: buildInjuryPattern('lumbar'),
  elbow: buildInjuryPattern('elbow'),
  wrist: buildInjuryPattern('wrist')
}

export const INJURY_BLOCKED_MUSCLES = {
  shoulder: ['pecho', 'hombros'],
  knee: ['cuádriceps', 'femoral'],
  lumbar: ['lumbares', 'femoral'],
  elbow: ['tríceps', 'bíceps'],
  wrist: []
}

export const INJURY_SAFE_FALLBACK = {
  shoulder: ['espalda', 'bíceps', 'tríceps', 'abdomen', 'gemelos'],
  knee: ['espalda', 'pecho', 'hombros', 'bíceps', 'tríceps', 'abdomen', 'glúteo'],
  lumbar: ['pecho', 'hombros', 'bíceps', 'tríceps', 'cuádriceps', 'abdomen', 'gemelos'],
  elbow: ['espalda', 'pecho', 'hombros', 'cuádriceps', 'femoral', 'glúteo', 'abdomen', 'gemelos'],
  wrist: ['cuádriceps', 'femoral', 'glúteo', 'gemelos', 'abdomen']
}

export const INJURY_LABELS_ES = {
  shoulder: 'hombro',
  knee: 'rodilla',
  lumbar: 'zona lumbar',
  elbow: 'codo',
  wrist: 'muñeca'
}

export function detectInjuries(...sources) {
  const text = sources.filter(Boolean).join(' ')
  if (!text.trim()) return new Set()
  const found = new Set()
  for (const [zone, regex] of Object.entries(INJURY_PATTERNS)) {
    if (regex.test(text)) found.add(zone)
  }
  return found
}

export function getBlockedMuscles(injuries) {
  const blocked = new Set()
  for (const zone of injuries) {
    for (const m of (INJURY_BLOCKED_MUSCLES[zone] || [])) blocked.add(m)
  }
  return blocked
}

export function describeInjuries(injuries) {
  return [...injuries].map(z => INJURY_LABELS_ES[z] || z).join(' y ')
}
