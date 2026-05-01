'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sparkles, LoaderCircle as Loader2, ChevronDown, ChevronUp, Save, RefreshCw, Settings2, User, Target, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const EQUIPMENT_OPTIONS = [
  { value: 'cable', label: 'Cable / Polea' },
  { value: 'máquina', label: 'Máquinas' },
  { value: 'mancuernas', label: 'Mancuernas' },
  { value: 'multipower', label: 'Multipower / Smith' },
  { value: 'barra', label: 'Barra libre' },
  { value: 'peso_libre', label: 'Peso libre (discos)' },
  { value: 'peso_corporal', label: 'Peso corporal' },
]

const GOAL_FROM_ONBOARDING = {
  perder_grasa: 'definición',
  mantenimiento: 'hipertrofia',
  ganar_masa: 'hipertrofia'
}

const ONBOARDING_GOAL_LABEL = {
  perder_grasa: 'Perder grasa',
  mantenimiento: 'Mantenimiento',
  ganar_masa: 'Ganar masa'
}

const SUPERSET_TAG_RE = /^\[(bi-serie|tri-serie):(\d+)\]\s*/i

const INJURY_REASON_LABEL = {
  shoulder: 'lesión de hombro',
  knee: 'lesión de rodilla',
  lumbar: 'lesión lumbar',
  elbow: 'lesión de codo',
  wrist: 'lesión de muñeca'
}

function formatInjuryReason(reason) {
  if (!reason || typeof reason !== 'string' || !reason.startsWith('injury:')) return null
  const zones = reason.slice('injury:'.length).split(',').filter(Boolean)
  const labels = zones.map(z => INJURY_REASON_LABEL[z] || z).filter(Boolean)
  if (labels.length === 0) return null
  return `reemplazado por ${labels.join(' y ')} detectada en las notas`
}

function parseExerciseGroup(ex) {
  if (typeof ex.superset_group === 'number' && ex.superset_group > 0) {
    return ex.superset_group
  }
  const desc = ex.notes || ex.description || ''
  const m = desc.match(SUPERSET_TAG_RE)
  return m ? parseInt(m[2], 10) : 0
}

function stripGroupTag(text) {
  if (!text) return text
  return text.replace(SUPERSET_TAG_RE, '').trim()
}

