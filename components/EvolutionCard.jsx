'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoaderCircle as Loader2, Share2, Download, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { loadImage, renderEvolutionCard } from '@/lib/shareCards'


// Tarjeta "antes / ahora" para compartir (formato story): primera y última
// foto de frente, peso y cintura al inicio y ahora, y las semanas de proceso.
// Se genera solo cuando el socio lo pide, en su móvil; no se guarda nada.
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
      await renderEvolutionCard(canvas, { imgA, imgB, dateA: first.date, dateB: last.date, weeks, recFirst, recLast, memberName })
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
          <DialogContent className="bg-[#111] border-[#2a2a2a] rounded-3xl max-w-sm p-4">
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
