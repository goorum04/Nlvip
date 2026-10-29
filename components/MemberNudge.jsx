'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Flame, HandMetal, LoaderCircle as Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'

const NUDGE_COOLDOWN_DAYS = 3

/**
 * Última actividad + racha + último "toque" de cada socio, para los paneles
 * de admin y entrenador. Una sola llamada para toda la lista.
 */
export function useMemberActivity(members) {
  const [activity, setActivity] = useState({})
  const ids = (members || []).map(m => m?.id).filter(Boolean)
  const key = ids.join(',')

  const refresh = useCallback(async () => {
    if (!ids.length) return
    try {
      const res = await authFetch('/api/admin-member-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: ids }),
      })
      const json = await res.json()
      if (res.ok && json.activity) setActivity(prev => ({ ...prev, ...json.activity }))
    } catch (e) {
      console.warn('useMemberActivity:', e.message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { refresh() }, [refresh])

  return { activity, refresh }
}

function describe(info) {
  if (!info) return { text: 'Cargando actividad…', tone: 'text-gray-600' }
  if (info.daysInactive == null) return { text: 'Sin actividad todavía', tone: 'text-red-400' }
  const d = info.daysInactive
  const when = d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
  const text = `Última actividad: ${when}${info.label ? ` · ${info.label}` : ''}`
  const tone = d >= 7 ? 'text-red-400' : d >= 3 ? 'text-amber-400' : 'text-gray-500'
  return { text, tone }
}

/** Línea compacta para la fila de un socio en la lista del panel. */
export function MemberActivityLine({ memberId, info, onNudged, compact = false }) {
  const [sending, setSending] = useState(false)
  const { toast } = useToast()
  const { text, tone } = describe(info)

  const inactive = info && (info.daysInactive == null || info.daysInactive >= 3)
  const nudgeAgeDays = info?.lastNudgeAt ? (Date.now() - new Date(info.lastNudgeAt).getTime()) / 86400000 : null
  const onCooldown = nudgeAgeDays != null && nudgeAgeDays < NUDGE_COOLDOWN_DAYS

  const nudge = async (e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    setSending(true)
    try {
      const res = await authFetch('/api/admin-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar')
      toast({ title: '👊 Toque enviado', description: json.message })
      onNudged?.(memberId)
    } catch (err) {
      toast({ title: 'No se pudo dar el toque', description: err.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      <span className={`${tone} truncate`}>{text}</span>
      {info?.streak >= 2 && (
        <span className="inline-flex items-center gap-0.5 text-orange-400 font-bold">
          <Flame className="w-3 h-3" /> {info.streak}
        </span>
      )}
      {inactive && (
        onCooldown ? (
          <span className="text-gray-600">Toque enviado {nudgeAgeDays < 1 ? 'hoy' : `hace ${Math.floor(nudgeAgeDays)} d`}</span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={sending}
            onClick={nudge}
            className="h-6 px-2 rounded-lg border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 text-[10px]"
            title="Enviar un mensaje personal (push) para que retome"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><HandMetal className="w-3 h-3 mr-1" /> Dar un toque</>}
          </Button>
        )
      )}
    </div>
  )
}
