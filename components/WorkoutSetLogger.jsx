'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ClipboardList, ChevronDown, ChevronUp, Sparkles,
  LoaderCircle as Loader2, Check, History, NotebookPen,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Acepta coma o punto decimal: en el teclado español lo natural es "62,5".
const parseDecimal = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().replace(',', '.')
  if (normalized === '') return null
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

const parseIntOrNull = (value) => {
  const n = parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(n) ? n : null
}

const todayISO = () => new Date().toISOString().split('T')[0]

// El generador de IA marca los ejercicios encadenados en bi-serie/tri-serie
// con un prefijo [bi-serie:N] / [tri-serie:N] en description (ver
// lib/routinePersistence.js). Cada ejercicio sigue siendo su propia fila con
// sus propias series/peso/reps — esto solo agrupa las tarjetas visualmente.
const SUPERSET_TAG_RE = /^\[(bi-serie|tri-serie):(\d+)\]\s*/i
const parseSupersetGroup = (description) => {
  const m = (description || '').match(SUPERSET_TAG_RE)
  return m ? parseInt(m[2], 10) : 0
}

/**
 * Registro OPCIONAL de series del socio para el entreno de hoy.
 *
 * Nada es obligatorio: si no rellena nada, no se guarda nada y la app se
 * comporta exactamente igual que antes. Solo se envían las series en las que
 * haya puesto peso y/o repeticiones.
 */
