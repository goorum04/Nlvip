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
  Dumbbell
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const PHASE_CONFIG = {
  menstrual: { 
    icon: Moon, 
    gradient: 'from-slate-600 to-slate-800', 
    accent: 'from-slate-500 to-slate-600',
    glow: 'shadow-slate-500/20',
    badge: 'bg-slate-500'
  },
  follicular: { 
    icon: Sun, 
    gradient: 'from-emerald-600 to-teal-700', 
    accent: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/20',
    badge: 'bg-emerald-500'
  },
  ovulation: { 
    icon: Zap, 
    gradient: 'from-amber-500 to-orange-600', 
    accent: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/20',
    badge: 'bg-amber-500'
  },
  luteal: { 
    icon: TrendingUp, 
    gradient: 'from-rose-600 to-pink-700', 
    accent: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/20',
    badge: 'bg-rose-500'
  },
  unknown: { 
    icon: Activity, 
    gradient: 'from-gray-600 to-gray-700', 
    accent: 'from-gray-500 to-gray-600',
    glow: 'shadow-gray-500/20',
    badge: 'bg-gray-500'
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
      toast({ title: 'Error', description: 'Indica la fecha de inicio de tu último periodo', variant: 'destructive' })
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

      toast({ title: '¡Configuración guardada!' })
      
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
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardContent className="py-8 px-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center border border-rose-500/30">
              <Heart className="w-8 h-8 text-rose-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Bienestar Femenino</h3>
            <p className="text-gray-400 text-sm mb-4">Activa el seguimiento de tu ciclo para recibir recomendaciones personalizadas</p>
            <Button 
              onClick={() => setShowConfig(true)}
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurar ciclo
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
        <div className={`bg-gradient-to-br ${cycleData.phaseConfig.gradient} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <PhaseIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Fase actual</p>
                <h3 className="text-lg font-bold text-white">
                  {getPhaseName(cycleData.phase)}
                </h3>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowConfig(true)}
              className="rounded-lg hover:bg-white/10"
            >
              <Settings className="w-4 h-4 text-white/70" />
            </Button>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{cycleData.cycleDay}</span>
              <span className="text-white/70 text-sm">/{cycleData.cycleLength}</span>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white ${cycleData.phaseConfig.badge}`}>
                <Dumbbell className="w-3 h-3" />
                {cycleData.workout.title}
              </span>
              <p className="text-white/60 text-xs mt-1">
                {cycleData.daysUntilPeriod} días para el periodo
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-3 bg-[#1a1a1a]">
          <p className="text-sm text-gray-300 leading-relaxed">
            {cycleData.workout.description}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            Hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-xl p-3 border border-orange-500/20">
              <p className="text-xs text-gray-400 mb-0.5">Calorías</p>
              <p className="text-2xl font-bold text-white">{cycleData.calories}</p>
              <p className="text-xs text-gray-500">kcal</p>
            </div>
            <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-xl p-3 border border-violet-500/20">
              <p className="text-xs text-gray-400 mb-0.5">Intensidad</p>
              <p className="text-base font-semibold text-white capitalize">{cycleData.workout.intensity}</p>
              <p className="text-xs text-gray-500">entrenamiento</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-rose-500/10 rounded-xl p-2.5 text-center border border-rose-500/20">
              <Droplets className="w-4 h-4 text-rose-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{cycleData.macros.protein}<span className="text-xs font-normal text-gray-400">g</span></p>
              <p className="text-xs text-gray-500">Proteína</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-2.5 text-center border border-amber-500/20">
              <Flame className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{cycleData.macros.fat}<span className="text-xs font-normal text-gray-400">g</span></p>
              <p className="text-xs text-gray-500">Grasas</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-2.5 text-center border border-emerald-500/20">
              <Sun className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{cycleData.macros.carbs}<span className="text-xs font-normal text-gray-400">g</span></p>
              <p className="text-xs text-gray-500">Carbs</p>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-2.5 border border-gray-700">
            <p className="text-xs font-medium text-gray-300 mb-0.5">Consejo</p>
            <p className="text-xs text-gray-400">{cycleData.workout.tip}</p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-gray-800/30 rounded-xl p-2.5 border border-gray-700/50">
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

function CycleConfigModal({ isOpen, onClose, config, onUpdate, onSave, loading }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            Configurar ciclo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
            <div>
              <Label className="text-gray-300 font-medium">Activar seguimiento</Label>
              <p className="text-xs text-gray-500">Recibe recomendaciones personalizadas</p>
            </div>
            <Switch
              checked={config.cycle_enabled}
              onCheckedChange={(checked) => onUpdate('cycle_enabled', checked)}
            />
          </div>

          {config.cycle_enabled && (
            <>
              <div>
                <Label className="text-gray-300">Fecha de inicio del último periodo</Label>
                <Input
                  type="date"
                  value={config.cycle_start_date}
                  onChange={(e) => onUpdate('cycle_start_date', e.target.value)}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Duración del ciclo</Label>
                  <div className="flex items-center gap-2 mt-1.5">
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
                  <Label className="text-gray-300">Duración del periodo</Label>
                  <div className="flex items-center gap-2 mt-1.5">
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
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CycleModule
