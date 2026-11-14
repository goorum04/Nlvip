'use client'

// Registro de series y notas del entreno de hoy, compartido por el registro
// clásico (WorkoutSetLogger) y el modo entreno del diseño nuevo (GoldWorkout).
// Lee y guarda exactamente igual en los dos: mismas tablas, misma fecha,
// mismas reglas de borrado y de récords.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { renderPrCard } from '@/lib/shareCards'

// Acepta coma o punto decimal: en el teclado español lo natural es "62,5".
export const parseDecimal = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().replace(',', '.')
  if (normalized === '') return null
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

export const parseIntOrNull = (value) => {
  const n = parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(n) ? n : null
}

export const todayISO = () => new Date().toISOString().split('T')[0]

// El generador de IA marca los ejercicios encadenados en bi-serie/tri-serie
// con un prefijo [bi-serie:N] / [tri-serie:N] en description (ver
// lib/routinePersistence.js). Cada ejercicio sigue siendo su propia fila con
// sus propias series/peso/reps — esto solo agrupa las tarjetas visualmente.
export const SUPERSET_TAG_RE = /^\[(bi-serie|tri-serie):(\d+)\]\s*/i
export const parseSupersetGroup = (description) => {
  const m = (description || '').match(SUPERSET_TAG_RE)
  return m ? parseInt(m[2], 10) : 0
}

// Ejercicios en orden, agrupando los consecutivos de la misma bi/tri-serie.
export function groupExercises(exercises) {
  const groups = []
  let current = null
  exercises.forEach(ex => {
    const g = parseSupersetGroup(ex.description)
    if (g && current && current.id === g) {
      current.items.push(ex)
    } else if (g) {
      current = { id: g, items: [ex] }
      groups.push(current)
    } else {
      groups.push({ id: 0, items: [ex] })
      current = null
    }
  })
  return groups
}

/**
 * @param {object} p
 * @param {string} p.memberId
 * @param {object} p.day       día de la rutina ({ id, ... })
 * @param {Array}  p.exercises ejercicios del día, en orden
 * @param {boolean} p.active   carga los datos la primera vez que pasa a true
 */
