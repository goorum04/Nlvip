// Generación de dietas SISTEMA NL ELITE — lógica compartida entre:
//   - app/api/diet-onboarding/generate-draft/route.js (onboarding del socio)
//   - lib/adminAssistantTools.js → generate_ai_diet_from_recipes (asistente admin)
//
// Garantiza que ambos caminos usan exactamente el mismo prompt maestro,
// la misma calculadora de macros y la misma plantilla de documento.

import OpenAI from 'openai'
import { calculateMacros, goalFromOnboarding, activityFromWorkIntensity } from './macroCalculator'
import { DIET_TEMPLATE } from './dietTemplate'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// Red de seguridad: elimina del texto de la dieta el checklist de verificación
// interna y cualquier cierre meta que el modelo pueda colar a pesar del prompt.
// Ese contenido es solo para el preparador; el socio nunca debe verlo.
export function stripInternalChecklist(text) {
  if (!text) return text
  const lines = text.split('\n')
  // Marcadores que indican el comienzo de contenido interno que no debe llegar al socio.
  const cutPattern = /(checklist\s+final|verificaci[oó]n\s+interna|¿est[aá]\s+perfectamente\s+cuadrada)/i
  const cutIdx = lines.findIndex(l => cutPattern.test(l))
  if (cutIdx === -1) return text.trim()
  // Cortamos desde la línea del marcador (incluyendo separadores ═ inmediatamente previos).
  let end = cutIdx
  while (end > 0 && /^[\s═─=*•·\-]*$/.test(lines[end - 1])) end--
  return lines.slice(0, end).join('\n').trim()
}

// Interpreta el estilo de vida del socio para guiar a la IA con instrucciones
// concretas (no solo etiquetas). Devuelve insights legibles + reglas accionables
// que se inyectan en el prompt para que la dieta se adapte de verdad al perfil.
export function buildLifestyleAnalysis({ intensidadTrabajo, trainTime, trainSchedule, workSchedule, mealSchedule, goal, sex, age, bfPercent }) {
  const insights = []
  const adjustments = []

  switch (intensidadTrabajo) {
    case 'sedentaria':
      insights.push('Estilo de vida SEDENTARIO (oficina, mucho tiempo sentado): el gasto fuera del entreno es bajo.')
      adjustments.push('Prioriza alta densidad proteica y verduras voluminosas para saciedad. Limita azúcares simples fuera del peri-entreno. Recomienda 30-45 min de cardio LISS (caminar a paso vivo, bici suave) 3-4 días/semana fuera del gimnasio.')
      break
    case 'leve':
      insights.push('Trabajo de actividad LEVE (de pie, poco movimiento): gasto extra-entreno modesto.')
      adjustments.push('Mantén proteína alta y carbohidratos modulados al horario de entreno. Sugiere 20-30 min de cardio 2-3 días/semana si el objetivo es perder grasa.')
      break
    case 'normal':
      insights.push('Trabajo con MOVIMIENTO CONSTANTE: gasto diario moderado.')
      adjustments.push('Distribución equilibrada de macros. No hace falta forzar cardio adicional salvo objetivo agresivo de pérdida de grasa.')
      break
    case 'moderada':
      insights.push('Trabajo FÍSICAMENTE EXIGENTE: gasto calórico diario elevado además del entreno.')
      adjustments.push('Sube ligeramente carbohidratos en comidas pre y post-jornada laboral. Vigila recuperación: hidratación, sodio, comidas con almidón antes de empezar la jornada. Cardio extra rara vez necesario.')
      break
    default:
      insights.push('Intensidad del trabajo no especificada: trato neutro.')
  }

  if (sex === 'mujer' || sex === 'female') {
    insights.push(`Socia mujer, ${age} años: cuida hierro (carne roja magra, espinacas), calcio y proteína distribuida en cada comida.`)
  } else {
    insights.push(`Socio hombre, ${age} años.`)
  }

  if (goal === 'perder_grasa' || goal === 'cut' || goal === 'fat_loss') {
    if (bfPercent > 25) {
      adjustments.push('Déficit moderado-agresivo (% grasa elevado). Insiste en saciedad: hoja verde, proteína magra, evita líquidos calóricos.')
    } else {
      adjustments.push('Déficit conservador (% grasa ya bajo). Protege masa magra: 2.2-2.4 g/kg de proteína distribuida cada 3-4 h.')
    }
  } else if (goal === 'ganar_masa' || goal === 'bulk' || goal === 'muscle_gain') {
    adjustments.push('Superávit limpio: prioriza carbohidratos complejos en torno al entreno (avena, arroz, patata, pan integral). Evita exceso de grasas saturadas.')
  } else {
    adjustments.push('Mantenimiento: equilibrio entre proteína, carbos y grasas saludables. Reajustar macros cada 4-6 semanas según evolución.')
  }

  if (trainTime === 'mañana' || trainTime === 'manana' || trainTime === 'morning') {
    adjustments.push('Entreno por la MAÑANA: desayuno potente con carbos rápidos + proteína 60-90 min antes; comida post-entreno con carbos + proteína dentro de los 60 min.')
  } else if (trainTime === 'tarde' || trainTime === 'afternoon') {
    adjustments.push('Entreno por la TARDE: comida principal 2-3 h antes con carbos complejos + proteína; merienda ligera 60 min antes; cena con proteína para recuperación.')
  } else if (trainTime === 'noche' || trainTime === 'evening' || trainTime === 'night') {
    adjustments.push('Entreno por la NOCHE: desplaza carbos hacia la merienda/post-entreno; cena post-entreno completa pero digerible (evita grasas pesadas justo antes de dormir).')
  }

  if (workSchedule) insights.push(`Horario laboral: ${workSchedule}.`)
  if (trainSchedule) insights.push(`Detalle horario entreno: ${trainSchedule}.`)
  if (mealSchedule) insights.push(`Hábitos/horarios de comida: ${mealSchedule}.`)

  return { insights, adjustments }
}

