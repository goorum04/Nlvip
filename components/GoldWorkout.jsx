'use client'

// Entreno del diseño negro y oro. La sesión de hoy es la protagonista y se
// hace en un "modo entreno" a pantalla completa: ejercicio a ejercicio, con
// las series, el peso de la última vez, el descanso con cuenta atrás y un
// resumen final con récords. Lee y guarda exactamente lo mismo que el
// registro clásico (hooks/useWorkoutSetLog.js); el diseño clásico no cambia.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Play, Check, X, ChevronLeft, ChevronRight, ChevronDown, Clock, Dumbbell, Flame, Trophy,
  History, NotebookPen, SkipForward, Share2, Download, Coffee, HeartPulse, Calendar,
  LoaderCircle as Loader2, Volume2, VolumeX, Timer, Layers, Repeat,
} from 'lucide-react'
import { pickTodayDay, localTodayIso, dayOverrideKey } from '@/lib/todayWorkout'
import { useWorkoutSetLog, groupExercises, todayISO, SUPERSET_TAG_RE } from '@/hooks/useWorkoutSetLog'
import { VideoCard } from './VideoPlayer'
import PRTracker from './PRTracker'

const C = {
  text: 'var(--nl-text)', muted: 'var(--nl-muted)', dim: 'var(--nl-dim)', accent: 'var(--nl-accent)',
  accent2: 'var(--nl-accent2)', surface: 'var(--nl-surface)', surface2: 'var(--nl-surface2)',
  line: 'var(--nl-line)', ink: 'var(--nl-ink)', soft: 'var(--nl-soft)',
}
const GOLD_GRADIENT = 'linear-gradient(90deg, #B8914F 0%, #E9CF97 100%)'
const LETTERS = ['A', 'B', 'C', 'D', 'E']
const DROPSET_RE = /^\[dropset:([^\]]+)\]\s*/i
const SOUND_KEY = 'nlvip_rest_sound'

// ───────────────────────── utilidades ─────────────────────────

function exerciseMeta(ex) {
  let d = ex?.description || ''
  const sup = d.match(SUPERSET_TAG_RE)
  if (sup) d = d.slice(sup[0].length)
  const drop = d.match(DROPSET_RE)
  if (drop) d = d.slice(drop[0].length)
  return { notes: d.trim(), drops: drop ? drop[1].split(',').map(s => s.trim()).filter(Boolean) : null }
}

const plannedSets = (ex) => Math.max(1, Math.min(20, parseInt(ex.sets, 10) || 3))
const restOf = (ex) => {
  const n = parseInt(ex.rest_seconds, 10)
  return Number.isFinite(n) && n > 0 ? n : 90
}
const fmtKg = (n) => (n == null || n === '' ? '—' : String(Math.round(Number(String(n).replace(',', '.')) * 100) / 100).replace('.', ','))
const fmtClock = (secs) => {
  const s = Math.max(0, Math.round(secs))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
const rowHasData = (row) => !!row && (String(row.weight ?? '').trim() !== '' || String(row.reps ?? '').trim() !== '')
const toNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function suggestedFor(ex, memberPrs) {
  const pr = memberPrs?.find(p => (p.exercise_name || '').toLowerCase() === (ex.name || '').toLowerCase())
  const orm = pr ? parseFloat(pr.estimated_1rm) : NaN
  if (!Number.isFinite(orm) || orm <= 0) return null
  return Math.round(orm * 0.75 * 2) / 2
}

function estimateMinutes(exercises) {
  const secs = exercises.reduce((t, ex) => t + plannedSets(ex) * (40 + restOf(ex)), 0)
  return Math.max(10, Math.round(secs / 60 / 5) * 5)
}

function lastSummary(entry, max = 3) {
  if (!entry?.sets?.length) return null
  const parts = entry.sets.slice(0, max).map(s => `${fmtKg(s.weight)}×${s.reps ?? '—'}`)
  return parts.join(' · ') + (entry.sets.length > max ? ' …' : '')
}

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')

async function exerciseVideoUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const { data } = await supabase.storage.from('exercise_videos').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}

function mergePrs(a = [], b = []) {
  const byId = new Map()
  for (const pr of [...a, ...b]) {
    const prev = byId.get(pr.exercise.id)
    if (!prev || pr.weight >= prev.weight) byId.set(pr.exercise.id, prev ? { ...pr, previous: prev.previous } : pr)
  }
  return [...byId.values()]
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf
    let start
    const tick = (t) => {
      if (start === undefined) start = t
      const p = Math.min(1, (t - start) / duration)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

// Pitido corto al acabar el descanso. El contexto de audio se abre con un
// toque del usuario (requisito de iOS/Android) y se reutiliza.
function useBeeper() {
  const ctxRef = useRef(null)
  const unlock = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      if (!ctxRef.current) ctxRef.current = new AC()
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    } catch {}
  }
  const beep = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    try {
      const t0 = ctx.currentTime
      ;[0, 0.24].forEach((offset, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = i ? 1175 : 880
        gain.gain.setValueAtTime(0.0001, t0 + offset)
        gain.gain.exponentialRampToValueAtTime(0.2, t0 + offset + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t0 + offset)
        osc.stop(t0 + offset + 0.22)
      })
    } catch {}
  }
  useEffect(() => () => { try { ctxRef.current?.close() } catch {} }, [])
  return { unlock, beep }
}

// ───────────────────────── pantalla Entreno ─────────────────────────