export function WorkoutSetLogger({ memberId, day, exercises = [] }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({})      // { [exerciseId]: [{weight, reps}, ...] }
  const [notes, setNotes] = useState({})        // { [exerciseId]: 'texto de la nota de hoy' }
  const [lastSession, setLastSession] = useState({}) // { [exerciseName]: 'texto resumen' }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const { toast } = useToast()

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

      // Resumen de la última sesión anterior por ejercicio.
      const summary = {}
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
      }
      setLastSession(summary)
    } catch (e) {
      console.warn('WorkoutSetLogger load error:', e.message)
    } finally {
      setLoading(false)
    }
  }, [memberId, exerciseIds])

  // Solo recarga la primera vez que se abre este día/lista de ejercicios:
  // antes recargaba (con su spinner de pantalla completa) cada vez que se
  // cerraba y se volvía a abrir el panel, aunque fuera exactamente lo mismo.
  const loadedKeyRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const key = `${dayId || ''}:${exerciseIds}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key
    load()
  }, [open, load, dayId, exerciseIds])

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

  const setNoteField = (exerciseId, raw) => {
    const clean = raw.length > 500 ? raw.slice(0, 500) : raw
    setNotes(prev => ({ ...prev, [exerciseId]: clean }))
  }

  const handleSave = async () => {
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
            toDelete.push({ exerciseId: ex.id, setNumber: i + 1 })
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
      }

      for (const d of toDelete) {
        await supabase
          .from('workout_set_logs')
          .delete()
          .eq('member_id', memberId)
          .eq('workout_exercise_id', d.exerciseId)
          .eq('performed_on', performed_on)
          .eq('set_number', d.setNumber)
      }

      const notesToUpsert = []
      const notesToDelete = []
      for (const ex of exercises) {
        const note = (notes[ex.id] || '').trim()
        if (note === '') {
          notesToDelete.push(ex.id)
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
      }

      for (const exerciseId of notesToDelete) {
        await supabase
          .from('workout_exercise_notes')
          .delete()
          .eq('member_id', memberId)
          .eq('workout_exercise_id', exerciseId)
          .eq('performed_on', performed_on)
      }

      setSavedAt(new Date())
      const parts = []
      if (toUpsert.length > 0) parts.push(`${toUpsert.length} serie(s)`)
      if (notesToUpsert.length > 0) parts.push(`${notesToUpsert.length} nota(s)`)
      toast({
        title: parts.length > 0 ? 'Guardado' : 'Registro actualizado',
        description: parts.length > 0
          ? `${parts.join(' y ')} registradas en el entreno de hoy.`
          : 'No has dejado nada registrado hoy.',
      })
      // No hace falta volver a pedir los datos: `values` ya refleja
      // exactamente lo que se acaba de guardar.
    } catch (e) {
      toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!day || exercises.length === 0) return null

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
      {/* Banner: deja claro que es opcional y por qué merece la pena */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold">Registra tus series y notas</h3>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                Opcional
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1 flex items-start gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Si apuntas el peso y las repeticiones de cada serie, tu seguimiento será
                mucho mejor: tu entrenador ve tu progresión real y tus rutinas se ajustan
                a las cargas que mueves de verdad. Si no lo rellenas, no pasa nada.
              </span>
            </p>
            {savedAt && !open && (
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Guardado
              </p>
            )}
          </div>
          {open
            ? <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />}
        </div>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : (
            <>
              {(() => {
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

                return groups.map((grp, gi) => {
                  const size = grp.items.length
                  const isSuperset = grp.id > 0 && size >= 2
                  const label = size >= 3 ? 'Tri-serie' : 'Bi-serie'
                  return (
                    <div
                      key={gi}
                      className={isSuperset ? 'border border-amber-500/30 bg-amber-500/[0.04] rounded-2xl p-2.5 space-y-2.5' : 'space-y-3'}
                    >
                      {isSuperset && (
                        <div className="flex items-center gap-2 px-1.5">
                          <span className="text-[10px] uppercase tracking-wide font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            {label}
                          </span>
                          <span className="text-[11px] text-amber-300/70">
                            registra cada ejercicio por separado
                          </span>
                        </div>
                      )}
                      {grp.items.map(ex => (
                        <div key={ex.id} className="bg-black/30 rounded-2xl p-4 border border-[#2a2a2a]">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <p className="text-white font-semibold text-sm">{ex.name}</p>
                            <span className="text-[11px] text-violet-400 whitespace-nowrap">
                              {ex.sets}×{ex.reps}
                            </span>
                          </div>

                          {lastSession[ex.id] && (
                            <p className="text-[11px] text-gray-500 mb-3 flex items-center gap-1">
                              <History className="w-3 h-3" />
                              Última vez: {lastSession[ex.id]}
                            </p>
                          )}

                          <div className="space-y-2">
                            {(values[ex.id] || []).map((row, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 w-12 flex-shrink-0">
                                  Serie {i + 1}
                                </span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="kg"
                                  value={row.weight}
                                  onChange={e => setField(ex.id, i, 'weight', e.target.value)}
                                  disabled={saving}
                                  className="bg-black/50 border-[#2a2a2a] rounded-xl text-white h-9 text-sm"
                                />
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="reps"
                                  value={row.reps}
                                  onChange={e => setField(ex.id, i, 'reps', e.target.value)}
                                  disabled={saving}
                                  className="bg-black/50 border-[#2a2a2a] rounded-xl text-white h-9 text-sm"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex items-start gap-1.5">
                            <NotebookPen className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-2" />
                            <Textarea
                              placeholder="Notas (opcional): p. ej. 'me costó más acabar' o 'tuve que hacerlo con otra máquina'"
                              value={notes[ex.id] || ''}
                              onChange={e => setNoteField(ex.id, e.target.value)}
                              disabled={saving}
                              rows={2}
                              className="bg-black/50 border-[#2a2a2a] rounded-xl text-white text-sm min-h-0 resize-none placeholder:text-gray-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-2xl h-12"
              >
                {saving ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
                ) : (
                  <><Check className="w-5 h-5 mr-2" /> Guardar entreno de hoy</>
                )}
              </Button>
              <p className="text-[11px] text-gray-600 text-center">
                Puedes rellenar solo las series que quieras y volver a editarlas durante el día.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default WorkoutSetLogger
