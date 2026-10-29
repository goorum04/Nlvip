'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, ChevronRight, Rocket, X } from 'lucide-react'

const NEW_MEMBER_DAYS = 30
const DISMISS_KEY = 'nlvip_first_week_dismissed'

const STEPS = [
  { key: 'push', title: 'Activa las notificaciones', hint: 'Para que te avisemos de comidas, entrenos y mensajes de tu entrenador.', tab: null, howTo: 'Acepta el aviso de notificaciones al abrir la app o actívalas en Ajustes del móvil → NL VIP Team.' },
  { key: 'weight', title: 'Apunta tu peso de inicio', hint: 'Tu punto de partida para medir el progreso.', tab: 'progress' },
  { key: 'photo', title: 'Haz tu primera foto de progreso', hint: 'Solo la ves tú y tu entrenador.', tab: 'progress' },
  { key: 'steps', title: 'Conecta tus pasos', hint: 'Desde Salud (iPhone) para contar tu actividad diaria.', tab: 'activity' },
  { key: 'meal', title: 'Marca tu primera comida', hint: 'En la pestaña Dieta, pulsa la comida cuando la termines.', tab: 'diet' },
  { key: 'workout', title: 'Registra tu primer entreno', hint: 'Apunta pesos y repeticiones desde tu rutina.', tab: 'workout' },
]

// Lista guiada para socios nuevos: los 6 pasos que hacen que la app sirva de
// algo. Se esconde sola cuando están todos hechos, o si el socio la cierra.
export function FirstWeekGuide({ memberId, createdAt, hasPremium, onNavigate }) {
  const [done, setDone] = useState(null)
  const [dismissed, setDismissed] = useState(true)
  const [openHow, setOpenHow] = useState(null)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1') } catch { setDismissed(false) }
  }, [])

  useEffect(() => {
    if (!memberId || !hasPremium) return
    let cancelled = false
    const load = async () => {
      const q = (table, col = 'id') => supabase.from(table).select(col).eq(table === 'device_tokens' || table === 'push_subscriptions' ? 'user_id' : 'member_id', memberId).limit(1)
      const [tokens, subs, records, photos, activity, meals, sets, checkins] = await Promise.all([
        q('device_tokens'), q('push_subscriptions'), q('progress_records'), q('progress_photos'),
        q('daily_activity'), q('meal_logs'), q('workout_set_logs'), q('workout_checkins'),
      ])
      if (cancelled) return
      const has = r => (r.data?.length || 0) > 0
      setDone({
        push: has(tokens) || has(subs),
        weight: has(records),
        photo: has(photos),
        steps: has(activity),
        meal: has(meals),
        workout: has(sets) || has(checkins),
      })
    }
    load()
    return () => { cancelled = true }
  }, [memberId, hasPremium])

  if (!hasPremium || dismissed || !done) return null

  const doneCount = STEPS.filter(s => done[s.key]).length
  const isNew = createdAt ? (Date.now() - new Date(createdAt).getTime()) < NEW_MEMBER_DAYS * 86400000 : false
  // Para socios veteranos solo tiene sentido si apenas han tocado la app.
  if (doneCount === STEPS.length || (!isNew && doneCount >= 3)) return null

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  return (
    <Card className="bg-gradient-to-br from-cyan-500/10 to-violet-500/5 border-cyan-500/25 rounded-3xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white font-bold text-sm flex items-center gap-2"><Rocket className="w-4 h-4 text-cyan-400" /> Tu primera semana</p>
            <p className="text-gray-400 text-xs mt-0.5">{doneCount} de {STEPS.length} pasos. Con esto la app trabaja para ti.</p>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 p-1" title="Ocultar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
        </div>

        <div className="space-y-1.5">
          {STEPS.map(step => {
            const ok = done[step.key]
            return (
              <div key={step.key}>
                <button
                  onClick={() => {
                    if (ok) return
                    if (step.tab) onNavigate?.(step.tab)
                    else setOpenHow(openHow === step.key ? null : step.key)
                  }}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-left border transition-colors ${ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#2a2a2a] bg-black/30 hover:border-cyan-500/40'}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-500 text-black' : 'border border-gray-600 text-gray-500 text-[11px] font-bold'}`}>
                    {ok ? <Check className="w-3.5 h-3.5" /> : STEPS.indexOf(step) + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${ok ? 'text-emerald-300 line-through decoration-emerald-500/40' : 'text-white'}`}>{step.title}</span>
                    {!ok && <span className="block text-[11px] text-gray-500 leading-tight">{step.hint}</span>}
                  </span>
                  {!ok && <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />}
                </button>
                {openHow === step.key && step.howTo && (
                  <p className="text-[11px] text-cyan-200/80 px-3 py-2">{step.howTo}</p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default FirstWeekGuide
