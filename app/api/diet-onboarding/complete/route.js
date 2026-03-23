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

// POST /api/diet-onboarding/complete
// Called when member submits the questionnaire
export async function POST(req) {
  try {
    const { requestId, memberId, responses } = await req.json()

    if (!requestId || !memberId || !responses) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // 1. Get member profile for macros calculation
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, weight_kg, height_cm, age, sex, goal, activity_level')
      .eq('id', memberId)
      .single()

    const weight = profile?.weight_kg || 75
    const name = profile?.name || 'Socio'

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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    })

    const mealsText = aiResponse.choices[0]?.message?.content || ''

    // 4. Build the full diet using the NL VIP template
    const fullDietContent = DIET_TEMPLATE.generateFullDiet(macros, mealsText)

    // 5. Get admin for created_by
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single()

    // 6. Save as diet_template and assign to member using RPC (SECURITY DEFINER)
    const dietName = `Dieta personalizada (${name})`
    
    const { data: generatedDietId, error: rpcError } = await supabase.rpc('complete_diet_onboarding', {
      p_member_id: memberId,
      p_request_id: requestId,
      p_diet_name: dietName,
      p_calories: macros.calories,
      p_protein_g: macros.protein_g,
      p_carbs_g: macros.carbs_g,
      p_fat_g: macros.fat_g,
      p_content: fullDietContent,
      p_admin_id: adminProfile?.id,
      p_responses: responses
    })

    if (rpcError) throw new Error('Error en el proceso de guardado: ' + rpcError.message)

    const newDietId = generatedDietId

    // 7. Get requester info for generate-recipe-plan
    const { data: reqData } = await supabase
      .from('diet_onboarding_requests')
      .select('requested_by')
      .eq('id', requestId)
      .single()

    // 9. Also generate recipe plan
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/generate-recipe-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          dietId: newDietId,
          trainerId: reqData?.requested_by
        })
      })
    } catch (e) {
      console.warn('Could not generate recipe plan:', e.message)
    }

    return NextResponse.json({
      success: true,
      message: '¡Tu plan nutricional personalizado ha sido creado y asignado!',
      dietName,
      macros
    })

  } catch (error) {
    console.error('diet-onboarding/complete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
