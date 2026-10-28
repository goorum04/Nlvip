// Importa rutinas y dietas escritas a mano por el entrenador (texto libre,
// como las que manda por WhatsApp) al formato estructurado de la app, sin
// inventar nada: ejercicios, series, reps, alimentos y gramos se copian tal
// cual. Devuelve los mismos shapes que generate_member_routine /
// generate_ai_diet_from_recipes para que el chat los muestre como preview y
// save_member_routine / save_ai_diet los asignen.
import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_MODEL = 'claude-sonnet-5'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function extractJson(response) {
  if (response.stop_reason === 'refusal') throw new Error('No se pudo interpretar el texto.')
  const text = response.content.find(b => b.type === 'text')?.text || ''
  return JSON.parse(text)
}

const ROUTINE_SCHEMA = {
  type: 'object',
  properties: {
    routine_name: { type: 'string' },
    routine_description: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day_number: { type: 'integer' },
          day_name: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: { type: 'string' },
                sets: { type: 'integer' },
                reps: { type: 'string' },
                rest_seconds: { type: 'integer' },
                superset_group: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                notes: { type: 'string' },
              },
              required: ['exercise_name', 'sets', 'reps', 'rest_seconds', 'superset_group', 'notes'],
              additionalProperties: false,
            },
          },
        },
        required: ['day_number', 'day_name', 'exercises'],
        additionalProperties: false,
      },
    },
  },
  required: ['routine_name', 'routine_description', 'days'],
  additionalProperties: false,
}

export async function importRoutineFromText({ text, memberName, routineName }) {
  const prompt = `Convierte esta rutina de entrenamiento, escrita a mano por un entrenador, al formato estructurado de la app. ES UNA TRANSCRIPCIÓN, NO UNA CREACIÓN:

REGLAS
- Copia los ejercicios EXACTAMENTE con el nombre que escribió el entrenador, en el mismo orden y en el mismo día. No añadas, quites ni sustituyas ejercicios.
- sets: número de series. reps: tal cual lo escribió, como texto (ej. "12-10-8", "15", "10-12", "5 min", "20 s por lado"). Si una línea es movilidad/calentamiento o estiramiento sin series, usa sets 1 y pon el tiempo/reps en reps.
- Las indicaciones que acompañan a un ejercicio ("última al fallo técnico", "2 RIR", "parada de 1s arriba", "solo si está autorizado"...) van en notes de ese ejercicio, tal cual.
- Si el entrenador agrupa ejercicios en biserie/triserie/superserie, pon el mismo superset_group (1, 2, 3...) en los ejercicios del grupo; si no, null.
- rest_seconds: si el entrenador indica descansos (ej. "2-3 min en músculos grandes y 1 min en pequeños", "60-90 s"), aplícalos: usa el punto medio en segundos. Si no indica nada, 90 para ejercicios con carga y 0 para movilidad/estiramientos.
- Prefija "Movilidad: " a los ejercicios de calentamiento/movilidad y "Estiramiento: " a los estiramientos, para que el socio distinga las fases.
- day_name: el nombre del día tal cual lo puso (ej. "Cuádriceps + Glúteo"), sin "DÍA 1 —".
- routine_description: las indicaciones generales de la rutina (objetivo, duración, descansos, intensidad, avisos importantes), tal cual, en texto plano con saltos de línea. Si no hay, cadena vacía.
- routine_name: ${routineName ? `exactamente "${routineName}"` : `un nombre corto tipo "${memberName || 'Socio'} - <descripción breve de la rutina>"`}.

TEXTO DEL ENTRENADOR:
"""
${text}
"""`

  const response = await getAnthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema: ROUTINE_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  })
  const routine = extractJson(response)
  if (!Array.isArray(routine.days) || routine.days.length === 0) {
    throw new Error('No he encontrado ningún día de entrenamiento en el texto.')
  }
  routine.days = routine.days
    .map((d, i) => ({ ...d, day_number: i + 1, exercises: Array.isArray(d.exercises) ? d.exercises : [] }))
  return routine
}

const DIET_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    calories: { type: 'integer' },
    protein_g: { type: 'integer' },
    carbs_g: { type: 'integer' },
    fat_g: { type: 'integer' },
    content: { type: 'string' },
  },
  required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'content'],
  additionalProperties: false,
}

export async function importDietFromText({ text, memberName, macros = {} }) {
  const givenMacros = ['calories', 'protein_g', 'carbs_g', 'fat_g']
    .filter(k => macros[k])
    .map(k => `${k}=${macros[k]}`)
    .join(', ')

  const prompt = `Convierte esta dieta, escrita a mano por un entrenador, al formato de documento de la app. ES UNA TRANSCRIPCIÓN, NO UNA CREACIÓN: alimentos, gramos, opciones y reglas se copian tal cual, sin añadir, quitar ni "mejorar" nada.

FORMATO OBLIGATORIO DEL CAMPO content (markdown):
# PROGRAMA NUTRICIONAL

## TUS MACROS DIARIOS
🔥 Calorías: X kcal
🥩 Proteína: X g
🍚 Hidratos de carbono: X g
🥑 Grasas: X g

(aquí, si el entrenador escribió una introducción o instrucciones generales como "elige la opción que más te apetezca", cópialas)

## DISTRIBUCIÓN DE COMIDAS

<emoji> NOMBRE DE LA COMIDA (lo que el entrenador ponga entre paréntesis, p. ej. hora o reparto de macros):
- Opción 1: alimentos con sus gramos
- Opción 2: ...

(una sección por comida, en el mismo orden. Emojis: 🌅 desayuno, ☀️ comida/almuerzo, 🍎 merienda, 🌙 cena, 🥤 batido, 🌜 recena. La cabecera de cada comida va SOLA en su línea y termina en ":"; cada opción empieza por "- Opción N: ". Si una comida tiene una sola propuesta sin numerar, escríbela como "- " seguido del contenido.)

## REGLAS GENERALES PARA TODAS LAS COMIDAS
(bullets con "* " copiando las reglas del entrenador; si no hay, omite la sección)

## OBSERVACIONES GENERALES / ## ACTIVIDAD DIARIA / ## FLUIDOS
(solo si el entrenador incluyó algo equivalente; copia su texto)

MACROS: ${givenMacros ? `usa exactamente estos: ${givenMacros}.` : 'si el texto indica calorías y macros totales, úsalos; si no, calcúlalos aproximadamente a partir de la primera opción de cada comida y redondea.'}
name: "Dieta - ${memberName || 'Socio'}".

TEXTO DEL ENTRENADOR:
"""
${text}
"""`

  const response = await getAnthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema: DIET_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  })
  const diet = extractJson(response)
  if (!diet.content || !/- Opci[oó]n|^- /m.test(diet.content)) {
    throw new Error('No he encontrado comidas con opciones en el texto.')
  }
  return diet
}
