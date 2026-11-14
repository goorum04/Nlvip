'use client'

// Pantalla "Hoy" del diseño negro y oro: lo que el socio tiene que hacer hoy,
// con sus datos reales. No sustituye a ninguna pestaña: cada tarjeta lleva a
// la sección completa (Entreno, Actividad, Nutrición, Bienestar).

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Play, Check, ChevronRight, Footprints, UtensilsCrossed, Flame, Moon, Sun, Zap,
  TrendingUp, Heart, Sparkles, Coffee, Lock,
} from 'lucide-react'
import { pickTodayDay, localTodayIso, dayOverrideKey } from '@/lib/todayWorkout'
import { getCyclePhase, getPhaseName, getEnergyLevel, getWorkoutRecommendation } from '@/lib/cycleFunctions'
import { getDietMealSlots } from './DietTabParts'
import { useStreak, streakMessage } from './StreakCard'
import { TrainerMessageCard } from './TrainerMessageCard'
import { FirstWeekGuide } from './FirstWeekGuide'
import { WeekOverview } from './WeekOverview'
import { dayHeroImage, heroBackground, HERO_IMAGES } from '@/lib/heroImages'

const C = {
  text: 'var(--nl-text)', muted: 'var(--nl-muted)', dim: 'var(--nl-dim)', accent: 'var(--nl-accent)',
  surface2: 'var(--nl-surface2)', cycle: 'var(--nl-cycle)', cyclesoft: 'var(--nl-cyclesoft)', soft: 'var(--nl-soft)',
}

export function todayGreeting(now = new Date()) {
  const h = now.getHours()
  if (h >= 6 && h < 14) return 'Buenos días'
  if (h >= 14 && h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function todayKicker(hasPremium, now = new Date()) {
  const date = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace(',', '').replace('.', '')
  return `${date} · ${hasPremium ? 'Socio VIP' : 'Cuenta básica'}`
}

function Ring({ pct, size = 46, stroke = 4.5, color = C.accent, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, pct || 0))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'rgba(255,255,255,0.07)' }} strokeWidth={stroke} />
        {p > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="nl-ring-fill" style={{ stroke: color, '--nl-ring-c': `${c}px` }} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ color: C.muted }}>{children}</span>
    </div>
  )
}

function Stat({ icon: Icon, value, of, label, pct, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="nl-card p-3 flex flex-col gap-2.5 text-left min-w-0">
      <Ring pct={pct}><Icon className="w-[17px] h-[17px]" strokeWidth={1.8} /></Ring>
      <div className="min-w-0">
        <div className="nl-display nl-tabular text-[24px] whitespace-nowrap" style={{ color: C.text }}>
          {value}
          {of && <span className="text-[11px] font-medium normal-case tracking-normal" style={{ fontFamily: 'Inter, sans-serif', color: C.muted }}> {of}</span>}
        </div>
        <div className="text-[11.5px] mt-1 truncate" style={{ color: C.muted }}>{label}</div>
      </div>
    </Tag>
  )
}

