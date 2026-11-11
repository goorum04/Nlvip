'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, LoaderCircle as Loader2, RefreshCw, Check, ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'

// Lista de la compra semanal de la dieta, pensada como CHECKLIST para usar
// en el súper desde la app: el socio va marcando lo que mete en el carro.
// - La lista se genera con IA la primera vez y queda guardada en la dieta.
// - Los ticks se guardan en servidor (shopping_list_checks) por socio y
//   dieta, así se mantienen entre dispositivos; copia local de respaldo.
// - A propósito NO se puede exportar como texto: la lista vive en la app.
export function ShoppingList({ dietTemplateId, dietName, memberId = null, canRegenerate = false, defaultOpen = false, prefetch = false }) {
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(defaultOpen)
  const [checked, setChecked] = useState({})
  const [hideDone, setHideDone] = useState(false)
  const { toast } = useToast()
  const checkKey = `nlvip_shopping_checked:${dietTemplateId}`
  const saveTimer = useRef(null)
  const openedTracked = useRef(false)

  useEffect(() => {
    setList(null)
    setChecked({})
    openedTracked.current = false
    try { setChecked(JSON.parse(localStorage.getItem(checkKey) || '{}')) } catch {}
    if (memberId && dietTemplateId) {
      supabase.from('shopping_list_checks').select('checked').eq('member_id', memberId).eq('diet_template_id', dietTemplateId).maybeSingle()
        .then(({ data }) => { if (data?.checked) setChecked(data.checked) })
    }
    // En la app del socio se pide nada más abrir la pestaña Dieta: la primera
    // generación tarda ~30 s y así, cuando la toca, ya suele estar lista.
    if (prefetch && dietTemplateId) load(false, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietTemplateId, memberId])

  const load = async (force = false, silent = false) => {
    if (!dietTemplateId) return
    setLoading(true)
    try {
      const res = await authFetch('/api/diet-shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dietTemplateId, force }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar la lista')
      setList(json.shoppingList)
      if (force) persistChecks({})
    } catch (e) {
      if (!silent) toast({ title: 'Lista de la compra', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const persistChecks = (next) => {
    setChecked(next)
    try { localStorage.setItem(checkKey, JSON.stringify(next)) } catch {}
    if (!memberId) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('shopping_list_checks').upsert(
        { member_id: memberId, diet_template_id: dietTemplateId, checked: next, updated_at: new Date().toISOString() },
        { onConflict: 'member_id,diet_template_id' }
      )
      if (error) console.warn('No se pudieron guardar los ticks:', error.message)
    }, 400)
  }

  const trackOpen = async () => {
    if (!memberId || openedTracked.current) return
    openedTracked.current = true
    try {
      const { data } = await supabase.from('shopping_list_checks').select('opened_count').eq('member_id', memberId).eq('diet_template_id', dietTemplateId).maybeSingle()
      await supabase.from('shopping_list_checks').upsert(
        { member_id: memberId, diet_template_id: dietTemplateId, opened_count: (data?.opened_count || 0) + 1, last_opened_at: new Date().toISOString() },
        { onConflict: 'member_id,diet_template_id' }
      )
    } catch { /* métrica, no bloquea */ }
  }

  const openList = () => {
    setOpen(true)
    trackOpen()
    if (!list && !loading) load(false)
  }

  const toggle = (id) => persistChecks({ ...checked, [id]: !checked[id] })

  const resetAll = () => {
    if (!window.confirm('¿Empezar una compra nueva? Se desmarcan todos los productos.')) return
    persistChecks({})
    setHideDone(false)
  }

  const total = list ? list.categories.reduce((n, c) => n + c.items.length, 0) : 0
  const done = list ? list.categories.reduce((n, c) => n + c.items.filter(it => checked[`${c.name}|${it.name}`]).length, 0) : 0
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <Card className="bg-gradient-to-br from-emerald-500/10 to-lime-500/5 border-emerald-500/20 rounded-3xl">
      <CardContent className="p-4 space-y-3">
        <button type="button" onClick={open ? () => setOpen(false) : openList} className="w-full flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm">Lista de la compra</p>
              <p className="text-gray-500 text-xs truncate">
                {list
                  ? (done === total && total > 0 ? '¡Compra completa! 🎉' : `${done} de ${total} en el carro · para una semana`)
                  : loading ? 'Preparando tu lista…' : 'Tu checklist para el súper, para una semana de esta dieta'}
              </p>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
        </button>

        {list && (
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        {open && (
          loading && !list ? (
            <div className="py-8 flex flex-col items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> Preparando tu lista…</div>
          ) : list ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-gray-400 flex-1 min-w-[200px]">{list.summary}</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setHideDone(h => !h)} className="h-7 px-2 rounded-lg text-gray-300 hover:text-white text-[11px]">
                    {hideDone ? <><Eye className="w-3.5 h-3.5 mr-1" /> Ver todo</> : <><EyeOff className="w-3.5 h-3.5 mr-1" /> Ocultar cogidos</>}
                  </Button>
                  {done > 0 && (
                    <Button size="sm" variant="ghost" onClick={resetAll} className="h-7 px-2 rounded-lg text-gray-300 hover:text-white text-[11px]" title="Empezar una compra nueva">
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Nueva compra
                    </Button>
                  )}
                </div>
              </div>

              {list.categories.map(cat => {
                const items = hideDone ? cat.items.filter(it => !checked[`${cat.name}|${it.name}`]) : cat.items
                if (items.length === 0) return null
                return (
                  <div key={cat.name}>
                    <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5">{cat.name}</p>
                    <div className="space-y-1.5">
                      {items.map(it => {
                        const id = `${cat.name}|${it.name}`
                        const on = !!checked[id]
                        return (
                          <button key={id} type="button" onClick={() => toggle(id)} className={`w-full flex items-start gap-3 rounded-2xl px-3 py-3 text-left border transition-colors active:scale-[0.99] ${on ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#2a2a2a] bg-black/30'}`}>
                            <span className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-gray-500'}`}>
                              {on && <Check className="w-4 h-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-[15px] leading-snug ${on ? 'text-gray-500 line-through' : 'text-white'}`}>
                                {it.name} <span className={on ? 'text-gray-600' : 'text-emerald-200/80'}>· {it.quantity}</span>
                              </span>
                              {it.note && <span className="block text-[11px] text-gray-500 mt-0.5">{it.note}</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {hideDone && done === total && total > 0 && (
                <p className="text-sm text-emerald-300 text-center py-2">Todo en el carro. ¡A casa! 🎉</p>
              )}

              {list.tips?.length > 0 && (
                <ul className="space-y-1 pt-1 border-t border-white/5">
                  {list.tips.map((t, i) => <li key={i} className="text-[11px] text-gray-400">💡 {t}</li>)}
                </ul>
              )}

              {canRegenerate && (
                <Button variant="outline" onClick={() => load(true)} disabled={loading} className="w-full rounded-xl border-[#2a2a2a] text-gray-200">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> Volver a generar la lista</>}
                </Button>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <Button onClick={() => load(false)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 text-black font-bold">Crear mi lista</Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}

export default ShoppingList
