'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Megaphone, LoaderCircle as Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'

const STORE_URL = 'https://apps.apple.com/es/app/nl-vip-team/id6759003518'

const DEFAULT_TITLE = '📲 Nueva versión disponible'
const DEFAULT_BODY = 'Ya está en la App Store la nueva versión de NL VIP Team. Actualiza para tener las últimas novedades: resumen de tu semana, tarjetas para compartir tus PRs y elegir qué día de rutina haces hoy.'

// Botón del panel de admin: avisa a TODOS los socios (push + pestaña Avisos)
// de que hay versión nueva. Pensado para el día que Apple publica la app.
export function BroadcastUpdateButton({ memberCount }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  const send = async () => {
    setSending(true)
    try {
      const res = await authFetch('/api/admin-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, url: STORE_URL, kind: 'new_version' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar')
      toast({ title: '📣 Aviso enviado', description: `A ${json.members} socios. Push entregados: ${json.pushSent} (solo a quien tiene notificaciones activas). Todos lo verán en Avisos.` })
      setOpen(false)
    } catch (e) {
      toast({ title: 'Error al enviar', description: e.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="rounded-xl border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs h-8">
        <Megaphone className="w-3.5 h-3.5 mr-1.5" /> Avisar de nueva versión
      </Button>

      {open && (
        <Dialog open onOpenChange={() => !sending && setOpen(false)}>
          <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Avisar a todos los socios</DialogTitle>
              <DialogDescription className="text-gray-400">
                Se envía un push a {memberCount} socios y queda en su pestaña Avisos con el enlace a la App Store. Úsalo solo cuando la versión ya esté publicada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-gray-400 text-xs">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-black/40 border-[#2a2a2a] text-white rounded-xl mt-1" maxLength={80} />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Mensaje</Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className="bg-black/40 border-[#2a2a2a] text-white rounded-xl mt-1" maxLength={300} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending} className="rounded-xl text-gray-300">Cancelar</Button>
                <Button onClick={send} disabled={sending || !title.trim() || !body.trim()} className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Megaphone className="w-4 h-4 mr-2" /> Enviar a todos</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default BroadcastUpdateButton
