'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, LoaderCircle as Loader2, Share2, RefreshCw, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'

// Lista de la compra semanal de la dieta. Se genera con IA la primera vez
// (y queda guardada en la dieta); el socio va marcando lo que ya tiene y
// puede enviarla por WhatsApp. Los ticks se guardan en el móvil.
export function ShoppingList({ dietTemplateId, dietName, canRegenerate = false, defaultOpen = false, prefetch = false }) {
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(defaultOpen)
  const [checked, setChecked] = useState({})
  const { toast } = useToast()
  const checkKey = `nlvip_shopping_checked:${dietTemplateId}`

  useEffect(() => {
    setList(null)
    try { setChecked(JSON.parse(localStorage.getItem(checkKey) || '{}')) } catch { setChecked({}) }
    // En la app del socio se pide nada más abrir la pestaña Dieta: la primera
    // generación tarda ~30 s y así, cuando la toca, ya suele estar lista.
    if (prefetch && dietTemplateId) load(false, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietTemplateId])

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
      if (force) {
        setChecked({})
        try { localStorage.removeItem(checkKey) } catch {}
      }
    } catch (e) {
      if (!silent) toast({ title: 'Lista de la compra', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const openList = () => {
    setOpen(true)
    if (!list) load(false)
  }

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] }
    setChecked(next)
    try { localStorage.setItem(checkKey, JSON.stringify(next)) } catch {}
  }

  const asText = () => {
    if (!list) return ''
    const lines = [`🛒 Lista de la compra · ${dietName || 'mi dieta'}`, list.summary, '']
    for (const cat of list.categories) {
      lines.push(`*${cat.name}*`)
      for (const it of cat.items) lines.push(`${checked[`${cat.name}|${it.name}`] ? '✅' : '▫️'} ${it.name} — ${it.quantity}${it.note ? ` (${it.note})` : ''}`)
      lines.push('')
    }
    if (list.tips?.length) lines.push('💡 ' + list.tips.join('\n💡 '))
    return lines.join('\n')
  }

  const share = async () => {
    const text = asText()
    try {
      if (navigator.share) { await navigator.share({ title: 'Lista de la compra', text }); return }
      await navigator.clipboard.writeText(text)
      toast({ title: 'Lista copiada', description: 'Pégala en WhatsApp o en tus notas.' })
    } catch (e) {
      if (e?.name !== 'AbortError') toast({ title: 'No se pudo compartir', description: e.message, variant: 'destructive' })
    }
  }

  const total = list ? list.categories.reduce((n, c) => n + c.items.length, 0) : 0
  const done = list ? list.categories.reduce((n, c) => n + c.items.filter(it => checked[`${c.name}|${it.name}`]).length, 0) : 0

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
              <p className="text-gray-500 text-xs truncate">{list ? `${done}/${total} cogidos · para una semana` : loading ? 'Preparando tu lista…' : 'Todo lo que necesitas para una semana de esta dieta'}</p>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
        </button>

        {open && (
          loading ? (
            <div className="py-8 flex flex-col items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> Preparando tu lista…</div>
          ) : list ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">{list.summary}</p>
              {list.categories.map(cat => (
                <div key={cat.name}>
                  <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5">{cat.name}</p>
                  <div className="space-y-1">
                    {cat.items.map(it => {
                      const id = `${cat.name}|${it.name}`
                      const on = !!checked[id]
                      return (
                        <button key={id} type="button" onClick={() => toggle(id)} className={`w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left border transition-colors ${on ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#2a2a2a] bg-black/30'}`}>
                          <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-gray-600'}`}>
                            {on && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${on ? 'text-gray-500 line-through' : 'text-white'}`}>{it.name} <span className="text-gray-400">· {it.quantity}</span></span>
                            {it.note && <span className="block text-[11px] text-gray-500">{it.note}</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {list.tips?.length > 0 && (
                <ul className="space-y-1 pt-1 border-t border-white/5">
                  {list.tips.map((t, i) => <li key={i} className="text-[11px] text-gray-400">💡 {t}</li>)}
                </ul>
              )}
              <div className="flex gap-2">
                <Button onClick={share} className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 text-black font-bold"><Share2 className="w-4 h-4 mr-2" /> Enviar por WhatsApp</Button>
                {canRegenerate && (
                  <Button variant="outline" onClick={() => load(true)} className="rounded-xl border-[#2a2a2a] text-gray-200" title="Volver a generar la lista">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
              </div>
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
