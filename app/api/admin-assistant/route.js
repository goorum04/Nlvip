import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { TOOLS_DEFINITIONS, executeTool, generateExecutionPlan } from '@/lib/adminAssistantTools'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

// El flujo puede encadenar hasta 3 llamadas a Claude (15-30s+), y algunas
// herramientas (generate_member_routine, generate_ai_diet_from_recipes)
// hacen POR SU CUENTA 2-3 llamadas más a OpenAI (planificación + formateo +
// análisis de fotos de progreso) dentro de esa misma ronda. Con 60s el
// job se quedaba colgado en "processing" para siempre en peticiones
// complejas (ej. rutina de 5 días con frecuencia 2 mirando fotos) — Vercel
// mataba la función a mitad de trabajo y el job nunca llegaba a marcarse
// como done/error. En modo background (waitUntil) el trabajo real sigue
// después de responder, así que necesita margen de sobra.
export const maxDuration = 300

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CLAUDE_MODEL = 'claude-sonnet-5'

// Sonnet 5 activa "adaptive thinking" por defecto en cuanto se omite
// `thinking` — y ese pensamiento consume del MISMO max_tokens que la
// respuesta, con riesgo real de truncar la respuesta a medias
// (stop_reason: "max_tokens") si el presupuesto se queda corto. Para un
// asistente de chat + function-calling como este (no una tarea de
// razonamiento profundo tipo coding/agéntico), la guía de Anthropic
// recomienda explícitamente desactivar el pensamiento y bajar el effort:
// mismo o mejor rendimiento que sin pensar, sin la latencia ni el riesgo de
// corte a mitad de respuesta.
const NO_THINKING = { type: 'disabled' }
const LOW_EFFORT = { effort: 'low' }

// Antes maxRetries: 1 ("fallar rápido"). En uso real eso significaba que
// cualquier 429 pasajero (habitual en horas punta, con varias llamadas
// encadenadas por turno) se convertía directamente en un error visible
// para el admin — "límite alcanzado" cada dos por tres. Como esto corre
// como job en segundo plano (no bloquea al admin, solo tarda un poco más
// en el poll), merece más la pena dejar que el SDK reintente con backoff
// antes de rendirse.
const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3 })

// Migrado desde OpenAI (gpt-4o) a Claude — mismo catálogo de herramientas,
// solo cambia la forma en que se describen: OpenAI usa
// {type:'function', function:{name, description, parameters}}, Claude usa
// {name, description, input_schema}. Se calcula una sola vez a partir del
// mismo TOOLS_DEFINITIONS que ya usa runToolExecution/generateExecutionPlan,
// así que lib/adminAssistantTools.js no necesita tocarse.
const CLAUDE_TOOLS = TOOLS_DEFINITIONS.map(t => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters
}))

