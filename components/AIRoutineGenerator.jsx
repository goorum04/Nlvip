'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sparkles, LoaderCircle as Loader2, ChevronDown, ChevronUp, Save, RefreshCw, Settings2, User, Target, AlertTriangle, Trash2, ArrowUp, ArrowDown, Plus, Link2, Link2Off } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import ExerciseCatalogPicker from './ExerciseCatalogPicker'

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

function nextSupersetId(routine) {
  let max = 0
  for (const day of routine.days || []) {
    for (const ex of day.exercises || []) {
      const g = parseExerciseGroup(ex)
      if (g > max) max = g
    }
  }
  return max + 1
}

function EditableExerciseRow({
  exercise, idx, dayIdx, total, excludeOnlyMale, prevHasGroup, isInGroup,
  onUpdate, onSwap, onRemove, onMove, onToggleSuperset
}) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-black/30 rounded-xl border border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold shrink-0">
          {idx + 1}
        </div>
        <p className="flex-1 text-white text-sm font-medium leading-tight">{exercise.exercise_name}</p>
        <ExerciseCatalogPicker
          excludeOnlyMale={excludeOnlyMale}
          triggerLabel="Cambiar"
          triggerClassName="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 rounded-lg whitespace-nowrap px-2 h-7 text-xs"
          onSelect={(catalogEx) => onSwap(dayIdx, idx, catalogEx)}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 pl-8">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase">Series</span>
          <Input
            type="number"
            min={1}
            max={20}
            value={exercise.sets ?? ''}
            onChange={e => onUpdate(dayIdx, idx, { sets: parseInt(e.target.value) || 1 })}
            className="h-8 bg-black/50 border-violet-500/20 rounded-lg text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase">Reps</span>
          <Input
            type="text"
            value={exercise.reps ?? ''}
            onChange={e => onUpdate(dayIdx, idx, { reps: e.target.value })}
            placeholder="8-12"
            className="h-8 bg-black/50 border-violet-500/20 rounded-lg text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase">Descanso (s)</span>
          <Input
            type="number"
            min={0}
            max={600}
            value={exercise.rest_seconds ?? ''}
            onChange={e => onUpdate(dayIdx, idx, { rest_seconds: parseInt(e.target.value) || 0 })}
            className="h-8 bg-black/50 border-violet-500/20 rounded-lg text-white text-sm"
          />
        </label>
      </div>

      <div className="flex items-center justify-between pl-8 gap-2">
        {idx > 0 ? (
          <button
            type="button"
            onClick={() => onToggleSuperset(dayIdx, idx)}
            className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border transition-all ${
              isInGroup
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-black/30 border-white/10 text-gray-400 hover:border-amber-500/30'
            }`}
          >
            {isInGroup ? <Link2Off className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
            {isInGroup ? 'Separar serie' : 'Encadenar con anterior'}
          </button>
        ) : (
          <span className="text-[11px] text-gray-600 italic">Primer ejercicio</span>
        )}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={idx === 0}
            onClick={() => onMove(dayIdx, idx, -1)}
            className="h-7 w-7 text-gray-400 hover:text-violet-300 disabled:opacity-30"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={idx === total - 1}
            onClick={() => onMove(dayIdx, idx, 1)}
            className="h-7 w-7 text-gray-400 hover:text-violet-300 disabled:opacity-30"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onRemove(dayIdx, idx)}
            className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function RoutinePreview({
  routine, excludeOnlyMale,
  onRoutineFieldChange, onUpdateExercise, onSwapExercise, onRemoveExercise,
  onMoveExercise, onToggleSuperset, onAddExercise, onUpdateDayName
}) {
  const [expanded, setExpanded] = useState({ 0: true })
  const toggle = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))

  const renderExerciseRows = (exercises, dayIdx) => {
    if (!exercises?.length) return <p className="text-xs text-gray-500 italic px-1">Sin ejercicios. Añade uno con el botón inferior.</p>
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
          {grp.items.map(({ ex, idx }) => {
            const prevEx = idx > 0 ? exercises[idx - 1] : null
            const prevGroup = prevEx ? parseExerciseGroup(prevEx) : 0
            const myGroup = parseExerciseGroup(ex)
            const isInGroup = myGroup > 0 && prevGroup === myGroup
            return (
              <EditableExerciseRow
                key={idx}
                exercise={ex}
                idx={idx}
                dayIdx={dayIdx}
                total={exercises.length}
                excludeOnlyMale={excludeOnlyMale}
                prevHasGroup={prevGroup > 0}
                isInGroup={isInGroup}
                onUpdate={onUpdateExercise}
                onSwap={onSwapExercise}
                onRemove={onRemoveExercise}
                onMove={onMoveExercise}
                onToggleSuperset={onToggleSuperset}
              />
            )
          })}
        </div>
      )
    })
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-violet-500/20 to-cyan-500/10 rounded-2xl p-4 border border-violet-500/20 space-y-2">
        <Input
          value={routine.routine_name || ''}
          onChange={e => onRoutineFieldChange('routine_name', e.target.value)}
          className="bg-black/30 border-violet-500/20 rounded-lg text-white font-bold text-base"
          placeholder="Nombre de la rutina"
        />
        <Textarea
          value={routine.routine_description || ''}
          onChange={e => onRoutineFieldChange('routine_description', e.target.value)}
          rows={2}
          className="bg-black/30 border-violet-500/20 rounded-lg text-gray-300 text-sm resize-none"
          placeholder="Descripción breve"
        />
        <p className="text-violet-400 text-xs">{routine.days?.length} días de entrenamiento · editable</p>
      </div>

      {routine.days?.map((day, i) => (
        <Card key={i} className="bg-[#1a1a1a] border-violet-500/20 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle(i)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold text-sm shrink-0">
                {day.day_number}
              </div>
              <Input
                value={day.day_name}
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdateDayName(i, e.target.value)}
                className="flex-1 h-8 bg-transparent border-transparent hover:border-violet-500/20 focus:border-violet-500/40 text-white font-semibold text-sm rounded-lg px-2"
              />
              <span className="text-xs text-gray-500 mr-1">{day.exercises?.length}</span>
              {expanded[i] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </CardHeader>
          {expanded[i] && (
            <CardContent className="pt-0 space-y-2">
              {renderExerciseRows(day.exercises, i)}
              <div className="flex justify-center pt-1">
                <ExerciseCatalogPicker
                  excludeOnlyMale={excludeOnlyMale}
                  triggerLabel="Añadir ejercicio"
                  triggerClassName="border-dashed border-violet-500/30 text-violet-300 hover:bg-violet-500/10 rounded-xl px-3"
                  onSelect={(catalogEx) => onAddExercise(i, catalogEx)}
                />
              </div>
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
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState('')
  const [memberSummary, setMemberSummary] = useState(null) // { name, sex, goal, conditions }
  const [memberLoading, setMemberLoading] = useState(false)
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
    if (!memberId || memberId === '__none__') { setMemberSummary(null); return }
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
      setCriteria(prev => ({
        ...prev,
        goal: goal ? (GOAL_FROM_ONBOARDING[goal] || prev.goal) : prev.goal,
        notes: conditions ? `Consideraciones del socio: ${conditions}` : prev.notes
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
      const res = await authFetch('/api/generate-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainerId,
          member_id: (memberId && memberId !== '__none__') ? memberId : null,
          criteria: {
            ...criteria,
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
    setSaving(false)
    onClose()
  }

  const updateRoutineField = (field, value) => {
    setGeneratedRoutine(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const updateDayName = (dayIdx, name) => {
    setGeneratedRoutine(prev => {
      if (!prev) return prev
      const days = prev.days.map((d, i) => i === dayIdx ? { ...d, day_name: name } : d)
      return { ...prev, days }
    })
  }

  const updateExercise = (dayIdx, exIdx, patch) => {
    setGeneratedRoutine(prev => {
      if (!prev) return prev
      const days = prev.days.map((d, i) => {
        if (i !== dayIdx) return d
        const exercises = d.exercises.map((ex, j) => j === exIdx ? { ...ex, ...patch } : ex)
        return { ...d, exercises }
      })
      return { ...prev, days }
    })
  }

  const swapExercise = (dayIdx, exIdx, catalogEx) => {
    updateExercise(dayIdx, exIdx, { exercise_name: catalogEx.name })
  }

  const removeExercise = (dayIdx, exIdx) => {
    setGeneratedRoutine(prev => {
      if (!prev) return prev
      const days = prev.days.map((d, i) => {
        if (i !== dayIdx) return d
        const exercises = d.exercises.filter((_, j) => j !== exIdx)
        return { ...d, exercises }
      })
      return { ...prev, days }
    })
  }

  const moveExercise = (dayIdx, exIdx, dir) => {
    setGeneratedRoutine(prev => {
      if (!prev) return prev
      const days = prev.days.map((d, i) => {
        if (i !== dayIdx) return d
        const exercises = [...d.exercises]
        const target = exIdx + dir
        if (target < 0 || target >= exercises.length) return d
        ;[exercises[exIdx], exercises[target]] = [exercises[target], exercises[exIdx]]
        return { ...d, exercises }
      })
      return { ...prev, days }
    })
  }

  const addExercise = (dayIdx, catalogEx) => {
    setGeneratedRoutine(prev => {
      if (!prev) return prev
      const newEx = {
        exercise_name: catalogEx.name,
        sets: catalogEx.default_sets || 4,
        reps: String(catalogEx.default_reps || '10-12'),
        rest_seconds: catalogEx.default_rest_seconds || 90,
        superset_group: 0,
        notes: ''
      }
      const days = prev.days.map((d, i) => {
        if (i !== dayIdx) return d
        return { ...d, exercises: [...d.exercises, newEx] }
      })
      return { ...prev, days }
    })
  }

  const toggleSuperset = (dayIdx, exIdx) => {
    setGeneratedRoutine(prev => {
      if (!prev || exIdx === 0) return prev
      const days = prev.days.map((d, i) => {
        if (i !== dayIdx) return d
        const exercises = [...d.exercises]
        const myGroup = parseExerciseGroup(exercises[exIdx])
        const prevGroup = parseExerciseGroup(exercises[exIdx - 1])
        const isInGroup = myGroup > 0 && prevGroup === myGroup
        if (isInGroup) {
          exercises[exIdx] = { ...exercises[exIdx], superset_group: 0 }
        } else {
          let groupId = prevGroup
          if (!groupId) {
            groupId = nextSupersetId(prev)
            exercises[exIdx - 1] = { ...exercises[exIdx - 1], superset_group: groupId }
          }
          exercises[exIdx] = { ...exercises[exIdx], superset_group: groupId }
        }
        return { ...d, exercises }
      })
      return { ...prev, days }
    })
  }

  const handleSaved = async () => {
    if (!generatedRoutine) return
    setSaving(true)
    try {
      const res = await authFetch('/api/save-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainerId,
          member_id: (memberId && memberId !== '__none__') ? memberId : null,
          routine: generatedRoutine
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar la rutina')
      }
      setSavedTemplateId(data.workout_template_id)
      toast({ title: '¡Rutina guardada!', description: 'Ya aparece en tu lista de rutinas.' })
      onRoutineSaved?.(data.workout_template_id)
      handleClose()
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' })
      setSaving(false)
    }
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
              <RoutinePreview
                routine={generatedRoutine}
                excludeOnlyMale={isFemale}
                onRoutineFieldChange={updateRoutineField}
                onUpdateExercise={updateExercise}
                onSwapExercise={swapExercise}
                onRemoveExercise={removeExercise}
                onMoveExercise={moveExercise}
                onToggleSuperset={toggleSuperset}
                onAddExercise={addExercise}
                onUpdateDayName={updateDayName}
              />

              {replacedInfo.length > 0 && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ajustes automáticos al catálogo
                  </div>
                  <ul className="space-y-0.5 list-disc pl-4">
                    {replacedInfo.slice(0, 5).map((r, i) => (
                      <li key={i}>
                        {r.dropped
                          ? `"${r.original}" descartado (sin equivalente en catálogo)`
                          : `"${r.original}" → "${r.replacement}"`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  disabled={saving}
                  className="flex-1 border-gray-600 text-gray-400 hover:bg-gray-800 rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerar
                </Button>
                <Button
                  onClick={handleSaved}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Aceptar y guardar</>
                  )}
                </Button>
              </div>

              <p className="text-center text-xs text-gray-600 pt-1">
                Edita lo que necesites antes de aceptar. Las rutinas generadas tienen carácter orientativo.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
