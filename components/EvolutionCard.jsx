'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoaderCircle as Loader2, Share2, Download, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const W = 1080
const H = 1350

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar una foto'))
    img.src = url
  })
}

function drawCover(ctx, img, x, y, w, h, radius) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Tarjeta "antes / ahora" para compartir (formato vertical de Instagram):
// primera y última foto de frente, peso y cintura al inicio y ahora, y las
// semanas de proceso. Se genera solo cuando el socio lo pide, en su móvil;
// no se guarda nada en el servidor.
export function EvolutionCard({ memberId, memberName }) {
  const [open, setOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  const [dataUrl, setDataUrl] = useState(null)
  const [error, setError] = useState(null)
  const { toast } = useToast()

  const build = async () => {
    setBuilding(true)
    setError(null)
    setDataUrl(null)
    try {
      const [{ data: photos }, { data: records }] = await Promise.all([
        supabase.from('progress_photos').select('photo_url, date').eq('member_id', memberId).eq('photo_type', 'front').order('date', { ascending: true }),
        supabase.from('progress_records').select('date, weight_kg, waist_cm').eq('member_id', memberId).order('date', { ascending: true }),
      ])
      if (!photos || photos.length < 2) throw new Error('Necesitas al menos dos fotos de frente (dos revisiones) para crear la tarjeta.')

      const first = photos[0]
      const last = photos[photos.length - 1]
      const { data: signed } = await supabase.storage.from('progress_photos').createSignedUrls([first.photo_url, last.photo_url], 600)
      const urlFor = (path) => signed?.find(s => s.path === path)?.signedUrl
      const [imgA, imgB] = await Promise.all([loadImage(urlFor(first.photo_url)), loadImage(urlFor(last.photo_url))])

      const recFirst = (records || []).find(r => r.weight_kg != null) || null
      const recLast = [...(records || [])].reverse().find(r => r.weight_kg != null) || null
      const weeks = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / (7 * 24 * 3600 * 1000)))

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#0b0b12')
      bg.addColorStop(1, '#17102b')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 54px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('MI EVOLUCIÓN', 70, 120)
      ctx.font = '500 34px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#a78bfa'
      ctx.fillText(`${weeks} semana${weeks === 1 ? '' : 's'} de proceso`, 70, 172)

      const gap = 30
      const pw = (W - 70 * 2 - gap) / 2
      const ph = Math.round(pw * 4 / 3)
      const py = 230
      drawCover(ctx, imgA, 70, py, pw, ph, 36)
      drawCover(ctx, imgB, 70 + pw + gap, py, pw, ph, 36)

      const tag = (text, x, color) => {
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif'
        const tw = ctx.measureText(text).width + 40
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x + 20, py + 20, tw, 48, 14)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        ctx.fillText(text, x + 40, py + 54)
      }
      tag('ANTES', 70, 'rgba(0,0,0,0.65)')
      tag('AHORA', 70 + pw + gap, '#7c3aed')

      ctx.font = '26px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#9ca3af'
      ctx.textAlign = 'center'
      ctx.fillText(fmtDate(first.date), 70 + pw / 2, py + ph + 44)
      ctx.fillText(fmtDate(last.date), 70 + pw + gap + pw / 2, py + ph + 44)

      const statsY = py + ph + 110
      const stats = []
      if (recFirst && recLast) {
        const dw = Number(recLast.weight_kg) - Number(recFirst.weight_kg)
        stats.push({ label: 'Peso', value: `${Number(recFirst.weight_kg).toFixed(1)} → ${Number(recLast.weight_kg).toFixed(1)} kg`, delta: `${dw > 0 ? '+' : ''}${dw.toFixed(1)} kg` })
        if (recFirst.waist_cm != null && recLast.waist_cm != null) {
          const dc = Number(recLast.waist_cm) - Number(recFirst.waist_cm)
          stats.push({ label: 'Cintura', value: `${Number(recFirst.waist_cm).toFixed(0)} → ${Number(recLast.waist_cm).toFixed(0)} cm`, delta: `${dc > 0 ? '+' : ''}${dc.toFixed(0)} cm` })
        }
      }
      const boxW = (W - 140 - (stats.length - 1) * 20) / Math.max(1, stats.length)
      stats.forEach((s, i) => {
        const x = 70 + i * (boxW + 20)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.beginPath()
        ctx.roundRect(x, statsY, boxW, 150, 28)
        ctx.fill()
        ctx.textAlign = 'center'
        ctx.fillStyle = '#9ca3af'
        ctx.font = '500 26px system-ui, -apple-system, sans-serif'
        ctx.fillText(s.label.toUpperCase(), x + boxW / 2, statsY + 44)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 40px system-ui, -apple-system, sans-serif'
        ctx.fillText(s.value, x + boxW / 2, statsY + 96)
        ctx.fillStyle = '#22d3ee'
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
        ctx.fillText(s.delta, x + boxW / 2, statsY + 134)
      })

      ctx.textAlign = 'left'
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 40px system-ui, -apple-system, sans-serif'
      ctx.fillText(memberName || '', 70, H - 90)
      ctx.textAlign = 'right'
      const brand = ctx.createLinearGradient(W - 400, 0, W - 70, 0)
      brand.addColorStop(0, '#8b5cf6')
      brand.addColorStop(1, '#22d3ee')
      ctx.fillStyle = brand
      ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
      ctx.fillText('NL VIP TEAM', W - 70, H - 90)

      setDataUrl(canvas.toDataURL('image/jpeg', 0.92))
    } catch (e) {
      setError(e.message)
    } finally {
      setBuilding(false)
    }
  }

  const openAndBuild = () => {
    setOpen(true)
    build()
  }

  const toFile = async () => {
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], 'mi-evolucion-nlvip.jpg', { type: 'image/jpeg' })
  }

  const share = async () => {
    try {
      const file = await toFile()
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mi evolución · NL VIP Team' })
        return
      }
      download()
    } catch (e) {
      if (e?.name !== 'AbortError') toast({ title: 'No se pudo compartir', description: 'Descárgala y compártela desde tu galería.', variant: 'destructive' })
    }
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'mi-evolucion-nlvip.jpg'
    a.click()
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-violet-500/10 to-cyan-500/5 border-violet-500/20 rounded-3xl">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-white font-bold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> Tarjeta de evolución</p>
            <p className="text-gray-500 text-xs mt-0.5">Tu antes y ahora en una imagen para compartir. Solo tú decides si la compartes.</p>
          </div>
          <Button size="sm" onClick={openAndBuild} className="bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-xl shrink-0">Crear</Button>
        </CardContent>
      </Card>

      {open && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent className="bg-[#111] border-[#2a2a2a] rounded-3xl max-w-md p-4">
            <DialogHeader>
              <DialogTitle className="text-white text-base">Mi evolución</DialogTitle>
            </DialogHeader>
            {building ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400 text-sm"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /> Preparando tu tarjeta…</div>
            ) : error ? (
              <p className="text-sm text-amber-300 py-6 text-center">{error}</p>
            ) : dataUrl ? (
              <div className="space-y-3">
                <img src={dataUrl} alt="Tarjeta de evolución" className="w-full rounded-2xl border border-[#2a2a2a]" />
                <p className="text-[11px] text-gray-500">La imagen incluye tus fotos. Compártela solo si quieres.</p>
                <div className="flex gap-2">
                  <Button onClick={share} className="flex-1 bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-xl"><Share2 className="w-4 h-4 mr-2" /> Compartir</Button>
                  <Button variant="outline" onClick={download} className="rounded-xl border-[#2a2a2a] text-gray-200"><Download className="w-4 h-4" /></Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default EvolutionCard