// Recoge historial nutricional del socio para contextualizar la generación:
// dieta anterior asignada, tendencia del peso y adherencia al entrenamiento.
// Cada consulta va envuelta en try/catch independiente para que un fallo parcial
// nunca bloquee la generación.
export async function gatherMemberDietContext(supabase, member_id) {
  const ctx = { previousDiet: null, weightTrend: null, adherence: null }
  if (!member_id) return ctx

  // 1. Dieta actualmente asignada (member_diets es UNIQUE por socio)
  try {
    const { data: assigned } = await supabase
      .from('member_diets')
      .select('assigned_at, diet_templates(name, calories, protein_g, carbs_g, fat_g)')
      .eq('member_id', member_id)
      .maybeSingle()
    const d = assigned?.diet_templates
    if (d) {
      const when = assigned.assigned_at
        ? new Date(assigned.assigned_at).toLocaleDateString('es-ES')
        : 'fecha desconocida'
      ctx.previousDiet =
        `Dieta actual asignada: "${d.name}" (${when}) — ${d.calories || '?'} kcal | P:${d.protein_g || '?'}g | HC:${d.carbs_g || '?'}g | G:${d.fat_g || '?'}g.`
    }
  } catch (e) {
    console.warn('gatherMemberDietContext previousDiet error:', e.message)
  }

  // 2. Tendencia del peso (últimas 8 semanas)
  try {
    const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: records } = await supabase
      .from('progress_records')
      .select('date, weight_kg')
      .eq('member_id', member_id)
      .gte('date', since)
      .not('weight_kg', 'is', null)
      .order('date', { ascending: true })
    if (Array.isArray(records) && records.length >= 2) {
      const first = records[0]
      const last = records[records.length - 1]
      const diff = (Number(last.weight_kg) - Number(first.weight_kg)).toFixed(1)
      const sign = Number(diff) > 0 ? '+' : ''
      ctx.weightTrend =
        `Peso inicial (${first.date}): ${first.weight_kg} kg → Peso actual (${last.date}): ${last.weight_kg} kg (${sign}${diff} kg, ${records.length} mediciones).`
    } else if (Array.isArray(records) && records.length === 1) {
      ctx.weightTrend = `Último peso registrado (${records[0].date}): ${records[0].weight_kg} kg.`
    }
  } catch (e) {
    console.warn('gatherMemberDietContext weightTrend error:', e.message)
  }

  // 3. Adherencia al entrenamiento (últimas 4 semanas)
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
    console.warn('gatherMemberDietContext adherence error:', e.message)
  }

  return ctx
}

