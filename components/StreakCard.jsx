'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Flame, Trophy } from 'lucide-react'
import { computeStreak, isoDateMadrid, addDaysIso } from '@/lib/memberActivity'

// Racha de días seguidos registrando algo (comida marcada o entreno).
// Se calcula en el móvil a partir de las tablas que ya existen; el aviso
// push de "racha en juego" lo manda el cron streak-guard a las 20:00.
export function StreakCard({ memberId, refreshKey }) {
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    const load = async () => {
      const today = isoDateMadrid()
      const from = addDaysIso(today, -120)
      const [{ data: meals }, { data: sets }, { data: checkins }] = await Promise.all([
        supabase.from('meal_logs').select('date').eq('member_id', memberId).gte('date', from),
        supabase.from('workout_set_logs').select('performed_on').eq('member_id', memberId).gte('performed_on', from),
        supabase.from('workout_checkins').select('checked_in_at').eq('member_id', memberId).gte('checked_in_at', `${from}T00:00:00`),
      ])
      if (cancelled) return
      const dates = new Set()
      for (const m of meals || []) dates.add(m.date)
      for (const s of sets || []) dates.add(s.performed_on)
      for (const c of checkins || []) dates.add(isoDateMadrid(new Date(c.checked_in_at)))
      setStreak(computeStreak(dates, today))
    }
    load()
    return () => { cancelled = true }
  }, [memberId, refreshKey])

  if (!streak) return null
  const { current, best, todayDone } = streak
  const atRisk = current > 0 && !todayDone

  let message
  if (current === 0) message = 'Marca una comida o un entreno hoy y empieza tu racha.'
  else if (atRisk) message = 'Hoy aún no has registrado nada. Marca algo y la racha sigue.'
  else if (current >= best && current >= 7) message = 'Tu mejor racha hasta ahora. Sigue así.'
  else message = 'Hoy ya cuenta. Mañana, otro día más.'

  return (
    <Card className={`rounded-3xl border ${atRisk ? 'bg-amber-500/5 border-amber-500/30' : current > 0 ? 'bg-gradient-to-br from-orange-500/10 to-rose-500/5 border-orange-500/25' : 'bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a]'}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${current > 0 ? 'bg-orange-500/15' : 'bg-white/5'}`}>
          <Flame className={`w-8 h-8 ${current > 0 ? (atRisk ? 'text-amber-400' : 'text-orange-400') : 'text-gray-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-black text-2xl leading-none">
            {current} <span className="text-sm font-bold text-gray-400">{current === 1 ? 'día de racha' : 'días de racha'}</span>
          </p>
          <p className={`text-xs mt-1 ${atRisk ? 'text-amber-300' : 'text-gray-400'}`}>{message}</p>
        </div>
        {best > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1 justify-end"><Trophy className="w-3 h-3" /> Mejor</p>
            <p className="text-white font-bold">{best}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default StreakCard
