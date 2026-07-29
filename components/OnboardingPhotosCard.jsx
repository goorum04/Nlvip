'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Camera as CameraIcon, X, LoaderCircle as Loader2, CircleCheckBig as CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateFileId, getFileExtension } from '@/hooks/useStorage'
import { useToast } from '@/hooks/use-toast'

const PHOTO_SLOTS = [
  { key: 'front', label: 'Frente' },
  { key: 'side', label: 'Lado izq.' },
  { key: 'side_right', label: 'Lado der.' },
  { key: 'back', label: 'Espalda' },
]

// Marca las fotos como parte del cuestionario inicial (mismo texto que usa
// DietOnboardingForm al subirlas en el momento) para que ambos caminos
// alimenten la misma comprobación de "¿ya tiene fotos iniciales?".
const ONBOARDING_PHOTO_NOTE = 'Foto inicial cuestionario nutricional'

/**
 * Tarjeta para que el socio añada las 4 fotos del cuestionario inicial
 * DESPUÉS de haberlo enviado sin ellas — algo habitual porque no siempre
 * las tiene hechas en el momento de rellenarlo. Solo se muestra si ya
 * envió el cuestionario y todavía no tiene ninguna foto marcada como
 * inicial (ver comprobación en MemberDashboard).
 */
export default function OnboardingPhotosCard({ memberId, onDone, onDismiss }) {
  const [expanded, setExpanded] = useState(false)
  const [photos, setPhotos] = useState({ front: null, side: null, side_right: null, back: null })
  const [previews, setPreviews] = useState({ front: null, side: null, side_right: null, back: null })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  const handleSelect = (type, file) => {
    if (!file) return
    setPhotos(prev => ({ ...prev, [type]: file }))
    setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }))
  }

  const removePhoto = (type) => {
    if (previews[type]) URL.revokeObjectURL(previews[type])
    setPhotos(prev => ({ ...prev, [type]: null }))
    setPreviews(prev => ({ ...prev, [type]: null }))
  }

  const hasAny = Object.values(photos).some(Boolean)

  const handleSave = async () => {
    if (!hasAny) return
    setSaving(true)
    try {
      const groupId = crypto.randomUUID()
      let uploaded = 0
      for (const { key: type } of PHOTO_SLOTS) {
        const file = photos[type]
        if (!file) continue
        const ext = getFileExtension(file.name) || 'jpg'
        const path = `${memberId}/onboarding/${generateFileId()}_${type}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('progress_photos')
          .upload(path, file, { upsert: true })
        if (uploadError) throw new Error(`Error al subir la foto de ${type}: ${uploadError.message}`)

        const { error: dbError } = await supabase.from('progress_photos').insert({
          member_id: memberId,
          photo_url: path,
          photo_type: type,
          group_id: groupId,
          date: new Date().toISOString().split('T')[0],
          notes: ONBOARDING_PHOTO_NOTE,
        })
        if (dbError) throw dbError
        uploaded++
      }

      setDone(true)
      toast({ title: '¡Fotos guardadas!', description: `${uploaded} foto(s) añadidas a tu cuestionario inicial.` })
      onDone?.()
    } catch (err) {
      toast({ title: 'No se pudo guardar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Card className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border-emerald-500/30 rounded-3xl">
        <CardContent className="p-5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-300 text-sm font-medium">
            Fotos guardadas. Gracias — ayudan a personalizar mejor tu plan.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-cyan-900/30 to-violet-900/20 border-cyan-500/30 rounded-3xl overflow-hidden">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center flex-shrink-0">
            <CameraIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm">Añade tus fotos iniciales</h3>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
              Al rellenar el cuestionario no subiste fotos — puedes añadirlas ahora cuando quieras.
              Son privadas y solo las ve tu entrenador.
            </p>
          </div>
          {expanded
            ? <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />}
        </div>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {PHOTO_SLOTS.map(({ key, label }) => (
              <div key={key} className="relative">
                {previews[key] ? (
                  <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-black/30">
                    <img src={previews[key]} alt={label} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(key)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/80 font-medium">{label}</span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-[3/4] rounded-xl border border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors gap-1">
                    <CameraIcon className="w-5 h-5 text-gray-500" />
                    <span className="text-[10px] text-gray-500 text-center px-1">{label}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={saving}
                      onChange={(e) => handleSelect(key, e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasAny}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white rounded-2xl h-11"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Guardar fotos</>
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => onDismiss?.()}
              className="text-gray-500 hover:text-gray-300 rounded-2xl h-11"
            >
              Ahora no
            </Button>
          </div>
          <p className="text-[11px] text-gray-600 text-center">
            Puedes subir solo alguna si no tienes todas — vuelve cuando quieras a completar el resto.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
