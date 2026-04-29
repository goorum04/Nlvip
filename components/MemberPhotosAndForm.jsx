'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, FileText, LoaderCircle as Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { ProgressPhotoGallery } from './ProgressPhotos'

// Vista consolidada por socio: fotos de progreso + cuestionario nutricional
// (último diet_onboarding_request del socio). Reutilizable desde Admin y Trainer
// para que ambos vean la misma información en el mismo sitio.
export function MemberPhotosAndForm({ memberId, canDeletePhotos = false, defaultOpen = false }) {
  const [photos, setPhotos] = useState([])
  const [onboarding, setOnboarding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [photosOpen, setPhotosOpen] = useState(defaultOpen)
  const [formOpen, setFormOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [{ data: photoRows }, { data: reqRow }] = await Promise.all([
        supabase
          .from('progress_photos')
          .select('*')
          .eq('member_id', memberId)
          .order('date', { ascending: false }),
        supabase
          .from('diet_onboarding_requests')
          .select('responses, status, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return
      setPhotos(photoRows || [])
      setOnboarding(reqRow || null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  const formatLabel = (key) => {
    if (!key) return ''
    return key
      .replace(/^extras\./, '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'object') {
      try { return JSON.stringify(value) } catch { return String(value) }
    }
    return String(value)
  }

  const flattenResponses = (responses) => {
    if (!responses || typeof responses !== 'object') return []
    const out = []
    for (const [k, v] of Object.entries(responses)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) {
          out.push([`${k}.${k2}`, v2])
        }
      } else {
        out.push([k, v])
      }
    }
    return out
  }

  return (
    <div className="space-y-4">
      {/* Fotos de progreso */}
      <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setPhotosOpen(o => !o)}>
          <CardTitle className="text-white text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-violet-400" />
              Fotos de progreso
              <span className="text-xs text-gray-500 font-normal">({photos.length})</span>
            </span>
            {photosOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </CardTitle>
        </CardHeader>
        {photosOpen && (
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            ) : (
              <ProgressPhotoGallery photos={photos} canDelete={canDeletePhotos} />
            )}
          </CardContent>
        )}
      </Card>

      {/* Cuestionario nutricional */}
      <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setFormOpen(o => !o)}>
          <CardTitle className="text-white text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-400" />
              Cuestionario nutricional
              {onboarding?.status && (
                <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                  onboarding.status === 'completed' || onboarding.status === 'reviewed'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {onboarding.status}
                </span>
              )}
            </span>
            {formOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </CardTitle>
        </CardHeader>
        {formOpen && (
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            ) : !onboarding?.responses ? (
              <p className="text-gray-500 text-sm">Este socio aún no ha rellenado el cuestionario nutricional.</p>
            ) : (
              <div className="space-y-3">
                {onboarding.created_at && (
                  <p className="text-[11px] text-gray-500">
                    Enviado: {new Date(onboarding.created_at).toLocaleString()}
                  </p>
                )}
                <div className="space-y-2">
                  {flattenResponses(onboarding.responses).map(([key, value]) => (
                    <div key={key} className="border-b border-white/5 pb-2">
                      <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider">{formatLabel(key)}</p>
                      <p className="text-sm text-gray-200 mt-1 break-words">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default MemberPhotosAndForm
