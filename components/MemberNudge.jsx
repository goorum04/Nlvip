'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Flame, HandMetal, LoaderCircle as Loader2, MessageSquarePlus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'

/**
 * "Avisar al socio": mensaje escrito a mano por el entrenador que llega como
 * push y como tarjeta "Mensaje de Nacho" en la app (no por WhatsApp).
 */
export function MemberMessageButton({ memberId, memberName, compact = false }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  const send = async () => {
    setSending(true)
    try {
      const res = await authFetch('/api/admin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, body: text.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar')
      toast({ title: '💬 Mensaje enviado', description: json.pushSent > 0 ? 'Le ha llegado al móvil y lo verá al abrir la app.' : 'Lo verá al abrir la app (no tiene notificaciones activas).' })
      setText('')
      setOpen(false)
    } catch (e) {
      toast({ title: 'No se pudo enviar', description: e.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true) }}
        className={`${compact ? 'h-6 px-2 text-[10px]' : 'h-6 px-2 text-[10px]'} rounded-lg border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200`}
        title="Mensaje que le llega al móvil y ve en la app"
      >
        <MessageSquarePlus className="w-3 h-3 mr-1" /> Avisar
      </Button>
      {open && (
        <Dialog open onOpenChange={() => !sending && setOpen(false)}>
          <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] rounded-3xl max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="text-white">Avisar a {memberName || 'este socio'}</DialogTitle>
              <DialogDescription className="text-gray-400">
                Le llega como notificación y le aparece en la pantalla principal de la app hasta que lo lea. Úsalo en vez del WhatsApp para que entre en la app.
              </DialogDescription>
            </DialogHeader>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={500} placeholder="Ej.: Te he subido 250 kcal en hidratos y grasas. Ya tienes la dieta nueva en la app, échale un ojo." className="bg-black/40 border-[#2a2a2a] text-white rounded-xl" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending} className="rounded-xl text-gray-300">Cancelar</Button>
              <Button onClick={send} disabled={sending || text.trim().length < 2} className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

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
export function MemberActivityLine({ memberId, memberName, info, onNudged, compact = false }) {
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
      <MemberMessageButton memberId={memberId} memberName={memberName} compact={compact} />
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
