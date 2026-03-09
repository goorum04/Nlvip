'use client'

import { useState, useMemo } from 'react'
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
  Sun as SunIcon
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const PHASE_CONFIG = {
  menstrual: { 
    icon: Moon, 
    gradient: 'from-violet-200 via-purple-200 to-pink-100', 
    gradientDark: 'from-violet-600/30 via-purple-600/20 to-pink-500/10',
    accent: 'bg-violet-400',
    text: 'text-violet-700',
    border: 'border-violet-300',
    glow: 'shadow-violet-400/20',
    name: 'Descanso'
  },
  follicular: { 
    icon: Sun, 
    gradient: 'from-teal-200 via-cyan-200 to-emerald-100', 
    gradientDark: 'from-teal-600/30 via-cyan-600/20 to-emerald-500/10',
    accent: 'bg-teal-400',
    text: 'text-teal-700',
    border: 'border-teal-300',
    glow: 'shadow-teal-400/20',
    name: 'Energía'
  },
  ovulation: { 
    icon: Zap, 
    gradient: 'from-amber-200 via-orange-200 to-yellow-100', 
    gradientDark: 'from-amber-600/30 via-orange-600/20 to-yellow-500/10',
    accent: 'bg-amber-400',
    text: 'text-amber-700',
    border: 'border-amber-300',
    glow: 'shadow-amber-400/20',
    name: 'Pico'
  },
  luteal: { 
    icon: TrendingUp, 
    gradient: 'from-rose-200 via-pink-200 to-purple-100', 
    gradientDark: 'from-rose-600/30 via-pink-600/20 to-purple-500/10',
    accent: 'bg-rose-400',
    text: 'text-rose-700',
    border: 'border-rose-300',
    glow: 'shadow-rose-400/20',
    name: 'Equilibrio'
  },
  unknown: { 
    icon: Activity, 
    gradient: 'from-gray-200 via-slate-100 to-gray-100', 
    gradientDark: 'from-gray-600/30 via-slate-600/20 to-gray-500/10',
    accent: 'bg-gray-400',
    text: 'text-gray-700',
    border: 'border-gray-300',
    glow: 'shadow-gray-400/20',
    name: 'Sin config'
  }
}

export function CycleModule({ user, profile, onProfileUpdate }) {
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

  const cycleData = useMemo(() => {
    if (profile?.sex !== 'female' || !profile?.cycle_enabled) {
      return null
    }

    const { phase, cycleDay, daysUntilPeriod } = getCyclePhase(
      profile.cycle_start_date,
      profile.cycle_length_days,
      profile.period_length_days
    )

    const calories = calculateTotalCalories(profile.weight_kg, stepsToday, phase)
    const macros = calculateMacros(profile.weight_kg, calories, phase)
    const workout = getWorkoutRecommendation(phase)
    const phaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG.unknown

    return {
      phase,
      cycleDay,
      daysUntilPeriod,
      calories,
      macros,
      workout,
      phaseConfig,
      cycleLength: profile.cycle_length_days || 28,
      periodLength: profile.period_length_days || 5
    }
  }, [profile, stepsToday])

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
      const { error } = await supabase
        .from('profiles')
        .update({
          cycle_enabled: configForm.cycle_enabled,
          cycle_start_date: configForm.cycle_start_date,
          cycle_length_days: configForm.cycle_length_days,
          period_length_days: configForm.period_length_days,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

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

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
        <div className={`bg-gradient-to-br ${cycleData.phaseConfig.gradientDark} p-5 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-xl"></div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl ${cycleData.phaseConfig.accent} flex items-center justify-center shadow-lg ${cycleData.phaseConfig.glow}`}>
                  <PhaseIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Tu fase</p>
                  <h3 className="text-xl font-bold text-white">
                    {getPhaseName(cycleData.phase)}
                  </h3>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(true)}
                className="rounded-full hover:bg-white/10"
              >
                <Settings className="w-4 h-4 text-white/60" />
              </Button>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-white">{cycleData.cycleDay}</span>
                <span className="text-white/60 text-lg font-medium">/ {cycleData.cycleLength}</span>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white ${cycleData.phaseConfig.accent} shadow-lg`}>
                  <Dumbbell className="w-3 h-3" />
                  {cycleData.workout.title}
                </span>
                <p className="text-white/50 text-xs mt-2">
                  {cycleData.daysUntilPeriod} días para el periodo
                </p>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-4 bg-[#1a1a1a]">
          <p className="text-sm text-gray-300 leading-relaxed">
            {cycleData.workout.description}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-pink-400" />
            Hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-violet-500/20 to-pink-500/10 rounded-2xl p-4 border border-violet-500/20">
              <p className="text-xs text-gray-400 mb-1">Calorías</p>
              <p className="text-3xl font-bold text-white">{cycleData.calories}</p>
              <p className="text-xs text-gray-500">kcal</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500/20 to-rose-500/10 rounded-2xl p-4 border border-pink-500/20">
              <p className="text-xs text-gray-400 mb-1">Intensidad</p>
              <p className="text-lg font-semibold text-white capitalize">{cycleData.workout.intensity}</p>
              <p className="text-xs text-gray-500">entrenamiento</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 rounded-2xl p-3 text-center border border-violet-500/15">
              <Droplets className="w-5 h-5 text-violet-400 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-white">{cycleData.macros.protein}<span className="text-xs font-normal text-gray-400">g</span></p>
              <p className="text-xs text-gray-500">Proteína</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 rounded-2xl p-3 text-center border border-pink-500/15">
              <Flame className="w-5 h-5 text-pink-400 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-white">{cycleData.macros.fat}<span className="text-xs font-normal text-gray-400">g</span></p>
              <p className="text-xs text-gray-500">Grasas</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/5 rounded-2xl p-3 text-center border border-rose-500/15">
              <SunIcon className="w-5 h-5 text-rose-400 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-white">{cycleData.macros.carbs}<span className="text-xs font-normal text-gray-400">g</span></p>
              <p className="text-xs text-gray-500">Carbs</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 rounded-2xl p-3 border border-violet-500/10">
            <p className="text-xs font-medium text-violet-300 mb-1">💡 Consejo</p>
            <p className="text-xs text-gray-400">{cycleData.workout.tip}</p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-gray-800/30 rounded-2xl p-3 border border-gray-700/50">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            La información mostrada es orientativa y no sustituye el consejo médico o nutricional profesional.
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

function Sun(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2"/>
      <path d="M12 20v2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="m17.66 17.66 1.41 1.41"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
      <path d="m6.34 17.66-1.41 1.41"/>
      <path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  )
}

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

export default CycleModule
