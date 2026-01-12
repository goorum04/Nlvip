'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Clock, Loader2, Video, X } from 'lucide-react'
import { useSignedUrl } from '@/hooks/useStorage'

export default function VideoPlayer({ video, onClose }) {
  const [videoUrl, setVideoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { getSignedUrl } = useSignedUrl()

  useEffect(() => {
    loadVideo()
  }, [video])

  const loadVideo = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const url = await getSignedUrl('workout_videos', video.video_path, 3600)
      if (!url) {
        throw new Error('No se pudo cargar el vídeo')
      }
      setVideoUrl(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#1a1a1a] rounded-3xl overflow-hidden border border-[#2a2a2a]">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{video.title}</h3>
            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
              <Clock className="w-4 h-4" />
              {formatDuration(video.duration_seconds)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-xl"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Video */}
        <div className="relative aspect-video bg-black">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center text-center p-4">
              <div>
                <Video className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">{error}</p>
                <Button
                  variant="outline"
                  onClick={loadVideo}
                  className="mt-4 border-violet-500 text-violet-400"
                >
                  Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              controlsList="nodownload"
            />
          )}
        </div>

        {/* Description */}
        {video.description && (
          <div className="p-4 border-t border-[#2a2a2a]">
            <p className="text-gray-400 text-sm">{video.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente para lista de vídeos en tarjetas
export function VideoCard({ video, onClick }) {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-black/30 rounded-2xl border border-[#2a2a2a] hover:border-violet-500/30 transition-all overflow-hidden group"
    >
      <div className="aspect-video bg-gradient-to-br from-violet-500/20 to-black flex items-center justify-center relative">
        <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-gradient-to-r from-violet-600 to-cyan-600 transition-colors">
          <Play className="w-8 h-8 text-white ml-1" />
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(video.duration_seconds)}
        </div>
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-white text-sm line-clamp-1">{video.title}</h4>
        {video.description && (
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{video.description}</p>
        )}
      </div>
    </button>
  )
}
