'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Camera as CameraIcon, X, LoaderCircle as Loader2, Upload, Calendar, ChevronLeft, ChevronRight,
  ZoomIn, Trash2, CircleAlert as AlertCircle, Image as ImageIcon
} from 'lucide-react'
import { useFileUpload, useSignedUrl, generateFileId, getFileExtension } from '@/hooks/useStorage'
import { supabase } from '@/lib/supabase'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

// Componente para subir fotos de progreso (3 fotos requeridas)
export function ProgressPhotoUploader({ memberId, onSuccess, onCancel }) {
  const [photos, setPhotos] = useState({
    front: { file: null, preview: null },
    side: { file: null, preview: null },
    back: { file: null, preview: null }
  })
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  
  const frontInputRef = useRef(null)
  const sideInputRef = useRef(null)
  const backInputRef = useRef(null)

  // Load and save photo session to localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`progress_photos_session_${memberId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const restoredPhotos = { ...photos }
        
        Object.keys(parsed).forEach(type => {
          if (parsed[type].base64 && parsed[type].mimeType && parsed[type].fileName) {
            const blob = base64ToBlob(parsed[type].base64, parsed[type].mimeType)
            const file = new File([blob], parsed[type].fileName, { type: parsed[type].mimeType })
            restoredPhotos[type] = {
              file,
              preview: parsed[type].preview,
              base64: parsed[type].base64 // Keep base64 for re-serialization
            }
          }
        })
        setPhotos(restoredPhotos)
      } catch (e) {
        console.error('Failed to restore photo session', e)
      }
    }
  }, [memberId])

  useEffect(() => {
    const sessionData = {}
    let hasPhotos = false
    
    Object.keys(photos).forEach(type => {
      if (photos[type].file && photos[type].base64) {
        hasPhotos = true
        sessionData[type] = {
          base64: photos[type].base64,
          mimeType: photos[type].file.type,
          fileName: photos[type].file.name,
          preview: photos[type].preview
        }
      }
    })

    if (hasPhotos) {
      localStorage.setItem(`progress_photos_session_${memberId}`, JSON.stringify(sessionData))
    } else {
      localStorage.removeItem(`progress_photos_session_${memberId}`)
    }
  }, [photos, memberId])

  const { uploadFile, uploading, progress, error: uploadError } = useFileUpload()

  const base64ToBlob = (base64, mime) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  const handleNativeCamera = async (type) => {
    try {
      // Verificar permisos primero
      const status = await Camera.checkPermissions();
      if (status.camera !== 'granted' || status.photos !== 'granted') {
        const request = await Camera.requestPermissions();
        if (request.camera !== 'granted' || request.photos !== 'granted') {
          setError('Permisos de cámara o galería denegados. Actívalos en ajustes.');
          return;
        }
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt
      });

      if (image.base64String) {
        const mimeType = `image/${image.format}`;
        const blob = base64ToBlob(image.base64String, mimeType);
        const fileName = `progress_${type}_${Date.now()}.${image.format}`;
        const file = new File([blob], fileName, { type: mimeType });
        const previewUrl = `data:${mimeType};base64,${image.base64String}`;
        
        setPhotos(prev => ({
          ...prev,
          [type]: {
            file: file,
            preview: previewUrl,
            base64: image.base64String
          }
        }))
      }
    } catch (err) {
      console.error('Error al capturar imagen:', err);
      if (err.message?.includes('cancelled')) {
        return;
      }
      setError(`Error: ${err.message || 'No se pudo acceder a la cámara o galería'}`);
    }
  }

  const handleFileSelect = (e, type) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError(null)

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }

    // Validar tamaño (50MB - Acorde al nuevo límite auditado)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('La imagen es muy grande. Máximo 50MB')
      return
    }

    setPhotos(prev => ({
      ...prev,
      [type]: {
        file: selectedFile,
        preview: URL.createObjectURL(selectedFile)
      }
    }))
  }

  const handleUpload = async () => {
    if (!photos.front.file || !photos.side.file || !photos.back.file) {
      setError('Debes subir las 3 fotos (frente, lado y espalda)')
      return
    }

    const groupId = crypto.randomUUID()
    const dbEntries = []

    try {
      for (const type of ['front', 'side', 'back']) {
        const file = photos[type].file
        const fileId = generateFileId()
        const ext = getFileExtension(file.name)
        const path = `progress/${memberId}/${fileId}_${type}.${ext}`

        // Subir a storage (usamos el nuevo límite de 50MB)
        const result = await uploadFile('progress_photos', path, file, {
          maxSize: 50 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
        })

        if (!result.success) {
          throw new Error(`Error al subir la foto ${type}: ${result.error}`)
        }

        dbEntries.push({
          member_id: memberId,
          photo_url: path,
          photo_type: type,
          group_id: groupId,
          date: new Date(takenAt).toISOString(),
          notes: notes.trim() || null
        })
      }

      // Guardar en base de datos
      const { error: dbError } = await supabase.from('progress_photos').insert(dbEntries)

      if (dbError) throw dbError

      // Clear session after success
      localStorage.removeItem(`progress_photos_session_${memberId}`)
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRemove = (type) => {
    setPhotos(prev => ({
      ...prev,
      [type]: { file: null, preview: null }
    }))
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
        disabled={uploading}
      />
      
      {!photos[type].file ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (Capacitor.isNativePlatform()) {
              handleNativeCamera(type)
            } else {
              inputRef.current?.click()
            }
          }}
          disabled={uploading}
          className="w-full aspect-square border-dashed border-[#2a2a2a] bg-black/30 hover:bg-black/50 text-gray-500 hover:text-violet-400 rounded-2xl flex flex-col gap-2 p-0"
        >
          <CameraIcon className="w-6 h-6" />
          <span className="text-[10px] px-1">Subir</span>
        </Button>
      ) : (
        <div className="relative aspect-square rounded-2xl overflow-hidden border border-violet-500/30 group">
          <img
            src={photos[type].preview}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={() => handleRemove(type)}
              disabled={uploading}
              className="w-7 h-7 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6 p-5 bg-[#121212] rounded-3xl border border-[#2a2a2a] shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <CameraIcon className="w-5 h-5 text-violet-400" />
            Nuevo Reporte
          </h3>
          <p className="text-gray-500 text-[10px]">Las 3 perspectivas son obligatorias</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400 hover:text-white rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="bg-violet-500/5 border border-violet-400/10 rounded-2xl p-4 space-y-2">
        <p className="text-xs text-white/90 leading-relaxed">
          <span className="font-bold text-violet-400">Fotos actuales (frente, lado y espalda)</span><br />
          Hacer con la mejor calidad posible, ropa interior o en bañador corto en el caso de los hombres; las mujeres con bikini o brasileña/tanga.
        </p>
        <p className="text-[10px] text-gray-400 leading-relaxed italic">
          Fotos de cuerpo completo para poder apreciar todos los avances o atrasos, mientras mejor se vea el cuerpo más podremos perfeccionar todo.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <PhotoSlot type="front" label="Frente" inputRef={frontInputRef} />
        <PhotoSlot type="side" label="Lado" inputRef={sideInputRef} />
        <PhotoSlot type="back" label="Espalda" inputRef={backInputRef} />
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <Label className="text-gray-500 text-[10px] ml-1">Fecha</Label>
            <Input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className="bg-black/40 border-[#2a2a2a] rounded-xl text-white h-10"
              disabled={uploading}
            />
          </div>
          <div>
            <Label className="text-gray-500 text-[10px] ml-1">Notas (opcional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Ayunas..."
              className="bg-black/40 border-[#2a2a2a] rounded-xl text-white h-10"
              disabled={uploading}
            />
          </div>
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Subiendo reporte...</span>
              <span className="text-violet-400 font-bold">{progress}%</span>
            </div>
            <div className="h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={uploading || !photos.front.file || !photos.side.file || !photos.back.file}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl py-6 shadow-lg shadow-violet-500/10 disabled:opacity-30 transition-all h-14"
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin"/>
              Subiendo...
            </div>
          ) : "Guardar Reporte Fotográfico"}
        </Button>
      </div>

      {(error || uploadError) && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-500 text-xs font-medium">{error || uploadError}</p>
        </div>
      )}
    </div>
  )
}

