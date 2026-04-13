'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  getCyclePhase,
  calculateTotalCalories,
  calculateMacros,
  calculateSymptomAdjustedMacros,
  getWorkoutRecommendation,
  getPhaseName
} from '@/lib/cycleFunctions'
import {
  Heart,
  Flame,
  Activity,
  Settings,
  Moon,
  Sun,
  Zap,
  Droplets,
  TrendingUp,
  Info,
  Dumbbell,
  Sparkles,
  Wind,
  Salad,
  Apple
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SymptomsTracker } from '@/components/SymptomsTracker'

const PHASE_CONFIG = {
  menstrual: {
    icon: Moon,
    gradient: 'from-violet-600/20 via-indigo-600/10 to-transparent',
    accent: 'bg-violet-500',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    glow: 'shadow-violet-500/40',
    name: 'Fase Menstrual',
    slogan: 'Tiempo de introspección y descanso.'
  },
  follicular: {
    icon: Sun,
    gradient: 'from-teal-600/20 via-emerald-600/10 to-transparent',
    accent: 'bg-teal-500',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    glow: 'shadow-teal-500/40',
    name: 'Fase Folicular',
    slogan: 'Tu energía y creatividad despegan.'
  },
  ovulation: {
    icon: Zap,
    gradient: 'from-amber-600/20 via-orange-600/10 to-transparent',
    accent: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/40',
    name: 'Fase Ovulatoria',
    slogan: 'Máxima potencia y confianza.'
  },
  luteal: {
    icon: TrendingUp,
    gradient: 'from-rose-600/20 via-pink-600/10 to-transparent',
    accent: 'bg-rose-500',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/40',
    name: 'Fase Lútea',
    slogan: 'Equilibrio, calma y nutrición.'
  },
  unknown: {
    icon: Activity,
    gradient: 'from-gray-600/20 to-transparent',
    accent: 'bg-gray-500',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    glow: 'shadow-gray-500/40',
    name: 'Configuración',
    slogan: 'Personaliza tu experiencia elite.'
  }
}

function CycleWheel({ day, totalDays, phaseConfig }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (day / totalDays) * circumference;
  
  return (
    <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background track */}
        <circle
          cx="112" cy="112" r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-white/5"
        />
        {/* Progress circle */}
        <circle
          cx="112" cy="112" r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference - progress,
            transition: 'stroke-dashoffset 1s ease-in-out'
          }}
          className={`${phaseConfig.text} drop-shadow-[0_0_8px_rgba(var(--phase-rgb),0.5)]`}
        />
      </svg>
      
      {/* Central Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={`w-14 h-14 rounded-2xl ${phaseConfig.accent} flex items-center justify-center shadow-2xl mb-2 animate-bounce-slow`}>
          <phaseConfig.icon className="w-7 h-7 text-white" />
        </div>
        <span className="text-4xl font-black text-white">{day}</span>
        <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Día del Ciclo</span>
      </div>

      {/* Rotating Dot */}
      <div 
        className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-black transition-all duration-1000"
        style={{
          transform: `rotate(${(day / totalDays) * 360}deg) translateY(-${radius}px)`,
          transformOrigin: 'center'
        }}
      />
    </div>
  )
}

// Sugerencias nutricionales por fase
const PHASE_NUTRITION = {
  menstrual: {
    emoji: '🥩',
    title: 'Enfoque antiinflamatorio',
    nutrients: ['Hierro (carne roja, legumbres)', 'Magnesio (chocolate negro, semillas)', 'Vitamina C (naranja, kiwi)', 'Omega-3 (salmón, nueces)'],
    limit: ['Cafeína', 'Alcohol', 'Azúcar refinado', 'Sal en exceso']
  },
  follicular: {
    emoji: '🥗',
    title: 'Proteínas y antioxidantes',
    nutrients: ['Proteínas magras (pollo, huevo, legumbres)', 'Probióticos (yogur, kéfir)', 'Zinc (semillas calabaza, carne)', 'Vitamina B6 (plátano, atún)'],
    limit: []
  },
  ovulation: {
    emoji: '🥦',
    title: 'Fibra y glutatión',
    nutrients: ['Fibra (brócoli, alcachofa, avena)', 'Vitamina B (cereales integrales)', 'Antioxidantes (frutos rojos, espinacas)', 'Hidratación extra (+500ml)'],
    limit: []
  },
  luteal: {
    emoji: '🥜',
    title: 'Calcio y reducir antojos',
    nutrients: ['Calcio (lácteos, almendras, brócoli)', 'Vitamina D (pescado azul, yema huevo)', 'Magnesio (reduce calambres)', 'Triptófano (pavo, plátano, avena)'],
    limit: ['Azúcar refinado (aumenta síntomas)', 'Cafeína (aumenta irritabilidad)']
  },
  unknown: {
    emoji: '🥙',
    title: 'Alimentación equilibrada',
    nutrients: ['Proteínas en cada comida', 'Verduras variadas', 'Grasas saludables', 'Hidratación adecuada'],
    limit: []
  }
}

