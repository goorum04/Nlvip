'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { 
  Smile, Frown, Meh, Zap, Battery, BatteryLow, 
  Droplets, Heart, AlertCircle, CheckCircle2, Loader2, 
  ChevronDown, ChevronUp 
} from 'lucide-react'

const MOODS = [
  { value: 'happy', emoji: '😊', label: 'Feliz' },
  { value: 'motivated', emoji: '💪', label: 'Motivada' },
  { value: 'calm', emoji: '😌', label: 'Tranquila' },
  { value: 'tired', emoji: '😴', label: 'Cansada' },
  { value: 'irritable', emoji: '😤', label: 'Irritable' },
  { value: 'anxious', emoji: '😰', label: 'Ansiosa' },
  { value: 'sad', emoji: '😢', label: 'Triste' },
]

const PAIN_LOCATIONS = [
  { value: 'abdomen', label: '🫃 Abdomen' },
  { value: 'head', label: '🤕 Cabeza' },
  { value: 'back', label: '🦴 Espalda' },
  { value: 'breasts', label: '💗 Pechos' },
  { value: 'legs', label: '🦵 Piernas' },
]

const EXTRA_SYMPTOMS = [
  { value: 'bloating', label: '🫧 Hinchazón' },
  { value: 'acne', label: '🔴 Acné' },
  { value: 'cravings', label: '🍫 Antojos' },
  { value: 'insomnia', label: '🌙 Insomnio' },
  { value: 'nausea', label: '🤢 Náuseas' },
  { value: 'hot_flashes', label: '🔥 Sofocos' },
]

const FLOW_OPTIONS = [
  { value: 'none', label: 'Sin flujo', color: 'border-gray-600 text-gray-400' },
  { value: 'spotting', label: 'Manchado', color: 'border-pink-900 text-pink-700' },
  { value: 'light', label: 'Leve', color: 'border-pink-600 text-pink-400' },
  { value: 'moderate', label: 'Moderado', color: 'border-rose-500 text-rose-400' },
  { value: 'heavy', label: 'Abundante', color: 'border-red-500 text-red-400' },
]

export function SymptomsTracker({ userId, phase }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const { toast } = useToast()

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    energy_level: 3,
    mood: null,
    pain_level: 0,
    pain_locations: [],
    flow_intensity: null,
    extra_symptoms: [],
    notes: ''
  })

  // Cargar síntomas de hoy si existen
  useEffect(() => {
    const loadToday = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('cycle_symptoms')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .single()

        if (data) {
          setForm({
            energy_level: data.energy_level || 3,
            mood: data.mood || null,
            pain_level: data.pain_level || 0,
            pain_locations: data.pain_locations || [],
            flow_intensity: data.flow_intensity || null,
            extra_symptoms: data.extra_symptoms || [],
            notes: data.notes || ''
          })
          setSaved(true)
        }
      } catch {
        // No hay síntomas hoy, es normal
      } finally {
        setLoading(false)
      }
    }
    loadToday()
  }, [userId, today])

  const toggleArrayItem = (field, value) => {
    setForm(prev => {
      const arr = prev[field] || []
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        user_id: userId,
        date: today,
        energy_level: form.energy_level,
        mood: form.mood,
        pain_level: form.pain_level,
        pain_locations: form.pain_locations,
        flow_intensity: form.flow_intensity,
        extra_symptoms: form.extra_symptoms,
        notes: form.notes || null
      }

      const { error } = await supabase
        .from('cycle_symptoms')
        .upsert(payload, { onConflict: 'user_id,date' })

      if (error) throw error

      setSaved(true)
      toast({ title: '✅ Síntomas guardados' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardContent className="p-4 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
      {/* Header colapsable */}
      <button
        className="w-full p-4 flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500/30 to-violet-500/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Cómo me siento hoy</p>
            <p className="text-xs text-gray-500">
              {saved ? '✅ Registrado' : 'Toca para registrar'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <CardContent className="px-4 pb-4 space-y-5">

          {/* Energía */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Nivel de energía</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(level => (
                <button
                  key={level}
                  onClick={() => setForm(f => ({ ...f, energy_level: level }))}
                  className={`flex-1 aspect-square rounded-2xl border text-xs font-bold transition-all ${
                    form.energy_level === level
                      ? 'bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-500/30'
                      : 'border-[#2a2a2a] text-gray-500 hover:border-pink-500/50'
                  }`}
                >
                  {['😫','😔','😐','🙂','⚡'][level - 1]}
                </button>
              ))}
            </div>
          </div>

          {/* Estado de ánimo */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Estado de ánimo</p>
            <div className="grid grid-cols-4 gap-2">
              {MOODS.map(mood => (
                <button
                  key={mood.value}
                  onClick={() => setForm(f => ({ ...f, mood: f.mood === mood.value ? null : mood.value }))}
                  className={`p-2 rounded-2xl border text-center transition-all ${
                    form.mood === mood.value
                      ? 'bg-violet-500/30 border-violet-500 text-white'
                      : 'border-[#2a2a2a] text-gray-500 hover:border-violet-500/40'
                  }`}
                >
                  <div className="text-xl">{mood.emoji}</div>
                  <div className="text-[9px] mt-0.5">{mood.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Flujo (solo si aplica la fase) */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Flujo</p>
            <div className="grid grid-cols-5 gap-1">
              {FLOW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, flow_intensity: f.flow_intensity === opt.value ? null : opt.value }))}
                  className={`p-2 rounded-xl border text-center transition-all text-[10px] font-medium ${
                    form.flow_intensity === opt.value
                      ? `${opt.color} bg-white/5`
                      : 'border-[#2a2a2a] text-gray-600'
                  }`}
                >
                  <Droplets className="w-3 h-3 mx-auto mb-0.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dolor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Dolor</p>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    onClick={() => setForm(f => ({ ...f, pain_level: level }))}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all ${
                      form.pain_level === level
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'border-[#2a2a2a] text-gray-600 hover:border-rose-500/40'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            {form.pain_level > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {PAIN_LOCATIONS.map(loc => (
                  <button
                    key={loc.value}
                    onClick={() => toggleArrayItem('pain_locations', loc.value)}
                    className={`px-2.5 py-1 rounded-xl text-xs border transition-all ${
                      form.pain_locations?.includes(loc.value)
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'border-[#2a2a2a] text-gray-500'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Síntomas extra */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Otros síntomas</p>
            <div className="flex flex-wrap gap-2">
              {EXTRA_SYMPTOMS.map(sym => (
                <button
                  key={sym.value}
                  onClick={() => toggleArrayItem('extra_symptoms', sym.value)}
                  className={`px-3 py-1.5 rounded-2xl text-xs border transition-all ${
                    form.extra_symptoms?.includes(sym.value)
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                      : 'border-[#2a2a2a] text-gray-500 hover:border-pink-500/30'
                  }`}
                >
                  {sym.label}
                </button>
              ))}
            </div>
          </div>

          {/* Guardar */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:opacity-90 text-white rounded-2xl font-semibold shadow-lg shadow-pink-500/20"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Actualizar registro</>
            ) : (
              <><Heart className="w-4 h-4 mr-2" /> Guardar síntomas</>
            )}
          </Button>

          {/* Disclaimer Apple */}
          <p className="text-[10px] text-gray-600 text-center leading-relaxed">
            Esta información es orientativa y no sustituye el consejo médico profesional.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