function RoutinePreview({ routine }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))

  const renderExerciseRows = (exercises) => {
    if (!exercises?.length) return null
    const groups = []
    let currentGroup = null
    exercises.forEach((ex, j) => {
      const g = parseExerciseGroup(ex)
      if (g && currentGroup && currentGroup.id === g) {
        currentGroup.items.push({ ex, idx: j })
      } else if (g) {
        currentGroup = { id: g, items: [{ ex, idx: j }] }
        groups.push(currentGroup)
      } else {
        groups.push({ id: 0, items: [{ ex, idx: j }] })
        currentGroup = null
      }
    })

    return groups.map((grp, gi) => {
      const size = grp.items.length
      const isSuperset = grp.id > 0 && size >= 2
      const label = size >= 3 ? 'Tri-serie' : 'Bi-serie'
      const wrapperCls = isSuperset
        ? 'border border-amber-500/40 bg-amber-500/5 rounded-xl p-2 space-y-2'
        : 'space-y-2'
      return (
        <div key={gi} className={wrapperCls}>
          {isSuperset && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] uppercase tracking-wide font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                {label}
              </span>
              <span className="text-xs text-amber-200/70">{size} ejercicios encadenados</span>
            </div>
          )}
          {grp.items.map(({ ex, idx }) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
              <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold">
                {idx + 1}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{ex.exercise_name}</p>
                <p className="text-xs text-gray-500">{ex.sets}×{ex.reps} · {ex.rest_seconds}s descanso</p>
                {stripGroupTag(ex.notes) && (
                  <p className="text-xs text-violet-400 mt-0.5">{stripGroupTag(ex.notes)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    })
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-violet-500/20 to-cyan-500/10 rounded-2xl p-4 border border-violet-500/20">
        <h3 className="text-white font-bold text-lg">{routine.routine_name}</h3>
        <p className="text-gray-400 text-sm mt-1">{routine.routine_description}</p>
        <p className="text-violet-400 text-xs mt-2">{routine.days?.length} días de entrenamiento</p>
      </div>

      {routine.days?.map((day, i) => (
        <Card key={i} className="bg-[#1a1a1a] border-violet-500/20 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle(i)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold text-sm">
                {day.day_number}
              </div>
              <h4 className="flex-1 text-white font-semibold text-sm">{day.day_name}</h4>
              <span className="text-xs text-gray-500 mr-1">{day.exercises?.length} ejercicios</span>
              {expanded[i] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </CardHeader>
          {expanded[i] && (
            <CardContent className="pt-0 space-y-2">
              {renderExerciseRows(day.exercises)}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}

export default function AIRoutineGenerator({ open, onClose, trainerId, onRoutineSaved }) {
  const [step, setStep] = useState('form') // 'form' | 'loading' | 'preview'
  const [generatedRoutine, setGeneratedRoutine] = useState(null)
  const [savedTemplateId, setSavedTemplateId] = useState(null)
  const [replacedInfo, setReplacedInfo] = useState([])
  const { toast } = useToast()

  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState('')
  const [memberSummary, setMemberSummary] = useState(null) // { name, sex, goal, conditions }
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberConditions, setMemberConditions] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [criteria, setCriteria] = useState({
    days_per_week: '4',
    goal: 'hipertrofia',
    level: 'intermedio',
    equipment: EQUIPMENT_OPTIONS.map(e => e.value),
    session_duration_min: '60',
    notes: '',
    allow_supersets: true
  })

  // Load members on open
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, sex, role')
        .eq('role', 'member')
        .order('name')
      if (!cancelled && data) setMembers(data)
    })()
    return () => { cancelled = true }
  }, [open])

  // Auto-load member context when memberId changes
  useEffect(() => {
    if (!memberId || memberId === '__none__') { setMemberSummary(null); setMemberConditions(''); return }
    let cancelled = false
    setMemberLoading(true)
    ;(async () => {
      const member = members.find(m => m.id === memberId)
      const { data: onboarding } = await supabase
        .from('diet_onboarding_requests')
        .select('responses')
        .eq('member_id', memberId)
        .in('status', ['completed', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      const responses = onboarding?.responses || null
      const goal = responses?.objetivo || null
      const conditions = responses?.extras?.condicion_medica || ''
      setMemberSummary({
        name: member?.name || 'Socio',
        sex: member?.sex || null,
        rawGoal: goal,
        goal: goal ? (GOAL_FROM_ONBOARDING[goal] || 'hipertrofia') : null,
        conditions
      })
      setMemberConditions(conditions || '')
      setCriteria(prev => ({
        ...prev,
        goal: goal ? (GOAL_FROM_ONBOARDING[goal] || prev.goal) : prev.goal
      }))
      setMemberLoading(false)
    })()
    return () => { cancelled = true }
  }, [memberId, members])

  const toggleEquipment = (value) => {
    setCriteria(prev => ({
      ...prev,
      equipment: prev.equipment.includes(value)
        ? prev.equipment.filter(e => e !== value)
        : [...prev.equipment, value]
    }))
  }

  const generate = async () => {
    if (criteria.equipment.length === 0) {
      toast({ title: 'Error', description: 'Selecciona al menos un tipo de equipamiento', variant: 'destructive' })
      return
    }

    setStep('loading')
    try {
      const trainerNotes = (criteria.notes || '').trim()
      const memberNotes = memberConditions
        ? `Consideraciones del socio: ${memberConditions}`
        : ''
      const mergedNotes = [memberNotes, trainerNotes].filter(Boolean).join('\n').slice(0, 500)

      const res = await authFetch('/api/generate-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainerId,
          member_id: (memberId && memberId !== '__none__') ? memberId : null,
          criteria: {
            ...criteria,
            notes: mergedNotes,
            days_per_week: parseInt(criteria.days_per_week),
            session_duration_min: parseInt(criteria.session_duration_min)
          }
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar la rutina')
      }

      setGeneratedRoutine(data.preview)
      setSavedTemplateId(data.workout_template_id)
      setReplacedInfo(Array.isArray(data.replaced) ? data.replaced : [])
      setStep('preview')
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      setStep('form')
    }
  }

  const handleClose = () => {
    setStep('form')
    setGeneratedRoutine(null)
    setSavedTemplateId(null)
    setReplacedInfo([])
    setMemberId('')
    setMemberSummary(null)
    setShowAdvanced(false)
    onClose()
  }

  const handleSaved = () => {
    toast({ title: '¡Rutina guardada!', description: 'Ya aparece en tu lista de rutinas.' })
    onRoutineSaved?.()
    handleClose()
  }

  const isFemale = memberSummary?.sex === 'female'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-violet-500/20 rounded-2xl max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-white/5">
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Generar Rutina con IA
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">

          {/* PASO: FORMULARIO */}
          {step === 'form' && (
            <div className="space-y-4">
              {/* Selector de socio (paso 1, único campo obligatorio) */}
              <div>
                <Label className="text-gray-400 text-sm">Generar para socio</Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1">
                    <SelectValue placeholder="Selecciona un socio o deja en blanco para genérica" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-violet-500/20 max-h-72">
                    <SelectItem value="__none__" className="text-white">
                      Sin socio (rutina genérica)
                    </SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-white">
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resumen autocalculado del socio */}
              {memberId && memberId !== '__none__' && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4 space-y-2">
                  {memberLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos del socio…
                    </div>
                  ) : memberSummary ? (
                    <>
                      <div className="flex items-center gap-2 text-white text-sm font-semibold">
                        <User className="w-4 h-4 text-violet-300" /> {memberSummary.name}
                        <span className="text-xs text-gray-400 font-normal">
                          {memberSummary.sex === 'male' ? 'Hombre' : memberSummary.sex === 'female' ? 'Mujer' : 'Sexo no especificado'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <Target className="w-3.5 h-3.5 text-cyan-400 mt-0.5" />
                        <span>
                          <span className="text-gray-500">Objetivo: </span>
                          {memberSummary.rawGoal ? `${ONBOARDING_GOAL_LABEL[memberSummary.rawGoal] || memberSummary.rawGoal} → ${memberSummary.goal}` : 'No registrado en onboarding'}
                        </span>
                      </div>
                      {memberSummary.conditions ? (
                        <div className="flex items-start gap-2 text-xs text-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5" />
                          <span>
                            <span className="text-gray-500">Consideraciones: </span>
                            {memberSummary.conditions}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 pl-5">Sin lesiones / condiciones registradas.</div>
                      )}
                      {isFemale && (
                        <div className="text-xs text-pink-300 pl-5 italic">No se incluirán ejercicios de pecho.</div>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {/* Botón principal */}
              <Button
                onClick={generate}
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl py-6 mt-2"
              >
                <Sparkles className="w-5 h-5 mr-2" /> Generar Rutina
              </Button>

              {/* Colapsable: ajustar parámetros */}
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-violet-300 transition-colors py-2 px-1"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  Ajustar parámetros (opcional)
                </span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400 text-sm">Días por semana</Label>
                      <Select value={criteria.days_per_week} onValueChange={v => setCriteria(p => ({ ...p, days_per_week: v }))}>
                        <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-violet-500/20">
                          {[2, 3, 4, 5, 6].map(n => (
                            <SelectItem key={n} value={String(n)} className="text-white">{n} días</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Duración sesión (min)</Label>
                      <Input
                        type="number"
                        value={criteria.session_duration_min}
                        onChange={e => setCriteria(p => ({ ...p, session_duration_min: e.target.value }))}
                        className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
                        min={30} max={120}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-400 text-sm">Objetivo</Label>
                    <Select value={criteria.goal} onValueChange={v => setCriteria(p => ({ ...p, goal: v }))}>
                      <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-violet-500/20">
                        <SelectItem value="hipertrofia" className="text-white">Hipertrofia (volumen muscular)</SelectItem>
                        <SelectItem value="fuerza" className="text-white">Fuerza</SelectItem>
                        <SelectItem value="definición" className="text-white">Definición / tonificación</SelectItem>
                        <SelectItem value="resistencia" className="text-white">Resistencia muscular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-gray-400 text-sm">Nivel</Label>
                    <Select value={criteria.level} onValueChange={v => setCriteria(p => ({ ...p, level: v }))}>
                      <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-violet-500/20">
                        <SelectItem value="principiante" className="text-white">Principiante</SelectItem>
                        <SelectItem value="intermedio" className="text-white">Intermedio</SelectItem>
                        <SelectItem value="avanzado" className="text-white">Avanzado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-gray-400 text-sm mb-2 block">Equipamiento disponible</Label>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleEquipment(opt.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            criteria.equipment.includes(opt.value)
                              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                              : 'bg-black/30 border-white/10 text-gray-500 hover:border-violet-500/30'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-400 text-sm">Notas adicionales (opcional)</Label>
                    <Textarea
                      value={criteria.notes}
                      onChange={e => setCriteria(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Ej: molestia en hombro derecho, evitar sentadilla, rutina para mujer..."
                      className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1 text-sm min-h-[70px]"
                    />
                    {memberConditions && (
                      <p className="text-xs text-cyan-400/80 mt-1">
                        Se añadirán automáticamente las consideraciones del socio: "{memberConditions}"
                      </p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criteria.allow_supersets}
                      onChange={e => setCriteria(p => ({ ...p, allow_supersets: e.target.checked }))}
                      className="rounded border-violet-500/40 bg-black/50"
                    />
                    Permitir bi-series / tri-series cuando convenga
                  </label>
                </div>
              )}
            </div>
          )}

          {/* PASO: GENERANDO */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Generando rutina...</p>
                <p className="text-gray-500 text-sm mt-1">La IA está diseñando tu programa</p>
              </div>
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          )}

          {/* PASO: PREVIEW */}
          {step === 'preview' && generatedRoutine && (
            <div className="space-y-4">
              <RoutinePreview routine={generatedRoutine} />

              {replacedInfo.length > 0 && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ajustes automáticos al catálogo
                  </div>
                  <ul className="space-y-0.5 list-disc pl-4">
                    {replacedInfo.slice(0, 5).map((r, i) => {
                      const reasonText = formatInjuryReason(r.reason)
                      return (
                        <li key={i}>
                          {r.dropped
                            ? `"${r.original}" descartado (sin equivalente en catálogo)`
                            : `"${r.original}" → "${r.replacement}"`}
                          {reasonText && (
                            <span className="text-cyan-300/80"> · {reasonText}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  className="flex-1 border-gray-600 text-gray-400 hover:bg-gray-800 rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerar
                </Button>
                <Button
                  onClick={handleSaved}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl"
                >
                  <Save className="w-4 h-4 mr-2" /> Usar esta Rutina
                </Button>
              </div>

              <p className="text-center text-xs text-gray-600 pt-1">
                Las rutinas generadas tienen carácter orientativo. Consulta con un profesional antes de iniciar cualquier programa de entrenamiento.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
