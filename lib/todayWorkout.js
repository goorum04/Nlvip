// Qué día de la rutina toca hoy. Lo usan la rutina del socio (WorkoutViewer)
// y la tarjeta "Entreno de hoy" de la pantalla Hoy, para que digan lo mismo.

// Fecha local de hoy en formato AAAA-MM-DD.
export function localTodayIso(now = new Date()) {
  const d = new Date(now)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

// Clave de localStorage donde se guarda el día elegido a mano para hoy.
export function dayOverrideKey(workoutId, todayIso) {
  return `nlvip_day_override:${workoutId}:${todayIso}`
}

// days: días de la rutina ordenados por day_number.
// lastLog: último registro de series de esta rutina ({ workout_day_id, performed_on }) o null.
//
// Mapeo simple semana → día de rutina: Lunes = day_number 1, Martes = 2 ...
// hasta days.length; si hoy es fin de semana o excede la cantidad de días,
// hoy es un día de descanso. Si el socio ya ha registrado series de esta
// rutina, se propone EL SIGUIENTE en orden al último que hizo (si se saltó el
// martes, el miércoles le sale el día 2, no el 3). Si hoy ya ha registrado
// algo, se queda en ese día. Solo sin historial se usa el día de la semana.
export function pickTodayDay(days, lastLog, todayIso, now = new Date()) {
  const weekday = ((now.getDay() + 6) % 7) + 1 // 1=Lunes ... 7=Domingo
  const todayDayNumber = weekday <= days.length ? weekday : null
  const weekdayDay = todayDayNumber ? days.find(d => d.day_number === todayDayNumber) : null

  const lastDay = lastLog ? days.find(d => d.id === lastLog.workout_day_id) : null
  let suggestedDay = weekdayDay
  let suggestionNote = ''
  if (lastDay) {
    if (lastLog.performed_on === todayIso) {
      suggestedDay = lastDay
      suggestionNote = 'Hoy ya has registrado series de este día.'
    } else {
      const nextNumber = (lastDay.day_number % days.length) + 1
      suggestedDay = days.find(d => d.day_number === nextNumber) || days[0]
      const when = new Date(`${lastLog.performed_on}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
      suggestionNote = `Tu último entreno fue el día ${lastDay.day_number} (${when}), así que te toca el siguiente.`
    }
  }
  return { todayDay: suggestedDay || null, suggestionNote, trainedToday: !!(lastDay && lastLog.performed_on === todayIso) }
}
