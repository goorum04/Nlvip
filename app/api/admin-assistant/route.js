import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { TOOLS_DEFINITIONS, executeTool, generateExecutionPlan } from '@/lib/adminAssistantTools'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

// El flujo puede encadenar hasta 3 llamadas a OpenAI (15-30s+). En modo
// background (waitUntil) el trabajo real sigue después de responder, así
// que necesita el mismo margen o más que en modo síncrono.
export const maxDuration = 60

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// maxRetries bajo: si hay rate limit, mejor fallar rápido y que el admin
// vea el aviso a los pocos segundos (el poll del cliente lo recoge en su
// siguiente vuelta) que esperar ~40s a que el SDK agote sus reintentos.
const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 })

const DIET_RULES = `
SISTEMA NL ELITE — REGLAS DEL PROGRAMA NUTRICIONAL:

METODOLOGÍA:
• Recomposición corporal, adherencia extrema, sostenibilidad, precisión quirúrgica
• La mejor dieta es la que el cliente puede mantener durante meses
• TODO cuadrado al milímetro. 4 comidas + 4 opciones intercambiables por comida
• Pesos siempre en crudo. Solo macros al final de cada opción: P: | HC: | G:

REGLAS GENERALES:
• Aliño: AOVE solo si se especifica. Si no: limón, lima, especias, sal, vinagre
• Arroces y Pastas: tomate tamizado o rallado (no frito)
• Post-Entrenamiento: proteína ISO inmediatamente al terminar (35g mujeres / 45g hombres)
• NO usar término "whey" → usar "proteína ISO"

SUPLEMENTACIÓN HOMBRES (después desayuno):
• Omega 3 → 2 perlas | Multivitamínico → 1 | D3K2 → 1 | Androbull → 2 tomas (desayuno/cena)

SUPLEMENTACIÓN MUJERES (después desayuno):
• Omega 3 → 3 cápsulas | Multivitamínico → 1 | D3K2 → 1 | Maca → 1

INTRA-ENTRENO: Cell Pro + Creatina (1g/10kg, TODOS los días) + BCAA + Glutamina 10g
PRE-CAMA: Ashwagandha + Magnesio bisglicinato
SITUACIONAL: Carblocker (comida libre) | Termogénico+Diurético (definición, máx 2 meses)

OBSERVACIONES:
• Sal: OBLIGATORIA en todas las comidas
• Bebidas zero: máximo 1-2 al día | Cafés: máximo 2 al día, sin leche
• Edulcorante: prioridad Stevia, si no Sacarina | Evitar azúcar
• Comida libre: UNA por semana sustituyendo la que toque

FLUIDOS:
• Agua: 4-6 litros al día
• NO beber durante las comidas (30 min antes o después)

CÁLCULO DE MACROS:
• Pérdida grasa: TDEE - 15% | Mantenimiento: TDEE | Volumen: TDEE + 15%
• Proteína: ~2,2g/kg | Grasa: 0,9g/kg | Carbos: el resto de calorías
`;


