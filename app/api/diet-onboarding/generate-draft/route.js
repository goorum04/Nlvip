import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { DIET_TEMPLATE } from '@/lib/dietTemplate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// POST /api/diet-onboarding/generate-draft
// Llama a OpenAI y genera el borrador de la dieta, pero no lo guarda en BBDD.
export async function POST(req) {
  try {
    const { requestId, memberId, responses } = await req.json()

    if (!requestId || !memberId || !responses) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // 1. Get member profile for macros calculation
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, weight_kg, height_cm, age, sex, goal, activity_level')
      .eq('id', memberId)
      .single()

    const weight = profile?.weight_kg || 75
    const rawName = (profile?.name && profile.name.trim() !== '') 
      ? profile.name.trim()
      : (profile?.email ? profile.email.split('@')[0] : 'Socio')
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()

    // 2. Calculate base macros from NL VIP formula
    const protein_g = Math.round(weight * 2)
    const fat_g = Math.round(weight * 0.9)
    
    let calMult = 1.0
    const goal = responses.objetivo || profile?.goal || 'mantenimiento'
    if (goal === 'perder_grasa' || goal === 'cut') calMult = 0.85
    else if (goal === 'ganar_masa' || goal === 'bulk') calMult = 1.15
    
    const basalCalories = Math.round((weight * 24) * 1.5) // TDEE approx
    const calories = Math.round(basalCalories * calMult)
    const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4)

    const macros = { calories, protein_g, carbs_g, fat_g }

    const numMeals = parseInt(responses.num_comidas) || 5
    const restrictions = responses.restricciones || 'ninguna'
    const preferences = responses.preferencias || 'omnívoro'
    const dislikes = responses.no_me_gusta || ''
    const favorites = responses.favoritos || ''
    const trainTime = responses.horario_entreno || 'tarde'
    const medConditions = responses.condicion_medica || 'ninguna'

    // 3. Build AI prompt for specific daily meal plan
    const prompt = `Eres un nutricionista deportivo experto del club NL VIP. 
Genera un programa nutricional COMPLETO Y DETALLADO para ${name}.

DATOS DEL SOCIO:
- Peso: ${weight}kg
- Macros calculados: ${calories} kcal | ${protein_g}g proteína | ${carbs_g}g carbohidratos | ${fat_g}g grasa
- Objetivo: ${goal}
- Nº de comidas: ${numMeals}
- Horario de entreno: ${trainTime}
- Restricciones: ${restrictions}
- Preferencias: ${preferences}
- No le gustan: ${dislikes || 'nada especificado'}
- Favoritos: ${favorites || 'nada especificado'}
- Condición médica: ${medConditions}

INSTRUCCIONES PARA GENERAR EL PLAN:
1. Distribuye las ${numMeals} comidas a lo largo del día con nombres en español (DESAYUNO, MEDIA MAÑANA, COMIDA, MERIENDA, CENA, etc.)
2. Para CADA COMIDA indica ALIMENTOS ESPECÍFICOS CON GRAMOS EXACTOS. Ejemplo:
   🌅 DESAYUNO:
   - 120g de claras de huevo (tortilla a la plancha)
   - 60g de avena en copos con agua
   - 1 pieza de fruta (manzana o pera)
3. Si la persona entrena por la ${trainTime} añade post-entreno: 40g de proteína en polvo
4. Respeta las restricciones (${restrictions}) y excluye lo que no le gusta (${dislikes})
5. Los alimentos proteicos: pollo, pavo, atún, merluza, salmón, ternera, huevos, queso cottage
6. Carbohidratos: arroz, pasta, avena, patata, boniato, pan integral
7. Grasas: AOVE, aguacate, frutos secos (si no es alérgico)
8. Formato SOLO para la distribución de comidas, SIN reglas generales (las añadiremos después)

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
