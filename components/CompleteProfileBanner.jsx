'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  ClipboardList, Camera as CameraIcon, X, LoaderCircle as Loader2,
  CircleCheckBig as CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateFileId, getFileExtension } from '@/hooks/useStorage'
import { useToast } from '@/hooks/use-toast'
import { getApiUrl } from '@/lib/utils'
import { getMissingOnboardingItems } from '@/lib/onboardingGaps'

const ONBOARDING_PHOTO_NOTE = 'Foto inicial cuestionario nutricional'

/**
 * Banner que avisa a un socio (que YA completó su cuestionario nutricional
 * en algún momento) de qué datos concretos le siguen faltando — una foto en
 * concreto, la edad, sus alimentos favoritos... — sin obligarle a repetir
 * el cuestionario entero. Solo se muestra si de verdad falta algo.
 */
export default function CompleteProfileBanner({ memberId }) {
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [fieldValues, setFieldValues] = useState({})
  const [photoFiles, setPhotoFiles] = useState({})
  const [photoPreviews, setPhotoPreviews] = useState({})
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!memberId) return
    try {
      if (localStorage.getItem(`nlvip_complete_profile_dismissed_${memberId}`) === '1') {
        setDismissed(true)
        setLoading(false)
        return
      }
    } catch {}
    load()
  }, [memberId])

  const load = async () => {
    setLoading(true)
    try {
      const { data: request } = await supabase
        .from('diet_onboarding_requests')
        .select('id, responses')
        .eq('member_id', memberId)
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!request) { setMissing([]); setLoading(false); return }

      const { data: photos } = await supabase
        .from('progress_photos')
        .select('photo_type')
        .eq('member_id', memberId)
        .eq('notes', ONBOARDING_PHOTO_NOTE)

      const photoTypesPresent = (photos || []).map(p => p.photo_type).filter(Boolean)
      const items = getMissingOnboardingItems(request.responses, photoTypesPresent)
      setMissing(items)
      // Si hay campos obligatorios pendientes, se abre solo — no puede quedar
      // colapsado sin que el socio lo vea (las fotos solas sí pueden quedar
      // colapsadas, no son obligatorias).
      if (items.some(i => i.kind === 'field')) setExpanded(true)
    } catch (e) {
      console.warn('CompleteProfileBanner load error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  const missingFields = missing.filter(m => m.kind === 'field')
  const missingPhotos = missing.filter(m => m.kind === 'photo')

  const handlePhotoSelect = (key, file) => {
    if (!file) return
    setPhotoFiles(prev => ({ ...prev, [key]: file }))
    setPhotoPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }))
  }

  const removePhoto = (key) => {
    if (photoPreviews[key]) URL.revokeObjectURL(photoPreviews[key])
    setPhotoFiles(prev => { const p = { ...prev }; delete p[key]; return p })
    setPhotoPreviews(prev => { const p = { ...prev }; delete p[key]; return p })
  }

  const handleDismiss = () => {
    try { localStorage.setItem(`nlvip_complete_profile_dismissed_${memberId}`, '1') } catch {}
    setDismissed(true)
  }

  // Las fotos se pueden dejar para más tarde; los campos de texto/medida NO
  // — si falta alguno, es obligatorio rellenarlo TODO para poder guardar.
  const allFieldsFilled = missingFields.every(f => (fieldValues[f.key] || '').trim())

  const handleSave = async () => {
    if (!allFieldsFilled) return
    setSaving(true)
    try {
      // 1. Campos de texto/medida — obligatorio ir todos juntos
      const fieldsToSave = {}
      for (const f of missingFields) {
        fieldsToSave[f.key] = fieldValues[f.key].trim()
      }
      if (Object.keys(fieldsToSave).length > 0) {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(getApiUrl() + '/api/diet-onboarding/complete-fields', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ memberId, fields: fieldsToSave })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Error al guardar tus datos')
      }

      // 2. Fotos que se hayan seleccionado
      const photoKeysToUpload = Object.keys(photoFiles)
      if (photoKeysToUpload.length > 0) {
        const groupId = crypto.randomUUID()
        for (const type of photoKeysToUpload) {
          const file = photoFiles[type]
          const ext = getFileExtension(file.name) || 'jpg'
          const path = `${memberId}/onboarding/${generateFileId()}_${type}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('progress_photos')
            .upload(path, file, { upsert: true })
          if (uploadError) throw new Error(`Error al subir la foto: ${uploadError.message}`)

          const { error: dbError } = await supabase.from('progress_photos').insert({
            member_id: memberId,
            photo_url: path,
            photo_type: type,
            group_id: groupId,
            date: new Date().toISOString().split('T')[0],
            notes: ONBOARDING_PHOTO_NOTE,
          })
          if (dbError) throw dbError
        }
      }

      toast({ title: '¡Gracias!', description: 'Tus datos se han actualizado correctamente.' })
      setFieldValues({})
      setPhotoFiles({})
      setPhotoPreviews({})
      await load()
    } catch (err) {
      toast({ title: 'No se pudo guardar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading || dismissed || missing.length === 0) return null

  const hasMandatoryPending = missingFields.length > 0
  const canSave = hasMandatoryPending ? allFieldsFilled : Object.keys(photoFiles).length > 0

  return (
    <Card className="bg-gradient-to-br from-amber-900/25 to-orange-900/10 border-amber-500/30 rounded-3xl overflow-hidden">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm">
              Te falta{missing.length === 1 ? '' : 'n'} {missing.length} dato{missing.length === 1 ? '' : 's'} de tu ficha
            </h3>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
              {hasMandatoryPending
                ? 'Estos datos son obligatorios para poder hacerte un plan bien — no se pueden dejar en blanco (las fotos sí pueden esperar).'
                : 'Puedes añadir las fotos que faltan cuando quieras.'}
            </p>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />}
        </div>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {missingFields.map(f => (
            <div key={f.key}>
              <Label className="text-gray-400 text-xs">{f.label} <span className="text-amber-400">*</span></Label>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.placeholder}
                value={fieldValues[f.key] || ''}
                onChange={e => setFieldValues(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white mt-1 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
          ))}

          {missingPhotos.length > 0 && (
            <div>
              <Label className="text-gray-400 text-xs">Fotos que faltan</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {missingPhotos.map(({ key, label }) => (
                  <div key={key} className="relative">
                    {photoPreviews[key] ? (
                      <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-black/30">
                        <img src={photoPreviews[key]} alt={label} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(key)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-[3/4] rounded-xl border border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors gap-1">
                        <CameraIcon className="w-5 h-5 text-gray-500" />
                        <span className="text-[9px] text-gray-500 text-center px-1">{label.replace('Foto de ', '')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={saving}
                          onChange={(e) => handlePhotoSelect(key, e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-2xl h-11"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Guardar</>
              )}
            </Button>
            {/* "Ahora no" solo si lo único pendiente son fotos — los campos
                de texto son obligatorios y no se pueden descartar. */}
            {!hasMandatoryPending && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-300 rounded-2xl h-11"
              >
                Ahora no
              </Button>
            )}
          </div>
          <p className="text-[11px] text-gray-600 text-center">
            {hasMandatoryPending
              ? 'Las fotos que falten sí puedes subirlas más adelante — el resto es obligatorio.'
              : 'Puedes subir solo alguna foto y volver luego a por el resto.'}
          </p>
        </CardContent>
      )}
    </Card>
  )
}
