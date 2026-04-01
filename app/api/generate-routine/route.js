import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `Eres un entrenador personal experto en diseño de rutinas de hipertrofia y fuerza.
Tu tarea es generar una rutina de entrenamiento estructurada en formato JSON.

REGLAS:
1. Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.
2. Elige los ejercicios EXCLUSIVAMENTE de la lista de catálogo proporcionada.
3. Usa el nombre exacto del ejercicio tal como aparece en el catálogo.
4. Distribuye los grupos musculares inteligentemente para evitar sobreentrenar músculos sinérgicos en días consecutivos.
5. Los ejercicios de PECHO (only_male: true) NO deben asignarse a rutinas generales — solo si el trainer lo indica explícitamente.
6. Incluye entre 5 y 8 ejercicios por día según la duración indicada.
7. Los valores de "reps" pueden ser: "10", "8-12", "15-20", "al fallo", "30s".

FORMATO JSON DE RESPUESTA:
{
  "routine_name": "string",
  "routine_description": "string",
  "days": [
    {
      "day_number": 1,
      "day_name": "string (ej: Espalda y Bíceps)",
      "exercises": [
        {
          "exercise_name": "string (nombre exacto del catálogo)",
          "sets": 4,
          "reps": "10-12",
          "rest_seconds": 90,
          "notes": "string o null"
        }
      ]
    }
  ]
}`

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 })
    }

    const body = await request.json()
    const { trainer_id, criteria } = body

    if (!criteria) {
      return NextResponse.json({ error: 'Se requieren criterios para generar la rutina' }, { status: 400 })
    }

    const { days_per_week, goal, level, equipment = [], session_duration_min = 60, notes = '' } = criteria

    // Cargar catálogo de ejercicios desde Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: catalog, error: catalogError } = await supabase
      .from('exercises')
      .select('id, name, muscle_primary, equipment, difficulty, default_sets, default_reps, default_rest_seconds, only_male')
      .eq('is_global', true)
      .order('muscle_primary')
      .order('name')

    if (catalogError || !catalog?.length) {
      return NextResponse.json({
        error: 'No se pudo cargar el catálogo de ejercicios. Asegúrate de haber ejecutado el seed.'
      }, { status: 500 })
    }

    // Formatear catálogo para el prompt (excluir pecho por defecto)
    const catalogLines = catalog
      .filter(e => !e.only_male)
      .map(e => `- ${e.name} (músculo: ${e.muscle_primary}, equipo: ${e.equipment}, dificultad: ${e.difficulty}, series: ${e.default_sets}, reps: ${e.default_reps})`)
      .join('\n')

    const userMessage = `Genera una rutina de entrenamiento con los siguientes criterios:
- Días por semana: ${days_per_week}
- Objetivo: ${goal}
- Nivel: ${level}
- Equipamiento disponible: ${equipment.length > 0 ? equipment.join(', ') : 'todo el equipamiento del catálogo'}
- Duración aproximada por sesión: ${session_duration_min} minutos
- Notas adicionales: ${notes || 'ninguna'}

CATÁLOGO DE EJERCICIOS DISPONIBLES:
${catalogLines}

Genera exactamente ${days_per_week} días. Responde solo con el JSON.`

    // Llamar a OpenAI
    const openai = new OpenAI({ apiKey })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000
    })

    const content = response.choices[0]?.message?.content || ''
    let routineJson
    try {
      routineJson = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'No se pudo generar la rutina. Inténtalo de nuevo.' }, { status: 400 })
    }

    if (!routineJson.days || !Array.isArray(routineJson.days)) {
      return NextResponse.json({ error: 'Formato de rutina incorrecto. Inténtalo de nuevo.' }, { status: 400 })
    }

    // Guardar en la base de datos
    const { data: template, error: templateError } = await supabase
      .from('workout_templates')
      .insert([{
        trainer_id: trainer_id,
        name: routineJson.routine_name,
        description: routineJson.routine_description
      }])
      .select()
      .single()

    if (templateError) throw templateError

    for (const day of routineJson.days) {
      const { data: dayRow, error: dayError } = await supabase
        .from('workout_days')
        .insert([{
          workout_template_id: template.id,
          day_number: day.day_number,
          name: day.day_name
        }])
        .select()
        .single()

      if (dayError) throw dayError

      if (day.exercises?.length > 0) {
        const exercisesToInsert = day.exercises.map((ex, idx) => ({
          workout_day_id: dayRow.id,
          name: ex.exercise_name,
          description: ex.notes || null,
          sets: ex.sets,
          reps: String(ex.reps),
          rest_seconds: ex.rest_seconds,
          order_index: idx
        }))

        const { error: exError } = await supabase
          .from('workout_exercises')
          .insert(exercisesToInsert)

        if (exError) throw exError
      }
    }

    return NextResponse.json({
      success: true,
      workout_template_id: template.id,
      preview: routineJson
    })

  } catch (error) {
    console.error('Generate routine error:', error)
    let errorMessage = 'Error al generar la rutina'
    let statusCode = 500

    if (error.status === 401) {
      errorMessage = 'API key de OpenAI inválida o expirada.'
      statusCode = 401
    } else if (error.status === 429) {
      errorMessage = 'Límite de uso de OpenAI alcanzado. Inténtalo más tarde.'
      statusCode = 429
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode })
  }
}
