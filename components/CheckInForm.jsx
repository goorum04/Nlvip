'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Camera as CameraIcon, X, LoaderCircle as Loader2, CircleAlert as AlertCircle, ClipboardCheck } from 'lucide-react'
import { useFileUpload, generateFileId, getFileExtension } from '@/hooks/useStorage'
import { authFetch } from '@/lib/utils'

// Formulario ÚNICO de revisión periódica del socio: peso, medidas corporales,
// cómo se siente, y las 3 fotos. NUNCA incluye nada de comida/dieta/macros —
// eso pertenece exclusivamente al cuestionario inicial (DietOnboardingForm),
// que se rellena una sola vez y no se repite aquí.
export function CheckInForm({ memberId, onSuccess, onCancel }) {
  const [photos, setPhotos] = useState({
    front: { file: null, preview: null },
    side: { file: null, preview: null },
    back: { file: null, preview: null },
  })
  const [weight, setWeight] = useState('')
  const [neck, setNeck] = useState('')
  const [chest, setChest] = useState('')
  const [waist, setWaist] = useState('')
  const [hips, setHips] = useState('')
  const [arms, setArms] = useState('')
  const [legs, setLegs] = useState('')
  const [glutes, setGlutes] = useState('')
  const [calves, setCalves] = useState('')

  const [dietAdherence, setDietAdherence] = useState(true)
  const [activityAdherence, setActivityAdherence] = useState(true)
  const [mood, setMood] = useState('')
  const [digestion, setDigestion] = useState('')
  const [stressLevel, setStressLevel] = useState('')
  const [appetite, setAppetite] = useState('')
  const [sleepQuality, setSleepQuality] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const frontInputRef = useRef(null)
  const sideInputRef = useRef(null)
  const backInputRef = useRef(null)
  const { uploadFile } = useFileUpload()

  const handleFileSelect = (e, type) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('La imagen es muy grande. Máximo 50MB')
      return
    }
    setPhotos(prev => ({
      ...prev,
      [type]: { file: selectedFile, preview: URL.createObjectURL(selectedFile) },
    }))
  }

  const handleNativeCamera = async (type) => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const status = await Camera.checkPermissions()
      if (status.camera !== 'granted' || status.photos !== 'granted') {
        const request = await Camera.requestPermissions()
        if (request.camera !== 'granted' || request.photos !== 'granted') {
          setError('Permisos de cámara o galería denegados. Actívalos en ajustes.')
          return
        }
      }
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
      })
      if (image.base64String) {
        const mimeType = `image/${image.format}`
        const byteCharacters = atob(image.base64String)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
        const fileName = `checkin_${type}_${Date.now()}.${image.format}`
        const file = new File([blob], fileName, { type: mimeType })
        setPhotos(prev => ({
          ...prev,
          [type]: { file, preview: `data:${mimeType};base64,${image.base64String}` },
        }))
      }
    } catch (err) {
      if (err.message?.includes('cancelled')) return
      setError(`Error: ${err.message || 'No se pudo acceder a la cámara o galería'}`)
    }
  }

  const handleRemovePhoto = (type) => setPhotos(prev => ({ ...prev, [type]: { file: null, preview: null } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!weight || parseFloat(weight) <= 0) {
      setError('Indica tu peso actual')
      return
    }
    if (!photos.front.file || !photos.side.file || !photos.back.file) {
      setError('Debes subir las 3 fotos (frente, lado y espalda)')
      return
    }

    setSubmitting(true)
    try {
      const groupId = crypto.randomUUID()
      const uploadedPhotos = []
      for (const type of ['front', 'side', 'back']) {
        const file = photos[type].file
        const fileId = generateFileId()
        const ext = getFileExtension(file.name)
        const path = `${memberId}/checkins/${groupId}_${fileId}_${type}.${ext}`
        const result = await uploadFile('progress_photos', path, file, {
          maxSize: 50 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        })
        if (!result.success) throw new Error(`Error al subir la foto de ${type}: ${result.error}`)
        uploadedPhotos.push({ type, path })
      }

      const res = await authFetch('/api/checkin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          groupId,
          weight: parseFloat(weight),
          measurements: {
            neck: parseFloat(neck) || null,
            chest: parseFloat(chest) || null,
            waist: parseFloat(waist) || null,
            hips: parseFloat(hips) || null,
            arms: parseFloat(arms) || null,
            legs: parseFloat(legs) || null,
            glutes: parseFloat(glutes) || null,
            calves: parseFloat(calves) || null,
          },
          feeling: {
            dietAdherence,
            activityAdherence,
            mood: mood || null,
            digestion: digestion || null,
            stressLevel: stressLevel || null,
            appetite: appetite || null,
            sleepQuality: sleepQuality || null,
          },
          notes,
          photos: uploadedPhotos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar la revisión')

      onSuccess?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const PhotoSlot = ({ type, label, inputRef }) => (
    <div className="space-y-2">
      <Label className="text-gray-400 text-[10px] uppercase font-bold text-center block">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFileSelect(e, type)}
        className="hidden"
        disabled={submitting}
      />
      {!photos[type].file ? (
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const { Capacitor } = await import('@capacitor/core')
            if (Capacitor.isNativePlatform()) handleNativeCamera(type)
            else inputRef.current?.click()
          }}
          disabled={submitting}
          className="w-full aspect-square border-dashed border-[#2a2a2a] bg-black/30 hover:bg-black/50 text-gray-500 hover:text-violet-400 rounded-2xl flex flex-col gap-2 p-0"
        >
          <CameraIcon className="w-6 h-6" />
          <span className="text-[10px] px-1">Subir</span>
        </Button>
      ) : (
        <div className="relative aspect-square rounded-2xl overflow-hidden border border-violet-500/30 group">
          <img src={photos[type].preview} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button type="button" size="icon" variant="destructive" onClick={() => handleRemovePhoto(type)} disabled={submitting} className="w-7 h-7 rounded-full">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const FeelingSelect = ({ label, value, onChange, options }) => (
    <div>
      <Label className="text-gray-400 text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={submitting}>
        <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1">
          <SelectValue placeholder="Selecciona..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-violet-500" />
            Nueva Revisión
          </CardTitle>
          <CardDescription className="text-gray-500">
            Peso, medidas, cómo te sientes y tus 3 fotos. Tu entrenador la revisará y adaptará tu dieta y rutina según tu evolución.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-white font-bold text-sm mb-3">Fotos (frente, lado y espalda)</p>
            <div className="grid grid-cols-3 gap-3">
              <PhotoSlot type="front" label="Frente" inputRef={frontInputRef} />
              <PhotoSlot type="side" label="Lado" inputRef={sideInputRef} />
              <PhotoSlot type="back" label="Espalda" inputRef={backInputRef} />
            </div>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-3">Medidas</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Peso (kg) *', value: weight, setter: setWeight, required: true },
                { label: 'Cuello (cm)', value: neck, setter: setNeck },
                { label: 'Pecho (cm)', value: chest, setter: setChest },
                { label: 'Cintura (cm)', value: waist, setter: setWaist },
                { label: 'Cadera (cm)', value: hips, setter: setHips },
                { label: 'Brazo (cm)', value: arms, setter: setArms },
                { label: 'Muslo (cm)', value: legs, setter: setLegs },
                { label: 'Glúteo (cm)', value: glutes, setter: setGlutes },
                { label: 'Gemelo (cm)', value: calves, setter: setCalves },
              ].map(f => (
                <div key={f.label}>
                  <Label className="text-gray-400 text-xs">{f.label}</Label>
                  <Input
                    type="number" step="0.1" value={f.value}
                    onChange={(e) => f.setter(e.target.value)}
                    required={f.required}
                    disabled={submitting}
                    className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-3">Cómo te sientes</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-[#2a2a2a]">
                <Label className="text-gray-300 text-sm">¿Has seguido la dieta esta semana?</Label>
                <Switch checked={dietAdherence} onCheckedChange={setDietAdherence} disabled={submitting} />
              </div>
              <div className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-[#2a2a2a]">
                <Label className="text-gray-300 text-sm">¿Has cumplido pasos/actividad?</Label>
                <Switch checked={activityAdherence} onCheckedChange={setActivityAdherence} disabled={submitting} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FeelingSelect label="Estado anímico" value={mood} onChange={setMood} options={['Muy bien', 'Normal', 'Bajo', 'Muy bajo']} />
                <FeelingSelect label="Digestiones" value={digestion} onChange={setDigestion} options={['Normales', 'Hinchazón', 'Malas']} />
                <FeelingSelect label="Estrés semanal" value={stressLevel} onChange={setStressLevel} options={['Ninguno', 'Moderado', 'Alto']} />
                <FeelingSelect label="Apetito" value={appetite} onChange={setAppetite} options={['Saciado', 'Normal', 'Con hambre', 'Ansiedad']} />
                <FeelingSelect label="Calidad del sueño" value={sleepQuality} onChange={setSleepQuality} options={['Buena', 'Normal', 'Mala']} />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Observaciones (opcional)</Label>
                <Textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Cualquier cosa que quieras contarle a tu entrenador sobre cómo te ha ido..."
                  disabled={submitting}
                  className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-500 text-xs font-medium">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="flex-1 rounded-2xl py-6">
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={submitting} className="flex-1 bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-2xl py-6">
              {submitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando revisión...
                </div>
              ) : 'Enviar revisión'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
