'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Scale, ChevronDown, ChevronUp } from 'lucide-react'
import { WeekOverview } from './WeekOverview'

// "Semana del socio" en el panel: la misma rejilla de 7 días que ve el socio
// (entrenos, comidas marcadas, pasos) más el último peso y su variación.
// Para que el entrenador escriba un toque personal sin mirar cuatro pantallas.
export function MemberWeekPanel({ memberId, workoutId, stepsGoal = 8000, memberName = '' }) {
  const [open, setOpen] = useState(true)
  const [weights, setWeights] = useState([])

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    supabase.from('progress_records').select('date, weight_kg').eq('member_id', memberId).not('weight_kg', 'is', null).order('date', { ascending: false }).limit(5)
      .then(({ data }) => { if (!cancelled) setWeights(data || []) })
    return () => { cancelled = true }
  }, [memberId])

  const last = weights[0]
  const prev = weights.find(w => w.date !== last?.date && w.weight_kg != null)
  const delta = last && prev ? Number(last.weight_kg) - Number(prev.weight_kg) : null
  const daysAgo = last ? Math.round((Date.now() - new Date(last.date).getTime()) / 86400000) : null

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
        <span>Esta semana</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <>
          <WeekOverview memberId={memberId} workoutId={workoutId} stepsGoal={stepsGoal} memberName={memberName} showShare={false} title="Semana" />
          <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            {last ? (
              <span>
                Último peso: <span className="text-white font-semibold">{Number(last.weight_kg).toFixed(1)} kg</span>
                {daysAgo != null && <span className="text-gray-500"> (hace {daysAgo === 0 ? 'hoy' : `${daysAgo} d`})</span>}
                {delta != null && (
                  <span className={`ml-2 font-semibold ${delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg vs. anterior
                  </span>
                )}
              </span>
            ) : <span>Sin pesos registrados</span>}
          </div>
        </>
      )}
    </div>
  )
}

export default MemberWeekPanel
