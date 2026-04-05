'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sparkles, Loader2, ChevronDown, ChevronUp, Dumbbell, Save, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const EQUIPMENT_OPTIONS = [
  { value: 'cable', label: 'Cable / Polea' },
  { value: 'máquina', label: 'Máquinas' },
  { value: 'mancuernas', label: 'Mancuernas' },
  { value: 'multipower', label: 'Multipower / Smith' },
  { value: 'barra', label: 'Barra libre' },
  { value: 'peso_libre', label: 'Peso libre (discos)' },
  { value: 'peso_corporal', label: 'Peso corporal' },
]

function RoutinePreview({ routine }) {
  const [expanded, setExpanded] = useState({})

  const toggle = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))

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
              {day.exercises?.map((ex, j) => (
                <div key={j} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                  <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold">
                    {j + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{ex.exercise_name}</p>
                    <p className="text-xs text-gray-500">{ex.sets}×{ex.reps} · {ex.rest_seconds}s descanso</p>
                    {ex.notes && <p className="text-xs text-violet-400 mt-0.5">{ex.notes}</p>}
                  </div>
                </div>
              ))}
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
  const { toast } = useToast()

  const [criteria, setCriteria] = useState({
    days_per_week: '4',
    goal: 'hipertrofia',
    level: 'intermedio',
    equipment: EQUIPMENT_OPTIONS.map(e => e.value),
    session_duration_min: '60',
    notes: ''
  })

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
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/generate-routine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          trainer_id: trainerId,
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
      setSavedTemplateId(data.workout_template_id)
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
    onClose()
  }

  const handleSaved = () => {
    toast({ title: '¡Rutina guardada!', description: 'Ya aparece en tu lista de rutinas.' })
    onRoutineSaved?.()
    handleClose()
  }

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

              <Button
                onClick={generate}
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl py-6 mt-2"
              >
                <Sparkles className="w-5 h-5 mr-2" /> Generar Rutina
              </Button>
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
