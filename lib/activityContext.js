// Actividad diaria REAL del socio (tabla daily_activity, alimentada por Apple
// Health o a mano desde ActivityTracker) convertida en dos cosas:
//
//   1. Un resumen en texto para el contexto de la IA (dieta y rutina).
//   2. Un nivel de actividad MEDIDO que corrige el nivel DECLARADO en el
//      onboarding a la hora de calcular el gasto (TDEE).
//
// El porqué del punto 2: el multiplicador de actividad se elegía una sola vez,
// marcando una casilla, y no volvía a cambiar nunca. Entre dos opciones
// contiguas hay ~300 kcal/día — todo el déficit de una definición. Si el socio
// cambia de trabajo, se lesiona o deja de andar, su dieta sigue calculada con
// lo que marcó hace meses.
//
// A prueba de fallos: si no hay datos suficientes, todo devuelve null y el
// cálculo se comporta EXACTAMENTE igual que antes de existir este módulo.

// Mismo orden (de menos a más) que ACTIVITY_MULTIPLIERS en macroCalculator.
export const ACTIVITY_ORDER = ['sedentary', 'light', 'moderate', 'active', 'very_active']

export const ACTIVITY_LABELS_ES = {
  sedentary: 'sedentario',
  light: 'poco activo',
  moderate: 'moderadamente activo',
  active: 'activo',
  very_active: 'muy activo',
}

// Días con registro que exigimos dentro de la ventana para fiarnos del dato.
// Con menos de esto, un par de días sueltos (justo los que más anduvo) darían
// una media engañosa.
const MIN_DAYS_WITH_DATA = 7

// Separador de miles a la española sin depender de ICU.
const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * Clasificación de Tudor-Locke (pasos/día → nivel de actividad), que es el
 * estándar usado en la literatura de actividad física.
 */
export function activityFromSteps(avgSteps) {
  if (!Number.isFinite(avgSteps) || avgSteps <= 0) return null
  if (avgSteps < 5000) return 'sedentary'
  if (avgSteps < 7500) return 'light'
  if (avgSteps < 10000) return 'moderate'
  if (avgSteps < 12500) return 'active'
  return 'very_active'
}

/**
 * Reconcilia el nivel DECLARADO (onboarding/perfil) con el MEDIDO (pasos).
 *
 * Los pasos solo pueden mover el nivel declarado UNA posición, nunca más. Dos
 * motivos:
 *  - Los pasos miden el movimiento del día a día (NEAT), no el entrenamiento.
 *    Alguien con trabajo de oficina que entrena 5 días/semana hace pocos pasos
 *    y NO es sedentario: bajarlo a saco le dejaría corto de comida.
 *  - Limita el impacto a ~±175-310 kcal, que es una corrección, no un reseteo.
 *
 * @returns {{ level: string, adjusted: boolean, direction: -1|0|1 }}
 */
export function reconcileActivityLevel(declared, measured) {
  const d = ACTIVITY_ORDER.indexOf(declared)
  const m = ACTIVITY_ORDER.indexOf(measured)
  if (d < 0 || m < 0 || m === d) {
    return { level: declared, adjusted: false, direction: 0 }
  }
  const direction = m > d ? 1 : -1
  return { level: ACTIVITY_ORDER[d + direction], adjusted: true, direction }
}

const isoDay = (date) => date.toISOString().split('T')[0]

/**
 * Lee daily_activity y resume la actividad real del socio.
 *
 * Compara dos ventanas consecutivas de `days` días (por defecto 14 vs los 14
 * anteriores) para poder detectar que se está moviendo MENOS, que es la causa
 * más frecuente de un estancamiento y la que ahora mismo nadie ve.
 *
 * @returns {Promise<{
 *   avgSteps: number|null, daysWithData: number, deviceDays: number,
 *   prevAvgSteps: number|null, deltaSteps: number|null, deltaPct: number|null,
 *   measuredActivity: string|null, trend: 'subiendo'|'bajando'|'estable'|null,
 *   summary: string|null
 * }>}
 */
