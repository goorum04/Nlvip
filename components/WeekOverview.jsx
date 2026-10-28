'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, Check, Dumbbell, Footprints, UtensilsCrossed } from 'lucide-react'

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const isoDate = (d) => {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 10)
}

// Semana en curso (lunes a domingo) del socio: qué día de rutina toca, si lo
// ha registrado, cuántas comidas ha marcado y los pasos frente a su objetivo.
// Todo sale de tablas que ya existen; no guarda nada.
export function WeekOverview({ memberId, workoutId, stepsGoal = 8000 }) {
  const [days, setDays] = useState(null)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false

    const load = async () => {
      const today = new Date()
      const weekday = ((today.getDay() + 6) % 7) // 0=lunes
      const monday = new Date(today)
      monday.setDate(today.getDate() - weekday)
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return isoDate(d)
      })
      const from = dates[0]
      const to = dates[6]

      const [{ data: routineDays }, { data: setLogs }, { data: checkins }, { data: meals }, { data: activity }] = await Promise.all([
        workoutId
          ? supabase.from('workout_days').select('id, day_number, name').eq('workout_template_id', workoutId).order('day_number')
          : Promise.resolve({ data: [] }),
        supabase.from('workout_set_logs').select('performed_on, workout_day_id').eq('member_id', memberId).gte('performed_on', from).lte('performed_on', to),
        supabase.from('workout_checkins').select('checked_in_at').eq('member_id', memberId).gte('checked_in_at', `${from}T00:00:00`).lte('checked_in_at', `${to}T23:59:59`),
        supabase.from('meal_logs').select('date, meal_slot').eq('member_id', memberId).gte('date', from).lte('date', to),
        supabase.from('daily_activity').select('activity_date, steps').eq('member_id', memberId).gte('activity_date', from).lte('activity_date', to),
      ])
      if (cancelled) return

      const routine = routineDays || []
      const todayIso = isoDate(today)
      let overrideDayId = null
      try { overrideDayId = localStorage.getItem(`nlvip_day_override:${workoutId}:${todayIso}`) } catch {}

      setDays(dates.map((date, i) => {
        const plannedDay = routine.find(d => d.day_number === i + 1) || null
        const logsThatDay = (setLogs || []).filter(l => l.performed_on === date)
        const loggedDayIds = [...new Set(logsThatDay.map(l => l.workout_day_id).filter(Boolean))]
        const loggedDay = loggedDayIds.length > 0 ? routine.find(d => d.id === loggedDayIds[0]) : null
        const overrideDay = date === todayIso && overrideDayId ? routine.find(d => d.id === overrideDayId) : null
        const shownDay = loggedDay || overrideDay || plannedDay
        const trained = logsThatDay.length > 0 || (checkins || []).some(c => isoDate(c.checked_in_at) === date)
        const mealsLogged = new Set((meals || []).filter(m => m.date === date).map(m => m.meal_slot)).size
        const steps = (activity || []).find(a => a.activity_date === date)?.steps ?? null
        return { date, label: DAY_LABELS[i], isToday: date === todayIso, isPast: date < todayIso, day: shownDay, trained, mealsLogged, steps }
      }))
    }

    load()
    return () => { cancelled = true }
  }, [memberId, workoutId])

  if (!days) return null

  const trainedCount = days.filter(d => d.trained).length
  const plannedCount = days.filter(d => d.day).length
  const stepsDaysOk = days.filter(d => d.steps != null && d.steps >= stepsGoal).length

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white font-bold text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-violet-400" /> Tu semana
          </p>
          <p className="text-[11px] text-gray-500">
            {trainedCount}/{plannedCount || 0} entrenos · {stepsDaysOk} días de pasos
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map(d => (
            <div
              key={d.date}
              className={`rounded-2xl border p-1.5 text-center space-y-1 ${
                d.isToday ? 'border-violet-500/60 bg-violet-500/10' : 'border-[#2a2a2a] bg-black/30'
              } ${d.isPast && !d.isToday ? 'opacity-80' : ''}`}
            >
              <p className={`text-[11px] font-bold ${d.isToday ? 'text-violet-300' : 'text-gray-400'}`}>{d.label}</p>

              <div className={`mx-auto w-7 h-7 rounded-xl flex items-center justify-center ${
                d.trained ? 'bg-emerald-500/20 text-emerald-400' : d.day ? 'bg-white/5 text-gray-500' : 'text-gray-700'
              }`} title={d.day ? `Día ${d.day.day_number}${d.day.name ? ` · ${d.day.name}` : ''}` : 'Descanso'}>
                {d.trained ? <Check className="w-4 h-4" /> : d.day ? <Dumbbell className="w-3.5 h-3.5" /> : <span className="text-[10px]">—</span>}
              </div>
              <p className="text-[9px] text-gray-500 leading-tight truncate">{d.day ? `D${d.day.day_number}` : 'Desc.'}</p>

              <div className="flex items-center justify-center gap-0.5 text-[9px] text-gray-400">
                <UtensilsCrossed className="w-2.5 h-2.5" />
                {d.mealsLogged}
              </div>
              <div className={`flex items-center justify-center gap-0.5 text-[9px] ${
                d.steps == null ? 'text-gray-600' : d.steps >= stepsGoal ? 'text-emerald-400' : 'text-amber-400/80'
              }`}>
                <Footprints className="w-2.5 h-2.5" />
                {d.steps == null ? '–' : d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600">Entreno registrado · comidas marcadas · pasos (objetivo {stepsGoal.toLocaleString('es-ES')}).</p>
      </CardContent>
    </Card>
  )
}

export default WeekOverview
