// Actividad de los socios en la app: última actividad (para el panel del
// entrenador y "dar un toque") y rachas de días seguidos registrando algo
// (para la tarjeta del socio y el aviso de racha en peligro).
//
// "Registrar algo" = marcar una comida, apuntar series de un entreno o fichar
// un entreno. Los pasos NO cuentan para la racha (se sincronizan solos desde
// Salud y no demuestran que la persona esté usando la app), pero sí para la
// "última actividad" porque para sincronizarlos hay que abrir la app.

export function isoDateMadrid(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = t => parts.find(p => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Racha actual y mejor racha a partir del conjunto de fechas (ISO) con actividad.
 * La racha actual se cuenta hacia atrás desde hoy; si hoy aún no hay nada,
 * desde ayer (y `todayDone` = false → la racha está "en juego").
 */
export function computeStreak(activeDates, todayIso) {
  const set = activeDates instanceof Set ? activeDates : new Set(activeDates || [])
  const todayDone = set.has(todayIso)
  let cursor = todayDone ? todayIso : addDaysIso(todayIso, -1)
  let current = 0
  while (set.has(cursor)) {
    current++
    cursor = addDaysIso(cursor, -1)
  }

  let best = 0
  const sorted = [...set].sort()
  let run = 0
  let prev = null
  for (const d of sorted) {
    run = prev && addDaysIso(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return { current, best: Math.max(best, current), todayDone }
}

/**
 * Fechas con actividad (comidas / entrenos) por socio desde `fromIso`.
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function getActiveDates(supabase, memberIds, fromIso) {
  const map = new Map(memberIds.map(id => [id, new Set()]))
  if (memberIds.length === 0) return map
  const [{ data: meals }, { data: sets }, { data: checkins }] = await Promise.all([
    supabase.from('meal_logs').select('member_id, date').in('member_id', memberIds).gte('date', fromIso),
    supabase.from('workout_set_logs').select('member_id, performed_on').in('member_id', memberIds).gte('performed_on', fromIso),
    supabase.from('workout_checkins').select('member_id, checked_in_at').in('member_id', memberIds).gte('checked_in_at', `${fromIso}T00:00:00`),
  ])
  for (const m of meals || []) map.get(m.member_id)?.add(m.date)
  for (const s of sets || []) map.get(s.member_id)?.add(s.performed_on)
  for (const c of checkins || []) map.get(c.member_id)?.add(isoDateMadrid(new Date(c.checked_in_at)))
  return map
}

const ACTIVITY_SOURCES = [
  { table: 'meal_logs', ts: 'logged_at', label: 'marcar una comida' },
  { table: 'workout_set_logs', ts: 'created_at', label: 'registrar un entreno' },
  { table: 'workout_checkins', ts: 'checked_in_at', label: 'fichar un entreno' },
  { table: 'daily_activity', ts: 'updated_at', label: 'sincronizar los pasos' },
  { table: 'progress_records', ts: 'created_at', label: 'apuntar peso y medidas' },
  { table: 'progress_photos', ts: 'created_at', label: 'subir fotos de progreso' },
  { table: 'member_checkins', ts: 'created_at', label: 'enviar una revisión' },
]

/**
 * Última actividad de cada socio (cualquier tabla de uso de la app).
 * @returns {Promise<Record<string, {lastAt: string|null, label: string|null, daysInactive: number|null}>>}
 */
export async function getLastActivity(supabase, memberIds) {
  const out = {}
  for (const id of memberIds) out[id] = { lastAt: null, label: null, daysInactive: null }
  if (memberIds.length === 0) return out

  // Una consulta por tabla, ordenada desc y limitada: para pocas decenas de
  // socios es más que suficiente y evita funciones SQL nuevas.
  const results = await Promise.all(ACTIVITY_SOURCES.map(src =>
    supabase.from(src.table).select(`member_id, ${src.ts}`).in('member_id', memberIds).order(src.ts, { ascending: false }).limit(2000)
      .then(r => ({ src, rows: r.data || [] }))
  ))
  for (const { src, rows } of results) {
    const seen = new Set()
    for (const row of rows) {
      if (seen.has(row.member_id)) continue
      seen.add(row.member_id)
      const ts = row[src.ts]
      if (!ts) continue
      const cur = out[row.member_id]
      if (cur && (!cur.lastAt || new Date(ts) > new Date(cur.lastAt))) {
        cur.lastAt = ts
        cur.label = src.label
      }
    }
  }
  const now = Date.now()
  for (const id of memberIds) {
    const cur = out[id]
    cur.daysInactive = cur.lastAt ? Math.floor((now - new Date(cur.lastAt).getTime()) / 86400000) : null
  }
  return out
}
