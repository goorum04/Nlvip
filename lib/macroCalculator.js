// Calculadora unificada de macros.
// Fórmula del generador de dietas (la "buena"): TDEE = weight × 24 × actMult,
// % grasa estimado por Deurenberg (BMI), proteína 2.2 g/kg (2.4 si bulk),
// grasa 0.9 g/kg, déficit/superávit basado en % grasa para cut.
// Esta misma utilidad la usan la calculadora del Trainer/Admin y el endpoint
// app/api/diet-onboarding/generate-draft → así no pueden divergir.

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.3,
  light: 1.4,
  moderate: 1.5,
  active: 1.6,
  very_active: 1.7,
}

// Devuelve { calories, protein_g, carbs_g, fat_g, tdee, bfPercent } redondeados.
// Devuelve null si faltan datos numéricos válidos.
export function calculateMacros({ weight, height, age, sex, activity = 'moderate', goal = 'maintain' }) {
  const w = parseFloat(weight)
  const h = parseFloat(height)
  const a = parseInt(age)

  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(a) || w <= 0 || h <= 0 || a <= 0) {
    return null
  }

  const isMale = sex !== 'female' && sex !== 'mujer' && sex !== 'F' && sex !== 'f'

  // % grasa estimado (Deurenberg vía BMI). Acotado [5, 55].
  const height_m = h / 100
  const bmi = w / (height_m * height_m)
  const bfPercent = Math.max(5, Math.min(55,
    (1.20 * bmi) + (0.23 * a) - (isMale ? 16.2 : 5.4)
  ))

  const isFatLoss = goal === 'cut' || goal === 'fat_loss' || goal === 'perder_grasa'
  const isBulk = goal === 'bulk' || goal === 'muscle_gain' || goal === 'ganar_masa'

  // Proteína: 2.4 g/kg si bulk, 2.2 g/kg en el resto.
  const proteinFactor = isBulk ? 2.4 : 2.2
  const protein_g = Math.round(w * proteinFactor)

  // Grasa: 0.9 g/kg de peso total.
  const fat_g = Math.round(w * 0.9)

  // TDEE: weight × 24 × multiplicador de actividad.
  const actMult = ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS.moderate
  const tdee = Math.round(w * 24 * actMult)

  // Déficit/superávit: para cut, más agresivo a mayor % grasa.
  let calMult = 1.0
  if (isFatLoss) {
    if (bfPercent > 30) calMult = 0.78
    else if (bfPercent > 22) calMult = 0.82
    else calMult = 0.85
  } else if (isBulk) {
    calMult = 1.15
  }
  const calories = Math.round(tdee * calMult)

  // Carbohidratos por diferencia, mínimo 80g por seguridad.
  const carbs_g = Math.max(80, Math.round((calories - protein_g * 4 - fat_g * 9) / 4))

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    tdee,
    bfPercent: Math.round(bfPercent * 10) / 10,
  }
}

// Mapea el "objetivo" del onboarding al goal de la calculadora.
export function goalFromOnboarding(objetivo) {
  if (objetivo === 'perder_grasa' || objetivo === 'cut' || objetivo === 'fat_loss') return 'cut'
  if (objetivo === 'ganar_masa' || objetivo === 'bulk' || objetivo === 'muscle_gain') return 'bulk'
  return 'maintain'
}

// Mapea la "intensidad de trabajo" del onboarding (proxy de actividad diaria)
// al nivel de actividad de la calculadora.
export function activityFromWorkIntensity(intensity) {
  switch (intensity) {
    case 'sedentaria':
    case 'sedentary':
      return 'sedentary'
    case 'leve':
    case 'light':
      return 'light'
    case 'normal':
    case 'moderate':
      return 'moderate'
    case 'moderada':
    case 'active':
    case 'alta':
      return 'active'
    case 'muy_alta':
    case 'very_active':
      return 'very_active'
    default:
      return 'moderate'
  }
}
