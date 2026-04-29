'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  User, Dumbbell, Apple, Activity, Calendar, Mail, Phone,
  LoaderCircle as Loader2, ChevronRight, X, Pencil as Edit, Flame, Target, Zap, Star, Heart,
  MessageSquare, Bell
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'
import { WorkoutViewer } from './WorkoutBuilder'
import { DietViewer } from './DietBuilder'
import { MemberPhotosAndForm } from './MemberPhotosAndForm'

export function MemberDetailPanel({ member, isOpen, onClose, trainers = [], onRefresh, onOpenChat, canDeletePhotos = true }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [assignedWorkout, setAssignedWorkout] = useState(null)
  const [assignedDiet, setAssignedDiet] = useState(null)
  const [workoutDays, setWorkoutDays] = useState([])
  const [availableWorkouts, setAvailableWorkouts] = useState([])
  const [availableDiets, setAvailableDiets] = useState([])
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [savingReminderFreq, setSavingReminderFreq] = useState(false)
  const { toast } = useToast()

  const REMINDER_FREQUENCY_OPTIONS = [
    { value: 'off', label: 'Sin recordatorio', days: null },
    { value: '7', label: 'Semanal', days: 7 },
    { value: '14', label: 'Cada 2 semanas', days: 14 },
    { value: '21', label: 'Cada 3 semanas', days: 21 },
    { value: '30', label: 'Mensual', days: 30 },
  ]

  const currentReminderValue = memberData?.progress_reminder_days
    ? String(memberData.progress_reminder_days)
    : 'off'

  useEffect(() => {
    if (member && isOpen) {
      loadMemberData()
    }
  }, [member, isOpen])

  const loadMemberData = async () => {
    setLoading(true)
    try {
      // Cargar datos del perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', member.id)
        .single()

      setMemberData(profile)

      // Cargar rutina asignada
      const { data: workoutAssignment } = await supabase
        .from('member_workouts')
        .select(`
          *,
          workout:workout_templates(
            id, name, description,
            workout_days(id, day_number, name)
          )
        `)
        .eq('member_id', member.id)
        .single()

      if (workoutAssignment?.workout) {
        setAssignedWorkout(workoutAssignment.workout)
        setWorkoutDays(workoutAssignment.workout.workout_days || [])
      } else {
        setAssignedWorkout(null)
        setWorkoutDays([])
      }

      // Cargar dieta asignada
      const { data: dietAssignment } = await supabase
        .from('member_diets')
        .select(`
          *,
          diet:diet_templates(id, name, calories, protein_g, carbs_g, fat_g, content)
        `)
        .eq('member_id', member.id)
        .single()

      if (dietAssignment?.diet) {
        setAssignedDiet(dietAssignment.diet)
      } else {
        setAssignedDiet(null)
      }

      // Cargar rutinas disponibles
      const { data: workouts } = await supabase
        .from('workout_templates')
        .select('id, name, trainer_id')
        .order('created_at', { ascending: false })

      setAvailableWorkouts(workouts || [])

      // Cargar dietas disponibles
      const { data: diets } = await supabase
        .from('diet_templates')
        .select('id, name, calories, protein_g, carbs_g, fat_g')
        .order('created_at', { ascending: false })

      setAvailableDiets(diets || [])


    } catch (error) {
      console.error('Error loading member data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignWorkout = async (workoutId) => {
    setAssigning(true)
    try {
      const { error } = await supabase
        .from('member_workouts')
        .upsert([{
          member_id: member.id,
          workout_template_id: workoutId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id
        }], { onConflict: 'member_id' })

      if (error) throw error
      toast({ title: '¡Rutina asignada!' })
      loadMemberData()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const handleReminderFrequencyChange = async (value) => {
    if (!member?.id) return
    const option = REMINDER_FREQUENCY_OPTIONS.find(o => o.value === value)
    if (!option) return
    setSavingReminderFreq(true)
    try {
      const res = await authFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          updates: { progress_reminder_days: option.days },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setMemberData(prev => prev ? { ...prev, progress_reminder_days: option.days } : prev)
      toast({
        title: option.days
          ? `Recordatorio ${option.label.toLowerCase()} activado`
          : 'Recordatorio desactivado',
      })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSavingReminderFreq(false)
    }
  }

  const handleSendProgressReminder = async () => {
    if (!member?.id) return
    try {
      const res = await authFetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: member.id,
          title: '📸 Toca hacer revisión',
          body: 'Sube tus 3 fotos y todas las medidas en la pestaña Progreso.',
          url: '/',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar')
      toast({ title: '✅ Recordatorio enviado', description: `${member.name || 'Socio'} lo recibirá ahora mismo.` })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleAssignDiet = async (dietId) => {
    setAssigning(true)
    try {
      const { error } = await supabase
        .from('member_diets')
        .upsert([{
          member_id: member.id,
          diet_template_id: dietId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id
        }], { onConflict: 'member_id' })

      if (error) throw error
      toast({ title: '¡Dieta asignada!' })
      loadMemberData()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold text-lg">
              {member?.name?.charAt(0)}
            </div>
            <div>
              <span>{member?.name}</span>
              <p className="text-sm text-gray-400 font-normal">{member?.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Bienestar Femenino (Solo si es mujer) */}
            {memberData?.sex === 'female' && (
              <Card className="bg-gradient-to-br from-pink-500/10 to-violet-500/5 border-pink-500/20 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Heart className="w-5 h-5 text-pink-400" />
                    Bienestar Femenino
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-black/30 rounded-xl">
                    <span className="text-sm text-gray-400">Etapa actual:</span>
                    <span className="text-sm font-bold text-pink-300 uppercase">
                      {memberData.life_stage === 'cycle' ? 'Ciclo Natural' :
                        memberData.life_stage === 'pregnant' ? 'Embarazo' :
                          memberData.life_stage === 'postpartum' ? 'Post-parto' :
                            memberData.life_stage === 'lactating' ? 'Lactancia' : 'No configurado'}
                    </span>
                  </div>

                  {memberData.life_stage === 'pregnant' && memberData.due_date && (
                    <div className="p-3 bg-black/30 rounded-xl">
                      <p className="text-xs text-gray-500">Fecha probable de parto:</p>
                      <p className="text-sm text-white font-semibold">{new Date(memberData.due_date).toLocaleDateString()}</p>
                    </div>
                  )}

                  {memberData.life_stage === 'cycle' && memberData.cycle_enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-black/30 rounded-lg">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Ciclo</p>
                        <p className="text-sm text-white">{memberData.cycle_length_days} días</p>
                      </div>
                      <div className="p-2 bg-black/30 rounded-lg">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Periodo</p>
                        <p className="text-sm text-white">{memberData.period_length_days} días</p>
                      </div>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full border-pink-500/30 text-pink-300 hover:bg-pink-500/10 rounded-xl text-xs">
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Acciones Rápidas */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => onOpenChat?.(member)}
                className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl gap-2 h-12"
              >
                <MessageSquare className="w-5 h-5" />
                Mensaje
              </Button>
              <Button
                onClick={handleSendProgressReminder}
                variant="outline"
                className="border-violet-500/30 bg-black/40 text-violet-200 hover:bg-violet-500/10 rounded-xl gap-2 h-12"
              >
                <Bell className="w-5 h-5" />
                Pedir revisión
              </Button>
            </div>

            {/* Recordatorio automático de progreso */}
            <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Bell className="w-5 h-5 text-violet-400" />
                  Recordatorio automático
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-gray-400">
                  Avisa a este socio por notificación para que suba su revisión (3 fotos + todas las medidas) cada cierto tiempo. El aviso se envía por la mañana.
                </p>
                <Select
                  value={currentReminderValue}
                  onValueChange={handleReminderFrequencyChange}
                  disabled={savingReminderFreq}
                >
                  <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white">
                    <SelectValue placeholder="Frecuencia…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_FREQUENCY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {memberData?.last_progress_reminder_at && (
                  <p className="text-[11px] text-gray-500">
                    Último aviso: {new Date(memberData.last_progress_reminder_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Rutina Asignada */}
            <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-violet-400" />
                  Rutina Asignada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignedWorkout ? (
                  <div
                    className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl cursor-pointer hover:bg-violet-500/20 transition-all"
                    onClick={() => setShowWorkoutDetail(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">{assignedWorkout.name}</h4>
                        <p className="text-sm text-gray-400">{workoutDays.length} días de entrenamiento</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-violet-400" />
                    </div>
                    {workoutDays.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {workoutDays.sort((a, b) => a.day_number - b.day_number).map(day => (
                          <span key={day.id} className="px-2 py-1 bg-violet-500/20 rounded-lg text-xs text-violet-300">
                            Día {day.day_number}: {day.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Sin rutina asignada</p>
                )}

                <div className="pt-2">
                  <Select onValueChange={handleAssignWorkout} disabled={assigning}>
                    <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white">
                      <SelectValue placeholder="Asignar rutina..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWorkouts.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Dieta y Macros */}
            <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Apple className="w-5 h-5 text-violet-400" />
                  Dieta y Macros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignedDiet ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                      <h4 className="font-semibold text-white mb-3">{assignedDiet.name}</h4>

                      {/* Macros Details */}
                      <DietViewer dietId={assignedDiet.id} />
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Sin dieta asignada</p>
                )}

                <div className="pt-2">
                  <Select onValueChange={handleAssignDiet} disabled={assigning}>
                    <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white">
                      <SelectValue placeholder="Asignar dieta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDiets.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.calories} kcal)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Fotos de progreso + Cuestionario nutricional consolidados */}
            {member?.id && (
              <MemberPhotosAndForm memberId={member.id} canDeletePhotos={canDeletePhotos} />
            )}
          </div>
        )}

        {/* Modal de detalle de rutina */}
        {showWorkoutDetail && assignedWorkout && (
          <Dialog open={showWorkoutDetail} onOpenChange={() => setShowWorkoutDetail(false)}>
            <DialogContent className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-violet-400" />
                  Rutina: {assignedWorkout.name}
                </DialogTitle>
              </DialogHeader>
              <WorkoutViewer workoutId={assignedWorkout.id} />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default MemberDetailPanel
