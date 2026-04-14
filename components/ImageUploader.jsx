'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Camera as CameraIcon, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export default function ImageUploader({ onImageSelect, onImageRemove, disabled }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleNativeCamera = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt // Preguntar al usuario: Cámara o Galería
      });

      if (image.webPath) {
        setPreview(image.webPath);
        
        // Convertir Uri a File objeto para compatibilidad con el resto de la app
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.${image.format}`, { type: blob.type });
        
        onImageSelect?.(file);
      }
    } catch (err) {
      console.error('Error al capturar imagen:', err);
      // No mostrar error si el usuario cancela
      if (err.message !== 'User cancelled photos app') {
        setError('No se pudo acceder a la cámara o galería');
      }
    }
  }

  const handleButtonClick = () => {
    if (Capacitor.isNativePlatform()) {
      handleNativeCamera();
    } else {
      fileInputRef.current?.click();
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP, GIF)')
      return
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen es muy grande. Máximo 5MB')
      return
    }

    // Crear preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target.result)
    }
    reader.readAsDataURL(file)

    onImageSelect?.(file)
  }

  const handleRemove = () => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onImageRemove?.()
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {!preview ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={disabled}
          className="w-full border-dashed border-[#2a2a2a] bg-black/30 hover:bg-black/50 text-gray-400 hover:text-violet-400 rounded-xl py-8"
        >
          <CameraIcon className="w-5 h-5 mr-2" />
          Añadir foto
        </Button>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-[#2a2a2a]">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-red-500"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </div>
  )
}