// Componente de galería de fotos (Agrupadas por sesión)
export function ProgressPhotoGallery({ photos, canDelete = false, onDelete }) {
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [imageUrls, setImageUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const { getSignedUrls } = useSignedUrl()

  // Agrupar fotos por group_id
  const photoGroups = photos.reduce((acc, photo) => {
    const groupId = photo.group_id || photo.date // Fallback para fotos antiguas sin group_id
    if (!acc[groupId]) {
      acc[groupId] = {
        id: groupId,
        date: photo.date,
        notes: photo.notes,
        photos: []
      }
    }
    acc[groupId].photos.push(photo)
    return acc;
  }, {})

  const sortedGroups = Object.values(photoGroups).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  useEffect(() => {
    loadImages()
  }, [photos])

  const loadImages = async () => {
    setLoading(true)
    const photosWithUrls = photos.filter(p => p.photo_url)
    if (photosWithUrls.length > 0) {
      const paths = photosWithUrls.map(p => p.photo_url)
      const signed = await getSignedUrls('progress_photos', paths, 3600)
      const urls = {}
      for (const { path, url } of signed) {
        const photo = photosWithUrls.find(p => p.photo_url === path)
        if (photo && url) urls[photo.id] = url
      }
      setImageUrls(urls)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
      </div>
    )
  }

  if (sortedGroups.length === 0) {
    return (
      <div className="text-center py-20 bg-black/20 rounded-3xl border border-dashed border-[#2a2a2a]">
        <ImageIcon className="w-16 h-16 mx-auto text-violet-500/20 mb-4" />
        <p className="text-gray-500 font-medium">No hay registros visuales aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {sortedGroups.map((group) => (
        <div key={group.id} className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              <span className="text-white font-bold text-sm">
                {new Date(group.date).toLocaleDateString('es-ES', { 
                  day: 'numeric', month: 'short', year: 'numeric' 
                })}
              </span>
            </div>
            {group.notes && <span className="text-[10px] text-gray-500 italic max-w-[150px] truncate">{group.notes}</span>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['front', 'side', 'back'].map((type) => {
              const photo = group.photos.find(p => p.photo_type === type) || group.photos[0] // Fallback
              return (
                <div key={type} className="space-y-1">
                  <button
                    onClick={() => setSelectedGroup(group)}
                    className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] hover:border-violet-500/50 transition-colors w-full relative group"
                  >
                    {photo && imageUrls[photo.id] ? (
                      <>
                        <img src={imageUrls[photo.id]} alt={type} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-[8px] text-white font-bold uppercase tracking-tighter">
                          {type === 'front' ? 'Frente' : type === 'side' ? 'Lado' : 'Espalda'}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CameraIcon className="w-6 h-6 text-gray-800" />
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
          
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                group.photos.forEach(p => onDelete?.(p.id))
              }}
              className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 text-[10px] h-6 px-2 rounded-full w-fit mx-auto"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Eliminar sesión
            </Button>
          )}
        </div>
      ))}

      {/* Lightbox para ver el grupo completo */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedGroup(null)}
            className="absolute top-6 right-6 text-white bg-white/10 rounded-full hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="w-full max-w-6xl space-y-6">
            <div className="text-center">
              <h2 className="text-white text-2xl font-bold">
                {new Date(selectedGroup.date).toLocaleDateString('es-ES', { 
                  day: 'numeric', month: 'long', year: 'numeric' 
                })}
              </h2>
              {selectedGroup.notes && <p className="text-gray-400 mt-2">{selectedGroup.notes}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto max-h-[70vh] py-4">
              {['front', 'side', 'back'].map(type => {
                const photo = selectedGroup.photos.find(p => p.photo_type === type)
                if (!photo) return null
                return (
                  <div key={type} className="space-y-3">
                    <p className="text-violet-400 font-bold text-center uppercase tracking-widest text-sm">{type === 'front' ? 'Frente' : type === 'side' ? 'Lado' : 'Espalda'}</p>
                    <div className="aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                      <img src={imageUrls[photo.id]} className="w-full h-full object-cover" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