const buildSystemPrompt = (adminPreferencesText) => `Eres el Asistente IA del gimnasio NL VIP TEAM. Tu trabajo es ayudar al administrador a gestionar el gimnasio mediante comandos de voz o texto.
${adminPreferencesText ? `
CÓMO TRABAJA ESTE ADMIN (aprendido de conversaciones anteriores — aplícalo SIEMPRE, en cualquier socio, sin que tenga que repetirlo):
${adminPreferencesText}
` : ''}
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
   d. Muestra al admin un resumen claro: nombre de la rutina, objetivo, días, número de ejercicios por día y avisos relevantes (lesiones detectadas, ejercicios sustituidos). Pregunta si confirma para ASIGNARLA (guardarla) — NO para generarla.

REGLA CRÍTICA — NUNCA PIDAS PERMISO ANTES DE GENERAR: generate_member_routine es de solo lectura/vista previa (no guarda nada en la base de datos hasta que se llama a save_member_routine aparte). Por eso, en cuanto tengas member_id + criterios, LLAMA A LA HERRAMIENTA DIRECTAMENTE en el mismo turno — nunca respondas solo con texto tipo "voy a proceder a generarla" o "¿confirmas que la genere?" sin haber hecho ya la llamada. Si el admin ya pidió generar una rutina y tú solo hablaste de ello sin llamar a la herramienta, y el admin responde "sí"/"vale"/"adelante", eso significa EJECUTA LA HERRAMIENTA AHORA, no vuelvas a describir lo que vas a hacer.

REGLA — BASAR EN LA RUTINA ACTUAL: si el admin pide "que sea en base a su rutina actual", "conservando el orden/estructura de días", "que el lunes siga siendo glúteo" o similar, indícalo TEXTUALMENTE en el campo "notes" al llamar a generate_member_routine (ej: notes: "Mantener exactamente la misma agrupación de músculos por día que su rutina actual (mismo tema cada día, mismo orden), cambiando los ejercicios concretos dentro de cada día."). El generador ya carga la rutina anterior del socio como contexto, pero solo prioriza mantener su ESTRUCTURA de días si se lo pides explícitamente en las notas — por defecto puede proponer un split distinto.

REGLA — ESTRUCTURA DÍA A DÍA DETALLADA DEL ADMIN (MUY IMPORTANTE, léela bien): cuando el admin describe qué quiere entrenar CADA día con detalle (qué grupos musculares, cuántos ejercicios de cada uno, qué va en biserie...) — aunque venga en un solo mensaje largo, coloquial y sin puntuación perfecta — tu trabajo es TRANSCRIBIR esa estructura completa y literal al campo "notes", día por día, tal cual la dio. NO la resumas, NO la parafrasees, NO la acortes a algo genérico tipo "rutina personalizada centrada en espalda y piernas": eso es exactamente lo que hace que el generador pierda el detalle y acabe inventando su propio reparto de grupos musculares por día, distinto de lo que pidió el admin. Si notes queda largo, no pasa nada — no hay límite práctico de longitud, prioriza la fidelidad sobre la brevedad. Ejemplo: si el admin dice "lunes espalda y hombro posterior con gemelos biseriados, martes pecho y hombro lateral y frontal con biserie suave y 2 de abs...", notes debe reproducir eso día por día, no resumirlo en una frase.

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
- modify_routine_exercise: "cambia las series de X a 4", "sube las reps de X a 12", "ajusta el descanso de X a 120s" → cambia sets/reps/descanso de UN ejercicio concreto.
- modify_routine_day: "que el día 4 sea de fuerza", "menos reps y más peso en el día 2", "sube las series del día 1 a 4", "el día 3 con 8-12 reps" → cambia sets/reps/descanso de TODOS los ejercicios de un día. Cuando el admin diga un objetivo (fuerza/hipertrofia/definición/resistencia) para un día concreto, mapea al rango: fuerza→4-5 series 4-6 reps 120-180s; hipertrofia→3-4 series 8-12 reps 60-90s; definición→3-4 series 10-15 reps 45-60s; resistencia→2-3 series 15-20 reps 30-45s. Frases tipo "menos reps y más peso" = fuerza (4-6 reps).

REGLAS IMPORTANTES PARA LA EDICIÓN:
1. Pasa SIEMPRE el routine_data completo de la última versión (la devuelta por generate_member_routine o por la última herramienta de edición). NO inventes el routine_data ni lo simplifiques.
2. Identifica el día por su number 1-based (ej: "día 2" → day_index: 2). Si el admin no dice día y la rutina tiene varios, pregúntale a qué día se refiere.
3. Usa nombres parciales si hace falta (la búsqueda es case-insensitive y por substring).
4. Tras cada edición, muestra al admin un resumen breve de la rutina actualizada y pregunta si quiere otro cambio o si ya la asigna.
5. Cuando el admin diga "asígnala" / "dale", llama a save_member_routine con el routine_data MÁS RECIENTE (el devuelto por la última edición).

CUANDO GENERES O HABLES DE DIETAS, USA ESTAS REGLAS DEL GIMNASIO:
${DIET_RULES}

MEMORIA DEL ASISTENTE — CUÁNDO GUARDAR ALGO PARA RECORDARLO SIEMPRE:
El asistente puede recordar cosas de una conversación a otra. Hay dos tipos de memoria, no las mezcles:

1. NOTA DE UN SOCIO CONCRETO (add_member_note): algo duradero sobre ESE socio en particular que no sea una aversión de alimento (para comida usa add_food_aversion). Ejemplos: "hombro sensible al hacer press", "prefiere barra recta en curl de bíceps y tríceps", "no le gusta hacer cardio en cinta". Guárdalo en cuanto el admin diga algo así sobre un socio con nombre, SIN esperar a que diga "recuérdalo" — es su forma normal de darte contexto duradero. Estas notas se cargan automáticamente cada vez que generes una rutina o dieta para ese socio.

2. PREFERENCIA GENERAL DEL ADMIN (remember_admin_preference): algo sobre CÓMO le gusta trabajar al admin en general, no ligado a un socio. Ejemplos: "para el día de empuje siempre agrupa hombro con tríceps", "usa 'barra recta' como término para bíceps y tríceps", "prefiere que los resúmenes sean breves". Guárdalo cuando detectes un patrón que el admin repite o corrige más de una vez, o cuando diga explícitamente "recuerda que...", "acuérdate de que...", "a partir de ahora...". Esto se aplica SIEMPRE a partir de entonces, con cualquier socio.

Si dudas si algo es específico de un socio o una preferencia general, pregúntale al admin antes de guardarlo. Usa list_member_notes / list_admin_preferences si el admin pregunta "¿qué recuerdas de X?" o "¿qué sabes de mi forma de trabajar?".

CORRECCIÓN DE UNA NOTA YA GUARDADA — MUY IMPORTANTE: si le muestras al admin una nota/preferencia guardada (con list_member_notes o list_admin_preferences, o porque la aplicaste en algo que generaste) y el admin te dice que está mal, que ya no es así, o te da la versión correcta, NO guardes solo la versión nueva dejando la vieja — eso deja dos notas contradictorias en memoria para siempre. En su lugar: 1º elimina la nota incorrecta (remove_member_note / remove_admin_preference, con el texto de la nota vieja), 2º guarda la nota corregida (add_member_note / remember_admin_preference). Haz ambas llamadas en el mismo turno.
- Si el admin solo corrige UNA parte de una nota que mezclaba varias cosas (ej. la nota decía "barra recta en curl de bíceps y tríceps" y el admin solo corrige lo de tríceps), NO descartes lo demás: al guardar la nota corregida, conserva textualmente la parte que seguía siendo correcta (ej. guarda "Curl de bíceps con barra recta; tríceps con polea" en vez de perder la parte de bíceps).
- Si tiene varias notas SEPARADAS y solo corrige una, las demás no se tocan — cada nota es independiente.

Responde siempre de forma amigable y profesional. Si algo falla, explica el problema de forma sencilla.`

