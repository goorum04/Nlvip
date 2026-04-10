import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { TOOLS_DEFINITIONS, executeTool, generateExecutionPlan } from '@/lib/adminAssistantTools'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const DIET_RULES = `
REGLAS DEL PROGRAMA NUTRICIONAL NL VIP:

REGLAS GENERALES:
• Verdura o Ensalada: al gusto con moderación
• Aliño: AOVE solo si se especifica. Si no: limón, lima, especias, sal, vinagre
• Arroces y Pastas: tomate tamizado o rallado (no frito)
• Post-Entrenamiento: 40gr de proteína inmediatamente al terminar

SUPLEMENTACIÓN BÁSICA:
• Omega 3: 1 en desayuno
• Multivitamínico: 1 en desayuno, 1 en cena
• Pre-entreno: 15 min antes de entrenar
• Creatina: 1gr por cada 10kg de peso (diario)
• Post-entreno: 40gr proteína

OBSERVACIONES:
• Sal: OBLIGATORIA en todas las comidas
• Bebidas zero: máximo 1-2 al día
• Cafés/infusiones: máximo 2 al día, sin leche
• Edulcorante: preferir Stevia
• Comida libre: UNA por semana

FLUIDOS:
• Agua: 4-6 litros al día
• NO beber durante las comidas (30 min antes o después)

CÁLCULO DE MACROS:
• Pérdida grasa: TDEE - 15%
• Mantenimiento: TDEE
• Volumen: TDEE + 15%
• Proteína: 2g por kg de peso
• Grasa: 0.8-1g por kg
• Carbos: el resto de calorías
`;

const SYSTEM_PROMPT = `Eres el Asistente IA del gimnasio NL VIP CLUB. Tu trabajo es ayudar al administrador a gestionar el gimnasio mediante comandos de voz o texto.

IMPORTANTE:
1. SIEMPRE usa las herramientas disponibles para obtener información o realizar acciones.
2. NUNCA menciones IDs o UUIDs (cadenas largas de letras y números) en tus respuestas al usuario. Si necesitas referirte a un socio, usa SIEMPRE su nombre.
3. Si hay varios socios con el mismo nombre, usa el apellido para diferenciarlos.
4. Cuando el admin mencione un nombre de socio, PRIMERO usa find_member para buscarlo.
5. Nunca inventes datos - siempre consulta la información real.
6. RECETAS, CATÁLOGO Y RECOMENDACIONES:
   a. Si el usuario pide "cargar recetas" o el catálogo está vacío, usa bulk_import_recipes con varias queries (ej: 'dieta mediterránea', 'gym breakfast', 'high protein dinner').
   b. Al asignar una dieta, DEBES:
      i. Calcular los macros por comida (aprox. Desayuno 25%, Comida 35%, Cena 30%, Snack 10%).
      ii. Buscar recetas en el CATÁLOGO LOCAL que encajen con esos macros usando find_recipes_for_macros para cada slot.
      iii. Si no hay suficientes en el catálogo, usa search_recipe_ideas para buscar nuevas y guárdalas.
      iv. Recomienda las recetas encontradas y ofrece VINCULARLAS (link_recipe_to_diet) para completar el plan del socio.
   c. El objetivo es que el socio tenga un plan de comidas real y variado.
7. Responde en español de forma clara y concisa.
8. Para acciones que modifiquen datos, explica qué vas a hacer ANTES de ejecutar.

Objetivos que el admin puede pedir:
- "pérdida de grasa" o "definición" → goal: fat_loss
- "mantener" o "mantenimiento" → goal: maintain  
- "ganar músculo" o "volumen" → goal: muscle_gain

FLUJO PARA GENERAR/CREAR DIETAS:
1. Cuando el admin pida "genera una dieta", "crea una dieta", "hazme una dieta" para un socio:
   a. PRIMERO busca al socio con find_member para obtener su ID.
   b. DESPUÉS usa generate_diet_plan con el member_id y el goal (objetivo). Si no hay objetivo, asume 'maintain'.
   c. LUEGO usa search_recipe_ideas una o varias veces para encontrar recetas reales que encajen con los macros calculados (especialmente para almuerzo y cena).
   d. Muestra el plan completo al admin, incluyendo los macros calculados Y las sugerencias de recetas de Spoonacular con sus ingredientes y pasos.

2. Cuando el admin pida "aplicar un plan completo" a un socio:
   a. Busca al socio con find_member
   b. Usa apply_full_member_plan (esto asigna dieta + rutina + macros)

CUANDO GENERES O HABLES DE DIETAS, USA ESTAS REGLAS DEL GIMNASIO:
${DIET_RULES}

8. Responde siempre de forma amigable y profesional. Si algo falla, explica el problema de forma sencilla.
9. ATAJOS ESPECIALES (IMPORTANTE): 
   Si el usuario envía un mensaje con el formato 'Acción: [NOMBRE_ACCION]. Pregúntame "¿Para quién?"':
   - Responde ÚNICAMENTE: "¡Claro! ¿Para quién?" (o una variante breve y amable).
   - NO ejecutes ninguna herramienta en ese momento.
   - Quédate a la espera del nombre del socio.
   - Cuando el usuario diga un nombre (ej: "Said"):
     a) Usa find_member para buscarlo.
     b) Si hay UN SOLO resultado, procede a realizar la [NOMBRE_ACCION] para ese socio.
     c) Si hay VARIOS resultados con el mismo nombre, responde preguntando: "He encontrado varios socios con ese nombre: [Lista de nombres con apellidos]. ¿A cuál de ellos te refieres?" y espera la aclaración.
     d) Si no hay resultados, informa al usuario.`