export function useWorkoutSetLog({ memberId, day, exercises = [], active = true }) {
  const [values, setValues] = useState({})      // { [exerciseId]: [{weight, reps}, ...] }
  const [notes, setNotes] = useState({})        // { [exerciseId]: 'texto de la nota de hoy' }
  const [lastSession, setLastSession] = useState({}) // { [exerciseId]: 'texto resumen' }
  const [lastSets, setLastSets] = useState({})  // { [exerciseId]: { date, sets: [{weight, reps}] } }
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  // Récords: máximo histórico por ejercicio (series registradas + PRs
  // guardados) para detectar al guardar si hoy se ha superado.
  const [historicalMax, setHistoricalMax] = useState({})
  const [newPrs, setNewPrs] = useState([])
  const [prShareUrl, setPrShareUrl] = useState(null)
  const [prShareBuilding, setPrShareBuilding] = useState(false)
  const { toast } = useToast()
  // Series y notas de hoy que existen en la base de datos: al guardar solo se
  // borran esas (vaciar una serie que nunca se guardó no necesita llamada).
  const persistedRef = useRef({ sets: new Set(), notes: new Set() })

  const dayId = day?.id
  const exerciseIds = exercises.map(e => e.id).join(',')

  // Carga lo ya registrado hoy (para poder corregir) y la última sesión previa
  // de cada ejercicio (para saber con qué peso se quedó la vez anterior).
  const load = useCallback(async () => {
    if (!memberId || exercises.length === 0) return
    setLoading(true)
    try {
      const ids = exercises.map(e => e.id)
      const { data: rows } = await supabase
        .from('workout_set_logs')
        .select('workout_exercise_id, exercise_name, performed_on, set_number, weight_kg, reps')
        .eq('member_id', memberId)
        .in('workout_exercise_id', ids)
        .order('performed_on', { ascending: false })
        .limit(400)

      const today = todayISO()
      const todayRows = (rows || []).filter(r => r.performed_on === today)
      const previousRows = (rows || []).filter(r => r.performed_on !== today)

      const initial = {}
      for (const ex of exercises) {
        const planned = Math.max(1, Math.min(20, parseInt(ex.sets, 10) || 3))
        const mine = todayRows.filter(r => r.workout_exercise_id === ex.id)
        initial[ex.id] = Array.from({ length: planned }, (_, i) => {
          const found = mine.find(r => r.set_number === i + 1)
          return {
            weight: found?.weight_kg != null ? String(found.weight_kg) : '',
            reps: found?.reps != null ? String(found.reps) : '',
          }
        })
      }
      setValues(initial)
      persistedRef.current.sets = new Set(todayRows.map(r => `${r.workout_exercise_id}:${r.set_number}`))

      const { data: noteRows } = await supabase
        .from('workout_exercise_notes')
        .select('workout_exercise_id, note')
        .eq('member_id', memberId)
        .eq('performed_on', today)
        .in('workout_exercise_id', ids)

      const initialNotes = {}
      for (const ex of exercises) {
        const found = (noteRows || []).find(r => r.workout_exercise_id === ex.id)
        initialNotes[ex.id] = found?.note || ''
      }
      setNotes(initialNotes)
      persistedRef.current.notes = new Set((noteRows || []).map(r => r.workout_exercise_id))

      // Resumen de la última sesión anterior por ejercicio.
      const summary = {}
      const structured = {}
      for (const ex of exercises) {
        const mine = previousRows.filter(r => r.workout_exercise_id === ex.id)
        if (mine.length === 0) continue
        const lastDate = mine[0].performed_on
        const sameDay = mine
          .filter(r => r.performed_on === lastDate)
          .sort((a, b) => a.set_number - b.set_number)
        summary[ex.id] = sameDay
          .map(r => `${r.weight_kg ?? '—'}kg×${r.reps ?? '—'}`)
          .join('  ')
        structured[ex.id] = {
          date: lastDate,
          sets: sameDay.map(r => ({ setNumber: r.set_number, weight: r.weight_kg, reps: r.reps })),
        }
      }
      setLastSession(summary)
      setLastSets(structured)

      const { data: prRows } = await supabase
        .from('member_prs')
        .select('exercise_name, weight_kg')
        .eq('member_id', memberId)
      const maxes = {}
      for (const ex of exercises) {
        const fromLogs = previousRows
          .filter(r => r.workout_exercise_id === ex.id && r.weight_kg != null)
          .reduce((m, r) => Math.max(m, Number(r.weight_kg)), 0)
        const fromPrs = (prRows || [])
          .filter(p => (p.exercise_name || '').toLowerCase() === ex.name.toLowerCase() && p.weight_kg != null)
          .reduce((m, p) => Math.max(m, Number(p.weight_kg)), 0)
        maxes[ex.id] = Math.max(fromLogs, fromPrs)
      }
      setHistoricalMax(maxes)
      setLoaded(true)
    } catch (e) {
      console.warn('WorkoutSetLogger load error:', e.message)
    } finally {
      setLoading(false)
    }
  }, [memberId, exerciseIds])

  // Solo carga la primera vez que se activa este día/lista de ejercicios:
  // no recarga (con su spinner) cada vez que se cierra y se vuelve a abrir.
  const loadedKeyRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const key = `${dayId || ''}:${exerciseIds}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key
    load()
  }, [active, load, dayId, exerciseIds])

  const setField = (exerciseId, index, field, raw) => {
    const clean = field === 'weight'
      ? raw.replace(/[^0-9.,]/g, '')
      : raw.replace(/[^0-9]/g, '')
    setValues(prev => {
      const rows = [...(prev[exerciseId] || [])]
      rows[index] = { ...rows[index], [field]: clean }
      return { ...prev, [exerciseId]: rows }
    })
  }

  // Rellena una serie de golpe (p. ej. "igual que la última vez").
  const setRow = (exerciseId, index, row) => {
    setValues(prev => {
      const rows = [...(prev[exerciseId] || [])]
      rows[index] = { ...rows[index], ...row }
      return { ...prev, [exerciseId]: rows }
    })
  }

  const setNoteField = (exerciseId, raw) => {
    const clean = raw.length > 500 ? raw.slice(0, 500) : raw
    setNotes(prev => ({ ...prev, [exerciseId]: clean }))
  }

  // Guarda todo lo del día. Con silent no avisa con un toast ni abre la
  // ventana de récord (el modo entreno los enseña en su resumen final).
  // Devuelve { ok, sets, notes, prs }.
  const save = async ({ silent = false } = {}) => {
    setSaving(true)
    try {
      const performed_on = todayISO()
      const toUpsert = []
      const toDelete = []

      for (const ex of exercises) {
        const rows = values[ex.id] || []
        rows.forEach((row, i) => {
          const weight = parseDecimal(row.weight)
          const reps = parseIntOrNull(row.reps)
          if (weight === null && reps === null) {
            // Serie vacía: si antes tenía algo guardado, se borra al vaciarla.
            if (persistedRef.current.sets.has(`${ex.id}:${i + 1}`)) toDelete.push({ exerciseId: ex.id, setNumber: i + 1 })
            return
          }
          toUpsert.push({
            member_id: memberId,
            workout_exercise_id: ex.id,
            exercise_name: ex.name,
            workout_day_id: dayId || null,
            performed_on,
            set_number: i + 1,
            weight_kg: weight,
            reps,
          })
        })
      }

      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('workout_set_logs')
          .upsert(toUpsert, { onConflict: 'member_id,workout_exercise_id,performed_on,set_number' })
        if (error) throw error
        for (const r of toUpsert) persistedRef.current.sets.add(`${r.workout_exercise_id}:${r.set_number}`)
      }

      for (const d of toDelete) {
        const { error } = await supabase
          .from('workout_set_logs')
          .delete()
          .eq('member_id', memberId)
          .eq('workout_exercise_id', d.exerciseId)
          .eq('performed_on', performed_on)
          .eq('set_number', d.setNumber)
        if (!error) persistedRef.current.sets.delete(`${d.exerciseId}:${d.setNumber}`)
      }

      const notesToUpsert = []
      const notesToDelete = []
      for (const ex of exercises) {
        const note = (notes[ex.id] || '').trim()
        if (note === '') {
          if (persistedRef.current.notes.has(ex.id)) notesToDelete.push(ex.id)
        } else {
          notesToUpsert.push({
            member_id: memberId,
            workout_exercise_id: ex.id,
            exercise_name: ex.name,
            workout_day_id: dayId || null,
            performed_on,
            note,
            updated_at: new Date().toISOString(),
          })
        }
      }

      if (notesToUpsert.length > 0) {
        const { error } = await supabase
          .from('workout_exercise_notes')
          .upsert(notesToUpsert, { onConflict: 'member_id,workout_exercise_id,performed_on' })
        if (error) throw error
        for (const n of notesToUpsert) persistedRef.current.notes.add(n.workout_exercise_id)
      }

      for (const exerciseId of notesToDelete) {
        const { error } = await supabase
          .from('workout_exercise_notes')
          .delete()
          .eq('member_id', memberId)
          .eq('workout_exercise_id', exerciseId)
          .eq('performed_on', performed_on)
        if (!error) persistedRef.current.notes.delete(exerciseId)
      }

      setSavedAt(new Date())
      if (!silent) {
        const parts = []
        if (toUpsert.length > 0) parts.push(`${toUpsert.length} serie(s)`)
        if (notesToUpsert.length > 0) parts.push(`${notesToUpsert.length} nota(s)`)
        toast({
          title: parts.length > 0 ? 'Guardado' : 'Registro actualizado',
          description: parts.length > 0
            ? `${parts.join(' y ')} registradas en el entreno de hoy.`
            : 'No has dejado nada registrado hoy.',
        })
      }

      // ¿Récord? Solo cuenta si ya había un máximo anterior y hoy se supera.
      const prs = []
      for (const ex of exercises) {
        const prev = historicalMax[ex.id] || 0
        if (prev <= 0) continue
        const best = toUpsert
          .filter(r => r.workout_exercise_id === ex.id && r.weight_kg != null)
          .reduce((b, r) => (r.weight_kg > (b?.weight_kg ?? -1) ? r : b), null)
        if (best && best.weight_kg > prev) prs.push({ exercise: ex, weight: best.weight_kg, reps: best.reps, previous: prev })
      }
      if (prs.length > 0) {
        await supabase.from('member_prs').insert(prs.map(p => ({
          member_id: memberId,
          exercise_name: p.exercise.name,
          weight_kg: p.weight,
          reps: p.reps,
          estimated_1rm: p.reps ? Math.round(p.weight * (1 + p.reps / 30) * 10) / 10 : p.weight,
          date: performed_on,
        })))
        setHistoricalMax(prev => {
          const next = { ...prev }
          for (const p of prs) next[p.exercise.id] = p.weight
          return next
        })
        if (!silent) {
          setNewPrs(prs)
          setPrShareUrl(null)
        }
      }
      // No hace falta volver a pedir los datos: `values` ya refleja
      // exactamente lo que se acaba de guardar.
      return { ok: true, sets: toUpsert.length, notes: notesToUpsert.length, prs }
    } catch (e) {
      toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' })
      return { ok: false, sets: 0, notes: 0, prs: [] }
    } finally {
      setSaving(false)
    }
  }

  const buildPrShare = async (pr) => {
    setPrShareBuilding(true)
    try {
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', memberId).maybeSingle()
      const name = profile?.name || ''
      const canvas = document.createElement('canvas')
      await renderPrCard(canvas, { exerciseName: pr.exercise.name, weight: pr.weight, reps: pr.reps, previous: pr.previous, memberName: name })
      const url = canvas.toDataURL('image/jpeg', 0.92)
      setPrShareUrl(url)
      return url
    } catch (e) {
      toast({ title: 'No se pudo crear la imagen', description: e.message, variant: 'destructive' })
      return null
    } finally {
      setPrShareBuilding(false)
    }
  }

  const sharePr = async (url = prShareUrl) => {
    try {
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], 'nuevo-record-nlvip.jpg', { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Nuevo récord · NL VIP Team' })
        return
      }
      const a = document.createElement('a'); a.href = url; a.download = 'nuevo-record-nlvip.jpg'; a.click()
    } catch (e) {
      if (e?.name !== 'AbortError') toast({ title: 'No se pudo compartir', description: 'Descárgala y compártela desde tu galería.', variant: 'destructive' })
    }
  }

  const downloadPr = (url = prShareUrl) => {
    const a = document.createElement('a'); a.href = url; a.download = 'nuevo-record-nlvip.jpg'; a.click()
  }

  return {
    values, notes, lastSession, lastSets, historicalMax,
    loading, loaded, saving, savedAt,
    setField, setRow, setNoteField, save, reload: load,
    newPrs, setNewPrs, prShareUrl, setPrShareUrl, prShareBuilding,
    buildPrShare, sharePr, downloadPr,
  }
}

export default useWorkoutSetLog
