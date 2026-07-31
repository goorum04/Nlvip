import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
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
    weight: z.union([z.number(), z.string()]).optional().nullable(),
    goal: z.string().optional().nullable(),
    restrictions: z.string().optional().nullable(),
    numMeals: z.union([z.number(), z.string()]).optional().nullable()
  }).optional().nullable()
})

// POST /api/diet-onboarding/refine-draft
// Allows trainer to ask the AI to correct/refine the diet draft via chat
export async function POST(req) {
  try {
    // Auth: solo admin/trainer pueden refinar borradores de dieta (consume OpenAI).
    const supabase = getSupabase()
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr) {
      console.error('refine-draft auth error:', authErr.status, authErr.message)
      const status = authErr.status === 401 ? 401 : 503
      const msg = authErr.status === 401 ? 'Token inválido o expirado' : 'Error de autenticación, inténtalo de nuevo'
      return NextResponse.json({ error: msg }, { status })
    }
    if (!caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    if (!['admin', 'trainer'].includes(callerProfile?.role)) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

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
El entrenador está revisando el borrador de dieta de un socio y realiza una consulta o pide una corrección.

MACROS OBJETIVO ACTUALES:
- Calorías: ${macros?.calories || '?'} kcal | Proteína: ${macros?.protein_g || '?'}g | Carbohidratos: ${macros?.carbs_g || '?'}g | Grasas: ${macros?.fat_g || '?'}g

DATOS DEL SOCIO:
- Peso: ${weight || '?'}kg | Objetivo: ${goal || '?'} | Comidas: ${numMeals || '?'} | Restricciones: ${restrictions || 'ninguna'}

BORRADOR ACTUAL:
${originalDraft}

MENSAJE / PREGUNTA / CORRECCIÓN SOLICITADA POR EL ENTRENADOR:
"${correction}"

INSTRUCCIONES:
1. Aplica EXACTAMENTE los cambios indicados si los solicita, manteniendo el formato y estructura del borrador original.
2. Responde directamente a cualquier pregunta técnico-nutricional planteada por el entrenador en el campo "explanation", argumentando el motivo de la decisión.
3. Ajusta los gramos de otros alimentos si es necesario para mantener coherencia nutricional.
4. Si la corrección implica alterar calorías o macros, calcula y actualiza los macros totales resultantes.
5. Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{"updatedDietContent": "<texto completo del menú corregido>", "explanation": "<respuesta directa y justificación al entrenador>", "changeSummary": "<bullets breves de cambios si aplica>", "calories": <number>, "protein_g": <number>, "carbs_g": <number>, "fat_g": <number>}`

    const openai = getOpenAI()
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      temperature: 0.4
    })

    let parsedResponse = {}
    try {
      parsedResponse = JSON.parse(aiResponse.choices[0]?.message?.content || '{}')
    } catch (e) {
      console.warn('Failed to parse json in refine-draft:', e)
    }

    const updatedDietContent = parsedResponse.updatedDietContent || originalDraft
    const explanation = parsedResponse.explanation || parsedResponse.changeSummary || 'Ajuste aplicado según las indicaciones.'
    const changeSummary = parsedResponse.changeSummary || explanation
    const updatedMacros = {
      calories: Number(parsedResponse.calories) || macros?.calories || 0,
      protein_g: Number(parsedResponse.protein_g) || macros?.protein_g || 0,
      carbs_g: Number(parsedResponse.carbs_g) || macros?.carbs_g || 0,
      fat_g: Number(parsedResponse.fat_g) || macros?.fat_g || 0,
    }

    return NextResponse.json({
      success: true,
      updatedDietContent,
      explanation,
      changeSummary,
      macros: updatedMacros
    })

  } catch (error) {
    console.error('diet-onboarding/refine-draft error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