export async function POST(request) {
  try {
    // Verificar autenticación y rol admin
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { messages, executeTools = false, toolCallsToExecute = [] } = await request.json()

    // Si es una petición de ejecución de tools ya confirmados
    if (executeTools && toolCallsToExecute.length > 0) {
      const results = {}
      const errors = []

      for (const toolCall of toolCallsToExecute) {
        try {
          const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args
          const result = await executeTool(toolCall.name, args)
          results[toolCall.id] = result
        } catch (err) {
          errors.push({ id: toolCall.id, name: toolCall.name, error: err.message })
          results[toolCall.id] = { success: false, error: err.message }
        }
      }

      return NextResponse.json({
        success: errors.length === 0,
        results,
        errors: errors.length > 0 ? errors : undefined
      })
    }

    // Llamada normal al asistente
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      tools: TOOLS_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 3000
    })

    const assistantMessage = response.choices[0].message
    const toolCalls = assistantMessage.tool_calls || []

    // Si hay tool calls, ejecutar las de solo lectura automáticamente
    if (toolCalls.length > 0) {
      const readOnlyTools = ['find_member', 'get_member_summary', 'get_gym_dashboard', 'list_trainers', 'list_recent_posts', 'generate_diet_plan', 'list_workouts', 'get_member_activity', 'list_members', 'search_recipe_ideas']
      const autoExecute = []
      const needsConfirmation = []

      for (const call of toolCalls) {
        if (readOnlyTools.includes(call.function.name)) {
          autoExecute.push(call)
        } else {
          needsConfirmation.push(call)
        }
      }

      // Ejecutar automáticamente las herramientas de solo lectura
      const toolResults = {}
      for (const call of autoExecute) {
        try {
          const args = JSON.parse(call.function.arguments || '{}')
          toolResults[call.id] = await executeTool(call.function.name, args)
        } catch (err) {
          toolResults[call.id] = { success: false, error: err.message }
        }
      }

      // Si hay resultados de lectura, hacer una segunda llamada para que el modelo los interprete
      if (autoExecute.length > 0 && needsConfirmation.length === 0) {
        const toolMessages = autoExecute.map(call => ({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResults[call.id])
        }))

        const followUpResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
            assistantMessage,
            ...toolMessages
          ],
          tools: TOOLS_DEFINITIONS,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 3000
        })

        const followUpMessage = followUpResponse.choices[0].message
        const newToolCalls = followUpMessage.tool_calls || []

        // Si hay nuevas tool calls, procesarlas
        if (newToolCalls.length > 0) {
          const newAutoExecute = newToolCalls.filter(c => readOnlyTools.includes(c.function.name))
          const newNeedsConfirmation = newToolCalls.filter(c => !readOnlyTools.includes(c.function.name))

          // Ejecutar automáticamente las nuevas herramientas de solo lectura
          for (const call of newAutoExecute) {
            try {
              const args = JSON.parse(call.function.arguments || '{}')
              toolResults[call.id] = await executeTool(call.function.name, args)
            } catch (err) {
              toolResults[call.id] = { success: false, error: err.message }
            }
          }

          // Si ejecutamos más herramientas de solo lectura, hacer otra llamada al modelo
          if (newAutoExecute.length > 0 && newNeedsConfirmation.length === 0) {
            const newToolMessages = newAutoExecute.map(call => ({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(toolResults[call.id])
            }))

            const finalResponse = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages,
                assistantMessage,
                ...toolMessages,
                followUpMessage,
                ...newToolMessages
              ],
              temperature: 0.7,
              max_tokens: 3000
            })

            return NextResponse.json({
              message: finalResponse.choices[0].message.content || 'Aquí está la información solicitada.',
              toolCalls: [],
              needsConfirmation: false,
              toolResults
            })
          }

          // Si hay acciones que necesitan confirmación
          if (newNeedsConfirmation.length > 0) {
            const executionPlan = generateExecutionPlan(newNeedsConfirmation)
            return NextResponse.json({
              message: followUpMessage.content || 'Voy a realizar las siguientes acciones:',
              toolCalls: newToolCalls,
              executionPlan,
              needsConfirmation: true,
              toolResults
            })
          }
        }

        return NextResponse.json({
          message: followUpMessage.content || 'Listo',
          toolCalls: [],
          needsConfirmation: false,
          toolResults
        })
      }

      // Si hay acciones que necesitan confirmación
      if (needsConfirmation.length > 0) {
        const executionPlan = generateExecutionPlan(needsConfirmation)
        return NextResponse.json({
          message: assistantMessage.content || 'Voy a realizar las siguientes acciones. ¿Confirmas?',
          toolCalls: needsConfirmation,
          executionPlan,
          needsConfirmation: true,
          toolResults
        })
      }
    }

    // Respuesta simple sin tools
    return NextResponse.json({
      message: assistantMessage.content || 'No entendí tu petición. ¿Puedes reformularla?',
      toolCalls: [],
      needsConfirmation: false
    })

  } catch (error) {
    console.error('Admin Assistant Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error del asistente' },
      { status: 500 }
    )
  }
}
