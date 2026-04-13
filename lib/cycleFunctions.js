/**
 * =============================================================================
 * FUNCIONES DE CICLO MENSTRUAL - Recomendaciones de entrenamiento y nutrición
 * =============================================================================
 * Funciones orientativas de bienestar y fitness. No constituyen consejo médico.
 * =============================================================================
 */

/**
 * Obtiene la fase actual del ciclo menstrual
 * @param {string|Date} cycleStartDate - Fecha de inicio de la última menstruación
 * @param {number} cycleLength - Duración del ciclo (default: 28)
 * @param {number} periodLength - Duración del periodo (default: 5)
 * @returns {{ phase: string, cycleDay: number, daysUntilPeriod: number }}
 */
export function getCyclePhase(cycleStartDate, cycleLength = 28, periodLength = 5) {
  if (!cycleStartDate) {
    return { phase: 'unknown', cycleDay: 0, daysUntilPeriod: 0 }
  }

  const start = new Date(cycleStartDate)
  const today = new Date()

  // Normalizar a medianoche para comparación precisa
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { phase: 'unknown', cycleDay: 0, daysUntilPeriod: periodLength - diffDays }
  }

  const cycleDay = (diffDays % cycleLength) + 1
  const daysUntilPeriod = cycleLength - cycleDay + 1

  let phase
  if (cycleDay <= periodLength) {
    phase = 'menstrual'
  } else if (cycleDay <= 13) {
    phase = 'follicular'
  } else if (cycleDay <= 16) {
    phase = 'ovulation'
  } else {
    phase = 'luteal'
  }

  const THEME_MAP = {
    menstrual: 'menstrual',
    follicular: 'follicular',
    ovulation: 'ovulation',
    luteal: 'luteal'
  }

  return { phase, cycleDay, daysUntilPeriod, theme: THEME_MAP[phase] || 'default' }
}

/**
 * Estima calorías quemadas por pasos
 * @param {number} steps - Número de pasos
 * @param {number} weightKg - Peso en kg
 * @returns {number} Calorías estimadas
 */
export function estimateCaloriesFromSteps(steps, weightKg = 70) {
  const baseCaloriesPerStep = 0.04
  const weightMultiplier = weightKg / 70
  return Math.round(steps * baseCaloriesPerStep * weightMultiplier)
}

/**
 * Obtiene el ajuste calórico según los pasos diarios
 * @param {number} steps - Número de pasos
 * @returns {number} Ajuste en kcal
 */
export function getStepsAdjustment(steps) {
  if (steps < 5000) return 0
  if (steps < 10000) return 100
  if (steps < 15000) return 200
  return 300
}

/**
 * Calcula las calorías base orientativas
 * @param {number} weightKg - Peso en kg
 * @param {number} steps - Pasos del día
 * @returns {number} Calorías base
 */
export function calculateBaseCalories(weightKg, steps = 0) {
  if (!weightKg) return 2000

  const baseCalories = weightKg * 30
  const stepsAdjustment = getStepsAdjustment(steps)

  return Math.round(baseCalories + stepsAdjustment)
}

/**
 * Obtiene el ajuste calórico según la fase del ciclo
 * @param {string} phase - Fase del ciclo
 * @returns {{ calories: number, description: string }}
 */
export function getPhaseCalorieAdjustment(phase) {
  const adjustments = {
    menstrual: { calories: 0, description: 'Fase de descanso - mantener calorías de mantenimiento' },
    follicular: { calories: 50, description: 'Fase de energía creciente - buen momento para progresión' },
    ovulation: { calories: 100, description: 'Máximo rendimiento - mayor tolerancia al esfuerzo' },
    luteal: { calories: 125, description: 'Fase variable - ajustar según energía individual' },
    unknown: { calories: 0, description: 'Configura tu ciclo para obtener recomendaciones personalizadas' }
  }

  return adjustments[phase] || adjustments.unknown
}

/**
 * Calcula las calorías totales orientativas
 * @param {number} weightKg - Peso en kg
 * @param {number} steps - Pasos del día
 * @param {string} phase - Fase del ciclo
 * @returns {number} Calorías totales recomendadas
 */
export function calculateTotalCalories(weightKg, steps, phase) {
  const baseCalories = calculateBaseCalories(weightKg, steps)
  const phaseAdjustment = getPhaseCalorieAdjustment(phase)

  return baseCalories + phaseAdjustment.calories
}

/**
 * Calcula las recomendaciones de macronutrientes
 * @param {number} weightKg - Peso en kg
 * @param {number} totalCalories - Calorías totales
 * @param {string} phase - Fase del ciclo
 * @returns {{ protein: number, fat: number, carbs: number }}
 */