export function GoldWorkoutView({
  memberId, myWorkouts, activeWorkoutSlot, setActiveWorkoutSlot, memberPrs = [], dataLoaded,
  hasCheckedInToday, isCheckingIn, onCheckin, showCheckinConfetti, onPlayRoutineVideo, sessionRequest,
}) {
  const activeWorkout = myWorkouts?.[activeWorkoutSlot] || myWorkouts?.principal || myWorkouts?.alternativa
  const workoutId = activeWorkout?.workout?.id
  const routineVideos = activeWorkout?.workout?.workout_videos
    ? [...activeWorkout.workout.workout_videos].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    : []
  const [tpl, setTpl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [video, setVideo] = useState(null)
  const todayIso = localTodayIso()
  const overrideKey = dayOverrideKey(workoutId, todayIso)

  useEffect(() => {
    if (!workoutId) return
    let cancelled = false
    setLoading(true)
    try { setSelectedDayId(localStorage.getItem(overrideKey) || null) } catch { setSelectedDayId(null) }
    ;(async () => {
      try {
        // Una sola consulta: plantilla + días + ejercicios.
        const { data } = await supabase
          .from('workout_templates')
          .select('*, workout_days(*, workout_exercises(*))')
          .eq('id', workoutId)
          .single()
        if (!data) { if (!cancelled) setTpl(null); return }
        const { workout_days: daysData, ...workout } = data
        const days = [...(daysData || [])].sort((a, b) => a.day_number - b.day_number)
        const exercisesByDay = {}
        for (const d of days) exercisesByDay[d.id] = [...(d.workout_exercises || [])].sort((a, b) => a.order_index - b.order_index)
        let lastLog = null
        if (days.length > 0) {
          const { data: last } = await supabase
            .from('workout_set_logs')
            .select('workout_day_id, performed_on')
            .eq('member_id', memberId)
            .in('workout_day_id', days.map(d => d.id))
            .order('performed_on', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          lastLog = last || null
        }
        if (!cancelled) setTpl({ workout, days, exercisesByDay, lastLog })
      } catch (e) {
        console.error('Error loading workout:', e)
        if (!cancelled) setTpl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [workoutId, memberId])

  const playExercise = async (ex) => {
    const url = await exerciseVideoUrl(ex.video_url)
    if (url) setVideo({ ...ex, signedUrl: url })
  }

  if (!myWorkouts?.principal && !myWorkouts?.alternativa) {
    if (!dataLoaded) return <div className="nl-card h-[300px] animate-pulse" style={{ background: 'linear-gradient(165deg,#1F1B14 0%,#151517 58%)' }} />
    return (
      <div className="nl-card px-6 py-12 text-center">
        <Dumbbell className="w-12 h-12 mx-auto" style={{ color: 'rgba(212,175,106,0.35)' }} />
        <p className="nl-display text-[30px] mt-4" style={{ color: C.text }}>Tu rutina está en camino</p>
        <p className="text-[13.5px] mt-2" style={{ color: C.muted }}>Tu entrenador aún no te ha asignado una rutina.</p>
      </div>
    )
  }

  const { todayDay, suggestionNote } = tpl ? pickTodayDay(tpl.days, tpl.lastLog, todayIso) : { todayDay: null, suggestionNote: '' }
  // El socio puede hacer hoy cualquier día de la rutina; la elección se
  // recuerda solo para hoy (misma clave que el diseño clásico y la pantalla Hoy).
  const overrideDay = selectedDayId && tpl ? tpl.days.find(d => d.id === selectedDayId) : null
  const activeDay = overrideDay || todayDay
  const otherDays = tpl ? tpl.days.filter(d => d.id !== activeDay?.id) : []

  const chooseDay = (dayId) => {
    setSelectedDayId(dayId)
    try {
      if (dayId) localStorage.setItem(overrideKey, dayId)
      else localStorage.removeItem(overrideKey)
    } catch {}
  }

  const dayStrip = tpl && tpl.days.length > 0 && (
    <DayStrip
      days={tpl.days}
      exercisesByDay={tpl.exercisesByDay}
      activeDay={activeDay}
      todayDay={todayDay}
      overrideDay={overrideDay}
      suggestionNote={suggestionNote}
      onChoose={chooseDay}
    />
  )

  return (
    <div className="space-y-5">
      {myWorkouts.principal && myWorkouts.alternativa && (
        <div className="grid grid-cols-2 p-1 rounded-[16px]" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          {['principal', 'alternativa'].map(slot => {
            const active = activeWorkoutSlot === slot
            const Icon = slot === 'principal' ? Dumbbell : Flame
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveWorkoutSlot(slot)}
                aria-pressed={active}
                className="h-10 rounded-[12px] text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-colors"
                style={active ? { background: C.text, color: '#0B0B0C' } : { color: C.muted }}
              >
                <Icon className="w-4 h-4" /> {slot === 'principal' ? 'Principal' : 'Alternativa'}
              </button>
            )
          })}
        </div>
      )}

      {loading || !tpl ? (
        loading ? (
          <div className="space-y-5">
            <div className="nl-card h-[300px] animate-pulse" style={{ background: 'linear-gradient(165deg,#1F1B14 0%,#151517 58%)' }} />
            <div className="nl-card h-[220px] animate-pulse" />
          </div>
        ) : (
          <p className="text-center py-10 text-[14px]" style={{ color: C.muted }}>No se ha podido cargar tu rutina.</p>
        )
      ) : (
        <>
          {activeDay ? (
            <DayBlock
              key={activeDay.id}
              memberId={memberId}
              day={activeDay}
              routineName={tpl.workout.name}
              exercises={tpl.exercisesByDay[activeDay.id] || []}
              memberPrs={memberPrs}
              isOverride={!!overrideDay && overrideDay.id !== todayDay?.id}
              hasCheckedInToday={hasCheckedInToday}
              isCheckingIn={isCheckingIn}
              onCheckin={onCheckin}
              onVideo={playExercise}
              dayStrip={dayStrip}
              sessionRequest={sessionRequest}
            />
          ) : (
            <>
              <div className="nl-card relative overflow-hidden p-5" style={{ background: 'linear-gradient(165deg,#18181B 0%,#121214 100%)' }}>
                <Coffee aria-hidden className="absolute -right-4 -top-3 w-36 h-36" style={{ color: 'rgba(255,255,255,0.035)' }} />
                <div className="relative">
                  <p className="nl-label">Hoy toca descanso</p>
                  <h2 className="nl-display text-[46px] mt-2" style={{ color: C.text }}>Recupera</h2>
                  <p className="text-[13.5px] mt-2 leading-relaxed max-w-[30ch]" style={{ color: C.muted }}>
                    Tu rutina tiene {tpl.days.length} días y hoy toca recuperar. Si entrenas igualmente, elige abajo qué día haces.
                  </p>
                </div>
              </div>
              {dayStrip}
            </>
          )}

          <CheckinCard
            hasCheckedInToday={hasCheckedInToday}
            isCheckingIn={isCheckingIn}
            onCheckin={onCheckin}
            showCheckinConfetti={showCheckinConfetti}
          />

          <RoutineCard workout={tpl.workout} daysCount={tpl.days.length} />

          {otherDays.length > 0 && <OtherDays days={otherDays} exercisesByDay={tpl.exercisesByDay} />}
        </>
      )}

      {routineVideos.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-2.5 px-0.5">
            <span className="nl-label">Vídeos de la rutina</span>
            <span className="text-[12.5px]" style={{ color: C.muted }}>{routineVideos.length}</span>
          </div>
          <div className="nl-noscroll -mx-[18px] px-[18px] overflow-x-auto">
            <div className="flex gap-3 w-max pb-1">
              {routineVideos.map(v => (
                <div key={v.id} className="w-[230px] shrink-0">
                  <VideoCard video={v} onClick={() => onPlayRoutineVideo?.(v)} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PRTracker memberId={memberId} />

      {video && (
        <Dialog open onOpenChange={() => setVideo(null)}>
          <DialogContent className="bg-[#111] border-[#2a2a2a] rounded-3xl max-w-2xl p-4">
            <DialogHeader>
              <DialogTitle className="nl-display text-[26px] text-left pr-8" style={{ color: C.text }}>{video.name}</DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden">
              <video src={video.signedUrl} controls autoPlay playsInline className="w-full h-full" />
            </div>
            {exerciseMeta(video).notes && <p className="text-[13.5px]" style={{ color: C.muted }}>{exerciseMeta(video).notes}</p>}
            <div className="flex flex-wrap gap-1.5">
              <span className="nl-chip">{video.sets} series</span>
              <span className="nl-chip">{video.reps} reps</span>
              <span className="nl-chip">{restOf(video)} s descanso</span>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Peticiones de "Empezar entreno" desde la pantalla Hoy ya atendidas (para no
// volver a abrir el modo entreno al cambiar de día o volver a la pestaña).
let handledSessionRequest = 0

function DayBlock({
  memberId, day, routineName, exercises, memberPrs, isOverride, hasCheckedInToday, isCheckingIn,
  onCheckin, onVideo, dayStrip, sessionRequest,
}) {
  const log = useWorkoutSetLog({ memberId, day, exercises, active: true })
  const groups = useMemo(() => groupExercises(exercises), [exercises])
  const [session, setSession] = useState(null) // { start: índice del paso }

  const totalSets = exercises.reduce((t, ex) => t + plannedSets(ex), 0)
  const doneSets = log.loaded ? exercises.reduce((t, ex) => t + (log.values[ex.id] || []).filter(rowHasData).length, 0) : 0

  const firstOpenStep = () => {
    const i = groups.findIndex(g => g.items.some(ex => (log.values[ex.id] || []).some(r => !rowHasData(r))))
    return i >= 0 ? i : 0
  }
  const openSession = (start) => {
    if (exercises.length === 0) return
    setSession({ start: start ?? firstOpenStep() })
  }

  useEffect(() => {
    if (!sessionRequest || sessionRequest <= handledSessionRequest) return
    if (Date.now() - sessionRequest > 20000) return
    handledSessionRequest = sessionRequest
    openSession()
  }, [sessionRequest])

  const closeSession = (prs) => {
    setSession(null)
    if (prs?.length) {
      log.setPrShareUrl(null)
      log.setNewPrs(prs)
    }
  }

  let stepNumber = 0
  return (
    <>
      <SessionHero
        day={day}
        routineName={routineName}
        exercises={exercises}
        doneSets={doneSets}
        totalSets={totalSets}
        loaded={log.loaded}
        hasCheckedInToday={hasCheckedInToday}
        isOverride={isOverride}
        onStart={() => openSession()}
      />

      {dayStrip}

      {exercises.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-2.5 px-0.5">
            <span className="nl-label">Sesión de hoy</span>
            {log.loaded && <span className="text-[12.5px] nl-tabular" style={{ color: C.muted }}>{doneSets}/{totalSets} series</span>}
          </div>
          <div className="nl-card overflow-hidden">
            {groups.map((g, gi) => {
              const isGroup = g.id > 0 && g.items.length >= 2
              stepNumber += 1
              const num = String(stepNumber).padStart(2, '0')
              return (
                <div key={gi} className={isGroup ? 'relative pt-3.5' : ''} style={{ borderTop: gi ? `1px solid ${C.line}` : 'none' }}>
                  {isGroup && (
                    <>
                      <div className="flex items-center gap-2 px-4">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-md" style={{ background: C.soft, color: C.accent }}>
                          {g.items.length >= 3 ? 'Tri-serie' : 'Bi-serie'}
                        </span>
                        <span className="text-[12px]" style={{ color: C.dim }}>seguidos, sin descanso entre ellos</span>
                      </div>
                      <span aria-hidden className="absolute left-[33px] top-[60px] bottom-[34px] w-px" style={{ background: 'linear-gradient(180deg, rgba(212,175,106,0.55), rgba(212,175,106,0.08))' }} />
                    </>
                  )}
                  {g.items.map((ex, xi) => (
                    <ExerciseRow
                      key={ex.id}
                      ex={ex}
                      badge={isGroup ? `${num}${LETTERS[xi]}` : num}
                      rows={log.values[ex.id]}
                      last={log.lastSets[ex.id]}
                      loaded={log.loaded}
                      suggested={suggestedFor(ex, memberPrs)}
                      onOpen={() => openSession(gi)}
                      onVideo={ex.video_url ? () => onVideo(ex) : null}
                    />
                  ))}
                </div>
              )
            })}
          </div>
          <p className="text-[12px] mt-2.5 px-0.5 leading-snug" style={{ color: C.dim }}>
            Apuntar el peso y las repeticiones es opcional, pero así tu entrenador ve tu progresión real y ajusta tus cargas.
          </p>
        </section>
      )}

      {session && (
        <SessionMode
          day={day}
          routineName={routineName}
          exercises={exercises}
          groups={groups}
          log={log}
          memberPrs={memberPrs}
          startStep={session.start}
          hasCheckedInToday={hasCheckedInToday}
          isCheckingIn={isCheckingIn}
          onCheckin={onCheckin}
          onClose={closeSession}
        />
      )}

      {!session && log.newPrs.length > 0 && <GoldPrDialog log={log} />}
    </>
  )
}

function SessionHero({ day, routineName, exercises, doneSets, totalSets, loaded, hasCheckedInToday, isOverride, onStart }) {
  const num = String(day.day_number).padStart(2, '0')
  const pct = totalSets ? doneSets / totalSets : 0
  const started = doneSets > 0
  return (
    <div
      className="nl-card relative overflow-hidden p-5"
      style={{
        background: 'radial-gradient(120% 85% at 100% 0%, rgba(212,175,106,0.20) 0%, rgba(212,175,106,0) 55%), linear-gradient(165deg,#1F1B14 0%,#151517 58%)',
        borderColor: 'rgba(212,175,106,0.18)',
      }}
    >
      <span aria-hidden className="nl-display absolute -right-1 -top-7 text-[150px] select-none pointer-events-none" style={{ color: 'rgba(212,175,106,0.08)', lineHeight: 1 }}>
        {num}
      </span>
      <div className="relative">
        <p className="nl-label" style={{ color: C.accent }}>
          {isOverride ? `Hoy eliges · Día ${day.day_number}` : `Entreno de hoy · Día ${day.day_number}`}
        </p>
        <h2 className="nl-display text-[42px] mt-2 pr-12" style={{ color: C.text }}>
          {day.name || routineName || `Día ${day.day_number}`}
        </h2>
        {exercises.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            <span className="nl-chip" style={{ background: 'rgba(255,255,255,0.06)' }}><Dumbbell className="w-3.5 h-3.5" style={{ color: C.accent }} /> {exercises.length} ejercicios</span>
            <span className="nl-chip" style={{ background: 'rgba(255,255,255,0.06)' }}><Layers className="w-3.5 h-3.5" style={{ color: C.accent }} /> {totalSets} series</span>
            <span className="nl-chip" style={{ background: 'rgba(255,255,255,0.06)' }}><Clock className="w-3.5 h-3.5" style={{ color: C.accent }} /> ~{estimateMinutes(exercises)} min</span>
          </div>
        )}
        {loaded && started && (
          <div className="mt-5">
            <div className="flex justify-between text-[12.5px] mb-1.5">
              <span style={{ color: C.muted }}>Registrado hoy</span>
              <span className="nl-tabular font-semibold" style={{ color: C.text }}>{doneSets}/{totalSets} series</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full nl-grow-x" style={{ width: `${Math.round(pct * 100)}%`, background: GOLD_GRADIENT }} />
            </div>
          </div>
        )}
        {exercises.length > 0 ? (
          hasCheckedInToday ? (
            <button type="button" onClick={onStart} className="nl-btn nl-btn-ghost w-full mt-5">
              <Check className="w-[18px] h-[18px]" strokeWidth={2.4} style={{ color: C.accent }} /> Sesión completada · Ver series
            </button>
          ) : (
            <button type="button" onClick={onStart} className="nl-btn w-full mt-5">
              <Play className="w-4 h-4" fill="currentColor" /> {started ? 'Continuar entreno' : 'Empezar entreno'}
            </button>
          )
        ) : (
          <p className="text-[13.5px] mt-4" style={{ color: C.muted }}>Este día todavía no tiene ejercicios.</p>
        )}
      </div>
    </div>
  )
}

function DayStrip({ days, exercisesByDay, activeDay, todayDay, overrideDay, suggestionNote, onChoose }) {
  const overriding = overrideDay && overrideDay.id !== todayDay?.id
  // El día activo siempre a la vista (sin mover la página en vertical).
  const scrollerRef = useRef(null)
  useEffect(() => {
    const c = scrollerRef.current
    const el = c?.querySelector('[aria-pressed="true"]')
    if (!c || !el) return
    const left = el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2
    c.scrollTo({ left: Math.max(0, left) })
  }, [activeDay?.id])
  return (
    <section>
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <span className="nl-label">Elige el día</span>
        {overriding && (
          <button type="button" onClick={() => onChoose(null)} className="text-[12.5px] font-semibold" style={{ color: C.accent }}>
            {todayDay ? 'Volver al que toca' : 'Quitar'}
          </button>
        )}
      </div>
      <div ref={scrollerRef} className="nl-noscroll relative -mx-[18px] px-[18px] overflow-x-auto">
        <div className="flex gap-2 w-max pb-0.5">
          {days.map(d => {
            const active = activeDay?.id === d.id
            const isToday = todayDay?.id === d.id
            const count = (exercisesByDay[d.id] || []).length
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChoose(d.id === todayDay?.id ? null : d.id)}
                className="w-[124px] text-left rounded-[16px] px-3 py-2.5 border transition-colors"
                style={{
                  background: active ? 'rgba(212,175,106,0.12)' : C.surface,
                  borderColor: active ? 'rgba(212,175,106,0.5)' : C.line,
                }}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="nl-display text-[18px]" style={{ color: active ? C.accent : C.text }}>Día {d.day_number}</span>
                  {isToday && <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: C.accent }}>Hoy</span>}
                </span>
                <span className="block text-[12px] truncate mt-0.5" style={{ color: C.muted }}>
                  {d.name || `${count} ejercicios`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {(overriding || suggestionNote) && (
        <p className="text-[12px] mt-2 px-0.5 leading-snug" style={{ color: C.dim }}>
          {overriding
            ? `Hoy haces el día ${overrideDay.day_number}${todayDay ? ` en vez del día ${todayDay.day_number}` : ''}. Mañana vuelve el que te toque.`
            : suggestionNote}
        </p>
      )}
    </section>
  )
}

function ExerciseRow({ ex, badge, rows, last, loaded, suggested, onOpen, onVideo }) {
  const meta = exerciseMeta(ex)
  const planned = plannedSets(ex)
  const done = (rows || []).filter(rowHasData).length
  const complete = loaded && done >= planned
  return (
    <div className="flex items-start pr-3">
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 flex items-start gap-3.5 text-left pl-4 pr-1 py-3.5 transition-opacity active:opacity-70">
        <span
          className="relative z-[1] w-9 h-9 shrink-0 rounded-[11px] flex items-center justify-center nl-display nl-tabular text-[17px]"
          style={complete
            ? { background: C.accent, color: C.ink }
            : { background: '#1D1D20', color: done > 0 ? C.accent : C.muted }}
        >
          {complete ? <Check className="w-[18px] h-[18px]" strokeWidth={2.6} /> : badge}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold leading-snug" style={{ color: C.text }}>{ex.name}</span>
          <span className="block text-[12.5px] mt-0.5" style={{ color: C.muted }}>
            {planned} × {ex.reps || '—'} · {restOf(ex)} s{meta.drops ? ` · Dropset ${meta.drops.join('→')}` : ''}
          </span>
          {(last || suggested) && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px]">
              {last && (
                <span className="flex items-center gap-1 min-w-0" style={{ color: C.dim }}>
                  <History className="w-3 h-3 shrink-0" /> <span className="truncate nl-tabular">{lastSummary(last)}</span>
                </span>
              )}
              {suggested && <span className="font-semibold" style={{ color: C.accent }}>~{fmtKg(suggested)} kg sugerido</span>}
            </span>
          )}
          {loaded && (
            <span className="flex gap-1 mt-2.5">
              {Array.from({ length: planned }).map((_, i) => (
                <span key={i} className="h-[3px] w-[18px] rounded-full transition-colors" style={{ background: rowHasData(rows?.[i]) ? C.accent : 'rgba(255,255,255,0.09)' }} />
              ))}
            </span>
          )}
        </span>
      </button>
      {onVideo && (
        <button
          type="button"
          onClick={onVideo}
          aria-label={`Ver la técnica de ${ex.name}`}
          className="mt-3.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center border"
          style={{ borderColor: 'rgba(212,175,106,0.35)', color: C.accent }}
        >
          <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
        </button>
      )}
    </div>
  )
}

function CheckinCard({ hasCheckedInToday, isCheckingIn, onCheckin, showCheckinConfetti }) {
  if (showCheckinConfetti) {
    return (
      <div className="nl-card relative overflow-hidden px-5 py-7 text-center" style={{ background: 'radial-gradient(90% 90% at 50% 0%, rgba(212,175,106,0.28) 0%, rgba(212,175,106,0) 70%), #151517', borderColor: 'rgba(212,175,106,0.35)' }}>
        <NlBurst />
        <Trophy className="relative w-12 h-12 mx-auto" style={{ color: C.accent }} />
        <p className="relative nl-display text-[32px] mt-3" style={{ color: C.text }}>¡Sesión finalizada!</p>
        <p className="relative text-[13.5px] mt-1" style={{ color: C.muted }}>Tus estadísticas se han actualizado.</p>
      </div>
    )
  }
  if (hasCheckedInToday) {
    return (
      <div className="nl-card px-4 py-3.5 flex items-center gap-3">
        <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" style={{ background: C.soft }}>
          <Check className="w-5 h-5" strokeWidth={2.4} style={{ color: C.accent }} />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold" style={{ color: C.text }}>Sesión de hoy completada</p>
          <p className="text-[12.5px]" style={{ color: C.muted }}>Has registrado tu entrenamiento. Mañana más.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="nl-card p-[18px]">
      <p className="nl-label">¿Has terminado?</p>
      <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: C.muted }}>
        Completa la sesión para mantener al día tus estadísticas, tu racha y tu puesto en el ranking.
      </p>
      <button type="button" onClick={onCheckin} disabled={isCheckingIn} className="nl-btn nl-btn-ghost w-full mt-4 disabled:opacity-60">
        {isCheckingIn
          ? <><Loader2 className="w-5 h-5 animate-spin" /> Registrando...</>
          : <><Flame className="w-5 h-5" style={{ color: C.accent }} /> Completar sesión de hoy</>}
      </button>
    </div>
  )
}

function RoutineCard({ workout, daysCount }) {
  const [why, setWhy] = useState(false)
  return (
    <div className="nl-card p-[18px]">
      <p className="nl-label">Tu rutina</p>
      <h3 className="nl-display text-[30px] mt-1.5" style={{ color: C.text }}>{workout.name}</h3>
      {workout.description && (
        <p className="text-[13.5px] mt-2 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{workout.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="nl-chip"><Calendar className="w-3.5 h-3.5" style={{ color: C.accent }} /> {daysCount} días de entrenamiento</span>
      </div>
      {workout.medical_rationale && (
        <div className="mt-4 rounded-[16px] overflow-hidden" style={{ background: C.soft }}>
          <button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left">
            <HeartPulse className="w-[18px] h-[18px] shrink-0" style={{ color: C.accent }} />
            <span className="flex-1 text-[13.5px] font-semibold" style={{ color: C.text }}>Por qué esta rutina es buena para ti</span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${why ? 'rotate-180' : ''}`} style={{ color: C.muted }} />
          </button>
          {why && (
            <p className="px-3.5 pb-3.5 text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: 'rgba(244,241,234,0.82)' }}>
              {workout.medical_rationale}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function OtherDays({ days, exercisesByDay }) {
  const [open, setOpen] = useState(null)
  return (
    <section>
      <div className="mb-2.5 px-0.5"><span className="nl-label">Resto de la semana</span></div>
      <div className="nl-card overflow-hidden">
        {days.map((d, i) => {
          const exs = exercisesByDay[d.id] || []
          const isOpen = open === d.id
          return (
            <div key={d.id} style={{ borderTop: i ? `1px solid ${C.line}` : 'none' }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                <span className="nl-display nl-tabular text-[22px] w-8" style={{ color: C.dim }}>{String(d.day_number).padStart(2, '0')}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-semibold truncate" style={{ color: C.text }}>{d.name || `Día ${d.day_number}`}</span>
                  <span className="block text-[12.5px]" style={{ color: C.muted }}>{exs.length} ejercicios · {exs.reduce((t, ex) => t + plannedSets(ex), 0)} series</span>
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: C.muted }} />
              </button>
              {isOpen && (
                <ul className="px-4 pb-3.5 pl-[60px] space-y-1.5">
                  {exs.map(ex => (
                    <li key={ex.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate" style={{ color: 'rgba(244,241,234,0.85)' }}>{ex.name}</span>
                      <span className="shrink-0 nl-tabular" style={{ color: C.muted }}>{plannedSets(ex)}×{ex.reps || '—'}</span>
                    </li>
                  ))}
                  {exs.length === 0 && <li className="text-[13px]" style={{ color: C.muted }}>Sin ejercicios.</li>}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Destello de partículas doradas para los momentos de celebración.
function NlBurst() {
  return (
    <span aria-hidden className="nl-burst pointer-events-none absolute inset-0">
      {Array.from({ length: 14 }).map((_, i) => (
        <i key={i} style={{ '--a': `${(360 / 14) * i}deg`, '--d': `${70 + (i % 3) * 22}px`, animationDelay: `${(i % 4) * 40}ms` }} />
      ))}
    </span>
  )
}

function GoldPrDialog({ log }) {
  const close = () => { log.setNewPrs([]); log.setPrShareUrl(null) }
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="bg-[#111] border-amber-500/30 rounded-3xl max-w-sm p-5 overflow-hidden">
        <NlBurst />
        <DialogHeader>
          <DialogTitle className="nl-display text-[30px] text-left flex items-center gap-2" style={{ color: C.text }}>
            <Trophy className="w-6 h-6" style={{ color: C.accent }} /> ¡Nuevo récord{log.newPrs.length > 1 ? 's' : ''}!
          </DialogTitle>
        </DialogHeader>
        <PrList log={log} prs={log.newPrs} />
      </DialogContent>
    </Dialog>
  )
}

function PrList({ log, prs }) {
  return (
    <div className="space-y-2.5">
      {prs.map(pr => (
        <div key={pr.exercise.id} className="rounded-[18px] p-3.5" style={{ background: C.soft, border: '1px solid rgba(212,175,106,0.22)' }}>
          <p className="text-[14.5px] font-semibold" style={{ color: C.text }}>{pr.exercise.name}</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="nl-display nl-tabular text-[28px]" style={{ color: C.accent }}>{fmtKg(pr.weight)} kg{pr.reps ? ` × ${pr.reps}` : ''}</span>
            <span className="text-[12.5px]" style={{ color: C.muted }}>antes {fmtKg(pr.previous)} kg</span>
          </p>
          {!log.prShareUrl && (
            <button type="button" disabled={log.prShareBuilding} onClick={() => log.buildPrShare(pr)} className="mt-2 h-9 px-3.5 rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60" style={{ background: C.accent, color: C.ink }}>
              {log.prShareBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Crear imagen para compartir
            </button>
          )}
        </div>
      ))}
      {log.prShareUrl && (
        <div className="space-y-2.5">
          <img src={log.prShareUrl} alt="Nuevo récord" className="w-full rounded-[18px] border border-white/10" />
          <div className="flex gap-2">
            <button type="button" onClick={() => log.sharePr()} className="nl-btn flex-1 h-12"><Share2 className="w-4 h-4" /> Compartir</button>
            <button type="button" onClick={() => log.downloadPr()} aria-label="Descargar imagen" className="nl-btn nl-btn-ghost w-12 h-12"><Download className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── modo entreno ─────────────────────────

function SessionMode({
  day, routineName, exercises, groups, log, memberPrs, startStep = 0,
  hasCheckedInToday, isCheckingIn, onCheckin, onClose,
}) {
  const { toast } = useToast()
  const [step, setStep] = useState(Math.min(Math.max(0, startStep), Math.max(0, groups.length - 1)))
  const [view, setView] = useState('session') // 'session' | 'summary'
  const [rest, setRest] = useState(null)      // { endsAt, total, nextLabel, done }
  const [now, setNow] = useState(() => Date.now())
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sessionPrs, setSessionPrs] = useState([])
  const [hint, setHint] = useState(null)
  const [video, setVideo] = useState(null)
  const [openNotes, setOpenNotes] = useState({})
  const [finishedAt, setFinishedAt] = useState(null)
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
  })
  const scrollRef = useRef(null)
  const { unlock, beep } = useBeeper()
  const startKey = `nlvip_session_start:${day.id}:${todayISO()}`
  const [startedAt] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(startKey))
      if (saved && Date.now() - saved < 5 * 3600 * 1000) return saved
      const t = Date.now()
      localStorage.setItem(startKey, String(t))
      return t
    } catch { return Date.now() }
  })

  // Reloj (cronómetro de la sesión y cuenta atrás del descanso).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // Fin del descanso: vibración y pitido.
  useEffect(() => {
    if (rest && !rest.done && now >= rest.endsAt) {
      try { navigator.vibrate?.([220, 120, 220]) } catch {}
      if (sound) beep()
      setRest(r => (r ? { ...r, done: true } : r))
    }
  }, [now, rest, sound])
  useEffect(() => {
    if (!rest?.done) return
    const t = setTimeout(() => setRest(null), 2600)
    return () => clearTimeout(t)
  }, [rest?.done])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 2600)
    return () => clearTimeout(t)
  }, [hint])

  // Pantalla siempre encendida mientras se entrena, y sin scroll de fondo.
  useEffect(() => {
    let lock = null
    const request = async () => { try { lock = await navigator.wakeLock?.request('screen') } catch {} }
    request()
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVisible)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      try { lock?.release() } catch {}
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // Botón "atrás" de Android: cierra el modo entreno (guardando) en vez de
  // salir de la app.
  const closeRef = useRef(null)
  useEffect(() => {
    let handle = null
    let cancelled = false
    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        const h = await App.addListener('backButton', () => closeRef.current?.())
        if (cancelled) h.remove(); else handle = h
      } catch {}
    })()
    return () => { cancelled = true; try { handle?.remove() } catch {} }
  }, [])

  const group = groups[step]
  const isLastStep = step >= groups.length - 1
  const elapsed = Math.floor(((finishedAt || now) - startedAt) / 1000)

  const saveIfDirty = async () => {
    if (!dirty) return { ok: true, prs: [] }
    setBusy(true)
    const r = await log.save({ silent: true })
    setBusy(false)
    if (r.ok) setDirty(false)
    return r
  }

  const go = async (next) => {
    if (busy || next < 0 || next >= groups.length) return
    const r = await saveIfDirty()
    if (!r.ok) return
    if (r.prs?.length) setSessionPrs(p => mergePrs(p, r.prs))
    setVideo(null)
    setStep(next)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const finish = async () => {
    if (busy) return
    const r = await saveIfDirty()
    if (!r.ok) return
    setSessionPrs(p => mergePrs(p, r.prs || []))
    setRest(null)
    setVideo(null)
    setFinishedAt(Date.now())
    setView('summary')
    try { localStorage.removeItem(startKey) } catch {}
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const handleClose = async () => {
    if (busy) return
    if (view === 'summary') { onClose([]); return }
    const wasDirty = dirty
    const r = await saveIfDirty()
    if (!r.ok) return
    if (wasDirty) toast({ title: 'Series guardadas', description: 'Tu entreno de hoy queda registrado. Puedes seguir cuando quieras.' })
    onClose(mergePrs(sessionPrs, r.prs || []))
  }
  closeRef.current = handleClose

  const fillSource = (ex, i) => {
    const rows = log.values[ex.id] || []
    for (let k = i - 1; k >= 0; k--) {
      if (rowHasData(rows[k])) return { weight: rows[k].weight, reps: rows[k].reps }
    }
    const sets = log.lastSets[ex.id]?.sets || []
    const prev = sets[i] || sets[sets.length - 1]
    if (prev && (prev.weight != null || prev.reps != null)) {
      return {
        weight: prev.weight != null ? String(prev.weight).replace('.', ',') : '',
        reps: prev.reps != null ? String(prev.reps) : '',
      }
    }
    return null
  }

  const startRest = (seconds, nextLabel) => {
    unlock()
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds, nextLabel, done: false })
  }

  const checkSet = (ex, i, xi) => {
    const row = (log.values[ex.id] || [])[i]
    if (!rowHasData(row)) {
      const src = fillSource(ex, i)
      if (!src) {
        document.getElementById(`nl-kg-${ex.id}-${i}`)?.focus()
        setHint('Apunta el peso y las repeticiones de la serie')
        return
      }
      log.setRow(ex.id, i, src)
    }
    setDirty(true)
    try { navigator.vibrate?.(18) } catch {}
    const isLastInGroup = xi === group.items.length - 1
    if (!isLastInGroup) {
      const nextEx = group.items[xi + 1]
      setHint(`Sin descanso: sigue con ${LETTERS[xi + 1]} · ${nextEx.name}`)
      return
    }
    const first = group.items[0]
    let nextLabel
    if (i + 1 < plannedSets(first)) {
      nextLabel = group.items.length > 1 ? `serie ${i + 2} de la ${group.items.length >= 3 ? 'tri' : 'bi'}-serie` : `serie ${i + 2} de ${plannedSets(ex)}`
    } else if (!isLastStep) {
      nextLabel = groups[step + 1].items.map(e => e.name).join(' + ')
    } else {
      nextLabel = 'terminar el entreno'
    }
    startRest(restOf(ex), nextLabel)
  }

  const openVideo = async (ex) => {
    const url = await exerciseVideoUrl(ex.video_url)
    if (url) setVideo({ name: ex.name, url })
    else setHint('No se ha podido cargar el vídeo')
  }

  const toggleSound = () => {
    setSound(s => {
      const next = !s
      try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch {}
      if (next) unlock()
      return next
    })
  }

  const node = (
    <div
      className="nl-session fixed inset-0 z-[95] flex flex-col"
      style={{ background: '#0B0B0C', paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Modo entreno"
    >
      {/* Barra superior */}
      <div className="shrink-0 px-4 pt-2">
        <div className="flex items-center justify-between h-12 gap-3">
          <button type="button" onClick={handleClose} disabled={busy} aria-label="Cerrar el modo entreno" className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center disabled:opacity-50" style={{ background: C.surface2, color: C.text }}>
            {busy && view === 'session' ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <X className="w-[18px] h-[18px]" />}
          </button>
          <p className="nl-label truncate text-center" style={{ color: C.muted }}>
            Día {day.day_number}{day.name ? ` · ${day.name}` : routineName ? ` · ${routineName}` : ''}
          </p>
          <span className="nl-display nl-tabular text-[22px] shrink-0 min-w-[56px] text-right" style={{ color: view === 'summary' ? C.accent : C.text }}>
            {fmtClock(elapsed)}
          </span>
        </div>
        {view === 'session' && (
          <div className="flex gap-1 mt-2" aria-hidden>
            {groups.map((g, i) => {
              const total = g.items.reduce((t, ex) => t + plannedSets(ex), 0)
              const done = g.items.reduce((t, ex) => t + (log.values[ex.id] || []).filter(rowHasData).length, 0)
              const pct = total ? Math.min(1, done / total) : 0
              return (
                <span key={i} className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: i === step ? 'rgba(212,175,106,0.22)' : 'rgba(255,255,255,0.08)' }}>
                  <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: GOLD_GRADIENT }} />
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pt-6" style={{ paddingBottom: rest ? 310 : 28 }}>
        {view === 'summary' ? (
          <SessionSummary
            day={day}
            routineName={routineName}
            exercises={exercises}
            log={log}
            elapsed={elapsed}
            prs={sessionPrs}
            hasCheckedInToday={hasCheckedInToday}
            isCheckingIn={isCheckingIn}
            onCheckin={onCheckin}
            onClose={() => onClose([])}
          />
        ) : !log.loaded ? (
          <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin" style={{ color: C.accent }} /></div>
        ) : group ? (
          <div key={step} className="nl-step-in">
            <p className="nl-label" style={{ color: C.accent }}>
              {group.items.length > 1
                ? `${group.items.length >= 3 ? 'Tri-serie' : 'Bi-serie'} · ${step + 1} de ${groups.length}`
                : `Ejercicio ${step + 1} de ${groups.length}`}
            </p>
            {group.items.length > 1 && (
              <p className="text-[13px] mt-1.5" style={{ color: C.muted }}>
                Haz una serie de cada ejercicio seguidos y descansa al terminar la ronda.
              </p>
            )}
            {group.items.map((ex, xi) => (
              <SessionExercise
                key={ex.id}
                ex={ex}
                xi={xi}
                letter={group.items.length > 1 ? LETTERS[xi] : null}
                log={log}
                suggested={suggestedFor(ex, memberPrs)}
                noteOpen={!!openNotes[ex.id]}
                onOpenNote={() => setOpenNotes(n => ({ ...n, [ex.id]: true }))}
                onChange={() => setDirty(true)}
                onCheck={(i) => checkSet(ex, i, xi)}
                fillSource={fillSource}
                onVideo={ex.video_url ? () => openVideo(ex) : null}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Barra inferior */}
      {view === 'session' && (
        <div className="shrink-0 px-4 pt-3 border-t" style={{ borderColor: C.line, background: 'rgba(11,11,12,0.96)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2.5">
            <button type="button" disabled={step === 0 || busy} onClick={() => go(step - 1)} aria-label="Ejercicio anterior" className="nl-btn nl-btn-ghost w-[52px] shrink-0 disabled:opacity-35">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" disabled={busy || !log.loaded} onClick={() => (isLastStep ? finish() : go(step + 1))} className="nl-btn flex-1 disabled:opacity-60">
              {busy
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                : isLastStep
                  ? <><Check className="w-5 h-5" strokeWidth={2.4} /> Terminar entreno</>
                  : <>Siguiente ejercicio <ChevronRight className="w-5 h-5" /></>}
            </button>
          </div>
        </div>
      )}

      {/* Aviso breve */}
      {hint && view === 'session' && (
        <div className="absolute inset-x-0 flex justify-center px-6 pointer-events-none z-20" style={{ bottom: rest ? 330 : 'calc(92px + env(safe-area-inset-bottom))' }}>
          <span className="nl-hint-in text-[13px] font-semibold px-4 py-2.5 rounded-full text-center" style={{ background: '#26231C', color: C.accent2, border: '1px solid rgba(212,175,106,0.3)', boxShadow: '0 12px 30px -10px rgba(0,0,0,0.8)' }}>
            {hint}
          </span>
        </div>
      )}

      {/* Descanso */}
      {rest && view === 'session' && (
        <RestSheet
          rest={rest}
          now={now}
          sound={sound}
          onToggleSound={toggleSound}
          onAdd={(delta) => setRest(r => (r && !r.done ? { ...r, endsAt: Math.max(Date.now() + 1000, r.endsAt + delta * 1000), total: Math.max(5, r.total + delta) } : r))}
          onSkip={() => setRest(null)}
        />
      )}

      {/* Vídeo de técnica */}
      {video && (
        <div className="absolute inset-0 z-30 flex flex-col" style={{ background: 'rgba(5,5,6,0.96)', paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between px-4 h-14">
            <p className="nl-display text-[22px] truncate pr-3" style={{ color: C.text }}>{video.name}</p>
            <button type="button" onClick={() => setVideo(null)} aria-label="Cerrar vídeo" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: C.surface2, color: C.text }}>
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
          <div className="flex-1 flex items-center px-3 pb-10">
            <video src={video.url} controls autoPlay playsInline className="w-full max-h-full rounded-2xl bg-black" />
          </div>
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

function SessionExercise({ ex, xi, letter, log, suggested, noteOpen, onOpenNote, onChange, onCheck, fillSource, onVideo }) {
  const meta = exerciseMeta(ex)
  const rows = log.values[ex.id] || []
  const last = log.lastSets[ex.id]
  const note = log.notes[ex.id] || ''
  return (
    <div className={xi ? 'mt-8 pt-7 border-t' : 'mt-3'} style={{ borderColor: C.line }}>
      <div className="flex items-start gap-3">
        {letter && (
          <span className="nl-display text-[20px] w-9 h-9 shrink-0 mt-1 rounded-[11px] flex items-center justify-center" style={{ background: C.soft, color: C.accent }}>
            {letter}
          </span>
        )}
        <h2 className="nl-display text-[38px] flex-1 min-w-0" style={{ color: C.text, overflowWrap: 'anywhere' }}>{ex.name}</h2>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3.5">
        <span className="nl-chip"><Layers className="w-3.5 h-3.5" style={{ color: C.accent }} /> {plannedSets(ex)} series</span>
        <span className="nl-chip"><Repeat className="w-3.5 h-3.5" style={{ color: C.accent }} /> {ex.reps || '—'} reps</span>
        <span className="nl-chip"><Timer className="w-3.5 h-3.5" style={{ color: C.accent }} /> {restOf(ex)} s</span>
        {meta.drops && <span className="nl-chip" style={{ color: C.accent2 }}>Dropset {meta.drops.join(' → ')}</span>}
        {onVideo && (
          <button type="button" onClick={onVideo} className="nl-chip" style={{ background: C.soft, color: C.accent }}>
            <Play className="w-3.5 h-3.5" fill="currentColor" /> Técnica
          </button>
        )}
      </div>

      {meta.notes && <p className="text-[13.5px] mt-3 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{meta.notes}</p>}

      {(last || suggested) && (
        <div className={`mt-4 grid gap-2 ${last && suggested ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>
          {last && (
            <div className="rounded-[16px] px-3.5 py-3 min-w-0" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <p className="nl-label flex items-center gap-1.5"><History className="w-3 h-3" /> Última vez · {shortDate(last.date)}</p>
              <p className="text-[14px] mt-1.5 nl-tabular font-medium" style={{ color: C.text }}>{lastSummary(last, 5)}</p>
            </div>
          )}
          {suggested && (
            <div className="rounded-[16px] px-3.5 py-3" style={{ background: C.soft, border: '1px solid rgba(212,175,106,0.2)' }}>
              <p className="nl-label" style={{ color: C.accent }}>Sugerido</p>
              <p className="nl-display nl-tabular text-[26px] mt-1 whitespace-nowrap" style={{ color: C.text }}>~{fmtKg(suggested)} kg</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className="grid grid-cols-[40px_1fr_1fr_52px] gap-2 px-1 mb-2">
          <span className="nl-label text-center">Serie</span>
          <span className="nl-label text-center">Kg</span>
          <span className="nl-label text-center">Reps</span>
          <span />
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => {
            const has = rowHasData(row)
            const src = has ? null : fillSource(ex, i)
            return (
              <div
                key={i}
                className="grid grid-cols-[40px_1fr_1fr_52px] gap-2 items-center rounded-[18px] p-1 transition-colors duration-300"
                style={{ background: has ? 'rgba(212,175,106,0.08)' : 'transparent' }}
              >
                <span className="nl-display nl-tabular text-[24px] text-center" style={{ color: has ? C.accent : C.dim }}>{i + 1}</span>
                <input
                  id={`nl-kg-${ex.id}-${i}`}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  aria-label={`Kilos de la serie ${i + 1}`}
                  placeholder={src?.weight || 'kg'}
                  value={row.weight}
                  onChange={e => { log.setField(ex.id, i, 'weight', e.target.value); onChange() }}
                  className="nl-set-input"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-label={`Repeticiones de la serie ${i + 1}`}
                  placeholder={src?.reps || 'reps'}
                  value={row.reps}
                  onChange={e => { log.setField(ex.id, i, 'reps', e.target.value); onChange() }}
                  className="nl-set-input"
                />
                <button
                  type="button"
                  onClick={() => onCheck(i)}
                  aria-label={has ? `Serie ${i + 1} hecha: empezar el descanso` : `Marcar la serie ${i + 1} como hecha`}
                  className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center transition-all active:scale-95"
                  style={has ? { background: C.accent, color: C.ink } : { background: C.surface2, color: C.muted }}
                >
                  <Check className="w-[22px] h-[22px]" strokeWidth={2.6} />
                </button>
              </div>
            )
          })}
        </div>
        {rows.some(r => !rowHasData(r)) && rows.some((_, i) => fillSource(ex, i)) && (
          <p className="text-[12px] mt-2.5 px-1" style={{ color: C.dim }}>
            Pulsa ✓ para apuntar lo que ves en gris, o escribe tus kilos y repeticiones.
          </p>
        )}
      </div>

      <div className="mt-4">
        {noteOpen || note ? (
          <textarea
            value={note}
            onChange={e => { log.setNoteField(ex.id, e.target.value); onChange() }}
            placeholder="Nota para tu entrenador (opcional): p. ej. «me costó acabar» o «lo hice con otra máquina»"
            rows={2}
            className="nl-set-note"
          />
        ) : (
          <button type="button" onClick={onOpenNote} className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: C.muted }}>
            <NotebookPen className="w-4 h-4" /> Añadir nota
          </button>
        )}
      </div>
    </div>
  )
}

function RestSheet({ rest, now, sound, onToggleSound, onAdd, onSkip }) {
  const remaining = rest.done ? 0 : Math.max(0, (rest.endsAt - now) / 1000)
  const pct = rest.total ? Math.min(1, remaining / rest.total) : 0
  const R = 50
  const CIRC = 2 * Math.PI * R
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 nl-sheet-up">
      <div
        className="rounded-t-[28px] border-t px-5 pt-4"
        style={{
          background: 'linear-gradient(180deg,#1C1913 0%,#141416 70%)',
          borderColor: 'rgba(212,175,106,0.28)',
          boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.9)',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="nl-label" style={{ color: C.accent }}>{rest.done ? '¡Vamos!' : 'Descanso'}</span>
          <button type="button" onClick={onToggleSound} aria-label={sound ? 'Silenciar el aviso del descanso' : 'Activar el aviso sonoro del descanso'} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: C.muted }}>
            {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-5 mt-1">
          <div className="relative w-[118px] h-[118px] shrink-0">
            <svg viewBox="0 0 118 118" className="w-full h-full -rotate-90">
              <defs>
                <linearGradient id="nlRestGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#E9CF97" />
                  <stop offset="1" stopColor="#B8914F" />
                </linearGradient>
              </defs>
              <circle cx="59" cy="59" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <circle
                cx="59" cy="59" r={R} fill="none" stroke="url(#nlRestGrad)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
                style={{ transition: 'stroke-dashoffset 0.25s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {rest.done
                ? <Check className="w-11 h-11" strokeWidth={2.6} style={{ color: C.accent }} />
                : <span className="nl-display nl-tabular text-[36px]" style={{ color: C.text }}>{fmtClock(Math.ceil(remaining))}</span>}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold" style={{ color: C.text }}>{rest.done ? 'A por la siguiente' : 'Recupera y respira'}</p>
            {rest.nextLabel && (
              <p className="text-[12.5px] mt-1 leading-snug" style={{ color: C.muted }}>
                Después: <span style={{ color: C.text }}>{rest.nextLabel}</span>
              </p>
            )}
            {!rest.done && (
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => onAdd(-15)} className="h-10 flex-1 rounded-[12px] text-[13.5px] font-semibold nl-tabular" style={{ background: 'rgba(255,255,255,0.07)', color: C.text }}>−15 s</button>
                <button type="button" onClick={() => onAdd(15)} className="h-10 flex-1 rounded-[12px] text-[13.5px] font-semibold nl-tabular" style={{ background: 'rgba(255,255,255,0.07)', color: C.text }}>+15 s</button>
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={onSkip} className="nl-btn w-full mt-4 h-12">
          {rest.done ? 'Seguir' : <>Saltar descanso <SkipForward className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

function SummaryStat({ label, value, sub }) {
  return (
    <div className="rounded-[20px] px-4 py-3.5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <p className="nl-label">{label}</p>
      <p className="nl-display nl-tabular text-[34px] mt-1.5" style={{ color: C.text }}>{value}</p>
      {sub && <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>{sub}</p>}
    </div>
  )
}

function SessionSummary({ day, routineName, exercises, log, elapsed, prs, hasCheckedInToday, isCheckingIn, onCheckin, onClose }) {
  let setsDone = 0
  let volume = 0
  let exDone = 0
  for (const ex of exercises) {
    const rows = (log.values[ex.id] || []).filter(rowHasData)
    if (rows.length) exDone += 1
    setsDone += rows.length
    for (const r of rows) {
      const w = toNum(r.weight)
      const reps = toNum(r.reps)
      if (w != null && reps != null) volume += w * reps
    }
  }
  const volumeShown = useCountUp(volume, 1100)
  const setsShown = useCountUp(setsDone, 800)
  const longSession = elapsed > 4 * 3600

  return (
    <div className="pb-4">
      <div className="text-center pt-2">
        <div className="relative w-[132px] h-[132px] mx-auto">
          <NlBurst />
          <span className="absolute inset-0 rounded-full nl-glow" style={{ background: 'radial-gradient(circle, rgba(212,175,106,0.45) 0%, rgba(212,175,106,0) 68%)' }} />
          <span className="absolute inset-[22px] rounded-full flex items-center justify-center nl-pop" style={{ background: 'linear-gradient(145deg,#F1DCA8 0%,#C9A35E 55%,#A8823F 100%)', boxShadow: '0 18px 40px -12px rgba(212,175,106,0.55), inset 0 2px 0 rgba(255,255,255,0.35)' }}>
            <Trophy className="w-11 h-11" style={{ color: C.ink }} strokeWidth={2} />
          </span>
        </div>
        <p className="nl-label mt-6" style={{ color: C.accent }}>Día {day.day_number}{day.name ? ` · ${day.name}` : routineName ? ` · ${routineName}` : ''}</p>
        <h2 className="nl-display text-[50px] mt-2" style={{ color: C.text }}>Entreno<br />completado</h2>
        {setsDone === 0 && (
          <p className="text-[13.5px] mt-3 max-w-[32ch] mx-auto leading-relaxed" style={{ color: C.muted }}>
            Hoy no has apuntado series. No pasa nada: completa la sesión igualmente para sumar a tu racha.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-7">
        <SummaryStat label="Duración" value={longSession ? '—' : fmtClock(elapsed)} />
        <SummaryStat label="Volumen" value={`${Math.round(volumeShown).toLocaleString('es-ES')}`} sub="kg levantados" />
        <SummaryStat label="Series" value={Math.round(setsShown)} />
        <SummaryStat label="Ejercicios" value={`${exDone}/${exercises.length}`} />
      </div>

      {prs.length > 0 && (
        <div className="mt-6">
          <p className="nl-label mb-2.5 flex items-center gap-1.5" style={{ color: C.accent }}><Trophy className="w-3.5 h-3.5" /> Nuevos récords</p>
          <PrList log={log} prs={prs} />
        </div>
      )}

      <div className="mt-7 space-y-2.5">
        {hasCheckedInToday ? (
          <div className="nl-btn nl-btn-ghost w-full"><Check className="w-5 h-5" strokeWidth={2.4} style={{ color: C.accent }} /> Sesión de hoy registrada</div>
        ) : (
          <button type="button" onClick={onCheckin} disabled={isCheckingIn} className="nl-btn w-full disabled:opacity-60">
            {isCheckingIn ? <><Loader2 className="w-5 h-5 animate-spin" /> Registrando...</> : <><Flame className="w-5 h-5" /> Completar sesión de hoy</>}
          </button>
        )}
        <button type="button" onClick={onClose} className="nl-btn nl-btn-ghost w-full">Cerrar</button>
      </div>
      {!hasCheckedInToday && (
        <p className="text-[12px] text-center mt-3 leading-snug" style={{ color: C.dim }}>
          Completar la sesión suma a tu racha, tus estadísticas y el ranking.
        </p>
      )}
    </div>
  )
}

export default GoldWorkoutView