export function CycleModule({ user, profile, onProfileUpdate, onThemeChange, variant = 'full' }) {
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [stepsToday] = useState(0)
  const { toast } = useToast()

  const [configForm, setConfigForm] = useState({
    cycle_enabled: profile?.cycle_enabled || false,
    cycle_start_date: profile?.cycle_start_date || '',
    cycle_length_days: profile?.cycle_length_days || 28,
    period_length_days: profile?.period_length_days || 5
  })

  // Síntomas de hoy para ajustar macros
  const [todaySymptoms, setTodaySymptoms] = useState(null)
  const [symptomsLoaded, setSymptomsLoaded] = useState(false)

  useEffect(() => {
    if (profile?.sex !== 'female' || !profile?.cycle_enabled || !user?.id) {
      setSymptomsLoaded(true)
      return
    }
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('cycle_symptoms')
      .select('energy_level, mood, pain_level, extra_symptoms')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') {
          console.warn('[CycleModule] Symptom fetch warning:', error.message)
        }
        setTodaySymptoms(data ?? null)
        setSymptomsLoaded(true)
      })
      .catch(() => { setTodaySymptoms(null); setSymptomsLoaded(true) })
  }, [user?.id, profile?.sex, profile?.cycle_enabled])

  const cycleData = useMemo(() => {
    if (profile?.sex !== 'female' || !profile?.cycle_enabled) {
      return null
    }

    const { phase, cycleDay, daysUntilPeriod } = getCyclePhase(
      profile.cycle_start_date,
      profile.cycle_length_days,
      profile.period_length_days
    )

    const baseCalories = calculateTotalCalories(profile.weight_kg, stepsToday, phase)
    const { protein, fat, carbs, adjustedCalories, isSymptomAdjusted } =
      calculateSymptomAdjustedMacros(profile.weight_kg, baseCalories, phase, todaySymptoms)
    const macros = { protein, fat, carbs }
    const workout = getWorkoutRecommendation(phase)
    const phaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG.unknown

    return {
      phase,
      cycleDay,
      daysUntilPeriod,
      calories: adjustedCalories,
      macros,
      isSymptomAdjusted,
      workout,
      phaseConfig,
      cycleLength: profile.cycle_length_days || 28,
      periodLength: profile.period_length_days || 5,
      theme: phaseConfig === PHASE_CONFIG.unknown ? 'default' : phase
    }
  }, [profile, stepsToday, todaySymptoms])

  // Notificar cambio de tema al padre
  useEffect(() => {
    if (onThemeChange && variant === 'full' && cycleData?.theme) {
      onThemeChange(cycleData.theme)
    }
  }, [cycleData?.theme, onThemeChange, variant])

  const handleSaveConfig = async () => {
    if (!configForm.cycle_enabled) {
      setShowConfig(false)
      return
    }

    if (!configForm.cycle_start_date) {
      toast({ title: 'Error', description: 'Indica la fecha de inicio', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          updates: {
            cycle_enabled: configForm.cycle_enabled,
            cycle_start_date: configForm.cycle_start_date,
            cycle_length_days: configForm.cycle_length_days,
            period_length_days: configForm.period_length_days,
            updated_at: new Date().toISOString()
          }
        })
      })
      const data = await res.json()
      const error = data.error

      if (error) throw new Error(error)

      toast({ title: '¡Guardado!' })

      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          cycle_enabled: configForm.cycle_enabled,
          cycle_start_date: configForm.cycle_start_date,
          cycle_length_days: configForm.cycle_length_days,
          period_length_days: configForm.period_length_days
        })
      }

      setShowConfig(false)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const updateConfigField = (field, value) => {
    setConfigForm(prev => ({ ...prev, [field]: value }))
  }

  if (profile?.sex !== 'female') {
    return null
  }

  if (!cycleData) {
    // Compact variant - mostrar recuadro de activación
    if (variant === 'compact') {
      return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-pink-500/20 rounded-3xl overflow-hidden cursor-pointer hover:border-pink-500/40 transition-all group" onClick={() => setShowConfig(true)}>
          <div className="bg-gradient-to-r from-pink-500/10 to-violet-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Bienestar</p>
                  <h3 className="text-sm font-bold text-white">Configura tu ciclo</h3>
                </div>
              </div>
              <Sparkles className="w-5 h-5 text-pink-400 animate-pulse" />
            </div>
          </div>
        </Card>
      )
    }

    // Full variant - mostrar劝 activate card
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
        <CardContent className="py-8 px-4">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-400 via-pink-400 to-rose-400 flex items-center justify-center shadow-lg shadow-pink-400/30">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Bienestar Femenino</h3>
            <p className="text-gray-400 text-sm mb-5">Tu seguimiento personalizado del ciclo</p>
            <Button
              onClick={() => setShowConfig(true)}
              className="bg-gradient-to-r from-violet-500 via-pink-500 to-rose-500 hover:from-violet-600 hover:via-pink-600 hover:to-rose-600 text-white rounded-full px-6 shadow-lg shadow-pink-500/25"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Activar seguimiento
            </Button>
          </div>

          <CycleConfigModal
            isOpen={showConfig}
            onClose={() => setShowConfig(false)}
            config={configForm}
            onUpdate={updateConfigField}
            onSave={handleSaveConfig}
            loading={loading}
          />
        </CardContent>
      </Card>
    )
  }

  const PhaseIcon = cycleData.phaseConfig.icon

  // Compact variant - solo la fase para actividad
  if (variant === 'compact') {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden cursor-pointer" onClick={() => setShowConfig(true)}>
        <div className={`bg-gradient-to-br ${cycleData.phaseConfig.gradientDark} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${cycleData.phaseConfig.accent} flex items-center justify-center`}>
                <PhaseIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Tu fase</p>
                <h3 className="text-lg font-bold text-white">
                  {getPhaseName(cycleData.phase)}
                </h3>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{cycleData.cycleDay}</span>
              <span className="text-white/60 text-sm">/ {cycleData.cycleLength}</span>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // Full variant - toda la información
  return (
    <div className="space-y-6 relative">
      {/* Ambient Glow Background */}
      <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-[150%] h-full bg-gradient-to-b ${cycleData.phaseConfig.gradient} opacity-40 blur-[120px] pointer-events-none -z-10`} />

      <Card className="bg-[#0B0B0B]/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] shadow-2xl">
        <div className="p-8 relative">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Elite Edition</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Tu Bienestar</h2>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowConfig(true)}
              className="rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 border border-white/5"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          <CycleWheel 
            day={cycleData.cycleDay} 
            totalDays={cycleData.cycleLength} 
            phaseConfig={cycleData.phaseConfig} 
          />

          <div className="mt-8 text-center">
            <h3 className={`text-3xl font-black ${cycleData.phaseConfig.text} mb-2`}>
              {cycleData.phaseConfig.name}
            </h3>
            <p className="text-white/60 text-sm font-medium italic">
              "{cycleData.phaseConfig.slogan}"
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-white/30 uppercase font-black mb-1">Próximo Periodo</p>
              <p className="text-xl font-bold text-white">{cycleData.daysUntilPeriod} días</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-white/30 uppercase font-black mb-1">Entrenamiento</p>
              <p className="text-xl font-bold text-white">{cycleData.workout.intensity}</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 bg-white/[0.02] border-t border-white/5">
          <div className="flex gap-4 items-start">
            <div className={`w-10 h-10 rounded-xl ${cycleData.phaseConfig.accent}/20 flex items-center justify-center shrink-0`}>
              <Info className={`w-5 h-5 ${cycleData.phaseConfig.text}`} />
            </div>
            <p className="text-sm text-white/70 leading-relaxed font-medium">
              {cycleData.workout.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Macros Especializados */}
      {cycleData.isSymptomAdjusted && symptomsLoaded && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl w-fit">
          <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Ajustado por tu bienestar de hoy
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#0B0B0B]/40 backdrop-blur-xl border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Metabolismo Hoy</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{cycleData.calories}</span>
            <span className="text-sm font-bold text-white/30 tracking-tight">kcal/día</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${cycleData.phaseConfig.accent} opacity-50 transition-all duration-1000`} 
                style={{ width: '70%' }} 
              />
            </div>
            <span className="text-[10px] font-bold text-white/40">ÓPTIMO</span>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'PROT', value: cycleData.macros.protein, icon: Droplets, color: 'text-violet-400' },
            { label: 'GRAS', value: cycleData.macros.fat, icon: Flame, color: 'text-rose-400' },
            { label: 'CARB', value: cycleData.macros.carbs, icon: Sun, color: 'text-amber-400' }
          ].map((macro, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center">
              <macro.icon className={`w-4 h-4 ${macro.color} mb-2`} />
              <span className="text-lg font-black text-white">{macro.value}g</span>
              <p className="text-[8px] font-black text-white/20 tracking-tighter uppercase">{macro.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Nutrición Elite */}
      {(() => {
        const nutrition = PHASE_NUTRITION[cycleData.phase] || PHASE_NUTRITION.unknown
        return (
          <Card className="bg-[#0B0B0B]/60 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">{nutrition.emoji}</span>
                <div>
                  <h3 className="text-sm font-black text-white">Dieta de Fase</h3>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-tight">{nutrition.title}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10">
                  <p className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest mb-3">Prioridad Nutricional</p>
                  <div className="grid grid-cols-1 gap-2">
                    {nutrition.nutrients.map((n, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
                        <p className="text-xs text-white/60 font-medium">{n}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {nutrition.limit.length > 0 && (
                  <div className="bg-rose-500/5 rounded-2xl p-4 border border-rose-500/10">
                    <p className="text-[9px] font-black text-rose-400/60 uppercase tracking-widest mb-3">Limitaciones Sugeridas</p>
                    <div className="grid grid-cols-1 gap-2">
                      {nutrition.limit.map((n, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-rose-500/40" />
                          <p className="text-xs text-white/40 font-medium line-through decoration-white/10">{n}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      })()}


      <div className="bg-gray-800/30 rounded-2xl p-3 border border-gray-700/50">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            La información mostrada es orientativa y no sustituye el consejo médico o nutricional profesional. Consulta siempre a tu médico ante cualquier duda sobre tu salud.
          </p>
        </div>
      </div>

      <CycleConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        config={configForm}
        onUpdate={updateConfigField}
        onSave={handleSaveConfig}
        loading={loading}
      />
    </div>
  )
}

export default CycleModule

function CycleConfigModal({ isOpen, onClose, config, onUpdate, onSave, loading }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" />
            Configurar ciclo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-500/10 to-pink-500/10 rounded-2xl border border-violet-500/20">
            <div>
              <Label className="text-white font-medium">Seguimiento activo</Label>
              <p className="text-xs text-gray-400">Recomendaciones personalizadas</p>
            </div>
            <Switch
              checked={config.cycle_enabled}
              onCheckedChange={(checked) => onUpdate('cycle_enabled', checked)}
            />
          </div>

          {config.cycle_enabled && (
            <>
              <div>
                <Label className="text-gray-300">Fecha inicio último periodo</Label>
                <Input
                  type="date"
                  value={config.cycle_start_date}
                  onChange={(e) => onUpdate('cycle_start_date', e.target.value)}
                  className="mt-2 bg-gray-800 border-gray-700 text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Duración ciclo</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      min="21"
                      max="35"
                      value={config.cycle_length_days}
                      onChange={(e) => onUpdate('cycle_length_days', parseInt(e.target.value) || 28)}
                      className="bg-gray-800 border-gray-700 text-white rounded-xl"
                    />
                    <span className="text-sm text-gray-400">días</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-300">Duración periodo</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      min="2"
                      max="10"
                      value={config.period_length_days}
                      onChange={(e) => onUpdate('period_length_days', parseInt(e.target.value) || 5)}
                      className="bg-gray-800 border-gray-700 text-white rounded-xl"
                    />
                    <span className="text-sm text-gray-400">días</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={loading}
            className="bg-gradient-to-r from-violet-500 via-pink-500 to-rose-500 hover:from-violet-600 hover:via-pink-600 hover:to-rose-600 text-white rounded-xl"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
