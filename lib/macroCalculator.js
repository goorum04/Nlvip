// Calculadora unificada de macros.
// BMR: Mifflin-St Jeor (usa peso, altura, edad y sexo).
// TDEE = BMR × multiplicador de actividad (Harris estándar).
// % grasa estimado por Deurenberg (BMI), proteína 2.4 g/kg (2.6 si bulk),
// grasa 0.9 g/kg, déficit/superávit basado en % grasa para cut.
// Esta misma utilidad la usan la calculadora del Trainer/Admin y el endpoint
// app/api/diet-onboarding/generate-draft → así no pueden divergir.

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

// Devuelve { calories, protein_g, carbs_g, fat_g, tdee, bfPercent } redondeados.
// Devuelve null si faltan datos numéricos válidos.
// calorieOverride: si se pasa (ej. el admin pidió una cifra concreta/aproximada
// de calorías vía chat), sustituye el cálculo TDEE×factor pero NO afecta a
// proteína/grasa (siguen fijadas por peso/LBM); los carbohidratos absorben la
// diferencia, igual que en el resto de ajustes de esta calculadora.
export function calculateMacros({ weight, height, age, sex, activity = 'moderate', goal = 'maintain', calorieOverride = null }) {
  const w = parseFloat(weight)
  const h = parseFloat(height)
  const a = parseInt(age)

  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(a) || w <= 0 || h <= 0 || a <= 0) {
    return null
  }

  const isMale = sex !== 'female' && sex !== 'mujer' && sex !== 'F' && sex !== 'f' && sex !== 'woman' && sex !== 'femenino'

  // % grasa estimado (Deurenberg vía BMI). Acotado [5, 55].
  const height_m = h / 100
  const bmi = w / (height_m * height_m)
  const bfPercent = Math.max(5, Math.min(55,
    (1.20 * bmi) + (0.23 * a) - (isMale ? 16.2 : 5.4)
  ))

  // Masa Magra (LBM) en kg
  const lbm = w * (1 - bfPercent / 100)

  // Umbral de grasa corporal elevada (Hombres > 22%, Mujeres > 30%)
  const isHighBF = isMale ? (bfPercent > 22) : (bfPercent > 30)

  const isFatLoss = goal === 'cut' || goal === 'fat_loss' || goal === 'perder_grasa'
  const isBulk = goal === 'bulk' || goal === 'muscle_gain' || goal === 'ganar_masa'

  // Proteína: 
  // Grasa corporal normal: 2.4 g/kg peso total (2.6 en bulk)
  // Grasa elevada: 2.2 g/kg de LBM (2.4 de LBM en bulk), evitando sobreprescribir por masa grasa
  const proteinFactor = isBulk ? (isHighBF ? 2.4 : 2.6) : (isHighBF ? 2.2 : 2.4)
  const protein_g = Math.round(isHighBF ? lbm * proteinFactor : w * proteinFactor)

  // Grasa: 0.9 g/kg peso total para BF normal; 0.9 g/kg de LBM (mínimo 0.55 g/kg de peso total) para BF alta
  const fat_g = Math.round(
    isHighBF 
      ? Math.max(lbm * 0.9, w * 0.55) 
      : w * 0.9
  )

  // BMR: Katch-McArdle si BF alta (basado en LBM), Mifflin-St Jeor si BF normal
  const bmr = isHighBF
    ? (370 + (21.6 * lbm))
    : (isMale ? (10 * w) + (6.25 * h) - (5 * a) + 5 : (10 * w) + (6.25 * h) - (5 * a) - 161)

  // TDEE = BMR × multiplicador de actividad
  const actMult = ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS.moderate
  const tdee = Math.round(bmr * actMult)

  // Déficit/superávit: para cut, déficit más adecuado a mayor % grasa.
  let calMult = 1.0
  if (isFatLoss) {
    if (bfPercent > 30) calMult = 0.75
    else if (bfPercent > 22) calMult = 0.80
    else calMult = 0.85
  } else if (isBulk) {
    calMult = 1.15
  }
  const formulaCalories = Math.round(tdee * calMult)
  const overrideNum = Number(calorieOverride)
  const calories = (Number.isFinite(overrideNum) && overrideNum > 0) ? Math.round(overrideNum) : formulaCalories

  // Carbohidratos por diferencia, mínimo 100g por seguridad y saciedad.
  const carbs_g = Math.max(100, Math.round((calories - protein_g * 4 - fat_g * 9) / 4))

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    tdee,
    bfPercent: Math.round(bfPercent * 10) / 10,
    lbm: Math.round(lbm * 10) / 10,
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
