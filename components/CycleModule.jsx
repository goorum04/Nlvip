'use client'

import { useState, useEffect, useMemo } from 'react'
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
  getPhaseColors,
  getPhaseName,
  getEnergyLevel,
  getStepsAdjustment
} from '@/lib/cycleFunctions'
import { 
  Heart, 
  Flame, 
  Activity, 
  Settings, 
  Sparkles, 
  Moon, 
  Sun, 
  Zap,
  Target,
  Droplets,
  TrendingUp,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const PHASE_ICONS = {
  menstrual: Moon,
  follicular: Sun,
  ovulation: Zap,
  luteal: TrendingUp,
  unknown: Activity
}

const PHASE_GRADIENTS = {
  menstrual: 'from-slate-100 via-gray-50 to-slate-100',
  follicular: 'from-emerald-50 via-teal-50 to-cyan-50',
  ovulation: 'from-amber-50 via-orange-50 to-rose-50',
  luteal: 'from-rose-50 via-orange-50 to-amber-50',
  unknown: 'from-gray-100 via-slate-50 to-gray-100'
}

const PHASE_ACCENTS = {
  menstrual: 'border-slate-300 bg-slate-50',
  follicular: 'border-emerald-300 bg-emerald-50',
  ovulation: 'border-amber-300 bg-amber-50',
  luteal: 'border-rose-300 bg-rose-50',
  unknown: 'border-gray-300 bg-gray-50'
}

export function CycleModule({ user, profile, onProfileUpdate }) {
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [stepsToday, setStepsToday] = useState(0)
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
    const colors = getPhaseColors(phase)
    const energy = getEnergyLevel(phase)

    return {
      phase,
      cycleDay,
      daysUntilPeriod,
      calories,
      macros,
      workout,
      colors,
      energy,
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
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            Bienestar Femenino
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center">
              <Activity className="w-8 h-8 text-rose-300" />
            </div>
            <p className="text-gray-500 mb-4">Activa el seguimiento de tu ciclo para recibir recomendaciones personalizadas</p>
            <Button 
              onClick={() => setShowConfig(true)}
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
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

  const PhaseIcon = PHASE_ICONS[cycleData.phase] || Activity

  return (
    <div className="space-y-4">
      <Card className={`overflow-hidden border-0 shadow-lg`}>
        <div className={`bg-gradient-to-br ${PHASE_GRADIENTS[cycleData.phase]} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl ${PHASE_ACCENTS[cycleData.phase]} flex items-center justify-center shadow-sm`}>
                <PhaseIcon className={`w-6 h-6 ${cycleData.colors.text}`} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Fase actual</p>
                <h3 className={`text-xl font-bold ${cycleData.colors.text}`}>
                  {getPhaseName(cycleData.phase)}
                </h3>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowConfig(true)}
              className="rounded-full hover:bg-white/50"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </Button>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold text-gray-800">{cycleData.cycleDay}</p>
              <p className="text-sm text-gray-500">día del ciclo</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-semibold ${cycleData.energy.color}`}>
                {cycleData.energy.label}
              </p>
              <p className="text-xs text-gray-400">
                {cycleData.daysUntilPeriod} días hasta el periodo
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-4 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed">
            {cycleData.workout.description}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Recomendación diaria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Calorías</p>
              <p className="text-2xl font-bold text-gray-800">{cycleData.calories}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Entrenamiento</p>
              <p className="text-sm font-semibold text-gray-800">{cycleData.workout.title}</p>
              <p className="text-xs text-gray-400">intensidad {cycleData.workout.intensity}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-rose-50 rounded-xl p-3 text-center">
              <Droplets className="w-4 h-4 text-rose-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-800">{cycleData.macros.protein}g</p>
              <p className="text-xs text-gray-500">Proteína</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <Flame className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-800">{cycleData.macros.fat}g</p>
              <p className="text-xs text-gray-500">Grasas</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <Sparkles className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-800">{cycleData.macros.carbs}g</p>
              <p className="text-xs text-gray-500">Carbs</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-600 mb-1">Consejo del día</p>
            <p className="text-sm text-gray-500">{cycleData.workout.tip}</p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
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
      <DialogContent className="bg-white rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            Configurar ciclo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-700 font-medium">Activar seguimiento</Label>
              <p className="text-xs text-gray-400">Recibe recomendaciones personalizadas</p>
            </div>
            <Switch
              checked={config.cycle_enabled}
              onCheckedChange={(checked) => onUpdate('cycle_enabled', checked)}
            />
          </div>

          {config.cycle_enabled && (
            <>
              <div>
                <Label className="text-gray-700">Fecha de inicio del último periodo</Label>
                <Input
                  type="date"
                  value={config.cycle_start_date}
                  onChange={(e) => onUpdate('cycle_start_date', e.target.value)}
                  className="mt-1.5 border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700">Duración del ciclo</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      min="21"
                      max="35"
                      value={config.cycle_length_days}
                      onChange={(e) => onUpdate('cycle_length_days', parseInt(e.target.value) || 28)}
                      className="border-gray-200 rounded-xl"
                    />
                    <span className="text-sm text-gray-400">días</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700">Duración del periodo</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      min="2"
                      max="10"
                      value={config.period_length_days}
                      onChange={(e) => onUpdate('period_length_days', parseInt(e.target.value) || 5)}
                      className="border-gray-200 rounded-xl"
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
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={loading}
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl"
          >
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CycleModule
