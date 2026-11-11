import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CLAUDE_MODEL = 'claude-opus-5-5'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  dietTemplateId: z.string().uuid(),
  force: z.boolean().optional().default(false),
})

const SHOPPING_LIST_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'string' },
                note: { type: 'string' },
              },
              required: ['name', 'quantity', 'note'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'items'],
        additionalProperties: false,
      },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'categories', 'tips'],
  additionalProperties: false,
}

const CATEGORY_ORDER = ['Proteínas', 'Lácteos y huevos', 'Hidratos', 'Frutas', 'Verduras', 'Grasas y frutos secos', 'Suplementos', 'Despensa y otros']

async function generateShoppingList(dietContent, dietName) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `Eres el nutricionista de un gimnasio en España. A partir de esta dieta, prepara la LISTA DE LA COMPRA para UNA SEMANA, pensada para que la persona la lleve al supermercado desde el móvil.

Reglas:
- La dieta tiene varias opciones por comida. Asume que la persona irá variando entre opciones a lo largo de la semana; calcula cantidades semanales aproximadas y redondeadas a formatos de compra reales (p. ej. "1,5 kg", "2 docenas", "2 botes de 500 g", "1 bolsa"). No hace falta precisión de gramo.
- Si la dieta es para varias personas (cantidades separadas por barras o nombres), suma para todas y dilo en el resumen.
- Agrupa por categorías, usando exactamente estos nombres cuando encajen: ${CATEGORY_ORDER.join(', ')}. No inventes categorías nuevas salvo que haga falta.
- Un alimento solo aparece una vez en toda la lista (no lo repitas en dos categorías).
- "note" es opcional (cadena vacía si no hace falta): úsala para indicar para qué comidas es o una alternativa ("o pechuga de pavo").
- Lo que es "al gusto" (especias, tomate al gusto, verdura libre) va en "Despensa y otros" o "Verduras" con cantidad "al gusto".
- Suplementos (proteína en polvo, creatina...) solo si aparecen en la dieta.
- "tips": 2 o 3 consejos cortos de compra o conservación (congelar en raciones, comprar a granel...). Castellano de España.
- "summary": una frase, p. ej. "Lista para 7 días de la dieta de 2.800 kcal, variando opciones".

Nombre de la dieta: ${dietName || 'sin nombre'}

DIETA:
${dietContent}`

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    // Esfuerzo bajo: para una lista de la compra sobra, y tarda la mitad.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SHOPPING_LIST_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  })
  if (response.stop_reason === 'refusal') throw new Error('No se pudo generar la lista (respuesta rechazada)')
  const text = response.content.find(b => b.type === 'text')?.text || ''
  const parsed = JSON.parse(text)
  // Orden estable de categorías para que la lista se lea siempre igual.
  parsed.categories.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.name), ib = CATEGORY_ORDER.indexOf(b.name)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  return parsed
}

// POST /api/diet-shopping-list  { dietTemplateId, force? }
// Devuelve la lista de la compra semanal de una dieta. Se genera con IA la
// primera vez y se guarda en diet_templates.shopping_list; `force` la rehace.
// Puede pedirla el socio que tiene esa dieta asignada, o admin/entrenador.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    const { dietTemplateId, force } = parsed.data

    const [{ data: caller }, { data: diet }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabase.from('diet_templates').select('id, name, content, shopping_list, shopping_list_generated_at').eq('id', dietTemplateId).maybeSingle(),
    ])
    if (!diet) return NextResponse.json({ error: 'Dieta no encontrada' }, { status: 404 })

    const isStaff = caller && ['admin', 'trainer'].includes(caller.role)
    if (!isStaff) {
      const { data: assigned } = await supabase.from('member_diets').select('id').eq('member_id', user.id).eq('diet_template_id', dietTemplateId).maybeSingle()
      if (!assigned) return NextResponse.json({ error: 'Esta dieta no es tuya' }, { status: 403 })
    }

    if (diet.shopping_list && !(force && isStaff)) {
      return NextResponse.json({ shoppingList: diet.shopping_list, generatedAt: diet.shopping_list_generated_at, cached: true })
    }
    if (!diet.content || diet.content.trim().length < 50) {
      return NextResponse.json({ error: 'La dieta no tiene contenido suficiente para hacer la lista' }, { status: 400 })
    }

    const shoppingList = await generateShoppingList(diet.content, diet.name)
    const generatedAt = new Date().toISOString()
    await supabase.from('diet_templates').update({ shopping_list: shoppingList, shopping_list_generated_at: generatedAt }).eq('id', dietTemplateId)

    return NextResponse.json({ shoppingList, generatedAt, cached: false })
  } catch (error) {
    console.error('diet-shopping-list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
