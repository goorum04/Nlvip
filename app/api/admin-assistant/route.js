import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { TOOLS_DEFINITIONS, executeTool, generateExecutionPlan } from '@/lib/adminAssistantTools'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
• Proteína: 2.2-2.4g por kg de peso (dependiendo de la masa muscular)
• Grasa: 0.8-1g por kg
• Carbos: el resto de calorías
`;

const SYSTEM_PROMPT = `Eres el Asistente IA del gimnasio NL VIP TEAM. Tu trabajo es ayudar al administrador a gestionar el gimnasio mediante comandos de voz o texto.

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

FLUJO PARA GENERAR/CREAR DIETAS PERSONALIZADAS CON IA:
1. Cuando el admin diga cosas como:
   - "ponle una dieta baja en calorías a [nombre]"
   - "crea una dieta alta en proteínas para [nombre], que no come pescado"
   - "genérale una dieta para perder grasa a [nombre], que le gusta el pollo"
   a. PRIMERO usa find_member para obtener el UUID del socio
   b. DESPUÉS usa generate_ai_diet_from_recipes con:
      - member_id: el UUID encontrado
      - prompt: descripción de la dieta tal como lo dijo el admin
      - goal: fat_loss / maintain / muscle_gain según el objetivo
      - exclude_ingredients: alimentos que NO puede comer
      - preferences: preferencias del socio
   c. Muestra el plan de dieta generado de forma clara y amigable

2. Cuando el admin pida "genera una dieta" genérica (sin recetas especiales):
   a. PRIMERO busca al socio con find_member para obtener su ID
   b. DESPUÉS usa generate_diet_plan con el member_id y el goal (objetivo)
   c. Muestra el plan de dieta completo al admin

3. Cuando el admin pida "aplicar un plan completo" a un socio:
   a. Busca al socio con find_member
   b. Usa apply_full_member_plan (esto asigna dieta + rutina + macros)

FLUJO PARA GENERAR RUTINAS DE ENTRENAMIENTO PERSONALIZADAS POR VOZ O TEXTO:
1. Cuando el admin diga cosas como:
   - "genera una rutina de hipertrofia para [nombre]"
   - "créale una rutina de fuerza a [nombre], 4 días"
   - "hazle una rutina para perder grasa a [nombre] teniendo en cuenta su formulario"
   a. PRIMERO usa find_member para obtener el UUID del socio.
   b. DESPUÉS usa generate_member_routine con:
      - member_id: el UUID encontrado
      - goal: el objetivo expresado por el admin (ver REGLAS DE INTERPRETACIÓN DEL OBJETIVO más abajo)
      - days_per_week / level / session_duration_min / notes: si el admin los menciona, úsalos. Si no, usa los defaults (4 / intermedio / 60), salvo en casos médicos (ver más abajo).
   c. La herramienta YA lee automáticamente el formulario de onboarding del socio (objetivo, lesiones, restricciones, sexo) y aplica las pautas oficiales del gimnasio (catálogo de ejercicios, filtro por sexo y bloqueo por lesiones). NO pidas estos datos al admin: ya están en el sistema.
   d. Muestra al admin un resumen claro: nombre de la rutina, objetivo, días, número de ejercicios por día y avisos relevantes (lesiones detectadas, ejercicios sustituidos). Pregunta si confirma para asignarla.

REGLAS DE INTERPRETACIÓN DEL OBJETIVO (CRÍTICO — léelo entero):
NO inventes ni infieras objetivos. Mapea solo lo que el admin diga:
- "hipertrofia" / "ganar músculo" / "volumen" → goal: "hipertrofia"
- "fuerza" → goal: "fuerza"
- "definición" / "definir" → goal: "definición"
- "perder peso" / "perder grasa" / "adelgazar" / "quemar grasa" → goal: "pérdida de grasa"
- "resistencia" / "cardio" → goal: "resistencia"

CASOS MÉDICOS / REHABILITACIÓN / VUELTA A LA ACTIVIDAD (PRIORIDAD MÁXIMA):
Si el admin menciona CUALQUIERA de estos contextos, NUNCA uses "pérdida de grasa" como objetivo:
- Acaba de salir del hospital / post-operatorio / post-cirugía
- Lesión reciente / dolor de [zona] / recuperándose de algo
- "Empezar suave" / "vuelta a la actividad" / "lleva tiempo sin entrenar" / "primera vez en gimnasio"
- Edad avanzada / "mayor" / problemas cardíacos / hipertensión / diabetes
- Embarazo / postparto

En estos casos:
- goal: usa "rehabilitación suave" / "acondicionamiento general" / "vuelta a la actividad" según lo que mejor describa la situación. NUNCA "pérdida de grasa".
- level: 'principiante' (siempre)
- session_duration_min: 30-45 (no 60)
- days_per_week: 2-3 (no 4) salvo que el admin pida más
- notes: incluye TEXTUALMENTE el contexto médico mencionado por el admin (ej: "Acaba de salir del hospital, quiere empezar suave"). Esto es crítico porque la IA generadora lo usa para escoger ejercicios apropiados.

REGLA DE ORO: si el admin no dice explícitamente "perder peso" / "perder grasa" / "definición" / "adelgazar", NO uses goal="pérdida de grasa". Cuando dudes, pregunta al admin: "¿Qué objetivo quieres para esta rutina: rehabilitación, acondicionamiento general, hipertrofia, fuerza...?"

