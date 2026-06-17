// Shared injury detection used by /api/generate-routine and /api/save-routine.
// Keep these tables in one place so prompt warnings, post-hoc generation
// substitution, and save-time guard rails stay consistent.

export const INJURY_PATTERNS = {
  shoulder: /\b(hombro|hombros|shoulder|shoulders|manguito|rotador|rotadores|acromion|subacromial|deltoid(?:e|es)?|luxaci[óo]n.{0,15}hombro|bursitis.{0,15}hombro|tendinitis.{0,15}hombro)\b/i,
  knee: /\b(rodilla|rodillas|knee|knees|menisco|meniscos|rotul(?:a|iano|iana)|patelar|lca|lcm|ligamento.{0,20}rodilla|condromalacia)\b/i,
  lumbar: /\b(lumbar|lumbares|lumbago|espalda baja|hernia(?:.{0,20}disc)?|discopat[íi]a|protrusi[óo]n|ci[áa]tic[ao]|sacro|lower back)\b/i,
  elbow: /\b(codo|codos|elbow|elbows|epicondil(?:itis|algia)?|epitr[óo]clea|codo.{0,10}(tenista|golfista)|tendinitis.{0,15}codo)\b/i,
  wrist: /\b(mu[ñn]eca|mu[ñn]ecas|wrist|wrists|carpo|t[úu]nel carpiano|tendinitis.{0,15}mu[ñn]eca|esguince.{0,15}mu[ñn]eca)\b/i
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