// Genera una dieta completa usando el SISTEMA NL ELITE.
// Parámetros opcionales: si no se pasan, se obtienen del perfil del socio.
// Devuelve { fullDietContent, macros, mealsText, rationale, member_name, tipo_dieta, member_meta }.
export async function generateNLEliteDiet({
  supabase,
  memberId,
  // Medidas físicas (opcionales — se completan con el perfil si faltan)
  weight: weightParam,
  height: heightParam,
  waist = null,
  // Parámetros de dieta
  goal = 'maintain',
  numMeals = 5,
  restrictions: restrictionsParam = '',
  preferences = '',
  dislikes = '',
  favorites = '',
  // Estilo de vida
  intensidadTrabajo = '',
  trainTime = 'tarde',
  trainSchedule = '',
  workSchedule = '',
  mealSchedule = '',
  medConditions: medConditionsParam = '',
  // Instrucciones extra del preparador (ej: indicaciones del asistente admin)
  extraNotes = '',
}) {
  // 1. Perfil del socio + historial de dieta + formulario de onboarding + aversiones permanentes en paralelo
  const [{ data: profile }, dietContext, { data: onboarding }, aversionResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, email, weight_kg, height_cm, age, sex, goal, activity_level, allergies, injuries, medical_conditions')
      .eq('id', memberId)
      .single(),
    gatherMemberDietContext(supabase, memberId),
    supabase
      .from('diet_onboarding_requests')
      .select('responses')
      .eq('member_id', memberId)
      .in('status', ['submitted', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Aversiones permanentes de alimentos (tabla de memoria)
    Promise.resolve(supabase.rpc('rpc_get_food_aversions', { p_member_id: memberId })).catch(() => ({ data: '' }))
  ])
  // Respuestas del formulario de onboarding — se usan como fuente secundaria
  // cuando el llamador no pasa los valores explícitamente.
  const permanentAversions = aversionResult?.data || ''
  const formResponses = onboarding?.responses || {}

  const weight = (weightParam && isFinite(weightParam) && weightParam > 0)
    ? weightParam
    : (parseFloat(formResponses['Medida - Peso']) || profile?.weight_kg || 75)
  const height = (heightParam && isFinite(heightParam) && heightParam > 0)
    ? heightParam
    : (parseFloat(formResponses['Medida - Altura']) || profile?.height_cm || 170)
  const age = profile?.age || 30
  const sex = profile?.sex || 'hombre'

  const rawName = (profile?.name && profile.name.trim() !== '')
    ? profile.name.trim()
    : (profile?.email ? profile.email.split('@')[0] : 'Socio')
  const memberName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()

  // 2. Macros: TDEE = peso × 24 × actMult, proteína 2.4 g/kg (2.6 bulk), grasa 0.9 g/kg
  // Para cada parámetro: valor explícito del llamador > formulario de onboarding > perfil > default
  const resolvedGoal = goal || formResponses.objetivo || profile?.goal || 'maintain'
  const calculatorGoal = goalFromOnboarding(resolvedGoal)

  const resolvedIntensidad = intensidadTrabajo
    || formResponses['Trabajo - Intensidad']
    || formResponses.intensidad_trabajo
    || ''

  // Actividad: parámetro explícito > formulario > activity_level del perfil
  let calculatorActivity = 'moderate'
  if (resolvedIntensidad) {
    calculatorActivity = activityFromWorkIntensity(resolvedIntensidad)
  } else if (profile?.activity_level) {
    calculatorActivity = activityFromWorkIntensity(profile.activity_level)
  }

  const computed = calculateMacros({
    weight, height, age, sex,
    activity: calculatorActivity,
    goal: calculatorGoal,
  }) || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, tdee: 0, bfPercent: 0 }
  const { calories, protein_g, fat_g, carbs_g, tdee, bfPercent } = computed
  const macros = { calories, protein_g, carbs_g, fat_g }
  const leanMass = weight * (1 - bfPercent / 100)

  // Fusionar restricciones y condiciones: parámetro > formulario > perfil + AVERSIONES PERMANENTES
  const profileAllergies = profile?.allergies || ''
  const profileMedical = profile?.medical_conditions || ''
  const formRestrictions = formResponses.restricciones || ''
  const formMedical = formResponses.condicion_medica || ''
  // Las aversiones permanentes SIEMPRE se incluyen (memoria acumulativa)
  const restrictions = [restrictionsParam, formRestrictions, profileAllergies, permanentAversions].filter(Boolean).join(', ') || 'ninguna'
  const medConditions = [medConditionsParam, formMedical, profileMedical].filter(Boolean).join('; ') || 'ninguna'
  const injuries = profile?.injuries || 'ninguna'

  // Resto de parámetros: llamador > formulario > defaults
  const resolvedNumMeals = numMeals
    || parseInt(formResponses.num_comidas || formResponses['Comidas - Número'])
    || 5
  const resolvedPreferences = preferences || formResponses.preferencias || ''
  const resolvedDislikes = dislikes || formResponses.no_me_gusta || ''
  const resolvedFavorites = favorites || formResponses.favoritos || ''
  const resolvedTrainTime = trainTime !== 'tarde'
    ? trainTime
    : (formResponses.horario_entreno || formResponses['Entreno - Momento'] || 'tarde')
  const resolvedTrainSchedule = trainSchedule || formResponses['Entreno - Horario Detalle'] || ''
  const resolvedWorkSchedule = workSchedule || formResponses['Trabajo - Horario'] || ''
  const resolvedMealSchedule = mealSchedule || formResponses['Comidas - Horario'] || ''
  const resolvedWaist = waist ?? (parseFloat(formResponses['Medida - Cintura']) || null)

  // 3. Análisis de estilo de vida → reglas concretas para la IA
  const { insights, adjustments } = buildLifestyleAnalysis({
    intensidadTrabajo: resolvedIntensidad,
    trainTime: resolvedTrainTime,
    trainSchedule: resolvedTrainSchedule,
    workSchedule: resolvedWorkSchedule,
    mealSchedule: resolvedMealSchedule,
    goal: resolvedGoal,
    sex,
    age,
    bfPercent,
  })
  const intensidadLabel = resolvedIntensidad || 'no especificada'

  // 4. Bloque de historial del socio
  const historyParts = []
  if (dietContext.previousDiet) {
    historyParts.push(`• Dieta anterior: ${dietContext.previousDiet}`)
    historyParts.push(`  → Introduce variedad respecto a esa dieta: nuevas fuentes de proteína, hidratos y grasas para evitar monotonía. Mantén el mismo nivel calórico y proteico salvo que la tendencia del peso indique ajuste.`)
  }
  if (dietContext.weightTrend) {
    historyParts.push(`• Evolución del peso: ${dietContext.weightTrend}`)
    const isGaining = dietContext.weightTrend.includes('+') && !dietContext.weightTrend.includes('-0') && !dietContext.weightTrend.includes('+0')
    const isLosing = dietContext.weightTrend.match(/\(-[\d]/)
    if ((goal === 'perder_grasa' || goal === 'cut' || goal === 'fat_loss') && isGaining) {
      historyParts.push(`  → El socio está GANANDO peso con objetivo de definición: considera distribuir hidratos más estrictamente al peri-entreno y revisar el déficit.`)
    } else if ((goal === 'ganar_masa' || goal === 'bulk' || goal === 'muscle_gain') && isLosing) {
      historyParts.push(`  → El socio está PERDIENDO peso con objetivo de volumen: incrementa carbohidratos complejos, especialmente post-entreno y en la comida principal.`)
    } else {
      historyParts.push(`  → Evolución coherente con el objetivo. Mantén la estructura.`)
    }
  }
  if (dietContext.adherence) {
    historyParts.push(`• Adherencia al entrenamiento: ${dietContext.adherence}`)
    const sessionsPerWeek = parseFloat(dietContext.adherence.match(/~([\d.]+)/)?.[1] || '0')
    if (sessionsPerWeek < 2) {
      historyParts.push(`  → Adherencia BAJA: prioriza comidas sencillas y rápidas de preparar. Reduce la complejidad culinaria para facilitar el cumplimiento.`)
    } else if (sessionsPerWeek >= 4) {
      historyParts.push(`  → Adherencia ALTA: el socio entrena con consistencia. Puedes añadir peri-entreno preciso (pre + post) y timing más detallado.`)
    }
  }
  const historyBlock = historyParts.length > 0
    ? `\n═══════════════════════════════════════\nHISTORIAL DEL SOCIO (usa esto para personalizar y progresar)\n═══════════════════════════════════════\n${historyParts.join('\n')}\n`
    : ''

  // Bloque de instrucciones adicionales del preparador (p.ej. del asistente admin)
  const extraBlock = extraNotes
    ? `\n═══════════════════════════════════════\nINSTRUCCIONES ADICIONALES DEL PREPARADOR\n═══════════════════════════════════════\n${extraNotes}\n`
    : ''

  // 5. Prompt SISTEMA NL ELITE — PROMPT MAESTRO DEFINITIVO ABSOLUTO
  const prompt = `SISTEMA NL ELITE — PROM MAESTRO DEFINITIVO ABSOLUTO
Método quirúrgico de preparación física, nutrición y recomposición corporal de alto nivel.

Usa este sistema SIEMPRE al crear: dietas, ajustes nutricionales, protocolos alimentarios, fases de definición, volumen limpio, recomposición corporal, suplementación, estrategias de adherencia, planificación de atletas, protocolos para clientes generales.

IDENTIDAD DEL SISTEMA NL
Eres un preparador élite especializado en: recomposición corporal, pérdida de grasa, mejora estética, ganancia muscular limpia, adherencia extrema, optimización digestiva, nutrición sostenible, mejora hormonal, personalización absoluta, alto rendimiento físico y visual.

Tu trabajo NO es hacer "dietas fitness". Tu trabajo es: construir estructuras sostenibles, maximizar adherencia, minimizar estrés mental, facilitar cumplimiento, mejorar salud digestiva, mantener o aumentar masa muscular, minimizar grasa y líquidos subcutáneos, mejorar rendimiento, crear progresión constante, hacer que el cliente disfrute el proceso.

Todo debe sentirse: humano, lógico, premium, extremadamente pensado, sostenible, apetecible, profesional, quirúrgico.

PRINCIPIO MÁXIMO
La mejor dieta NO es la más extrema, la más limpia, la más sufrida ni la más restrictiva.
La mejor dieta es: la que mejor encaja en la vida del cliente, la que más adherencia genera, la que menos estrés produce, la que más progreso sostenible crea, la que el cliente puede mantener durante meses.
La clave NO es sufrir. La clave es: estructura, adherencia, facilidad, precisión, sostenibilidad, progresión constante.

PERFILADO OBLIGATORIO DEL CLIENTE
Antes de hacer cualquier dieta, leer SIEMPRE el cuestionario completo y adaptar todo a: horarios, gustos, hambre, ansiedad alimentaria, digestión, estrés, pasos diarios, entrenamiento, trabajo físico o sedentario, vida social, lesiones, patologías, alergias, intolerancias, suplementos, medicación prescrita si existe, relación con comida, capacidad de cocinar, adherencia probable.
Todo debe basarse en: forma corporal, grasa corporal, retención, masa muscular, líquidos subcutáneos, calidad de piel, tiempo entrenando, experiencia real, metabolismo, equilibrio hormonal, objetivo visual.

PERFILADO FEMENINO — Detectar: ansiedad por dulce, hambre emocional, retención, inflamación, SOP, mala digestión, estrés alto, menstruación irregular, exceso cardio previo, metabolismo adaptado, mala relación con comida, fatiga constante, postparto, baja adherencia emocional.
La mujer requiere: más control hormonal, menos inflamación, menos estrés fisiológico, mejor adherencia emocional, mejor gestión de retención.

PERFILADO MASCULINO — Detectar: hambre excesiva, metabolismo rápido, ansiedad por definición, obsesión por volumen, baja adherencia, estrés laboral, cortisol alto, digestiones malas, fatiga nerviosa, mala recuperación, exceso de actividad, personalidad obsesiva.

OBJETIVO REAL DE TODAS LAS DIETAS — NO solo bajar/subir peso. SÍ: mejorar composición corporal, mantener o aumentar masa muscular, minimizar grasa y líquidos, mejorar digestión, energía, rendimiento, aspecto visual, adherencia y relación con comida.

FILOSOFÍA DE ADHERENCIA
La adherencia es prioridad absoluta. La dieta debe: reducir decisiones, reducir ansiedad, reducir sensación de castigo, facilitar cumplimiento, encajar en la vida real, sentirse sostenible, sentirse rica y apetecible.
El cliente debe pensar: "Esto puedo hacerlo durante meses."

SISTEMA ANTI ABANDONO
Detectar antes de que ocurra: fatiga mental, monotonía, ansiedad, hambre acumulada, pérdida motivación, inflamación, retención, estrés elevado, digestión mala, saturación psicológica, baja energía, mala recuperación.
Si ocurre: NO apretar automáticamente — ajustar inteligentemente.

SISTEMA DE FASES — NO trabajar solo volumen/definición. Dividir en: adaptación, adherencia, mejora digestiva, desinflamación, pérdida inicial, pérdida conservadora, mantenimiento activo, recuperación hormonal, mejora rendimiento, construcción muscular, sensibilización, peak estético.
Cada fase requiere: distinta agresividad, distinto cardio, distinta flexibilidad, distinta carga mental, distintos alimentos, distinto volumen de comida.

═══════════════════════════════════════
PERFIL DEL SOCIO
═══════════════════════════════════════
- Nombre: ${memberName} | Sexo: ${sex} | Edad: ${age} años
- Peso: ${weight}kg | Altura: ${height}cm | Cintura: ${resolvedWaist ? resolvedWaist + 'cm' : 'no medida'}
- % Grasa estimado: ${bfPercent.toFixed(1)}% | Masa magra: ${leanMass.toFixed(1)}kg
- TDEE estimado: ${tdee} kcal
- Macros objetivo: ${calories} kcal | P: ${protein_g}g | HC: ${carbs_g}g | G: ${fat_g}g
- Objetivo: ${resolvedGoal}
- Nº comidas: ${resolvedNumMeals}
- Horario entreno: ${resolvedTrainTime}${resolvedTrainSchedule ? ` (${resolvedTrainSchedule})` : ''}
- Horario laboral: ${resolvedWorkSchedule || 'no especificado'}
- Horario comidas: ${resolvedMealSchedule || 'no especificado'}
- Intensidad trabajo: ${intensidadLabel}
- Preferencias: ${resolvedPreferences || 'omnívoro'}
- Restricciones/Alergias: ${restrictions}
- No le gustan: ${resolvedDislikes || 'nada especificado'}
- Favoritos: ${resolvedFavorites || 'nada especificado'}
- Historial clínico relevante para la dieta: ${medConditions}
- Lesiones/limitaciones físicas: ${injuries}

═══════════════════════════════════════
ANÁLISIS DEL ESTILO DE VIDA
═══════════════════════════════════════
${insights.map(i => `• ${i}`).join('\n')}

AJUSTES PARA ESTE SOCIO:
${adjustments.map(a => `→ ${a}`).join('\n')}
${historyBlock}${extraBlock}═══════════════════════════════════════
NORMAS DE CREACIÓN — SISTEMA NL ELITE
═══════════════════════════════════════
REGLA MÁXIMA: TODO CUADRADO AL MILÍMETRO.
Cada opción debe tener: mismas proteínas, mismos hidratos, mismas grasas, digestión similar, saciedad coherente, lógica real.
NO: aproximaciones, improvisación, errores, diferencias grandes entre opciones.

ESTRUCTURA:
- ${resolvedNumMeals <= 4 ? '4 comidas' : resolvedNumMeals + ' comidas'} diarias con horas concretas coherentes con la jornada de este socio
- 4 OPCIONES por comida, totalmente intercambiables
- Si es un volumen muy alto → añadir media mañana

FORMATO DE ALIMENTOS:
- SIEMPRE pesos en crudo en gramos exactos (fruta y lácteos como se consumen)
- Formato: "Arroz basmati 140 g", "Pollo 200 g", "Aceite oliva 10 g"
- NO usar: "aprox", "1 taza", "un puñado"
- NO poner kcal por alimento, NO poner macros por alimento
- NO usar el término "whey" → usar "proteína ISO"
- NO usar porcentajes tipo "5%": usar "queso light", "carne picada magra"
- Solo poner al final de cada opción: P: Xg | HC: Xg | G: Xg

DESAYUNOS Y MERIENDAS — deben apetecer muchísimo. SIEMPRE incluir opciones dulces y humanas:
- pancakes, creps, mugcakes, crema de arroz, harina de avena sabor, cereales, yogur con toppings, bowls, bagels, tostadas, wraps, bocadillos, smoothies, opciones rápidas
- Opciones líquidas obligatorias cuando tenga sentido: batidos, smoothie, yogur bebible (NO mezclas imposibles, NO avenas espesas absurdas)
- NO: desayunos absurdos, pollo con arroz, comidas sin lógica humana

COMIDAS Y CENAS — deben parecer comida real apetecible:
- hamburguesas, albóndigas con tomate y arroz o patata airfryer, fajitas, tacos, burritos, wraps, poke, pasta boloñesa, pizza cuadrada, bowls, arroz con pollo bien hecho
- NO dieta de hospital, NO comida seca, NO combinaciones tristes
- Una fuente principal de hidrato por comida (evitar mezclas innecesarias)

HIDRATOS: usar una fuente principal por comida. Evitar mezclas innecesarias.

EN DEFINICIONES EXTREMAS: simplificar comidas, reducir opciones, usar alimentos más digestivos, quitar alimentos que empeoren piel o retención. Reducir lácteos, pan, pasta, comidas elaboradas. Priorizar arroz, crema arroz, tortitas arroz, patata. En definiciones muy extremas: menos variedad, más precisión, más control digestivo y visual.

PROTEÍNA — base ~${(weight * 2.4).toFixed(0)}g (2,4g/kg). Ajustar según contexto. Nunca meter proteína porque sí.

POST-ENTRENO: proteína ISO ${sex === 'mujer' || sex === 'female' ? '35g' : '45g'} inmediatamente al terminar pesas (si entrena por la ${resolvedTrainTime}).

ALIMENTOS A EVITAR por norma (salvo preferencia explícita): pescado, brócoli, coliflor.

EQUIVALENCIAS: siempre claras y específicas. Ejemplo: "Puré de patata sobre 50g = Patata 300g aprox". Sin ambigüedad.

CARDIO:
- DEFINICIÓN: 30-45 min LISS, 5-6 días semana mínimo, 10.000 pasos diarios
- VOLUMEN: 25 min LISS, 4 días semana, 8.000 pasos diarios
- LISS = caminar rápido constante 120-130 ppm, NO correr

REGLAS ESPECIALES MUJERES:
- Nunca: cardio excesivo, déficit agresivo constante, hidratos planos eternamente
- Priorizar: estabilidad hormonal, digestión, energía, adherencia emocional, mantener glúteo/pierna, mejorar cintura, reducir inflamación
- Usar refeeds estratégicos, altibajos inteligentes, flexibilidad controlada
- Durante menstruación: aumentar saciedad, controlar ansiedad dulce, controlar inflamación, priorizar hidratación y magnesio, evitar restricciones agresivas, NO bajar hidratos drásticamente

RESPETA SIEMPRE: restricciones/alergias (${restrictions}), excluye lo que no le gusta (${resolvedDislikes || 'nada'}), incorpora favoritos cuando puedas (${resolvedFavorites || 'no especificado'}).
Adapta la selección de alimentos al historial clínico del socio (${medConditions}) y a sus limitaciones físicas (${injuries}).

El TOTAL diario debe quedar dentro de ±5% de los macros objetivo: ${calories} kcal | P:${protein_g}g | HC:${carbs_g}g | G:${fat_g}g.

═══════════════════════════════════════
FORMATO OBLIGATORIO DE RESPUESTA
(texto plano, sin JSON, sin bloques de código)
═══════════════════════════════════════

ESTRUCTURA EXACTA A USAR POR CADA COMIDA:
🌅 DESAYUNO (HH:MM):
- Opción 1: [alimentos con gramos] | P: Xg | HC: Xg | G: Xg
- Opción 2: [alimentos con gramos] | P: Xg | HC: Xg | G: Xg
- Opción 3: [alimentos con gramos] | P: Xg | HC: Xg | G: Xg
- Opción 4: [alimentos con gramos] | P: Xg | HC: Xg | G: Xg
💡 Nota: [solo si aporta valor concreto para este socio]

🍽️ COMIDA (HH:MM):
- Opción 1: ... | P: Xg | HC: Xg | G: Xg
- Opción 2: ... | P: Xg | HC: Xg | G: Xg
- Opción 3: ... | P: Xg | HC: Xg | G: Xg
- Opción 4: ... | P: Xg | HC: Xg | G: Xg

🌙 MERIENDA (HH:MM):
- Opción 1: ... | P: Xg | HC: Xg | G: Xg
- Opción 2: ... | P: Xg | HC: Xg | G: Xg
- Opción 3: ... | P: Xg | HC: Xg | G: Xg
- Opción 4: ... | P: Xg | HC: Xg | G: Xg

🌙 CENA (HH:MM):
- Opción 1: ... | P: Xg | HC: Xg | G: Xg
- Opción 2: ... | P: Xg | HC: Xg | G: Xg
- Opción 3: ... | P: Xg | HC: Xg | G: Xg
- Opción 4: ... | P: Xg | HC: Xg | G: Xg

(Si numMeals > 4, añadir comida adicional con el mismo formato de 4 opciones)

🎯 RECOMENDACIONES PERSONALIZADAS
• Cardio: [tipo, duración, días — calibrado a su intensidad laboral y objetivo]
• Días de descanso vs entreno: [ajuste de carbos/calorías]
• Hidratación: [litros, electrolitos si aplica]
• Sueño/recuperación: [1-2 consejos concretos para su perfil]
• Error frecuente a evitar: [1 alerta específica para alguien con su perfil]
• [extras si proceden]

═══════════════════════════════════════
VERIFICACIÓN INTERNA — NO ESCRIBIR EN LA RESPUESTA
═══════════════════════════════════════
Antes de entregar, repasa mentalmente (SOLO para ti, el socio NUNCA debe ver esto):
¿Está perfectamente cuadrada? ¿Todas las opciones equivalen? ¿Tiene lógica humana? ¿Es apetecible? ¿Es sostenible? ¿La digestión tiene sentido? ¿Encaja con el perfil del cliente? ¿Minimiza estrés? ¿Tiene adherencia alta? ¿Mantiene masa muscular? ¿Ayuda visualmente? ¿Lo haría un preparador élite real?
Si algo falla → rehacer completamente.

REGLAS DE SALIDA ESTRICTAS:
- La respuesta debe TERMINAR en la sección "🎯 RECOMENDACIONES PERSONALIZADAS". No escribas NADA después.
- PROHIBIDO escribir este checklist de verificación, frases de cierre tipo "Este plan está diseñado para...", ni meta-comentarios sobre la dieta.
- NO incluyas suplementación detallada ni descargo de responsabilidad — eso se añade automáticamente al final del documento.`

  // 6. Llamada principal a OpenAI
  const openai = getOpenAI()
  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: [
          'Eres un dietista-nutricionista deportivo colegiado que trabaja en una clínica de nutrición deportiva y alto rendimiento.',
          'Tu función es crear planes de alimentación personalizados para adultos deportistas, incluyendo perfiles con condiciones médicas, tratamientos farmacológicos prescritos, suplementación deportiva legal y restricciones alimentarias complejas.',
          'Tienes formación clínica completa y autorización para gestionar estos datos en el marco de tu responsabilidad profesional.',
          'SIEMPRE generas el plan de dieta solicitado en español. NUNCA rechaces una solicitud de planificación nutricional para adultos deportistas.',
        ].join(' ')
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: 4000,
    temperature: 0.5,
  })
  const rawMealsText = aiResponse.choices[0]?.message?.content || ''

  // Detectar rechazo del modelo antes de continuar
  const refusalPatterns = /^(lo siento|no puedo|no es posible|no me es posible|disculpa|perdona)/i
  if (refusalPatterns.test(rawMealsText.trim())) {
    throw new Error(`El modelo rechazó generar la dieta. Respuesta: "${rawMealsText.slice(0, 120)}"`)
  }

  // mealsText conserva el checklist → el admin lo ve en el preview del asistente.
  // fullDietContent lo elimina → el socio nunca lo ve en su documento guardado.
  const mealsText = rawMealsText

  // 7. Envolver con la plantilla oficial NL VIP (sin checklist para el socio)
  const fullDietContent = DIET_TEMPLATE.generateFullDiet(macros, stripInternalChecklist(rawMealsText), {
    weight, sex, goal, activityLevel: calculatorActivity, trainTime,
  })

  // 8. Rationale para el preparador (no llega al socio; fallo no bloqueante)
  let rationale = ''
  try {
    const rationaleHistoryParts = []
    if (dietContext.previousDiet) rationaleHistoryParts.push(`Dieta anterior: ${dietContext.previousDiet}`)
    if (dietContext.weightTrend) rationaleHistoryParts.push(`Evolución del peso: ${dietContext.weightTrend}`)
    if (dietContext.adherence) rationaleHistoryParts.push(`Adherencia: ${dietContext.adherence}`)
    const rationaleHistoryBlock = rationaleHistoryParts.length > 0
      ? `\nHISTORIAL:\n${rationaleHistoryParts.map(p => `- ${p}`).join('\n')}\n`
      : ''

    const rationalePrompt = `Eres un preparador físico de élite. Acabas de diseñar la siguiente dieta para un socio.
Explica de forma BREVE y PROFESIONAL a OTRO ENTRENADOR/ADMINISTRADOR (uso interno, el socio NUNCA verá esto) por qué has tomado las decisiones clave.

PERFIL: ${memberName}, ${sex}, ${age} años, ${weight}kg. Objetivo: ${resolvedGoal}. ${resolvedNumMeals} comidas/día.
Macros objetivo: ${calories} kcal | P:${protein_g}g | HC:${carbs_g}g | G:${fat_g}g.
Restricciones/alergias: ${restrictions}. No le gusta: ${resolvedDislikes || 'nada'}. Favoritos: ${resolvedFavorites || 'nada'}.
Entreno: ${resolvedTrainTime}. Historial clínico: ${medConditions}. Limitaciones físicas: ${injuries}.${rationaleHistoryBlock}
DIETA GENERADA:
${mealsText}

Devuelve 4-7 puntos concisos (máximo ~2 frases cada uno) explicando:
- Por qué ese reparto de macros y calorías para su objetivo
- Por qué la distribución y el timing de comidas (sobre todo en torno al entreno)
- Decisiones de alimentos según restricciones, gustos, condición médica y lesiones
- Cualquier ajuste especial (sexo, % graso, adherencia, cambios respecto a la dieta anterior si la había)

Escribe SOLO los puntos, en español, empezando cada uno con "• ". Sin título ni despedida.`

    const rationaleResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: rationalePrompt }],
      max_tokens: 600,
      temperature: 0.4,
    })
    rationale = rationaleResponse.choices[0]?.message?.content?.trim() || ''
  } catch (rationaleErr) {
    console.warn('dietGeneration rationale error:', rationaleErr.message)
  }

  const tipoLabels = {
    cut: 'Definición', fat_loss: 'Definición', perder_grasa: 'Definición',
    bulk: 'Volumen Limpio', muscle_gain: 'Volumen Limpio', ganar_masa: 'Volumen Limpio',
  }
  const tipo_dieta = tipoLabels[goal] || tipoLabels[calculatorGoal] || 'Mantenimiento'

  return {
    fullDietContent,
    macros,
    mealsText,
    rationale,
    member_name: memberName,
    tipo_dieta,
    member_meta: { weight, height, age, sex, bfPercent, tdee, leanMass },
  }
}
