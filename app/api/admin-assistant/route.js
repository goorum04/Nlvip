import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { TOOLS_DEFINITIONS, executeTool, generateExecutionPlan } from '@/lib/adminAssistantTools'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.emergent.ai/v1'
})

const SYSTEM_PROMPT = `Eres el Asistente IA del gimnasio NL VIP CLUB. Tu trabajo es ayudar al administrador a gestionar el gimnasio mediante comandos de voz o texto.

IMPORTANTE:
1. SIEMPRE usa las herramientas disponibles para obtener información o realizar acciones
2. Cuando el admin mencione un nombre de socio, PRIMERO usa find_member para buscarlo
3. Nunca inventes datos - siempre consulta la información real
4. Responde en español de forma clara y concisa
5. Para acciones que modifiquen datos, explica qué vas a hacer ANTES de ejecutar

Objetivos que el admin puede pedir:
- "pérdida de grasa" o "definición" → goal: fat_loss
- "mantener" o "mantenimiento" → goal: maintain  
- "ganar músculo" o "volumen" → goal: muscle_gain

Cuando el admin pida aplicar un plan a un socio:
1. Primero busca al socio con find_member
2. Luego usa apply_full_member_plan con el goal correcto

Responde siempre de forma amigable y profesional. Si algo falla, explica el problema de forma sencilla.`

export async function POST(request) {
  try {
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
      max_tokens: 1000
    })

    const assistantMessage = response.choices[0].message
    const toolCalls = assistantMessage.tool_calls || []

    // Si hay tool calls, ejecutar las de solo lectura automáticamente
    if (toolCalls.length > 0) {
      const readOnlyTools = ['find_member', 'get_member_summary', 'get_gym_dashboard', 'list_trainers', 'list_recent_posts']
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
          max_tokens: 1000
        })

        const followUpMessage = followUpResponse.choices[0].message
        const newToolCalls = followUpMessage.tool_calls || []

        // Verificar si hay nuevas tool calls que necesitan confirmación
        const newNeedsConfirmation = newToolCalls.filter(c => !readOnlyTools.includes(c.function.name))

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
