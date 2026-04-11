import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const schema = z.object({
  originalDraft: z.string().min(1),
  correction: z.string().min(1).max(1000),
  macros: z.object({
    calories: z.number().optional(),
    protein_g: z.number().optional(),
    carbs_g: z.number().optional(),
    fat_g: z.number().optional()
  }).optional(),
  memberContext: z.object({
    weight: z.number().optional(),
    goal: z.string().optional(),
    restrictions: z.string().optional(),
    numMeals: z.number().optional()
  }).optional()
})

// POST /api/diet-onboarding/refine-draft
// Allows trainer to ask the AI to correct/refine the diet draft via chat
export async function POST(req) {
  try {
    const limit = await checkRateLimit(getIdentifier(req), 20, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Inténtalo de nuevo más tarde.` },
        { status: 429 }
      )
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { originalDraft, correction, macros, memberContext } = parsed.data

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