export function calculateMacros(weightKg, totalCalories, phase) {
  if (!weightKg || !totalCalories) {
    return { protein: 0, fat: 0, carbs: 0 }
  }

  // Proteína: 1.8 - 2.2 g/kg
  let proteinMultiplier = 2.0
  if (phase === 'luteal') {
    proteinMultiplier = 2.2 // Más proteína para saciedad
  } else if (phase === 'menstrual') {
    proteinMultiplier = 2.0
  } else {
    proteinMultiplier = 1.9
  }
  const protein = Math.round(weightKg * proteinMultiplier)

  // Grasas: 0.8 - 1.0 g/kg
  let fatMultiplier = 0.9
  if (phase === 'luteal') {
    fatMultiplier = 1.0 // Más grasas para saciedad
  }
  const fat = Math.round(weightKg * fatMultiplier)

  // Carbohidratos: resto de calorías
  // Proteína = 4 kcal/g, Grasa = 9 kcal/g
  const proteinCalories = protein * 4
  const fatCalories = fat * 9
  const carbsCalories = totalCalories - proteinCalories - fatCalories
  const carbs = Math.round(Math.max(carbsCalories / 4, 50)) // Mínimo 50g

  return { protein, fat, carbs }
}

/**
 * Obtiene la recomendación de entrenamiento según la fase
 * @param {string} phase - Fase del ciclo
 * @returns {{ title: string, description: string, intensity: string, focus: string[] }}
 */
export function getWorkoutRecommendation(phase) {
  const recommendations = {
    menstrual: {
      title: 'Entrenamiento suave',
      description: 'ENERGÍA BAJA - Enfoque en movilidad, cardio ligero y recuperación.',
      intensity: 'baja',
      focus: ['Mobility', 'Yoga suave', 'Cardio ligero', 'Estiramientos'],
      tip: 'Es normal sentir menos energía. Prioriza el descanso y la hidratación.'
    },
    follicular: {
      title: 'Progresión de fuerza',
      description: 'ENERGÍA EN AUMENTO - Buen momento para aumentar intensidad y cargas.',
      intensity: 'media-alta',
      focus: ['Fuerza', 'HIIT moderado', 'Entrenamiento de potencia', 'Nuevos retos'],
      tip: 'Tu cuerpo tolera bien el esfuerzo. Es buen momento para progresar.'
    },
    ovulation: {
      title: 'Máximo rendimiento',
      description: 'MÁXIMA ENERGÍA - Ideal para sesiones intensas y entrenamientos de fuerza.',
      intensity: 'alta',
      focus: ['Fuerza máxima', 'HIIT', 'Entrenamiento de potencia', 'Rendimiento'],
      tip: 'Fase de mejor rendimiento. Aprovéchala para sesiones intensas.'
    },
    luteal: {
      title: 'Entrenamiento moderado',
      description: 'ENERGÍA VARIABLE - Ajusta según cómo te sientas cada día.',
      intensity: 'media',
      focus: ['Fuerza moderada', 'Cardio controlado', 'Ejercicio regular', 'Recuperación'],
      tip: 'Escucha a tu cuerpo. Si hay fatiga, reduce intensidad pero mantén actividad.'
    },
    unknown: {
      title: 'Configura tu ciclo',
      description: 'Activa el seguimiento para recibir recomendaciones personalizadas.',
      intensity: 'variable',
      focus: ['Entrenamiento general'],
      tip: 'Configura tu ciclo en tu perfil para obtener recomendaciones.'
    }
  }

  return recommendations[phase] || recommendations.unknown
}

/**
 * Obtiene los datos de color para cada fase (para UI)
 * @param {string} phase - Fase del ciclo
 * @returns {{ bg: string, accent: string, text: string, gradient: string }}
 */
export function getPhaseColors(phase) {
  const colors = {
    menstrual: {
      bg: 'bg-slate-50',
      accent: 'bg-slate-400',
      text: 'text-slate-600',
      gradient: 'from-slate-100 to-slate-200',
      icon: '🌙'
    },
    follicular: {
      bg: 'bg-emerald-50',
      accent: 'bg-emerald-400',
      text: 'text-emerald-600',
      gradient: 'from-emerald-100 to-cyan-100',
      icon: '🌸'
    },
    ovulation: {
      bg: 'bg-amber-50',
      accent: 'bg-amber-400',
      text: 'text-amber-600',
      gradient: 'from-amber-100 to-orange-100',
      icon: '✨'
    },
    luteal: {
      bg: 'bg-rose-50',
      accent: 'bg-rose-400',
      text: 'text-rose-600',
      gradient: 'from-rose-100 to-orange-100',
      icon: '🌙'
    },
    unknown: {
      bg: 'bg-gray-50',
      accent: 'bg-gray-400',
      text: 'text-gray-600',
      gradient: 'from-gray-100 to-gray-200',
      icon: '⚙️'
    }
  }

  return colors[phase] || colors.unknown
}

