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
    const calculatorActivity = activityFromWorkIntensity(responses['Trabajo - Intensidad'] || responses.intensidad_trabajo)
    const computed = calculateMacros({
      weight,
      height,
      age,
      sex,
      activity: calculatorActivity,
      goal: calculatorGoal,
    }) || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, tdee: 0, bfPercent: 0 }
    const { calories, protein_g, fat_g, carbs_g, tdee, bfPercent } = computed
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
    // Merge medical conditions from form + profile
    const formMedical = responses.condicion_medica || ''
    const profileMedical = profile?.medical_conditions || ''
    const medConditions = [formMedical, profileMedical].filter(Boolean).join('; ') || 'ninguna'
    const injuries = profile?.injuries || 'ninguna'

    // 4. Build AI prompt for specific daily meal plan
    const prompt = `Eres un nutricionista deportivo experto del club NL VIP.
Genera un programa nutricional COMPLETO Y DETALLADO para ${name}.

DATOS DEL SOCIO:
- Peso total: ${weight}kg | Altura: ${height}cm | Cintura: ${waist ? waist + 'cm' : 'no medida'}
- % Grasa estimado: ${bfPercent.toFixed(1)}% | Masa magra estimada: ${leanMass.toFixed(1)}kg
- TDEE estimado: ${tdee} kcal
- Macros calculados: ${calories} kcal | ${protein_g}g proteína | ${carbs_g}g carbohidratos | ${fat_g}g grasa
- Objetivo: ${goal}
- Nº de comidas: ${numMeals}
- Horario de entreno: ${trainTime}
- Restricciones/Alergias: ${restrictions}
- Preferencias: ${preferences}
- No le gustan: ${dislikes || 'nada especificado'}
- Favoritos: ${favorites || 'nada especificado'}
- Condición médica: ${medConditions}
- Lesiones o limitaciones: ${injuries}

INSTRUCCIONES PARA GENERAR EL PLAN:
1. Distribuye las ${numMeals} comidas a lo largo del día con nombres en español (DESAYUNO, MEDIA MAÑANA, COMIDA, MERIENDA, CENA, etc.)
2. Para CADA COMIDA indica ALIMENTOS ESPECÍFICOS CON GRAMOS EXACTOS. Ejemplo:
   🌅 DESAYUNO:
   - 120g de claras de huevo (tortilla a la plancha)
   - 60g de avena en copos con agua
   - 1 pieza de fruta (manzana o pera)
3. Si la persona entrena por la ${trainTime} añade post-entreno: 40g de proteína en polvo
4. Respeta SIEMPRE las restricciones/alergias (${restrictions}) y excluye lo que no le gusta (${dislikes})
5. Ten en cuenta las condiciones médicas y lesiones al seleccionar alimentos y cantidades
6. Los alimentos proteicos: pollo, pavo, atún, merluza, salmón, ternera, huevos, queso cottage
7. Carbohidratos: arroz, pasta, avena, patata, boniato, pan integral
8. Grasas: AOVE, aguacate, frutos secos (si no es alérgico)
9. Los gramos deben ajustarse para que el total del día llegue EXACTAMENTE a los macros indicados
10. Formato SOLO para la distribución de comidas, SIN reglas generales (las añadiremos después)

FORMATO DE RESPUESTA (solo el texto de comidas, sin JSON):
🌅 DESAYUNO (HH:00):
- Xg de alimento
- Xg de alimento
...

☀️ COMIDA (HH:00):
...

Etc.`

    const openai = getOpenAI()
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o', /* Idealmente 4o-mini o el configurado, mantenemos el original */
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    })

    const mealsText = aiResponse.choices[0]?.message?.content || ''

    // 4. Build the full diet using the NL VIP template
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
