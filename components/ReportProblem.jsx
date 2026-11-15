'use client'

// "Informar de un problema": el usuario cuenta qué le pasa con la app y el
// aviso llega al responsable técnico (la IA lo resume y se le llama por
// teléfono), sin pasar por el entrenador. Junto al mensaje se mandan la
// pantalla, el dispositivo, la versión y los últimos errores técnicos.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bug, LoaderCircle as Loader2, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'

// Últimos errores de la app en este dispositivo (solo en memoria).
const recentErrors = []
if (typeof window !== 'undefined' && !window.__nlErrorBuffer) {
  window.__nlErrorBuffer = true
  const push = (t) => { if (!t) return; recentErrors.push(String(t).slice(0, 280)); if (recentErrors.length > 5) recentErrors.shift() }
  window.addEventListener('error', (e) => push(e?.message))
  window.addEventListener('unhandledrejection', (e) => push(e?.reason?.message || e?.reason))
}

function currentScreen() {
  if (typeof document === 'undefined') return ''
  const tab = document.querySelector('nav.nl-bottomnav button[aria-current="page"], [role="tab"][data-state="active"]')
  const title = document.querySelector('h1')
  return [title?.textContent, tab?.textContent].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim().slice(0, 110)
}

async function platformInfo() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app')
      const { version, build } = await App.getInfo()
      return { platform: `app ${Capacitor.getPlatform()}`, appVersion: build ? `${version} (${build})` : version }
    }
  } catch {}
  return { platform: 'web' }
}

export function ReportProblem() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [screen, setScreen] = useState('')
  const { toast } = useToast()

  const openDialog = () => { setScreen(currentScreen()); setOpen(true) }

  const send = async () => {
    if (text.trim().length < 5 || sending) return
    setSending(true)
    try {
      const info = await platformInfo()
      const res = await authFetch('/api/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: { screen, ...info, device: navigator.userAgent.slice(0, 280), errors: recentErrors.slice(-5) },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar el aviso')
      toast({ title: 'Aviso enviado', description: 'Gracias. Lo revisamos lo antes posible.' })
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
      <Button type="button" variant="ghost" onClick={openDialog} className="w-full text-gray-300 hover:text-white hover:bg-white/5 rounded-xl">
        <Bug className="w-4 h-4 mr-2" />
        Informar de un problema
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!sending) setOpen(o) }}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Informar de un problema</DialogTitle>
            <DialogDescription className="text-gray-400">
              Cuéntanos qué ha pasado y qué estabas haciendo. El aviso llega directamente al equipo técnico.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={5}
            autoFocus
            placeholder="Por ejemplo: al marcar la comida como hecha, la app se queda cargando."
            className="bg-black/40 border-white/10 text-white rounded-2xl"
          />
          <p className="text-[11px] text-gray-500">
            Se envía también la pantalla en la que estabas, tu dispositivo y la versión de la app.
          </p>
          <Button onClick={send} disabled={sending || text.trim().length < 5} className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl py-5">
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</> : <><Send className="w-4 h-4 mr-2" /> Enviar aviso</>}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
