'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Camera, X, Loader2, Upload, Calendar, ChevronLeft, ChevronRight,
  ZoomIn, Trash2, AlertCircle, Image as ImageIcon
} from 'lucide-react'
import { useFileUpload, useSignedUrl, generateFileId, getFileExtension } from '@/hooks/useStorage'
import { supabase } from '@/lib/supabase'

// Componente para subir foto de progreso
export function ProgressPhotoUploader({ memberId, onSuccess, onCancel }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const { uploadFile, uploading, progress, error: uploadError } = useFileUpload()

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError(null)

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }

    // Validar tamaño (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('La imagen es muy grande. Máximo 10MB')
      return
    }

    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
  }

  const handleUpload = async () => {
    if (!file) return

    // Generar path único
    const fileId = generateFileId()
    const ext = getFileExtension(file.name)
    const path = `progress/${memberId}/${fileId}.${ext}`

    // Subir a storage
    const result = await uploadFile('progress_photos', path, file, {
      maxSize: 10 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
    })

    if (!result.success) return

    // Guardar en base de datos
    const { error: dbError } = await supabase.from('progress_photos').insert({
      member_id: memberId,
      photo_url: path,
      date: new Date(takenAt).toISOString(),
      notes: notes.trim() || null
    })

    if (dbError) {
      setError('Error guardando: ' + dbError.message)
      return
    }

    onSuccess?.()
  }

  const handleRemove = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4 p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#00D4FF]" />
          Nueva Foto de Progreso
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {!file ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full border-dashed border-[#2a2a2a] bg-black/30 hover:bg-black/50 text-gray-400 hover:text-[#00D4FF] rounded-xl py-12"
        >
          <div className="text-center">
            <Camera className="w-10 h-10 mx-auto mb-2" />
            <p>Tomar foto o seleccionar</p>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP · Máx 10MB</p>
          </div>
        </Button>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden border border-[#2a2a2a]">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-64 object-contain bg-black"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleRemove}
              disabled={uploading}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Form fields */}
          <div>
            <Label className="text-gray-400 text-sm flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Fecha de la foto
            </Label>
            <Input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
              disabled={uploading}
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Semana 4, vista frontal..."
              className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1 min-h-[80px]"
              disabled={uploading}
            />
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Subiendo...</span>
                <span className="text-[#00D4FF]">{progress}%</span>
              </div>
              <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black font-bold rounded-xl py-6"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Guardar Foto
              </>
            )}
          </Button>
        </div>
      )}

      {/* Errors */}
      {(error || uploadError) && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error || uploadError}</p>
        </div>
      )}
    </div>
  )
}

// Componente de galería de fotos
export function ProgressPhotoGallery({ photos, canDelete = false, onDelete }) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [imageUrls, setImageUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const { getSignedUrl } = useSignedUrl()

  useEffect(() => {
    loadImages()
  }, [photos])

  const loadImages = async () => {
    setLoading(true)
    const urls = {}
    
    for (const photo of photos) {
      const url = await getSignedUrl('progress_photos', photo.photo_url, 3600)
      if (url) {
        urls[photo.id] = url
      }
    }
    
    setImageUrls(urls)
    setLoading(false)
  }

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null

  const goToPrev = () => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const goToNext = () => {
    setSelectedIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#00D4FF] animate-spin" />
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-16 h-16 mx-auto text-[#00D4FF]/20 mb-4" />
        <p className="text-gray-500">No hay fotos de progreso</p>
      </div>
    )
  }

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => setSelectedIndex(index)}
            className="aspect-square rounded-xl overflow-hidden bg-[#2a2a2a] hover:ring-2 hover:ring-[#00D4FF] transition-all"
          >
            {imageUrls[photo.id] ? (
              <img
                src={imageUrls[photo.id]}
                alt={`Progreso ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-gray-600" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Navigation */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrev}
                className="absolute left-4 text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                className="absolute right-4 text-white hover:bg-white/10"
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </>
          )}

          {/* Image */}
          <div className="max-w-4xl max-h-[80vh] px-16">
            <img
              src={imageUrls[selectedPhoto.id]}
              alt="Progreso"
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
            
            {/* Info */}
            <div className="mt-4 text-center">
              <p className="text-white font-semibold">
                {new Date(selectedPhoto.date).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              {selectedPhoto.notes && (
                <p className="text-gray-400 text-sm mt-1">{selectedPhoto.notes}</p>
              )}
              
              {/* Delete button */}
              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDelete?.(selectedPhoto.id)
                    setSelectedIndex(null)
                  }}
                  className="mt-4"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}
              
              {/* Counter */}
              <p className="text-gray-600 text-sm mt-2">
                {selectedIndex + 1} / {photos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
