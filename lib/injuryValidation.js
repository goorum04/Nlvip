// Shared injury detection used by /api/generate-routine and /api/save-routine.
// Keep these tables in one place so prompt warnings, post-hoc generation
// substitution, and save-time guard rails stay consistent.

export const INJURY_PATTERNS = {
  shoulder: /\b(hombro|hombros|shoulder|shoulders|manguito|rotador|rotadores|acromion|deltoid(?:e|es)?)\b/i,
  knee: /\b(rodilla|rodillas|knee|knees|menisco|meniscos|ligamento.{0,20}rodilla)\b/i,
  lumbar: /\b(lumbar|lumbares|espalda baja|hernia(?:.{0,20}disc)?|ci[áa]tica|lower back)\b/i,
  elbow: /\b(codo|codos|elbow|elbows|epicondil(?:itis|algia)?|tendinitis.{0,15}codo)\b/i,
  wrist: /\b(mu[ñn]eca|mu[ñn]ecas|wrist|wrists|carpo|t[úu]nel carpiano)\b/i
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
