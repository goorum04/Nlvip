'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Flame, MapPin, Target, Plus, Minus, CircleAlert as AlertCircle,
  TrendingUp, Calendar, LoaderCircle as Loader2, ChevronRight, RefreshCw, Heart, Footprints
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
// ⚠️ Capacitor plugin imports are dynamic to prevent iOS crash at module evaluation time

// Componente principal de Actividad Diaria
export default function ActivityTracker({ userId, compact = false }) {
  const [activity, setActivity] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showAddSteps, setShowAddSteps] = useState(false)
  const [stepsToAdd, setStepsToAdd] = useState('')
  const [healthKitAvailable, setHealthKitAvailable] = useState(false)
  const [healthKitSyncing, setHealthKitSyncing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadActivity()
    loadHistory()
    // Do NOT auto-call syncFromHealthKit() on mount — the native
    // HKHealthStore._validateAuthorizationRequestWithShareTypes:readTypes:
    // can raise an NSException that kills the process before any UI shows
    // (confirmed in TestFlight crash report, v1.32 build 55, Apr 2026).
    // The user can still trigger the sync manually via the HealthKit button.
  }, [userId])

  const syncFromHealthKit = async (showToast = false) => {
    try {
      // Dynamic import — only runs in browser, never during SSG/SSR build
      const { Capacitor } = await import('@capacitor/core')

      // Early exit if not on iOS
      if (Capacitor.getPlatform() !== 'ios') {
        if (showToast) toast({ 
          title: 'No disponible', 
          description: 'La sincronización con Apple Health solo está disponible en la App nativa de iPhone.' 
        })
        return
      }

      // Dynamic import of HealthKit plugin — safe because we already confirmed iOS platform
      const { CapacitorHealthkit } = await import('@perfood/capacitor-healthkit')

      if (showToast) toast({ title: 'Paso 1/4', description: 'Comprobando Apple Health en tu iPhone...' })
      
      try {
        await CapacitorHealthkit.isAvailable()
        setHealthKitAvailable(true)
      } catch (availErr) {
        console.warn('HealthKit not available:', availErr)
        setHealthKitAvailable(false)
        if (showToast) toast({ 
          title: 'Apple Health desactivado', 
          description: 'HealthKit no está disponible en este dispositivo.',
          variant: 'destructive'
        })
        return
      }

      setHealthKitSyncing(true)

      // Request auth
      if (showToast) toast({ title: 'Paso 2/4', description: 'Solicitando permisos de lectura...' })
      try {
        await CapacitorHealthkit.requestAuthorization({
          all: [],
          read: ['steps', 'calories'],
          write: []
        })
      } catch (authErr) {
        console.error('Auth error:', authErr)
        if (showToast) toast({ 
          title: 'Permiso denegado', 
          description: `Error de permisos: ${authErr.message || 'Configúralo en Ajustes > Salud.'}`,
          variant: 'destructive'
        })
        return
      }

      if (showToast) toast({ title: 'Paso 3/4', description: 'Consultando datos de hoy...' })
      
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const now = new Date()

      // Leer pasos de hoy
      const stepsResult = await CapacitorHealthkit.queryHKitSampleType({
        startDate: todayStart.toISOString(),
        endDate: now.toISOString(),
        sampleName: 'steps',
        limit: 0,
        ascending: false
      })

      if (showToast) toast({ title: 'Paso 4/4', description: 'Procesando resultados...' })

      const totalSteps = (stepsResult.resultData || []).reduce((sum, s) => sum + (s.value || 0), 0)

      if (totalSteps > 0) {
        await updateSteps(Math.round(totalSteps), false, 'device')
        if (showToast) toast({ title: '¡Sincronizado!', description: `${Math.round(totalSteps).toLocaleString()} pasos cargados.` })
      } else if (showToast) {
        toast({ title: 'Sin datos', description: 'No hay pasos registrados en Apple Health para hoy todavía.' })
      }
    } catch (err) {
      console.error('Error in syncFromHealthKit:', err)
      if (showToast) toast({ 
        title: 'Error crítico', 
        description: `Detalle: ${err.message || 'Error desconocido en la sincronización.'}`,
        variant: 'destructive'
      })
    } finally {
      setHealthKitSyncing(false)
    }
  }

  const loadActivity = async () => {
    try {
      const { data, error } = await supabase.rpc('rpc_get_today_activity')
      if (error) throw error
      setActivity(data)
    } catch (err) {
      console.error('Error loading activity:', err)
      // Fallback si la RPC no existe todavía
      setActivity({
        steps: 0,
        distance_km: 0,
        calories_kcal: 0,
        steps_goal: 8000,
        progress_percent: 0,
        has_complete_profile: false
      })
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase.rpc('rpc_get_activity_history', { p_days: 7 })
      if (error) throw error
      setHistory(data?.history || [])
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }

  const updateSteps = async (newSteps, showToast = true, source = 'manual') => {
    if (newSteps < 0) return
    setUpdating(true)
    try {
      const { data, error } = await supabase.rpc('rpc_update_daily_steps', { p_steps: newSteps, p_source: source })
      if (error) throw error
      setActivity(prev => ({
        ...prev,
        steps: data.steps,
        distance_km: data.distance_km,
        calories_kcal: data.calories_kcal,
        progress_percent: data.progress_percent
      }))
      if (showToast) toast({ title: '¡Pasos actualizados!' })
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setUpdating(false)
      setShowAddSteps(false)
      setStepsToAdd('')
    }
  }

  const handleAddSteps = () => {
    const add = parseInt(stepsToAdd) || 0
    if (add > 0) {
      updateSteps((activity?.steps || 0) + add, true, 'manual')
    }
  }

  const handleQuickAdd = (amount) => {
    updateSteps((activity?.steps || 0) + amount, true, 'manual')
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-violet-500/20 rounded-3xl">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </CardContent>
      </Card>
    )
  }

  const progressPercent = Math.min(activity?.progress_percent || 0, 100)
  const stepsGoal = activity?.steps_goal || 8000

  // Modo compacto para cards pequeñas
  if (compact) {
    return (
      <Card className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/20 rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Footprints className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{(activity?.steps || 0).toLocaleString()}</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-gray-400">pasos hoy</p>
                  {healthKitAvailable && <Heart className="w-2.5 h-2.5 text-pink-500 fill-pink-500" />}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-emerald-400">{progressPercent.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">de {stepsGoal.toLocaleString()}</p>
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-violet-500/20 rounded-3xl overflow-hidden">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-cyan-600/20 to-violet-600/20"></div>
        <CardHeader className="relative pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Footprints className="w-5 h-5 text-emerald-400" />
              Actividad de Hoy
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => syncFromHealthKit(true)}
                disabled={healthKitSyncing}
                className={`flex items-center gap-1 text-[10px] rounded-full px-2 py-1 transition-all ${
                  healthKitAvailable 
                    ? 'text-pink-400 bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20' 
                    : 'text-gray-400 bg-gray-500/10 border border-gray-500/20'
                }`}
                title="Sincronizar con Apple Health / Forzar Diagnóstico"
              >
                {healthKitSyncing
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Heart className={`w-3 h-3 ${healthKitAvailable ? 'fill-pink-500' : ''}`} />}
                <span>{healthKitAvailable ? 'Apple Health' : 'Test Health'}</span>
              </button>
              <span className="text-xs text-gray-400">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
        </CardHeader>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Alerta si falta perfil */}
        {!activity?.has_complete_profile && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-medium">Perfil incompleto</p>
              <p className="text-xs text-amber-400/80">Añade tu peso y altura para ver distancia y calorías.</p>
            </div>
          </div>
        )}

        {/* Pasos principales con círculo de progreso */}
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            {/* Círculo de progreso */}
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                cx="80" cy="80" r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-white/5"
              />
              <circle
                cx="80" cy="80" r="70"
                stroke="url(#progressGradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - progressPercent / 100)}`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            {/* Contenido central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Footprints className="w-6 h-6 text-emerald-400 mb-1" />
              <span className="text-3xl font-bold text-white">{(activity?.steps || 0).toLocaleString()}</span>
              <span className="text-xs text-gray-400">de {stepsGoal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Identificación clara de Fuente de Datos (Requisito Apple Health) */}
        <div className="flex flex-col items-center -mt-4 mb-2">
          {healthKitAvailable ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20">
              <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
              <span className="text-[10px] font-semibold text-pink-400 uppercase tracking-wider">Sincronizado con Apple Health</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/20">
              <RefreshCw className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Seguimiento Local</span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
            <MapPin className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">
              {activity?.has_complete_profile ? (activity?.distance_km || 0).toFixed(2) : '--'}
            </p>
            <p className="text-xs text-gray-500">km</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
            <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">
              {activity?.has_complete_profile ? Math.round(activity?.calories_kcal || 0) : '--'}
            </p>
            <p className="text-xs text-gray-500">kcal*</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
            <Target className="w-5 h-5 text-violet-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{progressPercent.toFixed(0)}%</p>
            <p className="text-xs text-gray-500">objetivo</p>
          </div>
        </div>

        {/* Nota de estimación */}
        {activity?.has_complete_profile && (
          <p className="text-[10px] text-gray-500 text-center">*Calorías son una estimación basada en tu peso y distancia</p>
        )}

        {/* Añadir pasos */}
        {showAddSteps ? (
          <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-sm text-gray-300 font-medium">Añadir pasos manualmente</p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Ej: 1000"
                value={stepsToAdd}
                onChange={(e) => setStepsToAdd(e.target.value)}
                className="bg-white/5 border-white/10 rounded-xl text-white"
              />
              <Button 
                onClick={handleAddSteps}
                disabled={updating || !stepsToAdd}
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map(amount => (
                <Button
                  key={amount}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuickAdd(amount)}
                  disabled={updating}
                  className="flex-1 text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg"
                >
                  +{amount}
                </Button>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAddSteps(false)}
              className="w-full text-gray-400"
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowAddSteps(true)}
            className="w-full h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5 mr-2" />
            Añadir Pasos
          </Button>
        )}

        {/* Mini historial */}
        {history.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Últimos 7 días
              </p>
              <p className="text-xs text-emerald-400">
                Promedio: {Math.round(history.reduce((a, h) => a + h.steps, 0) / history.length).toLocaleString()} pasos
              </p>
            </div>
            <div className="flex gap-1 h-16">
              {history.slice(0, 7).reverse().map((day, idx) => {
                const heightPercent = Math.min((day.steps / stepsGoal) * 100, 100)
                const isToday = idx === 6
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div 
                      className={`w-full rounded-t-lg transition-all ${
                        isToday 
                          ? 'bg-gradient-to-t from-emerald-500 to-cyan-500' 
                          : 'bg-white/20'
                      }`}
                      style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    />
                    <span className="text-[9px] text-gray-500">
                      {new Date(day.date).toLocaleDateString('es-ES', { weekday: 'narrow' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {/* Información de HealthKit (Requisito Transparencia Apple) */}
        <div className="pt-4 border-t border-white/5">
          <div className="flex items-start gap-2 text-[10px] text-gray-500 leading-relaxed italic text-center justify-center">
            <Heart className="w-3 h-3 text-pink-500/50 flex-shrink-0 mt-0.5" />
            <p>
              NL VIP utiliza los servicios de **Apple HealthKit** para leer el recuento de pasos y proporcionar una experiencia de seguimiento precisa. Puedes gestionar los permisos en Ajustes {">"} Salud.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para Trainer/Admin ver actividad de un socio
export function MemberActivitySummary({ memberId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMemberActivity()
  }, [memberId])

  const loadMemberActivity = async () => {
    try {
      const { data: result, error } = await supabase.rpc('rpc_get_member_activity', { 
        p_member_id: memberId,
        p_days: 7 
      })
      if (error) throw error
      setData(result)
    } catch (err) {
      console.error('Error loading member activity:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-white/5 rounded-xl animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-white/10 rounded w-1/3"></div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl border border-emerald-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Footprints className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-white">Actividad</span>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-xl font-bold text-white">{(data.today?.steps || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400">pasos hoy</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-cyan-400">{(data.today?.distance_km || 0).toFixed(1)}</p>
          <p className="text-xs text-gray-400">km hoy</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-orange-400">{Math.round(data.today?.calories_kcal || 0)}</p>
          <p className="text-xs text-gray-400">kcal hoy</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-xs text-gray-400">Promedio 7 días:</span>
        <span className="text-sm font-semibold text-emerald-400">{(data.avg_steps_7d || 0).toLocaleString()} pasos</span>
      </div>
    </div>
  )
}
