'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, FileText, LoaderCircle as Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { ProgressPhotoGallery } from './ProgressPhotos'

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

// Los datos más críticos para hacer bien la dieta (edad, medidas, lesión...)
// quedaban enterrados en medio de ~20 claves sueltas sin orden, con nombres
// crípticos — fáciles de pasar por alto al revisar el cuestionario. Los
// subimos arriba con etiquetas claras; el resto sigue debajo tal cual.
const PRIORITY_FIELDS = [
  ['Medida - Edad', 'Edad'],
  ['Medida - Peso', 'Peso (kg)'],
  ['Medida - Altura', 'Altura (cm)'],
  ['objetivo', 'Objetivo'],
  ['preferencias', 'Preferencias alimentarias'],
  ['favoritos', 'Alimentos favoritos'],
  ['no_me_gusta', 'Alimentos que NO quiere'],
  ['lesion', 'Lesión / molestia al hacer ejercicio'],
  ['condicion_medica', 'Condición médica'],
  ['restricciones', 'Alergias / intolerancias'],
]

const sortResponseEntries = (entries) => {
  const map = new Map(entries)
  const prioritized = []
  for (const [key, label] of PRIORITY_FIELDS) {
    if (map.has(key)) {
      prioritized.push([key, map.get(key), label])
      map.delete(key)
    }
  }
  const rest = entries.filter(([key]) => map.has(key))
  return { prioritized, rest }
}

// Solo cuestionario nutricional. Para usar en el tab Fotos de Progreso
// donde las fotos ya se muestran por separado.
export function MemberOnboardingResponses({ memberId, defaultOpen = false }) {
  const [onboarding, setOnboarding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('diet_onboarding_requests')
        .select('responses, status, created_at')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      setOnboarding(data || null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  return (
    <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(o => !o)}>
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
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </CardTitle>
      </CardHeader>
      {open && (
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
              {(() => {
                const { prioritized, rest } = sortResponseEntries(flattenResponses(onboarding.responses))
                return (
                  <>
                    {prioritized.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                        {prioritized.map(([key, value, label]) => (
                          <div key={key}>
                            <p className="text-[10px] text-violet-300 uppercase font-bold tracking-wider">{label}</p>
                            <p className="text-sm text-white mt-0.5 break-words">{formatValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {rest.map(([key, value]) => (
                        <div key={key} className="border-b border-white/5 pb-2">
                          <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider">{formatLabel(key)}</p>
                          <p className="text-sm text-gray-200 mt-1 break-words">{formatValue(value)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

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
                {(() => {
                  const { prioritized, rest } = sortResponseEntries(flattenResponses(onboarding.responses))
                  return (
                    <>
                      {prioritized.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                          {prioritized.map(([key, value, label]) => (
                            <div key={key}>
                              <p className="text-[10px] text-violet-300 uppercase font-bold tracking-wider">{label}</p>
                              <p className="text-sm text-white mt-0.5 break-words">{formatValue(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        {rest.map(([key, value]) => (
                          <div key={key} className="border-b border-white/5 pb-2">
                            <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider">{formatLabel(key)}</p>
                            <p className="text-sm text-gray-200 mt-1 break-words">{formatValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default MemberPhotosAndForm
