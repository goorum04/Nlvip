'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Video, X, Loader2, Upload, Clock, AlertCircle } from 'lucide-react'
import { useFileUpload, useVideoValidation, generateFileId, getFileExtension } from '@/hooks/useStorage'
import { supabase } from '@/lib/supabase'

export default function VideoUploader({ workoutTemplateId, uploaderId, onSuccess, onCancel }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState(null)
  const fileInputRef = useRef(null)

  const { uploadFile, uploading, progress, error: uploadError } = useFileUpload()
  const { validateVideo, validating, duration } = useVideoValidation()

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setValidationError(null)
    setFile(null)
    setPreview(null)

    // Validar tipo
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(selectedFile.type)) {
      setValidationError('Solo se permiten vídeos MP4, WebM o MOV')
      return
    }

    // Validar tamaño (50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setValidationError('El vídeo es muy grande. Máximo 50MB')
      return
    }

    // Validar duración
    try {
      await validateVideo(selectedFile, 120)
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
    } catch (err) {
      setValidationError(err.message)
    }
  }

  const handleUpload = async () => {
    if (!file || !title.trim()) return

    // Generar path único
    const fileId = generateFileId()
    const ext = getFileExtension(file.name)
    const path = `workouts/${workoutTemplateId}/${fileId}.${ext}`

    // Subir a storage
    const result = await uploadFile('workout_videos', path, file, {
      maxSize: 50 * 1024 * 1024,
      allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime']
    })

    if (!result.success) return

    // Guardar en base de datos
    const { error: dbError } = await supabase.from('workout_videos').insert({
      workout_template_id: workoutTemplateId,
      uploaded_by: uploaderId,
      video_path: path,
      duration_seconds: duration,
      title: title.trim(),
      description: description.trim() || null
    })

    if (dbError) {
      setValidationError('Error guardando el vídeo: ' + dbError.message)
      return
    }

    onSuccess?.()
  }

  const handleRemove = () => {
    setFile(null)
    setPreview(null)
    setValidationError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4 p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Video className="w-5 h-5 text-[#C9A24D]" />
          Subir Vídeo
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
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading || validating}
      />

      {!file ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || validating}
          className="w-full border-dashed border-[#2a2a2a] bg-black/30 hover:bg-black/50 text-gray-400 hover:text-[#C9A24D] rounded-xl py-12"
        >
          {validating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Validando duración...
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 mr-2" />
              <div className="text-left">
                <p>Seleccionar vídeo</p>
                <p className="text-xs text-gray-500">MP4, WebM, MOV · Máx 2 min · Máx 50MB</p>
              </div>
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          {/* Video preview */}
          <div className="relative rounded-xl overflow-hidden border border-[#2a2a2a]">
            <video
              src={preview}
              controls
              className="w-full max-h-48 bg-black"
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
            {duration && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Form fields */}
          <div>
            <Label className="text-gray-400 text-sm">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Técnica de Press Banca"
              className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
              disabled={uploading}
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explica qué se ve en el vídeo..."
              className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1 min-h-[80px]"
              disabled={uploading}
            />
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Subiendo...</span>
                <span className="text-[#C9A24D]">{progress}%</span>
              </div>
              <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || !title.trim()}
            className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-xl py-6"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Subir Vídeo
              </>
            )}
          </Button>
        </div>
      )}

      {/* Errors */}
      {(validationError || uploadError) && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{validationError || uploadError}</p>
        </div>
      )}
    </div>
  )
}
