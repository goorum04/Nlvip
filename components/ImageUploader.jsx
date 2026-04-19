'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Camera as CameraIcon, X, LoaderCircle as Loader2, Image as ImageIcon } from 'lucide-react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export default function ImageUploader({ onImageSelect, onImageRemove, disabled }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const base64ToBlob = (base64, mime) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  const handleNativeCamera = async () => {
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
        const fileName = `photo_${Date.now()}.${image.format}`;
        const file = new File([blob], fileName, { type: mimeType });
        
        setPreview(`data:${mimeType};base64,${image.base64String}`);
        onImageSelect?.(file);
      }
    } catch (err) {
      console.error('Error al capturar imagen:', err);
      // No mostrar error si el usuario cancela
      if (err.message?.includes('cancelled')) {
        return;
      }
      setError(`Error: ${err.message || 'No se pudo acceder a la cámara o galería'}`);
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
