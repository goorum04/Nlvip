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

    // 4. Prompt: contexto rico + análisis + instrucciones explicativas
    const prompt = `Eres un nutricionista deportivo experto del club NL VIP. Diseña un plan nutricional personalizado, didáctico y accionable para ${name}, explicando el "por qué" de cada decisión cuando aporte valor.

═══════════════════════════════════════
DATOS DEL SOCIO
═══════════════════════════════════════
- Nombre: ${name} | Sexo: ${sex} | Edad: ${age} años
- Peso: ${weight}kg | Altura: ${height}cm | Cintura: ${waist ? waist + 'cm' : 'no medida'}
- % Grasa estimado (Deurenberg): ${bfPercent.toFixed(1)}% | Masa magra: ${leanMass.toFixed(1)}kg
- TDEE estimado: ${tdee} kcal
- Macros objetivo: ${calories} kcal | ${protein_g}g proteína | ${carbs_g}g carbohidratos | ${fat_g}g grasa
- Objetivo principal: ${goal}
- Nº de comidas solicitadas: ${numMeals}
- Horario de entreno: ${trainTime}${trainSchedule ? ` (${trainSchedule})` : ''}
- Horario laboral: ${workSchedule || 'no especificado'}
- Hábitos/horario de comidas: ${mealSchedule || 'no especificado'}
- Intensidad del trabajo: ${intensidadLabel}
- Preferencias: ${preferences}
- Restricciones/Alergias: ${restrictions}
- No le gustan: ${dislikes || 'nada especificado'}
- Favoritos: ${favorites || 'nada especificado'}
- Condición médica: ${medConditions}
- Lesiones o limitaciones: ${injuries}

═══════════════════════════════════════
ANÁLISIS DEL ESTILO DE VIDA (interpretación experta)
═══════════════════════════════════════
${insights.map(i => `• ${i}`).join('\n')}

REGLAS DE AJUSTE PARA ESTE SOCIO:
${adjustments.map(a => `→ ${a}`).join('\n')}

═══════════════════════════════════════
INSTRUCCIONES PARA EL PLAN
═══════════════════════════════════════
1. Distribuye las ${numMeals} comidas a lo largo del día (DESAYUNO, MEDIA MAÑANA, COMIDA, MERIENDA, CENA, RECENA si aplica) con horas concretas coherentes con su jornada laboral y su entreno.

2. Para CADA COMIDA indica ALIMENTOS ESPECÍFICOS CON GRAMOS EXACTOS y, debajo, una línea breve "💡 Nota:" explicando el porqué nutricional (saciedad, perfil de aminoácidos, recuperación, energía pre-entreno, índice glucémico, etc.). Ejemplo:
   🌅 DESAYUNO (08:00):
   - 120g claras de huevo (tortilla a la plancha)
   - 60g avena en copos cocida en agua
   - 1 pieza de fruta (manzana o pera, ~150g)
   💡 Nota: proteína magra para activar síntesis proteica + carbohidrato complejo de bajo IG para energía sostenida durante la jornada.

3. Si la persona entrena por la ${trainTime}, organiza las comidas para que la principal en carbos quede antes/después del entreno. Añade post-entreno: 40g de proteína en polvo + 5g de creatina.

4. Respeta SIEMPRE las restricciones/alergias (${restrictions}) y excluye lo que no le gusta (${dislikes || 'nada'}). Incorpora cuando puedas alimentos favoritos: ${favorites || 'no especificado'}.

5. Aplica el ANÁLISIS de estilo de vida (no lo copies, úsalo): si es sedentario usa proteínas más densas y verduras voluminosas para saciedad; si es físicamente exigente, aporta más carbos antes de la jornada laboral; ajusta horarios al horario laboral indicado.

6. Ten en cuenta condiciones médicas y lesiones al elegir alimentos: si hay problemas digestivos evita lácteos y frituras; tendencia a inflamación → pescado azul + AOVE; anemia o socia mujer → prioriza hierro.

7. Alimentos preferentes — Proteína: pollo, pavo, atún, merluza, salmón, ternera magra, huevos, queso cottage, claras. Carbohidratos: arroz, pasta integral, avena, patata, boniato, pan integral, fruta. Grasas: AOVE, aguacate, frutos secos (si no es alérgico), pescado azul.

8. Los gramos se ajustan para que el TOTAL diario quede dentro de ±5% de los macros objetivo (${calories} kcal, ${protein_g}P / ${carbs_g}C / ${fat_g}G).

9. Después de las comidas, añade SIEMPRE una sección **"🎯 RECOMENDACIONES PERSONALIZADAS"** con 5-7 viñetas concretas para ESTE socio (no genéricas), aplicando el ANÁLISIS de estilo de vida. Incluye obligatoriamente:
   • Recomendación de cardio (cantidad y tipo) calibrada a su intensidad de trabajo y objetivo.
   • Pauta para días de descanso vs días de entreno (carbos y calorías).
   • Hidratación específica (litros, electrolitos si aplica).
   • 1-2 consejos de sueño/recuperación útiles para su perfil.
   • 1 alerta sobre un error frecuente que cometería alguien con su perfil.

10. NO incluyas reglas generales del gimnasio, suplementación detallada ni descargo de responsabilidad — eso se añade después automáticamente. Solo: comidas con notas + recomendaciones personalizadas.

═══════════════════════════════════════
FORMATO DE RESPUESTA (texto plano, sin JSON, sin bloques de código)
═══════════════════════════════════════
🌅 DESAYUNO (HH:MM):
- Xg de alimento
- Xg de alimento
💡 Nota: explicación breve.

☀️ MEDIA MAÑANA (HH:MM):
- ...
💡 Nota: ...

🍽️ COMIDA (HH:MM):
- ...
💡 Nota: ...

(continúa hasta cubrir las ${numMeals} comidas)

🎯 RECOMENDACIONES PERSONALIZADAS
• Cardio: ...
• Días de descanso vs entreno: ...
• Hidratación: ...
• Sueño/recuperación: ...
• Error frecuente a evitar: ...
• (extras si procede)

Sé directo, técnico pero claro, y aplica el análisis del socio en cada decisión.`

    const openai = getOpenAI()
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
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
