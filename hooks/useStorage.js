'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Hook para subir archivos con progreso
export function useFileUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const uploadFile = useCallback(async (bucket, path, file, options = {}) => {
    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Validar tamaño
      const maxSize = options.maxSize || 50 * 1024 * 1024 // 50MB default
      if (file.size > maxSize) {
        throw new Error(`El archivo es demasiado grande. Máximo ${Math.round(maxSize / 1024 / 1024)}MB`)
      }

      // Validar tipo
      if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
        throw new Error(`Tipo de archivo no permitido. Usa: ${options.allowedTypes.join(', ')}`)
      }

      // Simular progreso (Supabase no tiene progreso real en JS client)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: options.upsert || false
        })

      clearInterval(progressInterval)

      if (uploadError) throw uploadError

      setProgress(100)
      return { path: data.path, success: true }
    } catch (err) {
      setError(err.message)
      return { error: err.message, success: false }
    } finally {
      setUploading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  return { uploadFile, uploading, progress, error, reset }
}

// Hook para obtener signed URLs
export function useSignedUrl() {
  const [loading, setLoading] = useState(false)

  const getSignedUrl = useCallback(async (bucket, path, expiresIn = 3600) => {
    if (!path) return null
    
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

      if (error) throw error
      return data.signedUrl
    } catch (err) {
      console.error('Error getting signed URL:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getSignedUrls = useCallback(async (bucket, paths, expiresIn = 3600) => {
    if (!paths || paths.length === 0) return []
    
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, expiresIn)

      if (error) throw error
      return data.map(d => ({ path: d.path, url: d.signedUrl }))
    } catch (err) {
      console.error('Error getting signed URLs:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return { getSignedUrl, getSignedUrls, loading }
}

// Hook para validar duración de video
export function useVideoValidation() {
  const [validating, setValidating] = useState(false)
  const [duration, setDuration] = useState(null)

  const validateVideo = useCallback((file, maxDuration = 120) => {
    return new Promise((resolve, reject) => {
      setValidating(true)
      setDuration(null)

      const video = document.createElement('video')
      video.preload = 'metadata'

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        const dur = Math.round(video.duration)
        setDuration(dur)
        setValidating(false)

        if (dur > maxDuration) {
          reject(new Error(`El vídeo dura ${dur}s. Máximo permitido: ${maxDuration}s (2 minutos)`))
        } else {
          resolve({ duration: dur, valid: true })
        }
      }

      video.onerror = () => {
        setValidating(false)
        reject(new Error('No se pudo leer el vídeo. Asegúrate de que sea un archivo válido.'))
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  return { validateVideo, validating, duration }
}

// Generar UUID para nombres de archivo
export function generateFileId() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

// Obtener extensión de archivo
export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase()
}
