// Shared persistence logic for routine templates created/edited via AI generator.
// Inserts a workout_template, its workout_days, and workout_exercises.
// Encodes superset_group as a [bi-serie:N] / [tri-serie:N] prefix in description.

export async function persistRoutine(supabase, { trainerId, routine }) {
  const { data: template, error: templateError } = await supabase
    .from('workout_templates')
    .insert([{
      trainer_id: trainerId,
      name: routine.routine_name,
      description: routine.routine_description
    }])
    .select()
    .single()

  if (templateError) throw templateError

  for (const day of routine.days) {
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
      const groupSizes = new Map()
      for (const ex of day.exercises) {
        const g = ex.superset_group
        if (g && Number.isInteger(g) && g > 0) {
          groupSizes.set(g, (groupSizes.get(g) || 0) + 1)
        }
      }
      const tagFor = (g) => {
        if (!g || !Number.isInteger(g) || g <= 0) return ''
        const size = groupSizes.get(g) || 0
        if (size < 2) return ''
        const label = size >= 3 ? 'tri-serie' : 'bi-serie'
        return `[${label}:${g}] `
      }

      const exercisesToInsert = day.exercises.map((ex, idx) => {
        const tag = tagFor(ex.superset_group)
        const desc = `${tag}${ex.notes || ''}`.trim()
        return {
          workout_day_id: dayRow.id,
          name: ex.exercise_name,
          description: desc.length > 0 ? desc : null,
          sets: ex.sets,
          reps: String(ex.reps),
          rest_seconds: ex.rest_seconds,
          order_index: idx
        }
      })

      const { error: exError } = await supabase
        .from('workout_exercises')
        .insert(exercisesToInsert)

      if (exError) throw exError
    }
  }

  return template
}
