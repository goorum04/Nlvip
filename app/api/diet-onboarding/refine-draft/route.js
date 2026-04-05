import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authUtils'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// POST /api/diet-onboarding/refine-draft
// Allows trainer/admin to ask the AI to correct/refine the diet draft via chat
export async function POST(req) {
  const { error: authError } = await requireAuth(req, ['admin', 'trainer'])
  if (authError) return authError

  try {
    const { originalDraft, correction, macros, memberContext } = await req.json()

    if (!originalDraft || !correction) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const { weight, goal, restrictions, numMeals } = memberContext || {}

    const prompt = `Eres un nutricionista deportivo experto del club NL VIP.
El entrenador está revisando el siguiente borrador de dieta y quiere aplicar una corrección.

MACROS OBJETIVO:
- Calorías: ${macros?.calories || '?'} kcal
- Proteína: ${macros?.protein_g || '?'}g
- Carbohidratos: ${macros?.carbs_g || '?'}g
- Grasas: ${macros?.fat_g || '?'}g

DATOS DEL SOCIO:
- Peso: ${weight || '?'}kg | Objetivo: ${goal || '?'} | Comidas: ${numMeals || '?'} | Restricciones: ${restrictions || 'ninguna'}

BORRADOR ACTUAL:
${originalDraft}

CORRECCIÓN SOLICITADA POR EL ENTRENADOR:
"${correction}"

INSTRUCCIONES:
1. Aplica EXACTAMENTE la corrección indicada manteniendo el mismo formato y estructura
2. Ajusta los gramos de otros alimentos si es necesario para mantener los macros objetivo
3. Mantén todos los emojis y el formato del borrador original
4. Devuelve SOLO el texto del menú corregido, sin explicaciones adicionales
5. Si la corrección implica cambiar un alimento, asegúrate de que el sustituto sea nutritivamente equivalente`

    const openai = getOpenAI()
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.5
    })

    const updatedDietContent = aiResponse.choices[0]?.message?.content || originalDraft

    return NextResponse.json({ success: true, updatedDietContent })

  } catch (error) {
    console.error('diet-onboarding/refine-draft error:', error)
    return NextResponse.json({ error: 'Error al refinar el borrador' }, { status: 500 })
  }
}