// Ejecuta las tool calls ya confirmadas por el admin (acciones que escriben datos).
async function runToolExecution({ toolCallsToExecute, adminToken }) {
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

  return {
    success: errors.length === 0,
    results,
    errors: errors.length > 0 ? errors : undefined
  }
}

// Llamada normal al asistente: puede encadenar hasta 3 llamadas a OpenAI
// (interpretar → ejecutar tools de lectura → interpretar resultados). Puede
// tardar bastante, por eso corre como job en segundo plano (ver POST).
async function runAssistantChat({ openai, messages, adminToken, adminPreferencesText }) {
  const systemPrompt = buildSystemPrompt(adminPreferencesText)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    tools: TOOLS_DEFINITIONS,
    tool_choice: 'auto',
    // Con 0.7 el asistente variaba qué herramienta usaba o se saltaba reglas
    // del prompt (p. ej. el objetivo o el formato) entre peticiones casi
    // idénticas — "hace lo que quiere". Bajado a 0.2: para un asistente que
    // sobre todo tiene que elegir bien la herramienta y seguir reglas fijas,
    // no redactar con voz propia, la consistencia importa más que la variedad.
    temperature: 0.2,
    max_tokens: 4000
  })

  const assistantMessage = response.choices[0].message
  const toolCalls = assistantMessage.tool_calls || []

  // Si hay tool calls, ejecutar las de solo lectura automáticamente
  if (toolCalls.length > 0) {
    const readOnlyTools = [
      'find_member', 'get_member_summary', 'get_gym_dashboard', 'list_trainers',
      'list_recent_posts', 'generate_diet_plan', 'list_workouts', 'get_member_activity',
      'list_members', 'generate_ai_diet_from_recipes', 'generate_member_routine',
      'swap_routine_exercise', 'remove_routine_exercise', 'add_routine_exercise',
      'modify_routine_exercise', 'modify_routine_day',
      'list_member_notes', 'list_admin_preferences'
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
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          assistantMessage,
          ...toolMessages
        ],
        tools: TOOLS_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.2,
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
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
              assistantMessage,
              ...toolMessages,
              followUpMessage,
              ...newToolMessages
            ],
            temperature: 0.3,
            max_tokens: 3000
          })

          return {
            message: finalResponse.choices[0].message.content || 'Aquí está la información solicitada.',
            toolCalls: [],
            needsConfirmation: false,
            toolResults
          }
        }

        // Si hay acciones que necesitan confirmación
        if (newNeedsConfirmation.length > 0) {
          const executionPlan = generateExecutionPlan(newNeedsConfirmation)
          return {
            message: followUpMessage.content || 'Voy a realizar las siguientes acciones:',
            toolCalls: newToolCalls,
            executionPlan,
            needsConfirmation: true,
            toolResults
          }
        }
      }

      return {
        message: followUpMessage.content || 'Listo',
        toolCalls: [],
        needsConfirmation: false,
        toolResults
      }
    }

    // Si hay acciones que necesitan confirmación
    if (needsConfirmation.length > 0) {
      const executionPlan = generateExecutionPlan(needsConfirmation)
      return {
        message: assistantMessage.content || 'Voy a realizar las siguientes acciones. ¿Confirmas?',
        toolCalls: needsConfirmation,
        executionPlan,
        needsConfirmation: true,
        toolResults
      }
    }
  }

  // Respuesta simple sin tools
  return {
    message: assistantMessage.content || 'No entendí tu petición. ¿Puedes reformularla?',
    toolCalls: [],
    needsConfirmation: false
  }
}