/**
 * Obtiene el nombre traducida de la fase
 * @param {string} phase - Fase del ciclo
 * @returns {string} Nombre en español
 */
export function getPhaseName(phase) {
  const names = {
    menstrual: 'Menstrual',
    follicular: 'Folicular',
    ovulation: 'Ovulación',
    luteal: 'Lútea',
    unknown: 'Sin configurar'
  }

  return names[phase] || 'Desconocida'
}

/**
 * Obtiene el nivel de energía estimado
 * @param {string} phase - Fase del ciclo
 * @returns {{ level: string, label: string, color: string }}
 */
export function getEnergyLevel(phase) {
  const levels = {
    menstrual: { level: 'baja', label: 'Energía baja', color: 'text-slate-500' },
    follicular: { level: 'creciente', label: 'Energía creciente', color: 'text-emerald-500' },
    ovulation: { level: 'alta', label: 'Máxima energía', color: 'text-amber-500' },
    luteal: { level: 'variable', label: 'Energía variable', color: 'text-rose-500' },
    unknown: { level: 'variable', label: 'Sin datos', color: 'text-gray-400' }
  }

  return levels[phase] || levels.unknown
}

/**
 * Calcula el ajuste calórico basado en los síntomas registrados hoy.
 * Ajustes pequeños y acumulativos, limitados a [-150, +100] kcal.
 * Si symptoms es null (no registrados hoy), devuelve delta 0 sin cambios.
 *
 * @param {{ energy_level?: number, mood?: string, pain_level?: number, extra_symptoms?: string[] }|null} symptoms
 * @returns {{ caloriesDelta: number, isActive: boolean }}
 */
export function getSymptomCalorieAdjustment(symptoms) {
  if (!symptoms) return { caloriesDelta: 0, isActive: false }

  let delta = 0

  // energy_level 1-5 (3 = neutral)
  const energy = symptoms.energy_level ?? 3
  if (energy === 1)      delta -= 75
  else if (energy === 2) delta -= 40
  else if (energy === 4) delta += 25
  else if (energy === 5) delta += 50

  // pain_level 0-5
  const pain = symptoms.pain_level ?? 0
  if (pain >= 4)      delta -= 50
  else if (pain >= 2) delta -= 25

  // mood
  const downMoods = ['sad', 'anxious', 'irritable', 'tired']
  if (symptoms.mood && downMoods.includes(symptoms.mood)) delta -= 25

  // extra_symptoms
  const extra = symptoms.extra_symptoms ?? []
  if (extra.includes('nausea'))   delta -= 50
  if (extra.includes('cravings')) delta += 25
  if (extra.includes('insomnia')) delta -= 25

  const caloriesDelta = Math.max(-150, Math.min(100, delta))
  return { caloriesDelta, isActive: caloriesDelta !== 0 }
}

/**
 * Versión de calculateMacros que incorpora ajustes por síntomas.
 * Si symptoms es null, el resultado es idéntico al de calculateMacros (sin regresión).
 *
 * @param {number} weightKg
 * @param {number} baseCalories - Calorías calculadas por fase (calculateTotalCalories)
 * @param {string} phase
 * @param {{ energy_level?, mood?, pain_level?, extra_symptoms? }|null} symptoms
 * @returns {{ protein: number, fat: number, carbs: number, adjustedCalories: number, isSymptomAdjusted: boolean }}
 */
export function calculateSymptomAdjustedMacros(weightKg, baseCalories, phase, symptoms) {
  const { caloriesDelta, isActive } = getSymptomCalorieAdjustment(symptoms)
  const adjustedCalories = baseCalories + caloriesDelta

  let { protein, fat, carbs } = calculateMacros(weightKg, adjustedCalories, phase)

  if (symptoms && isActive) {
    const extra = symptoms.extra_symptoms ?? []
    const energy = symptoms.energy_level ?? 3

    // Hinchazón: reducir carbos fermentables, compensar con grasa
    if (extra.includes('bloating')) {
      carbs = Math.max(50, carbs - 10)
      fat = Math.round(fat + 4)
    }

    // Náuseas: reducir proteína (más difícil de digerir)
    if (extra.includes('nausea')) {
      protein = Math.max(Math.round(weightKg * 1.6), protein - 5)
    }

    // Energía muy baja: +5g proteína para preservar músculo
    if (energy <= 2) protein = protein + 5

    // Recalcular carbos para mantener consistencia calórica
    const usedCalories = (protein * 4) + (fat * 9)
    carbs = Math.round(Math.max(50, (adjustedCalories - usedCalories) / 4))
  }

  return { protein, fat, carbs, adjustedCalories, isSymptomAdjusted: isActive && !!symptoms }
}
