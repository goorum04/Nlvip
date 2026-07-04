'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardCheck, Loader2, ChevronDown, ChevronUp, Check, X, MessageSquarePlus,
  Apple, Dumbbell, Camera as CameraIcon
} from 'lucide-react'
import { useSignedUrl } from '@/hooks/useStorage'
import { authFetch } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const MEASURE_LABELS = {
  weight_kg: 'Peso (kg)', neck_cm: 'Cuello (cm)', chest_cm: 'Pecho (cm)', waist_cm: 'Cintura (cm)',
  hips_cm: 'Cadera (cm)', arms_cm: 'Brazo (cm)', legs_cm: 'Muslo (cm)', glutes_cm: 'Glúteo (cm)', calves_cm: 'Gemelo (cm)',
}
const PHOTO_LABELS = { front: 'Frente', side: 'Lado', back: 'Espalda' }

function MeasurementDelta({ label, current, previous }) {
  if (current === null || current === undefined) return null
  const delta = (previous !== null && previous !== undefined) ? (current - previous) : null
  return (
    <div className="bg-black/30 rounded-xl px-3 py-2 border border-[#2a2a2a]">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-white font-bold">{current}</p>
        {delta !== null && delta !== 0 && (
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}

function DietDraftPreview({ content }) {
  return (
    <div className="bg-black/30 rounded-xl border border-[#2a2a2a] p-4 max-h-96 overflow-y-auto">
      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
    </div>
  )
}

function RoutineDraftPreview({ routine }) {
  if (!routine?.days) return null
  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {routine.days.map((day, i) => (
        <div key={i} className="bg-black/30 rounded-xl border border-[#2a2a2a] p-3">
          <p className="text-violet-400 font-bold text-sm mb-2">Día {day.day_number} — {day.day_name}</p>
          <div className="space-y-1">
            {(day.exercises || []).map((ex, j) => (
              <div key={j} className="flex justify-between text-xs text-gray-300">
                <span>{ex.exercise_name}</span>
                <span className="text-gray-500">{ex.sets}x{ex.reps} · {ex.rest_seconds}s</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PhotoCompare({ groupId, previousGroupId }) {
  const [newUrls, setNewUrls] = useState({})
  const [prevUrls, setPrevUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const { getSignedUrls } = useSignedUrl()

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const loadGroup = async (gid) => {
        if (!gid) return {}
        const { data: rows } = await supabase.from('progress_photos').select('photo_url, photo_type').eq('group_id', gid)
        if (!rows?.length) return {}
        const signed = await getSignedUrls('progress_photos', rows.map(r => r.photo_url), 3600)
        const map = {}
        for (const s of signed) {
          const row = rows.find(r => r.photo_url === s.path)
          if (row && s.url) map[row.photo_type] = s.url
        }
        return map
      }
      const [nu, pu] = await Promise.all([loadGroup(groupId), loadGroup(previousGroupId)])
      if (active) { setNewUrls(nu); setPrevUrls(pu); setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [groupId, previousGroupId])

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>

  return (
    <div className="grid grid-cols-3 gap-2">
      {['front', 'side', 'back'].map(type => (
        <div key={type} className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase text-center">{PHOTO_LABELS[type]}</p>
          <div className="grid grid-cols-2 gap-1">
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a]">
              {prevUrls[type] ? <img src={prevUrls[type]} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-600">Sin anterior</div>}
            </div>
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-[#1a1a1a] border border-violet-500/40">
              {newUrls[type] ? <img src={newUrls[type]} className="w-full h-full object-cover" /> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CheckInCard({ checkin, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [progressRecord, setProgressRecord] = useState(null)
  const [previousRecord, setPreviousRecord] = useState(null)
  const [correctionTarget, setCorrectionTarget] = useState(null) // 'diet' | 'routine' | null
  const [correction, setCorrection] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!expanded || progressRecord) return
    const load = async () => {
      const { data: pr } = await supabase.from('progress_records').select('*').eq('id', checkin.progress_record_id).maybeSingle()
      setProgressRecord(pr)
      if (pr) {
        const { data: prev } = await supabase
          .from('progress_records').select('*')
          .eq('member_id', checkin.member_id)
          .lt('date', pr.date)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
        setPreviousRecord(prev)
      }
    }
    load()
  }, [expanded])

  const memberName = checkin.member?.name || checkin.member?.email?.split('@')[0] || 'Socio'

  const handleApprove = async (approveDiet, approveRoutine) => {
    setBusy(true)
    try {
      const res = await authFetch('/api/checkin/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkinId: checkin.id, approveDiet, approveRoutine }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al aprobar')
      toast({ title: '✅ Revisión aprobada', description: data.message })
      onRefresh?.()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = async () => {
    if (!window.confirm(`¿Descartar la revisión de ${memberName}? No se tocará su dieta ni rutina.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('member_checkins').update({ status: 'dismissed' }).eq('id', checkin.id)
      if (error) throw error
      toast({ title: 'Revisión descartada' })
      onRefresh?.()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const handleSendCorrection = async () => {
    if (!correction.trim()) return
    setBusy(true)
    try {
      const res = await authFetch('/api/checkin/refine-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkinId: checkin.id, target: correctionTarget, correction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al ajustar')
      toast({ title: 'Ajuste aplicado' })
      setCorrection('')
      setCorrectionTarget(null)
      onRefresh?.()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-violet-500" />
              {memberName}
            </CardTitle>
            <CardDescription className="text-gray-500">
              {new Date(checkin.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              {checkin.status === 'failed' && <span className="text-red-400 ml-2">· Análisis falló</span>}
              {checkin.status === 'analyzing' && <span className="text-yellow-400 ml-2">· Analizando...</span>}
            </CardDescription>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-5">
          {progressRecord && (
            <div>
              <p className="text-white font-bold text-sm mb-2">Medidas</p>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(MEASURE_LABELS).map(([key, label]) => (
                  <MeasurementDelta key={key} label={label} current={progressRecord[key]} previous={previousRecord?.[key]} />
                ))}
              </div>
              {progressRecord.notes && <p className="text-gray-400 text-xs mt-2 italic">"{progressRecord.notes}"</p>}
            </div>
          )}

          <div>
            <p className="text-white font-bold text-sm mb-2 flex items-center gap-2"><CameraIcon className="w-4 h-4 text-violet-400" /> Fotos (anterior vs. nueva)</p>
            <PhotoCompare groupId={checkin.photo_group_id} previousGroupId={checkin.previous_photo_group_id} />
          </div>

          {checkin.photo_analysis && (
            <div className="bg-violet-500/5 border border-violet-400/20 rounded-xl p-3">
              <p className="text-[10px] text-violet-400 uppercase font-bold mb-1">Análisis IA de fotos</p>
              <p className="text-gray-300 text-xs whitespace-pre-wrap">{checkin.photo_analysis}</p>
            </div>
          )}

          {checkin.draft_diet_content && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-white font-bold text-sm flex items-center gap-2"><Apple className="w-4 h-4 text-violet-400" /> Dieta propuesta</p>
                <Badge variant="outline" className="text-[10px]">{checkin.draft_calories} kcal · P{checkin.draft_protein_g} HC{checkin.draft_carbs_g} G{checkin.draft_fat_g}</Badge>
              </div>
              {checkin.diet_change_summary && (
                <div className="bg-black/20 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap">{checkin.diet_change_summary}</div>
              )}
              <DietDraftPreview content={checkin.draft_diet_content} />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => handleApprove(true, false)} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">
                  <Check className="w-3.5 h-3.5 mr-1" /> Aprobar dieta
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setCorrectionTarget(correctionTarget === 'diet' ? null : 'diet')} className="rounded-xl">
                  <MessageSquarePlus className="w-3.5 h-3.5 mr-1" /> Pedir ajuste
                </Button>
              </div>
              {correctionTarget === 'diet' && (
                <div className="flex gap-2">
                  <Textarea value={correction} onChange={e => setCorrection(e.target.value)} placeholder="Ej: no le bajes tanto los carbos..." className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                  <Button disabled={busy} onClick={handleSendCorrection} className="rounded-xl shrink-0">Enviar</Button>
                </div>
              )}
            </div>
          )}

          {checkin.draft_routine_data && (
            <div className="space-y-2">
              <p className="text-white font-bold text-sm flex items-center gap-2"><Dumbbell className="w-4 h-4 text-violet-400" /> Rutina propuesta</p>
              {checkin.routine_change_summary && (
                <div className="bg-black/20 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap">{checkin.routine_change_summary}</div>
              )}
              <RoutineDraftPreview routine={checkin.draft_routine_data} />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => handleApprove(false, true)} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">
                  <Check className="w-3.5 h-3.5 mr-1" /> Aprobar rutina
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setCorrectionTarget(correctionTarget === 'routine' ? null : 'routine')} className="rounded-xl">
                  <MessageSquarePlus className="w-3.5 h-3.5 mr-1" /> Pedir ajuste
                </Button>
              </div>
              {correctionTarget === 'routine' && (
                <div className="flex gap-2">
                  <Textarea value={correction} onChange={e => setCorrection(e.target.value)} placeholder="Ej: quita el peso muerto, le sigue molestando la lumbar..." className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                  <Button disabled={busy} onClick={handleSendCorrection} className="rounded-xl shrink-0">Enviar</Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
            {checkin.draft_diet_content && checkin.draft_routine_data && (
              <Button size="sm" disabled={busy} onClick={() => handleApprove(true, true)} className="bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-xl">
                Aprobar todo
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={handleDismiss} className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl ml-auto">
              <X className="w-3.5 h-3.5 mr-1" /> Descartar revisión
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Panel de revisión para admin/entrenador: lista las revisiones pendientes
// (status='draft_ready' o 'analyzing'/'failed') y permite aprobar, pedir un
// ajuste o descartar la dieta y/o rutina propuestas para cada una.
export function CheckInReviewPanel({ checkins, onRefresh }) {
  if (!checkins || checkins.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardContent className="py-20 text-center">
          <ClipboardCheck className="w-16 h-16 mx-auto text-violet-500/20 mb-4" />
          <p className="text-gray-500">No hay revisiones pendientes</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {checkins.map(c => <CheckInCard key={c.id} checkin={c} onRefresh={onRefresh} />)}
    </div>
  )
}