export async function gatherActivityContext(supabase, memberId, { days = 14 } = {}) {
  const empty = {
    avgSteps: null, daysWithData: 0, deviceDays: 0,
    prevAvgSteps: null, deltaSteps: null, deltaPct: null,
    measuredActivity: null, trend: null, summary: null,
  }
  if (!memberId) return empty

  try {
    const DAY_MS = 24 * 60 * 60 * 1000
    const now = Date.now()
    const startCurrent = isoDay(new Date(now - (days - 1) * DAY_MS))
    const startPrev = isoDay(new Date(now - (2 * days - 1) * DAY_MS))

    const { data: rows } = await supabase
      .from('daily_activity')
      .select('activity_date, steps, source')
      .eq('member_id', memberId)
      .gte('activity_date', startPrev)
      .order('activity_date', { ascending: false })

    if (!Array.isArray(rows) || rows.length === 0) return empty

    // Una fila con 0 pasos es "no sincronizó", no "no se movió en todo el día".
    // Contarla como cero hundiría la media de cualquiera.
    const valid = rows.filter(r => Number(r.steps) > 0)
    const current = valid.filter(r => r.activity_date >= startCurrent)
    const previous = valid.filter(r => r.activity_date < startCurrent)

    if (current.length === 0) return empty

    const mean = (list) => list.reduce((s, r) => s + Number(r.steps), 0) / list.length

    const avgSteps = Math.round(mean(current))
    const daysWithData = current.length
    const deviceDays = current.filter(r => r.source === 'device').length

    // La tendencia solo se afirma si AMBAS ventanas tienen muestra suficiente.
    let prevAvgSteps = null
    let deltaSteps = null
    let deltaPct = null
    let trend = null
    if (previous.length >= MIN_DAYS_WITH_DATA && daysWithData >= MIN_DAYS_WITH_DATA) {
      prevAvgSteps = Math.round(mean(previous))
      deltaSteps = avgSteps - prevAvgSteps
      deltaPct = prevAvgSteps > 0 ? Math.round((deltaSteps / prevAvgSteps) * 100) : null
      // ±10% es ruido normal entre dos quincenas; por debajo de eso, "estable".
      if (deltaPct === null || Math.abs(deltaPct) < 10) trend = 'estable'
      else trend = deltaPct > 0 ? 'subiendo' : 'bajando'
    }

    // El nivel medido solo se afirma con muestra suficiente: con 3 días sueltos
    // no tocamos el gasto de nadie.
    const measuredActivity = daysWithData >= MIN_DAYS_WITH_DATA
      ? activityFromSteps(avgSteps)
      : null

    const sourceNote = deviceDays > 0
      ? `${deviceDays} de ellos sincronizados desde el reloj`
      : 'todos introducidos a mano'

    const parts = [
      `Media de ${fmt(avgSteps)} pasos/día en los últimos ${days} días ` +
      `(${daysWithData} días con registro, ${sourceNote}).`,
    ]
    if (prevAvgSteps !== null) {
      const sign = deltaSteps > 0 ? '+' : '−'
      parts.push(
        `En los ${days} días anteriores hacía ${fmt(prevAvgSteps)} pasos/día: ` +
        `${sign}${fmt(Math.abs(deltaSteps))} pasos/día (${deltaPct > 0 ? '+' : ''}${deltaPct}%), tendencia ${trend}.`
      )
    }
    if (measuredActivity) {
      parts.push(`Eso lo sitúa como "${ACTIVITY_LABELS_ES[measuredActivity]}" por movimiento diario.`)
    }

    return {
      avgSteps, daysWithData, deviceDays,
      prevAvgSteps, deltaSteps, deltaPct,
      measuredActivity, trend,
      summary: parts.join(' '),
    }
  } catch (e) {
    console.warn('gatherActivityContext error:', e.message)
    return empty
  }
}

/**
 * Texto para el prompt explicando si los pasos han corregido el nivel de
 * actividad declarado, y qué debe hacer la IA con esa información.
 * Devuelve null si no hay nada que decir.
 */
export function buildActivityDietGuidance(activity, declaredLevel, reconciled) {
  if (!activity?.summary) return null

  const lines = [`• Actividad diaria real (pasos): ${activity.summary}`]

  if (reconciled?.adjusted) {
    const dir = reconciled.direction < 0 ? 'a la baja' : 'al alza'
    lines.push(
      `  → El nivel declarado en el formulario era "${ACTIVITY_LABELS_ES[declaredLevel] || declaredLevel}" ` +
      `y los pasos medidos no lo respaldan: para calcular el gasto se ha corregido ${dir} ` +
      `a "${ACTIVITY_LABELS_ES[reconciled.level] || reconciled.level}". Los macros de abajo YA incluyen esa corrección.`
    )
  }

  if (activity.trend === 'bajando') {
    lines.push(
      `  → AVISO: se está moviendo MENOS que hace dos semanas. Si además el peso se ha estancado, ` +
      `la causa más probable es la caída de actividad, NO la dieta. Antes de recortar calorías, ` +
      `recomiéndale de forma explícita recuperar su nivel de pasos y revisar en 10-14 días.`
    )
  } else if (activity.trend === 'subiendo') {
    lines.push(
      `  → Se está moviendo MÁS que hace dos semanas: su gasto ha subido. Ten cuidado con dejarlo ` +
      `demasiado corto de energía, sobre todo en los días de entreno.`
    )
  }

  if (activity.measuredActivity === 'sedentary') {
    lines.push(
      `  → Movimiento diario muy bajo. Incluye una recomendación concreta y realista de pasos ` +
      `(un objetivo alcanzable, no "anda más"), porque le va a rendir más que cualquier ajuste de macros.`
    )
  }

  return lines.join('\n')
}