const shortNumber = (n) => {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`
  return String(n)
}

// ───────────────── Entreno de hoy ─────────────────
function TodayWorkoutCard({ memberId, workoutRow, hasCheckedInToday, onOpen, onStart }) {
  const workoutId = workoutRow?.workout?.id
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!workoutId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: tpl } = await supabase
          .from('workout_templates')
          .select('id, name, workout_days(id, day_number, name, workout_exercises(id, name, order_index))')
          .eq('id', workoutId)
          .single()
        const days = [...(tpl?.workout_days || [])].sort((a, b) => a.day_number - b.day_number)
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
        if (!cancelled) setData({ name: tpl?.name, days, lastLog })
      } catch (e) {
        console.warn('[Hoy] No se pudo cargar el entreno de hoy:', e?.message)
        if (!cancelled) setData({ name: workoutRow?.workout?.name, days: [], lastLog: null })
      }
    })()
    return () => { cancelled = true }
  }, [workoutId, memberId])

  if (!data) {
    return <div className="nl-card h-[218px] animate-pulse" style={{ background: 'linear-gradient(160deg,#1E1B15 0%,#151517 55%)' }} />
  }

  const todayIso = localTodayIso()
  const { todayDay } = pickTodayDay(data.days, data.lastLog, todayIso)
  let overrideId = null
  try { overrideId = localStorage.getItem(dayOverrideKey(workoutId, todayIso)) } catch {}
  const day = (overrideId && data.days.find(d => d.id === overrideId)) || todayDay
  const exercises = day ? [...(day.workout_exercises || [])].sort((a, b) => a.order_index - b.order_index) : []
  const shown = exercises.slice(0, 2)
  const rest = exercises.length - shown.length

  return (
    <div
      className="nl-card p-[18px] nl-hero-photo"
      style={{ ...heroBackground(day ? dayHeroImage(day.name || data.name) : HERO_IMAGES.descanso), borderColor: 'rgba(212,175,106,0.2)' }}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <span className="nl-label" style={{ color: C.accent }}>{day ? `Entreno de hoy · Día ${day.day_number}` : 'Hoy toca descanso'}</span>
        {day && exercises.length > 0 && <span className="text-[12.5px] shrink-0" style={{ color: C.muted }}>{exercises.length} ejercicios</span>}
      </div>
      <h2 className="nl-display text-[34px] mb-3" style={{ color: C.text }}>
        {day ? (day.name || data.name || `Día ${day.day_number}`) : 'Recupera'}
      </h2>
      {day ? (
        shown.length > 0 && (
          <div className="flex gap-1.5 mb-4 overflow-hidden">
            {shown.map(ex => (
              <span key={ex.id} className="nl-chip min-w-0 shrink"><span className="truncate">{ex.name}</span></span>
            ))}
            {rest > 0 && <span className="nl-chip shrink-0">+{rest}</span>}
          </div>
        )
      ) : (
        <p className="text-[13.5px] leading-snug mb-4" style={{ color: C.muted }}>
          {data.days.length > 0
            ? `Tu rutina tiene ${data.days.length} días y hoy toca recuperar. Si entrenas igualmente, elige el día en Entreno.`
            : 'Tu rutina todavía no tiene días cargados.'}
        </p>
      )}
      {hasCheckedInToday ? (
        <button type="button" onClick={onOpen} className="nl-btn nl-btn-ghost w-full">
          <Check className="w-[18px] h-[18px]" strokeWidth={2.4} style={{ color: C.accent }} /> Sesión de hoy completada
        </button>
      ) : day ? (
        <button type="button" onClick={onStart || onOpen} className="nl-btn w-full">
          <Play className="w-4 h-4" fill="currentColor" /> Empezar entreno
        </button>
      ) : (
        <button type="button" onClick={onOpen} className="nl-btn nl-btn-ghost w-full">
          <Coffee className="w-4 h-4" /> Ver mi rutina
        </button>
      )}
    </div>
  )
}

// ───────────────── Bienestar (ciclo / etapa) ─────────────────
const PHASE_ICON = { menstrual: Moon, follicular: Sun, ovulation: Zap, luteal: TrendingUp }
const STAGE_LABEL = { pregnant: 'Embarazo', postpartum: 'Posparto', lactating: 'Lactancia' }

function WellnessCard({ profile, onOpen }) {
  const stage = profile?.life_stage || 'cycle'

  const shell = (icon, title, subtitle, extra) => (
    <button type="button" onClick={onOpen} className="nl-card w-full text-left p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0" style={{ background: C.cyclesoft, color: C.cycle }}>{icon}</span>
          <div className="min-w-0">
            <div className="font-semibold text-[14.5px] truncate" style={{ color: C.text }}>{title}</div>
            <div className="text-[12px] truncate" style={{ color: C.muted }}>{subtitle}</div>
          </div>
        </div>
        <ChevronRight className="w-[18px] h-[18px] shrink-0" style={{ color: C.muted }} />
      </div>
      {extra}
    </button>
  )

  if (stage !== 'cycle') {
    return shell(<Heart className="w-[15px] h-[15px]" />, STAGE_LABEL[stage] || 'Tu bienestar', 'Seguimiento, síntomas y recomendaciones')
  }

  const cycle = profile?.cycle_enabled
    ? getCyclePhase(profile.cycle_start_date, profile.cycle_length_days || 28, profile.period_length_days || 5)
    : null
  if (!cycle || cycle.phase === 'unknown') {
    return shell(<Sparkles className="w-[15px] h-[15px]" />, 'Configura tu ciclo', 'Adapta entreno y nutrición a cada fase')
  }

  const Icon = PHASE_ICON[cycle.phase] || Heart
  const length = Math.min(Math.max(profile.cycle_length_days || 28, 20), 40)
  const period = profile.period_length_days || 5
  const tip = getWorkoutRecommendation(cycle.phase)?.tip
  const bar = (
    <>
      <div className="flex gap-[3px] mt-3 mb-2.5" aria-hidden="true">
        {Array.from({ length }, (_, i) => {
          const d = i + 1
          let bg = C.surface2
          if (d <= period) bg = C.cycle
          else if (d >= 14 && d <= 16) bg = 'rgba(231,163,181,0.5)'
          if (d === cycle.cycleDay) bg = C.text
          return <span key={d} className="flex-1 h-1.5 rounded-full" style={{ background: bg }} />
        })}
      </div>
      {tip && <p className="text-[13px] leading-snug" style={{ color: C.muted }}>{tip}</p>}
    </>
  )
  return shell(
    <Icon className="w-[15px] h-[15px]" />,
    `${getPhaseName(cycle.phase)} · día ${cycle.cycleDay}`,
    getEnergyLevel(cycle.phase)?.label || '',
    bar,
  )
}

// ───────────────── Pantalla ─────────────────
export default function TodayView({
  user, profile, hasPremium, myWorkouts, myDiet, dataLoaded, loggedMealSlots = [],
  hasCheckedInToday, isActive, onNavigate, onLocked, onStartWorkout,
}) {
  const [steps, setSteps] = useState(null)
  const streak = useStreak(user.id, loggedMealSlots.length + (hasCheckedInToday ? 1000 : 0))

  // Pasos de hoy (los mismos que muestra Actividad). Se recargan al volver a
  // esta pantalla, por si se han sincronizado o añadido desde Actividad.
  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    supabase.rpc('rpc_get_today_activity').then(({ data, error }) => {
      if (cancelled) return
      if (error) { setSteps({ steps: null, goal: Number(profile?.steps_goal) || 8000 }); return }
      setSteps({ steps: data?.steps ?? 0, goal: Number(data?.steps_goal) || Number(profile?.steps_goal) || 8000 })
    })
    return () => { cancelled = true }
  }, [isActive, profile?.steps_goal])

  const workoutRow = myWorkouts?.principal || myWorkouts?.alternativa || null
  const slots = getDietMealSlots(myDiet?.diet?.content)
  const mealsDone = slots.filter(s => loggedMealSlots.includes(s)).length
  const atRisk = streak && streak.current > 0 && !streak.todayDone

  return (
    <div className="space-y-3 nl-stagger">
      {hasPremium && (
        workoutRow ? (
          <TodayWorkoutCard
            memberId={user.id}
            workoutRow={workoutRow}
            hasCheckedInToday={hasCheckedInToday}
            onOpen={() => onNavigate('workout')}
            onStart={onStartWorkout}
          />
        ) : dataLoaded ? (
          <div className="nl-card p-[18px]">
            <span className="nl-label">Entreno de hoy</span>
            <p className="mt-2 text-[14px]" style={{ color: C.text }}>Tu entrenador aún no te ha asignado una rutina.</p>
          </div>
        ) : (
          <div className="nl-card h-[218px] animate-pulse" />
        )
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={Footprints}
          value={steps ? shortNumber(steps.steps) : '—'}
          of={steps ? `/ ${shortNumber(steps.goal)}` : ''}
          label="Pasos"
          pct={steps?.steps != null ? steps.steps / steps.goal : 0}
          onClick={() => onNavigate('activity')}
        />
        <Stat
          icon={UtensilsCrossed}
          value={slots.length ? mealsDone : '—'}
          of={slots.length ? `/ ${slots.length}` : ''}
          label={slots.length ? 'Comidas hoy' : 'Sin dieta'}
          pct={slots.length ? mealsDone / slots.length : 0}
          onClick={() => (hasPremium ? onNavigate('diet') : onLocked?.())}
        />
        <Stat
          icon={Flame}
          value={streak ? streak.current : '—'}
          of={streak ? (streak.current === 1 ? 'día' : 'días') : ''}
          label="Racha"
          pct={streak ? Math.min(streak.current / Math.max(streak.best, 7), 1) : 0}
        />
      </div>

      {streak && (atRisk || streak.current === 0) && (
        <div className="flex items-start gap-2 px-1 text-[12.5px] leading-snug" style={{ color: atRisk ? '#F0C27B' : C.muted }}>
          <Flame className="w-4 h-4 shrink-0 mt-px" />
          <span>{streakMessage(streak)}</span>
        </div>
      )}

      {profile?.sex === 'female' && <WellnessCard profile={profile} onOpen={() => onNavigate('bienestar')} />}

      <TrainerMessageCard memberId={user.id} />

      <FirstWeekGuide
        memberId={user.id}
        createdAt={profile?.created_at}
        hasPremium={hasPremium}
        onNavigate={onNavigate}
      />

      <WeekOverview
        memberId={user.id}
        workoutId={workoutRow?.workout?.id || null}
        stepsGoal={Number(profile?.steps_goal) || 8000}
        memberName={profile?.name}
      />

      {!hasPremium && (
        <div className="nl-card p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 shrink-0" style={{ color: C.muted }} />
          <p className="text-[13px] leading-snug" style={{ color: C.muted }}>
            Rutina, dieta y revisiones se activan con el código de invitación de tu gimnasio.
          </p>
        </div>
      )}
    </div>
  )
}
