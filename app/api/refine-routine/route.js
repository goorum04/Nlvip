import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

const schema = z.object({
  routine: z.object({}).passthrough(),
  correction: z.string().min(1).max(1000)
})

// POST /api/refine-routine
// Applies a text/voice correction to a generated routine preview JSON
export async function POST(req) {
  try {
    const identifier = getIdentifier(req)
    const limit = await checkRateLimit(identifier, 30, 60_000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { routine, correction } = parsed.data

    // Fetch exercise catalog for valid substitutions
    const supabase = getSupabase()
    const { data: exercises } = await supabase
      .from('exercises')
      .select('name, muscle_primary, equipment')
      .order('name')

    const catalog = (exercises || [])
      .map(e => `- ${e.name} (músculo: ${e.muscle_primary}, equipo: ${e.equipment})`)
      .join('\n')

    const routineJson = JSON.stringify(routine, null, 2)

    const prompt = `Eres un entrenador personal experto. Tienes esta rutina en JSON y debes aplicar EXACTAMENTE la corrección solicitada sin cambiar nada más.

RUTINA ACTUAL:
${routineJson}

CATÁLOGO DE EJERCICIOS DISPONIBLES (solo puedes usar estos nombres exactos para ejercicios):
${catalog}

CORRECCIÓN SOLICITADA: "${correction}"

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con el JSON actualizado, sin texto adicional ni markdown.
2. Aplica SOLO la corrección indicada. No cambies nada más.
3. Si la corrección implica cambiar un ejercicio, usa el nombre EXACTO del catálogo.
4. Conserva la estructura exacta del JSON (routine_name, routine_description, days, exercises, sets, reps, rest_seconds, superset_group, exercise_id, exercise_name).
5. Si la corrección menciona un día por número o nombre, aplícala solo a ese día.
6. Si la corrección es general (ej: "sube todas las series a 4"), aplícala a todos los días.
7. Los valores de "reps" pueden ser: "10", "8-12", "15-20", "al fallo", "30s".`

    const openai = getOpenAI()
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.2
    })

    const raw = aiResponse.choices[0]?.message?.content || ''
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let updatedRoutine
    try {
      updatedRoutine = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'La IA devolvió un formato inesperado. Inténtalo de nuevo.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, updatedRoutine })
  } catch (error) {
    console.error('refine-routine error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