// Extrae el texto legible de una respuesta de Claude (array de bloques
// text/tool_use/thinking) — equivalente a leer choices[0].message.content
// en OpenAI, donde el content siempre era un string plano.
function extractText(content) {
  return (content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}

// Normaliza los bloques tool_use de Claude a la misma forma que ya
// esperaba todo el código de más abajo (readOnlyTools, generateExecutionPlan,
// executeTool) desde la época de OpenAI: {id, function:{name, arguments}}.
// Así el resto de la orquestación (auto-ejecución de lecturas, plan de
// confirmación, respuesta al cliente) no tiene que cambiar ni una línea.
function normalizeToolCalls(content) {
  return (content || [])
    .filter(b => b.type === 'tool_use')
    .map(b => ({ id: b.id, function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }))
}

// Si el modelo se queda sin texto que devolver (raro, pero puede pasar con
// effort bajo tras una cadena de tools), un genérico tipo "Aquí está la
// información solicitada" es engañoso cuando en realidad una herramienta
// falló — el admin ve un mensaje de éxito vacío y no se entera de que algo
// no se aplicó. Si hay algún error real entre los resultados, se muestra
// ese en vez del genérico.
//
// Prioridad: un resultado que SÍ tuvo éxito (con su propio mensaje) es
// siempre más útil que el error de OTRA llamada en paralelo dentro de la
// misma ronda. Caso real detectado: el modelo intenta primero editar una
// rutina con datos que no tenía (falla con un error críptico), pero en la
// MISMA ronda también la regenera bien vía generate_member_routine (éxito
// con resultado válido) — sin esta prioridad, el admin veía el error del
// primer intento aunque el segundo hubiera funcionado perfectamente.
function fallbackMessage(toolResults, generic) {
  const results = Object.values(toolResults || {})
  const succeeded = results.find(r => r && r.success !== false && r.message)
  if (succeeded) return succeeded.message
  const failed = results.find(r => r && r.success === false)
  if (failed?.error) return `Hubo un problema al ejecutar una acción: ${failed.error}`
  return generic
}

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
2b. member_id SIEMPRE tiene que ser el UUID real que devolvió find_member (u otra herramienta) COMO RESULTADO en ESTA MISMA CONVERSACIÓN — nunca lo inventes, ni un apodo/slug, ni lo "recuerdes" de un resumen en texto de un turno anterior sin repetir la búsqueda. Solo ves el HISTORIAL EN TEXTO de turnos previos, no los resultados de herramientas de entonces: si vas a llamar a algo que necesita member_id y no tienes su UUID real delante ahora mismo (en un resultado de herramienta de este turno), llama a find_member de nuevo primero, en el mismo turno, antes de la herramienta que lo necesita. Un member_id inventado hace que la acción falle en seco cuando el admin confirme.
3. Nunca inventes datos - siempre consulta la información real
4. Responde en español de forma clara y concisa
5. Para acciones que modifiquen datos, incluye una frase breve de qué vas a hacer JUNTO CON la llamada a la herramienta, en el MISMO mensaje — nunca en dos turnos separados. El texto y la llamada a la herramienta van a la vez, no primero uno y luego el otro.
6. PROHIBIDO prometer una acción sin ejecutarla: si tu respuesta contiene "voy a...", "permíteme un momento", "dame un segundo" o cualquier anuncio similar, ese mismo mensaje TIENE que incluir ya la llamada a la herramienta correspondiente. Nunca dejes una promesa para "el siguiente turno" — ni siquiera cuando el admin ya te dijo "sí"/"vale"/"hazlo"/"adelante": eso significa ejecutar YA, no volver a anunciarlo.
7. En cuanto identifiques qué herramienta hace falta, LLÁMALA directamente — no delibera de más ni te pares a explicar lo que vas a hacer antes de hacerlo.

RESPUESTA FINAL — SÉ ÚTIL, NO UN EJECUTOR MUDO (MUY IMPORTANTE):
1. Si el admin te hace una pregunta (técnica, sobre un socio, sobre por qué algo está como está, pidiendo tu opinión), RESPÓNDELA siempre de forma directa y razonada en el mismo turno. No la sustituyas por una acción sin más, no la ignores para pasar a otra cosa, y no te limites a devolver datos en bruto sin interpretarlos.
2. Cuando termines de generar, asignar o modificar algo, tu respuesta no puede quedarse en "Hecho" o un resumen plano de cifras: explica brevemente el PORQUÉ de las decisiones clave que tomaste (ej. "le he puesto 3 series de 10-15 reps porque pidió definición, y evité sentadilla profunda por su rodilla sensible" — no solo "rutina creada"). Esto aplica igual a generar de cero que a editar algo existente.
3. Si el admin cuestiona, corrige o pregunta "¿por qué hiciste X?" sobre algo que ya propusiste o ejecutaste, no apliques el cambio en silencio: reconoce el motivo de tu elección original y explica qué cambia y por qué con la corrección. Si crees que tu decisión original seguía siendo la correcta, dilo y explica por qué antes de aplicar el cambio de todas formas si el admin insiste.
4. Nunca respondas solo con la ejecución de una herramienta sin texto: cada respuesta al admin debe tener contenido en prosa, aunque sea breve.
5. Si el resultado de generate_ai_diet_from_recipes o generate_member_routine trae un campo physique_analysis con contenido, SÍ has mirado sus fotos de progreso más recientes (se analizan automáticamente al generar) — nunca digas que no tienes acceso a fotos. Si hay algo relevante ahí (un punto fuerte o débil visible), menciónalo brevemente en tu respuesta y explica si influyó en alguna decisión. Si el campo viene vacío/null, es que el socio aún no tiene fotos de progreso subidas — dilo así si te preguntan, no que "no puedes ver fotos".

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

REGLA — CORRECCIÓN NUMÉRICA SOBRE UNA DIETA QUE YA ENSEÑASTE (MUY IMPORTANTE): si el admin corrige las calorías de una dieta que le acabas de mostrar ("bájale un poco", "súbele 200 kcal", "ponle unas 2800") vas a volver a llamar a generate_ai_diet_from_recipes — pero SIN el campo target_calories esa llamada IGNORA la corrección y vuelve a calcular con la fórmula estándar del objetivo, devolviendo el mismo número de antes (o uno completamente distinto si cambias el goal). Por eso:
- Si el admin da o confirma una cifra concreta o aproximada, calcula el número resultante (a partir del total que le mostraste) y pásalo en target_calories.
- Si el admin solo dice algo vago ("bájale un poco", "me parece mucho") sin cifra ni referencia previa que te permita calcular una, NO adivines ni regeneres a ciegas: pregúntale primero a qué cifra concreta quiere que lo dejes (puedes proponer 1-2 opciones razonables), y usa target_calories con la que confirme.
- NUNCA reintentes la misma llamada sin target_calories esperando que "esta vez" salga distinto: la fórmula es determinista, siempre devuelve el mismo número mientras no cambies goal o target_calories.

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
1b. LÍMITE CRÍTICO: solo puedes llamar a swap/remove/add/modify_routine_exercise/modify_routine_day con un routine_data real, nunca inventado de memoria. Tienes el routine_data exacto en dos casos: (a) generate_member_routine o una edición te lo devolvió DENTRO DE ESTE MISMO TURNO, como resultado de herramienta; o (b) el mensaje del admin viene precedido de un bloque "[CONTEXTO INTERNO DEL SISTEMA]" con el JSON exacto de la última rutina de ese socio — en ese caso ÚSALO tal cual, es la forma correcta de aplicar un ajuste puntual pedido en un mensaje nuevo, NO llames a generate_member_routine para ese caso (regenerar de cero es lo que antes causaba que cambiaran ejercicios que nadie pidió tocar). Si NINGUNO de los dos casos aplica (no hay resultado de herramienta en este turno NI bloque de contexto para ese socio), NO tienes el routine_data real — NUNCA lo reconstruyas de memoria a partir de tu propio resumen en texto. En ese caso, vuelve a llamar a generate_member_routine con "notes" describiendo la rutina completa que quieres (la estructura que ya tenía + el cambio pedido, ej. "misma distribución de días que antes, pero con más volumen de bíceps: añade un ejercicio extra de bíceps en el día de brazos").
2. Identifica el día por su number 1-based (ej: "día 2" → day_index: 2). Si el admin no dice día y la rutina tiene varios, pregúntale a qué día se refiere.
3. Usa nombres parciales si hace falta (la búsqueda es case-insensitive y por substring), pero si no estás seguro del nombre EXACTO tal cual figura en el catálogo, usa PRIMERO search_exercise_catalog (por término o por grupo muscular) — un nombre "razonable" que no coincida literalmente (ej. "Curl predicador" cuando el catálogo lo llama "Curl en banco predicador") hace que swap/add fallen.
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
async function runToolExecution({ toolCallsToExecute, adminToken, updateStage }) {
  const results = {}
  const errors = []

  await updateStage?.('Ejecutando acciones...')

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

// Fallo conocido del modelo: en vez de llamar a la herramienta en el mismo
// turno, anuncia la acción en texto ("permíteme un momento", "voy a
// generar...", "procederé a...") y se queda ahí — el admin ve una promesa
// que nunca se cumple, ni siquiera insistiendo ("vale", "hazlo"). Amplia
// a propósito (sin anclar al final de la frase): esto solo se consulta
// cuando YA sabemos que no hubo tool_calls, así que pecar de detectar de
// más aquí es gratis — la alternativa (detectar de menos, como pasaba
// antes con "Procederé a crearla ahora mismo.") deja al admin en bucle.
const STALLING_WITHOUT_ACTION = /perm[ií]teme (un momento|un segundo)|dame (un momento|un segundo|unos segundos)|voy a (proceder|generar|modificar|ajustar|crear|hacer|realizar|asignar|buscar|revisar|comprobar|encontrar|mirar|consultar|intentar)|proceder[ée] a|procedo a|intentar[ée] (generar|crear|modificar|asignar|hacer|buscar|encontrar)|en un momento (te|lo|la)|ahora mismo lo (hago|genero|hacemos|ajusto|creo|asigno|busco)|lo (har[ée]|generar[ée]|crear[ée]|asignar[ée]|buscar[ée]|intentar[ée])\b/i

function isStallingWithoutAction(content) {
  return !!content && STALLING_WITHOUT_ACTION.test(content.trim())
}

// Si el admin confirma con una palabra corta ("hazlo", "sí", "dale",
// "adelante", "confirmar", "asígnala"...), casi seguro está reaccionando a
// algo que el asistente dejó a medias en el turno anterior. En vez de
// esperar a que vuelva a fallar para detectarlo, forzamos tool_choice
// desde la PRIMERA llamada — así no gastamos una llamada extra a la API
// (justo lo que dispara el límite de peticiones cuando ya va cargado).
const SHORT_CONFIRMATION = /^\s*(s[ií]|vale|dale|hazlo|hazla|adelante|confirmar?|confirmo|as[ií]gnala|as[ií]gnalo|guárdala|guárdalo|venga|ok(ay)?|correcto|de acuerdo|proceda?)[.!\s]*$/i

function isShortConfirmation(content) {
  return !!content && SHORT_CONFIRMATION.test(content.trim())
}

// Herramientas que solo leen datos — se ejecutan automáticamente sin pedir
// confirmación al admin. Cualquier otra herramienta (asignar, guardar,
// borrar, modificar) se devuelve al cliente como plan de confirmación.
const READ_ONLY_TOOLS = [
  'find_member', 'get_member_summary', 'get_gym_dashboard', 'list_trainers',
  'list_recent_posts', 'generate_diet_plan', 'list_workouts', 'get_member_activity',
  'list_members', 'generate_ai_diet_from_recipes', 'generate_member_routine',
  'search_exercise_catalog',
  'swap_routine_exercise', 'remove_routine_exercise', 'add_routine_exercise',
  'modify_routine_exercise', 'modify_routine_day',
  'list_member_notes', 'list_admin_preferences'
]

// Llamada normal al asistente: puede encadenar hasta 3 llamadas a Claude
// (interpretar → ejecutar tools de lectura → interpretar resultados). Puede
// tardar bastante, por eso corre como job en segundo plano (ver POST).
// Máximo de llamadas encadenadas a Claude en un turno. Antes era una cadena
// fija de 2-3 niveles con "tools" quitado en la última llamada (asumiendo
// que a esas alturas el modelo solo tenía que redactar texto) — en la
// práctica, probando en vivo, el modelo a veces necesita un tercer o cuarto
// paso de verdad (ej: buscar el nombre exacto de un ejercicio en el
// catálogo y DESPUÉS usarlo para añadirlo), y sin "tools" disponible se
// quedaba sin nada que decir. Ahora es un bucle acotado que SIEMPRE deja
// tools disponibles, así el modelo puede seguir actuando hasta que de
// verdad termine o hasta el límite de rondas.
const MAX_ASSISTANT_ROUNDS = 4

// Llamada normal al asistente: encadena hasta MAX_ASSISTANT_ROUNDS llamadas
// a Claude (interpretar → ejecutar tools de lectura → interpretar
// resultados → ...). Puede tardar bastante, por eso corre como job en
// segundo plano (ver POST).
async function runAssistantChat({ anthropic, messages, adminToken, adminPreferencesText, updateStage, lastRoutineContext }) {
  const systemPrompt = buildSystemPrompt(adminPreferencesText)
  // El prompt de sistema + el catálogo de herramientas suman varios miles de
  // tokens fijos que se repiten en CADA una de las hasta 4 llamadas
  // encadenadas por turno — justo lo que agotaba el límite de peticiones con
  // GPT-4o. Son idénticos byte a byte dentro de un mismo turno (y estables
  // entre turnos del mismo admin, ya que adminPreferencesText solo cambia
  // cuando se actualizan sus preferencias), así que se marcan como
  // cacheables: Claude cachea tools+system juntos con un único marcador en
  // el último bloque de system (las tools se renderizan antes, en orden).
  const cachedSystem = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]

  const lastUserContent = [...messages].reverse().find(m => m.role === 'user')?.content
  let toolChoice = isShortConfirmation(lastUserContent) ? { type: 'any' } : { type: 'auto' }

  const convo = [...messages]

  // Si el cliente manda el routine_data exacto de la última rutina de este
  // hilo (ver AdminAssistant.jsx), se lo adjuntamos al mensaje real del
  // admin como contexto interno — así un ajuste puntual pedido en un
  // mensaje NUEVO (no en el mismo turno que generó la rutina) se puede
  // aplicar con swap/modify_routine_exercise sobre el JSON real, en vez de
  // que el modelo tenga que regenerar toda la rutina de memoria a partir de
  // su propio resumen en texto (lo que antes cambiaba ejercicios que nadie
  // pidió tocar — ver regla 1b). Se añade como prefijo del ÚLTIMO mensaje
  // (el real, del admin) en vez de como turno aparte para no romper la
  // alternancia estricta user/assistant que exige la API.
  const lastIdx = convo.length - 1
  if (
    lastRoutineContext?.routine_data &&
    Array.isArray(lastRoutineContext.routine_data.days) &&
    lastIdx >= 0 &&
    convo[lastIdx].role === 'user' &&
    typeof convo[lastIdx].content === 'string'
  ) {
    const contextBlock = `[CONTEXTO INTERNO DEL SISTEMA — no lo menciones ni lo repitas, no es algo que haya escrito el admin]
Última rutina generada/editada en esta conversación para el socio "${lastRoutineContext.member_name || 'sin nombre'}" (member_id: ${lastRoutineContext.member_id || 'desconocido'}):
${JSON.stringify(lastRoutineContext.routine_data)}

Si el mensaje real de abajo pide un ajuste puntual sobre ESTA MISMA rutina de ESTE MISMO socio, usa EXACTAMENTE este JSON como routine_data al llamar a swap_routine_exercise / remove_routine_exercise / add_routine_exercise / modify_routine_exercise / modify_routine_day — no llames a generate_member_routine para ese caso. Si el mensaje real pide otra cosa (otro socio, una rutina nueva, cambios tan amplios que no tiene sentido editar esta), ignora este contexto y actúa según las reglas normales.

---
MENSAJE REAL DEL ADMIN:
${convo[lastIdx].content}`
    convo[lastIdx] = { role: 'user', content: contextBlock }
  }

  const toolResults = {}
  const STAGE_BY_ROUND = ['Pensando en qué hacer...', 'Interpretando los resultados...']

  for (let round = 0; round < MAX_ASSISTANT_ROUNDS; round++) {
    await updateStage?.(STAGE_BY_ROUND[round] || 'Preparando la respuesta...')

    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      system: cachedSystem,
      messages: convo,
      tools: CLAUDE_TOOLS,
      tool_choice: toolChoice,
      thinking: NO_THINKING,
      output_config: LOW_EFFORT,
      // Claude Sonnet 5 rechaza temperature/top_p/top_k con 400 ("deprecated
      // for this model") — a diferencia de OpenAI, aquí la consistencia se
      // controla desde el prompt (ver reglas fijas del asistente), no con un
      // parámetro de sampling.
      max_tokens: round === 0 ? 4000 : 3000
    })

    let content = resp.content
    let text = extractText(content)
    let calls = normalizeToolCalls(content)

    // Fallo conocido del modelo: anuncia una acción ("voy a...", "permíteme
    // un momento") o se queda sin texto tras una tanda de lecturas, en vez
    // de llamar a la herramienta correspondiente en el mismo turno. Forzamos
    // una segunda pasada con tool_choice: 'any'. Si esta también falla (p.
    // ej. rate limit), no reventamos el turno: nos quedamos con la
    // respuesta original.
    if (calls.length === 0 && toolChoice.type === 'auto' && (isStallingWithoutAction(text) || !text)) {
      try {
        await updateStage?.('Ejecutando la acción anunciada...')
        const retry = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          system: cachedSystem,
          messages: [
            ...convo,
            { role: 'assistant', content },
            { role: 'user', content: 'No has llamado a ninguna herramienta todavía, solo has dicho que ibas a hacerlo (o no has dicho nada). No lo anuncies de nuevo: llama YA a la herramienta correspondiente en este mismo turno.' }
          ],
          tools: CLAUDE_TOOLS,
          tool_choice: { type: 'any' },
          thinking: NO_THINKING,
          output_config: LOW_EFFORT,
          max_tokens: round === 0 ? 4000 : 3000
        })
        content = retry.content
        text = extractText(content)
        calls = normalizeToolCalls(content)
      } catch (retryError) {
        console.warn('Reintento de stalling falló (se conserva la respuesta original):', retryError.message)
      }
    }

    convo.push({ role: 'assistant', content })

    // Sin más tool calls: esta es la respuesta final del turno.
    if (calls.length === 0) {
      return {
        message: text || fallbackMessage(toolResults, round === 0 ? 'No entendí tu petición. ¿Puedes reformularla?' : 'Listo'),
        toolCalls: [],
        needsConfirmation: false,
        toolResults
      }
    }

    const autoExecute = calls.filter(c => READ_ONLY_TOOLS.includes(c.function.name))
    const needsConfirmation = calls.filter(c => !READ_ONLY_TOOLS.includes(c.function.name))

    // Ejecutar automáticamente las herramientas de solo lectura, aunque
    // vengan mezcladas con acciones que necesitan confirmación — así el
    // admin ve igualmente esos datos en el plan de confirmación.
    if (autoExecute.length > 0) await updateStage?.('Consultando datos del gimnasio...')
    for (const call of autoExecute) {
      try {
        const args = JSON.parse(call.function.arguments || '{}')
        toolResults[call.id] = await executeTool(call.function.name, args, adminToken)
      } catch (err) {
        toolResults[call.id] = { success: false, error: err.message }
      }
    }

    // Hay acciones que escriben datos: se devuelven para que el admin
    // confirme, sin seguir encadenando llamadas al modelo.
    if (needsConfirmation.length > 0) {
      const executionPlan = generateExecutionPlan(needsConfirmation, toolResults)
      return {
        message: text || 'Voy a realizar las siguientes acciones. ¿Confirmas?',
        toolCalls: needsConfirmation,
        executionPlan,
        needsConfirmation: true,
        toolResults
      }
    }

    // Solo lecturas: se le devuelven los resultados al modelo y se sigue a
    // la siguiente ronda (tools siempre disponibles, para que pueda seguir
    // actuando con lo que acaba de averiguar en vez de quedarse sin nada
    // más que decir).
    const toolResultBlocks = autoExecute.map(call => ({
      type: 'tool_result',
      tool_use_id: call.id,
      content: JSON.stringify(toolResults[call.id])
    }))
    convo.push({ role: 'user', content: toolResultBlocks })
    toolChoice = { type: 'auto' }
  }

  // Se agotaron las rondas sin que el modelo terminara con una respuesta de
  // texto limpia — más honesto decírselo al admin que fingir que se acabó.
  return {
    message: fallbackMessage(toolResults, 'He consultado varios datos pero necesito un paso más para terminar — vuelve a pedírmelo y sigo desde aquí.'),
    toolCalls: [],
    needsConfirmation: false,
    toolResults
  }
}