RANGOS DE REPS / SERIES / DESCANSO POR DEFECTO:
El generador YA aplica automáticamente el rango correcto según el goal:
- hipertrofia → 3-4 series, 8-12 reps, 60-90s descanso
- fuerza → 4-5 series, 4-6 reps, 120-180s descanso
- definición / pérdida de grasa → 3-4 series, 10-15 reps, 45-60s descanso
- resistencia → 2-3 series, 15-20 reps, 30-45s descanso
- rehabilitación / suave → 2-3 series, 12-15 reps, 60-90s descanso

Tú NO tienes que hacer nada para eso. PERO si el admin pide explícitamente un rango distinto (ej: "rutina de hipertrofia para Eric pero con 5x5", "fuerza con 6-8 reps", "alto volumen 20 reps", "descanso de 2 minutos"), incluye TEXTUALMENTE esa indicación en el campo "notes" al llamar a generate_member_routine. El generador detecta esos overrides en las notas y los respeta sobre el rango por defecto.

Después de generar, si el admin quiere cambiar reps/series/descanso de UN ejercicio en concreto, usa modify_routine_exercise (no regeneres la rutina entera).
2. Cuando el admin confirme con "asígnala", "guárdala", "dale", "confirmar":
   a. Usa save_member_routine pasándole el member_id y el routine_data exacto que devolvió generate_member_routine (o la última edición) en el paso anterior.
   b. Esto crea la plantilla y la asigna al socio.
3. NO uses save_member_routine sin haber generado antes una rutina con generate_member_routine en el mismo hilo.

EDICIÓN DE LA RUTINA ANTES DE ASIGNARLA:
Tras generar la rutina con generate_member_routine, el admin puede pedir cambios. Tienes 4 herramientas que NO guardan nada, solo transforman el preview en memoria:
- swap_routine_exercise: "cambia X por Y", "sustituye X por Y" → reemplaza un ejercicio por otro del catálogo.
- remove_routine_exercise: "quita X", "elimina X", "borra X" → elimina un ejercicio del día.
- add_routine_exercise: "añade X", "mete X", "pon X el día N" → añade un ejercicio del catálogo.
- modify_routine_exercise: "cambia las series de X a 4", "sube las reps de X a 12", "ajusta el descanso de X a 120s" → cambia sets/reps/descanso.

REGLAS IMPORTANTES PARA LA EDICIÓN:
1. Pasa SIEMPRE el routine_data completo de la última versión (la devuelta por generate_member_routine o por la última herramienta de edición). NO inventes el routine_data ni lo simplifiques.
2. Identifica el día por su number 1-based (ej: "día 2" → day_index: 2). Si el admin no dice día y la rutina tiene varios, pregúntale a qué día se refiere.
3. Usa nombres parciales si hace falta (la búsqueda es case-insensitive y por substring).
4. Tras cada edición, muestra al admin un resumen breve de la rutina actualizada y pregunta si quiere otro cambio o si ya la asigna.
5. Cuando el admin diga "asígnala" / "dale", llama a save_member_routine con el routine_data MÁS RECIENTE (el devuelto por la última edición).

CUANDO GENERES O HABLES DE DIETAS, USA ESTAS REGLAS DEL GIMNASIO:
${DIET_RULES}

Responde siempre de forma amigable y profesional. Si algo falla, explica el problema de forma sencilla.`

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin()
  const openai = getOpenAI()
  try {
    // 1. Rate Limiting (Más amplio para el chat del asistente)
    const identifier = getIdentifier(request)
    const { success: limitOk } = await checkRateLimit(identifier, 100, 60000) // 100 reqs/min
    if (!limitOk) {
      return NextResponse.json({ error: 'Too many requests. Límite de 100/min alcanzado.' }, { status: 429 })
    }

    const { messages, executeTools = false, toolCallsToExecute = [] } = await request.json()

    // 2. Authorization Check
    const authHeader = request.headers.get('Authorization')
    const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!adminToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(adminToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'trainer'].includes(profile.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    // Si es una petición de ejecución de tools ya confirmados
    if (executeTools && toolCallsToExecute.length > 0) {
      const results = {}
      const errors = []

      for (const toolCall of toolCallsToExecute) {
        try {
          const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args
          const result = await executeTool(toolCall.name, args, adminToken)
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
      const readOnlyTools = [
        'find_member', 'get_member_summary', 'get_gym_dashboard', 'list_trainers',
        'list_recent_posts', 'generate_diet_plan', 'list_workouts', 'get_member_activity',
        'list_members', 'generate_ai_diet_from_recipes', 'generate_member_routine',
        'swap_routine_exercise', 'remove_routine_exercise', 'add_routine_exercise', 'modify_routine_exercise'
      ]
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
          toolResults[call.id] = await executeTool(call.function.name, args, adminToken)
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
          max_tokens: 2000
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
              toolResults[call.id] = await executeTool(call.function.name, args, adminToken)
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
    Sentry.captureException(error, { tags: { endpoint: 'admin-assistant' } })
    console.error('Admin Assistant Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error del asistente' },
      { status: 500 }
    )
  }
}
