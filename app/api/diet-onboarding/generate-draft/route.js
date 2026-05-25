import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { DIET_TEMPLATE } from '@/lib/dietTemplate'
import { calculateMacros, goalFromOnboarding, activityFromWorkIntensity } from '@/lib/macroCalculator'

const schema = z.object({
  requestId: z.string().uuid(),
  memberId: z.string().uuid(),
  responses: z.record(z.string(), z.unknown()).nullable().optional()
})

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Interpreta el estilo de vida del socio para guiar a la IA con instrucciones
// concretas (no solo etiquetas). Devuelve insights legibles + reglas accionables
// que se inyectan en el prompt para que la dieta se adapte de verdad al perfil.
function buildLifestyleAnalysis({ intensidadTrabajo, trainTime, trainSchedule, workSchedule, mealSchedule, goal, sex, age, bfPercent }) {
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

// POST /api/diet-onboarding/generate-draft
// Llama a OpenAI y genera el borrador de la dieta, pero no lo guarda en BBDD.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    // Rate limiting: Más flexible para generar planes de dieta
    const identifier = getIdentifier(req)
    const isAuth = req.headers.get('authorization')
    let baseLimit = 50 // Subimos de 10 a 50
    // Si hay token, asumimos que puede ser admin y damos margen
    if (isAuth) baseLimit = 200

    const limit = await checkRateLimit(identifier, baseLimit, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Como medida de seguridad, hay un límite de ${baseLimit} peticiones por minuto.` },
        { status: 429 }
      )
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { requestId, memberId, responses: rawResponses } = parsed.data
    const responses = rawResponses || {}

    // 1. Get member profile for macros calculation
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, weight_kg, height_cm, age, sex, goal, activity_level, allergies, injuries, medical_conditions')
      .eq('id', memberId)
      .single()

    // Use questionnaire measurements first, fall back to profile, then defaults
    const weight = parseFloat(responses['Medida - Peso']) || profile?.weight_kg || 75
    const height = parseFloat(responses['Medida - Altura']) || profile?.height_cm || 170
    const waist = parseFloat(responses['Medida - Cintura']) || null
    const age = profile?.age || 30
    const sex = profile?.sex || 'hombre'

    const rawName = (profile?.name && profile.name.trim() !== '')
      ? profile.name.trim()
      : (profile?.email ? profile.email.split('@')[0] : 'Socio')
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()

    // 2. Macros: la utilidad compartida calcula TDEE = peso × 24 × actMult,
    //    % grasa por Deurenberg, proteína 2.2-2.4 g/kg, grasa 0.9 g/kg, déficit
    //    según % grasa para cut. La calculadora del Trainer/Admin usa exactamente
    //    la misma utilidad → diet onboarding y calculadora coinciden siempre.
    const goal = responses.objetivo || profile?.goal || 'mantenimiento'
    const calculatorGoal = goalFromOnboarding(goal)
    const intensidadTrabajo = responses['Trabajo - Intensidad'] || responses.intensidad_trabajo
    const calculatorActivity = activityFromWorkIntensity(intensidadTrabajo)
    const computed = calculateMacros({
      weight,
      height,
      age,
      sex,
      activity: calculatorActivity,
      goal: calculatorGoal,
    }) || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, tdee: 0, bfPercent: 0 }
    const { calories, protein_g, fat_g, carbs_g, tdee, bfPercent } = computed
    const macros = { calories, protein_g, carbs_g, fat_g }
    const leanMass = weight * (1 - bfPercent / 100)

    const numMeals = parseInt(responses.num_comidas || responses['Comidas - Número']) || 5
    // Merge restrictions from form answers + saved profile allergies
    const formRestrictions = responses.restricciones || responses['restricciones'] || ''
    const profileAllergies = profile?.allergies || ''
    const restrictions = [formRestrictions, profileAllergies].filter(Boolean).join(', ') || 'ninguna'
    const preferences = responses.preferencias || 'omnívoro'
    const dislikes = responses.no_me_gusta || ''
    const favorites = responses.favoritos || ''
    const trainTime = responses.horario_entreno || responses['Entreno - Momento'] || 'tarde'
    const trainSchedule = responses['Entreno - Horario Detalle'] || ''
    const workSchedule = responses['Trabajo - Horario'] || ''
    const mealSchedule = responses['Comidas - Horario'] || ''
    // Merge medical conditions from form + profile
    const formMedical = responses.condicion_medica || ''
    const profileMedical = profile?.medical_conditions || ''
    const medConditions = [formMedical, profileMedical].filter(Boolean).join('; ') || 'ninguna'
    const injuries = profile?.injuries || 'ninguna'

    // 3. Análisis de estilo de vida → reglas concretas para la IA
    const { insights, adjustments } = buildLifestyleAnalysis({
      intensidadTrabajo,
      trainTime,
      trainSchedule,
      workSchedule,
      mealSchedule,
      goal,
      sex,
      age,
      bfPercent
    })
    const intensidadLabel = intensidadTrabajo || 'no especificada'

    // 4. Prompt SISTEMA NL ELITE — PROM MAESTRO DEFINITIVO ABSOLUTO
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
Antes de hacer cualquier dieta, leer SIEMPRE el cuestionario completo y adaptar todo a: horarios, gustos, hambre, ansiedad alimentaria, digestión, estrés, pasos diarios, entrenamiento, trabajo físico o sedentario, vida social, lesiones, patologías, alergias, intolerancias, suplementos, química/TRT si existe, relación con comida, capacidad de cocinar, adherencia probable.
Todo debe basarse en: forma corporal, grasa corporal, retención, masa muscular, líquidos subcutáneos, calidad de piel, tiempo entrenando, experiencia real, metabolismo, estado hormonal, objetivo visual.

PERFILADO FEMENINO — Detectar: ansiedad por dulce, hambre emocional, retención, inflamación, SOP, mala digestión, estrés alto, menstruación irregular, exceso cardio previo, metabolismo adaptado, mala relación con comida, fatiga constante, postparto, baja adherencia emocional.
La mujer requiere: más control hormonal, menos inflamación, menos estrés fisiológico, mejor adherencia emocional, mejor gestión de retención.

PERFILADO MASCULINO — Detectar: hambre excesiva, metabolismo rápido, ansiedad por definición, obsesión por volumen, baja adherencia, estrés laboral, cortisol alto, digestiones malas, fatiga nerviosa, mala recuperación, química/TRT, exceso actividad, personalidad obsesiva.

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
- Nombre: ${name} | Sexo: ${sex} | Edad: ${age} años
- Peso: ${weight}kg | Altura: ${height}cm | Cintura: ${waist ? waist + 'cm' : 'no medida'}
- % Grasa estimado: ${bfPercent.toFixed(1)}% | Masa magra: ${leanMass.toFixed(1)}kg
- TDEE estimado: ${tdee} kcal
- Macros objetivo: ${calories} kcal | P: ${protein_g}g | HC: ${carbs_g}g | G: ${fat_g}g
- Objetivo: ${goal}
- Nº comidas: ${numMeals}
- Horario entreno: ${trainTime}${trainSchedule ? ` (${trainSchedule})` : ''}
- Horario laboral: ${workSchedule || 'no especificado'}
- Horario comidas: ${mealSchedule || 'no especificado'}
- Intensidad trabajo: ${intensidadLabel}
- Preferencias: ${preferences}
- Restricciones/Alergias: ${restrictions}
- No le gustan: ${dislikes || 'nada especificado'}
- Favoritos: ${favorites || 'nada especificado'}
- Condición médica: ${medConditions}
- Lesiones: ${injuries}

═══════════════════════════════════════
ANÁLISIS DEL ESTILO DE VIDA
═══════════════════════════════════════
${insights.map(i => `• ${i}`).join('\n')}

AJUSTES PARA ESTE SOCIO:
${adjustments.map(a => `→ ${a}`).join('\n')}

═══════════════════════════════════════
NORMAS DE CREACIÓN — SISTEMA NL ELITE
═══════════════════════════════════════
REGLA MÁXIMA: TODO CUADRADO AL MILÍMETRO.
Cada opción debe tener: mismas proteínas, mismos hidratos, mismas grasas, digestión similar, saciedad coherente, lógica real.
NO: aproximaciones, improvisación, errores, diferencias grandes entre opciones.

ESTRUCTURA:
- ${numMeals <= 4 ? '4 comidas' : numMeals + ' comidas'} diarias con horas concretas coherentes con la jornada de este socio
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

PROTEÍNA — base ~${(weight * 2.2).toFixed(0)}g (2,2g/kg). Ajustar según contexto. Nunca meter proteína porque sí.

POST-ENTRENO: proteína ISO ${sex === 'mujer' || sex === 'female' ? '35g' : '45g'} inmediatamente al terminar pesas (si entrena por la ${trainTime}).

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

RESPETA SIEMPRE: restricciones/alergias (${restrictions}), excluye lo que no le gusta (${dislikes || 'nada'}), incorpora favoritos cuando puedas (${favorites || 'no especificado'}).
Ten en cuenta condición médica (${medConditions}) y lesiones (${injuries}) al elegir alimentos.

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

CHECKLIST FINAL OBLIGATORIO antes de entregar:
¿Está perfectamente cuadrada? ¿Todas las opciones equivalen? ¿Tiene lógica humana? ¿Es apetecible? ¿Es sostenible? ¿La digestión tiene sentido? ¿Encaja con el perfil del cliente? ¿Minimiza estrés? ¿Tiene adherencia alta? ¿Mantiene masa muscular? ¿Ayuda visualmente? ¿Lo haría un preparador élite real?
Si algo falla → rehacer completamente.

NO incluyas suplementación detallada ni descargo de responsabilidad — eso se añade automáticamente al final del documento.`

    const openai = getOpenAI()
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.5
    })

    const mealsText = aiResponse.choices[0]?.message?.content || ''

    // 5. Build the full diet using the NL VIP template
    const fullDietContent = DIET_TEMPLATE.generateFullDiet(macros, mealsText)

    // Devolvemos el texto generado sin guardarlo en BBDD
    return NextResponse.json({
      success: true,
      message: 'Borrador generado con éxito.',
      macros,
      fullDietContent
    })

  } catch (error) {
    console.error('diet-onboarding/generate-draft error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