// Convierte errores técnicos (p.ej. 429 de la API de Claude) en un mensaje
// claro en español para el admin, en vez del texto crudo del proveedor.
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

    const { messages, executeTools = false, toolCallsToExecute = [], background = false, lastRoutineContext = null } = await request.json()

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

    // Actualiza el paso actual mientras el job sigue en processing, para que
    // el cliente pueda mostrar algo más útil que un spinner genérico durante
    // los 15-30s que puede tardar la cadena de llamadas a Claude.
    const updateStage = job?.id
      ? async (stage) => {
          try {
            await supabaseAdmin.from('assistant_jobs').update({ stage }).eq('id', job.id)
          } catch (e) {
            console.warn('updateStage falló (no crítico):', e.message)
          }
        }
      : null

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
        ? await runToolExecution({ toolCallsToExecute, adminToken, updateStage })
        : await runAssistantChat({ anthropic: getAnthropic(), messages, adminToken, adminPreferencesText, updateStage, lastRoutineContext })

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
      // real (puede encadenar varias llamadas a Claude, 15-30s+) — así el
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
      .select('id, status, result, error, created_by, stage')
      .eq('id', jobId)
      .maybeSingle()

    if (error || !job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    if (job.created_by !== user.id) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

    return NextResponse.json({ status: job.status, result: job.result, error: job.error, stage: job.stage })
  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'admin-assistant-job-status' } })
    return NextResponse.json({ error: error.message || 'Error consultando el job' }, { status: 500 })
  }
}