// Convierte errores técnicos (p.ej. 429 de OpenAI) en un mensaje claro en
// español para el admin, en vez del texto crudo del proveedor.
function friendlyJobError(error) {
  const raw = error?.message || ''
  if (error?.status === 429 || /rate limit/i.test(raw)) {
    return 'Ahora mismo tengo demasiadas peticiones a la vez (límite de uso de la IA). Espera unos 20-30 segundos e inténtalo de nuevo.'
  }
  if (error?.status === 401 || /invalid api key|incorrect api key/i.test(raw)) {
    return 'Hay un problema de configuración con la IA. Avisa al desarrollador.'
  }
  return raw || 'Error del asistente'
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    // 1. Rate Limiting (Más amplio para el chat del asistente)
    const identifier = getIdentifier(request)
    const { success: limitOk } = await checkRateLimit(identifier, 100, 60000) // 100 reqs/min
    if (!limitOk) {
      return NextResponse.json({ error: 'Too many requests. Límite de 100/min alcanzado.' }, { status: 429 })
    }

    const { messages, executeTools = false, toolCallsToExecute = [], background = false } = await request.json()

    // 2. Authorization Check
    const authHeader = request.headers.get('Authorization')
    const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!adminToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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

    // 3. Registrar el job (para trazabilidad / consulta) y procesar.
    //
    // IMPORTANTE — compatibilidad con la app YA instalada desde el App Store:
    // ese JS quedó fijado en la última build de Xcode y espera recibir
    // {message, toolCalls, ...} directamente en la respuesta del POST, tal
    // como funcionaba antes — no sabe preguntar por un jobId. Por eso el
    // modo asíncrono de verdad SOLO se activa si el cliente manda
    // `background: true` en el body, cosa que la app antigua nunca hace.
    // Sin ese flag, esta ruta se comporta exactamente igual que siempre
    // (síncrona, resultado completo en la misma respuesta) — cero riesgo
    // para los dispositivos que aún no tienen la próxima build.
    const { data: job } = await supabaseAdmin
      .from('assistant_jobs')
      .insert({
        created_by: user.id,
        status: 'processing',
        request: { messages: messages || null, executeTools, toolCallsToExecute },
      })
      .select('id')
      .single()

    const runAndFinish = async () => {
      let adminPreferencesText = ''
      if (!(executeTools && toolCallsToExecute?.length > 0)) {
        try {
          const { data } = await supabaseAdmin.rpc('rpc_get_admin_preferences_text')
          adminPreferencesText = data || ''
        } catch (e) {
          console.warn('rpc_get_admin_preferences_text falló, se ignoran preferencias:', e.message)
        }
      }

      const result = executeTools && toolCallsToExecute?.length > 0
        ? await runToolExecution({ toolCallsToExecute, adminToken })
        : await runAssistantChat({ openai: getOpenAI(), messages, adminToken, adminPreferencesText })

      if (job?.id) {
        await supabaseAdmin
          .from('assistant_jobs')
          .update({ status: 'done', result, updated_at: new Date().toISOString() })
          .eq('id', job.id)
      }
      return result
    }

    if (background && job?.id) {
      // Cliente nuevo: responde YA con el jobId. waitUntil mantiene la
      // función viva DESPUÉS de haber respondido para terminar el trabajo
      // real (puede encadenar varias llamadas a OpenAI, 15-30s+) — así el
      // admin puede minimizar o cerrar la app y el job sigue y termina en
      // el servidor de todas formas. El cliente lo recoge sondeando GET
      // ?jobId=... (o solo, al volver, gracias al id guardado en localStorage).
      waitUntil(
        runAndFinish().catch(async (error) => {
          Sentry.captureException(error, { tags: { endpoint: 'admin-assistant-background' } })
          await supabaseAdmin
            .from('assistant_jobs')
            .update({ status: 'error', error: friendlyJobError(error), updated_at: new Date().toISOString() })
            .eq('id', job.id)
        })
      )
      return NextResponse.json({ jobId: job.id })
    }

    // Modo síncrono (comportamiento de siempre): se espera aquí mismo.
    const result = await runAndFinish()
    return NextResponse.json({ jobId: job?.id, ...result })
  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'admin-assistant' } })
    console.error('Admin Assistant Error:', error)
    return NextResponse.json(
      { error: friendlyJobError(error) },
      { status: 500 }
    )
  }
}

// GET /api/admin-assistant?jobId=... — consulta el estado de un job en curso.
// El cliente lo sondea cada pocos segundos (y al volver del segundo plano)
// hasta que status pase a 'done' o 'error'.
export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    const jobId = new URL(request.url).searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ error: 'jobId requerido' }, { status: 400 })
    }

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: job, error } = await supabaseAdmin
      .from('assistant_jobs')
      .select('id, status, result, error, created_by')
      .eq('id', jobId)
      .maybeSingle()

    if (error || !job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    if (job.created_by !== user.id) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

    return NextResponse.json({ status: job.status, result: job.result, error: job.error })
  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'admin-assistant-job-status' } })
    return NextResponse.json({ error: error.message || 'Error consultando el job' }, { status: 500 })
  }
}
