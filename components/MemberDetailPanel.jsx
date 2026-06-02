'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dumbbell, Heart,
  LoaderCircle as Loader2, ChevronRight, MessageSquare, Bell, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'
import { WorkoutViewer } from './WorkoutBuilder'
import { DietViewer } from './DietBuilder'
import { ProgressPhotoGallery } from './ProgressPhotos'
import { MemberOnboardingResponses } from './MemberPhotosAndForm'

export function MemberDetailPanel({ member, isOpen, onClose, trainers = [], onRefresh, onOpenChat, initialTab = 'form' }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [assignedWorkout, setAssignedWorkout] = useState(null)
  const [assignedDiet, setAssignedDiet] = useState(null)
  const [workoutDays, setWorkoutDays] = useState([])
  const [availableWorkouts, setAvailableWorkouts] = useState([])
  const [availableDiets, setAvailableDiets] = useState([])
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(false)
  const [showDietContent, setShowDietContent] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [savingReminderFreq, setSavingReminderFreq] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [memberProgressPhotos, setMemberProgressPhotos] = useState([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
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
      setActiveTab(initialTab)
      setMemberProgressPhotos([])
      setShowDietContent(false)
      setShowWorkoutDetail(false)
      loadMemberData()
    }
  }, [member, isOpen])

  useEffect(() => {
    if (activeTab === 'photos' && member?.id && memberProgressPhotos.length === 0 && !loadingPhotos) {
      loadPhotos()
    }
  }, [activeTab])

  const loadMemberData = async () => {
    setLoading(true)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', member.id)
        .single()

      setMemberData(profile)

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

      const { data: workouts } = await supabase
        .from('workout_templates')
        .select('id, name, trainer_id')
        .order('created_at', { ascending: false })

      setAvailableWorkouts(workouts || [])

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

  const loadPhotos = async () => {
    if (!member?.id) return
    setLoadingPhotos(true)
    try {
      const { data } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('member_id', member.id)
        .order('date', { ascending: false })
      setMemberProgressPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoadingPhotos(false)
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

  const handleAssignDiet = async (dietId) => {
    setAssigning(true)
    try {
      const assignerId = (await supabase.auth.getUser()).data.user?.id
      const { error } = await supabase
        .from('member_diets')
        .upsert([{
          member_id: member.id,
          diet_template_id: dietId,
          assigned_by: assignerId
        }], { onConflict: 'member_id' })

      if (error) throw error
      toast({ title: '¡Dieta asignada!', description: 'Generando plan de recetas acorde a los macros...' })

      fetch('/api/generate-recipe-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, dietId, trainerId: assignerId })
      }).catch(e => console.warn('Recipe plan generation failed:', e))

      loadMemberData()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const handleRegeneratePlan = async () => {
    if (!assignedDiet) {
      toast({ title: 'Error', description: 'El socio no tiene dieta asignada', variant: 'destructive' })
      return
    }
    setRegenerating(true)
    try {
      const assignerId = (await supabase.auth.getUser()).data.user?.id
      const res = await fetch('/api/generate-recipe-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, dietId: assignedDiet.id, trainerId: assignerId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando plan')
      toast({ title: '¡Plan generado!', description: data.message })
    } catch (error) {
      toast({ title: 'Error al generar plan', description: error.message, variant: 'destructive' })
    } finally {
      setRegenerating(false)
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
          <div className="space-y-4 py-2">
            {/* Acciones rápidas */}
            <div className="flex gap-2">
              <Button
                onClick={() => onOpenChat?.(member)}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl gap-2 h-10"
              >
                <MessageSquare className="w-4 h-4" />
                Mensaje
              </Button>
              <Button
                onClick={handleSendProgressReminder}
                variant="outline"
                className="flex-1 border-violet-500/30 bg-black/40 text-violet-200 hover:bg-violet-500/10 rounded-xl gap-2 h-10"
              >
                <Bell className="w-4 h-4" />
                Pedir revisión
              </Button>
              <Select
                value={currentReminderValue}
                onValueChange={handleReminderFrequencyChange}
                disabled={savingReminderFreq}
              >
                <SelectTrigger className="w-40 h-10 bg-black/50 border-violet-500/20 rounded-xl text-white text-xs">
                  <Bell className="w-3 h-3 mr-1 text-violet-400" />
                  <SelectValue placeholder="Recordatorio…" />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_FREQUENCY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabs de 4 secciones */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 bg-black/40 border border-violet-500/20 rounded-xl h-11 w-full">
                <TabsTrigger value="form" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white rounded-lg text-lg">
                  📋
                </TabsTrigger>
                <TabsTrigger value="photos" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white rounded-lg text-lg">
                  📸
                </TabsTrigger>
                <TabsTrigger value="workout" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white rounded-lg text-lg">
                  💪
                </TabsTrigger>
                <TabsTrigger value="diet" className="data-[state=active]:bg-green-700 data-[state=active]:text-white rounded-lg text-lg">
                  🥗
                </TabsTrigger>
              </TabsList>

              {/* Tab: Formulario */}
              <TabsContent value="form" className="mt-4 space-y-4">
                {memberData?.sex === 'female' && (
                  <Card className="bg-gradient-to-br from-pink-500/10 to-violet-500/5 border-pink-500/20 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <Heart className="w-5 h-5 text-pink-400" />
                        Bienestar Femenino
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                    </CardContent>
                  </Card>
                )}
                <MemberOnboardingResponses memberId={member.id} defaultOpen={true} />
              </TabsContent>

              {/* Tab: Fotos y Medidas */}
              <TabsContent value="photos" className="mt-4">
                {loadingPhotos ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                ) : (
                  <ProgressPhotoGallery
                    photos={memberProgressPhotos}
                    canDelete={true}
                  />
                )}
              </TabsContent>

              {/* Tab: Rutina */}
              <TabsContent value="workout" className="mt-4 space-y-4">
                <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
                  <CardContent className="pt-4 space-y-3">
                    {assignedWorkout ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-white">{assignedWorkout.name}</h4>
                              <p className="text-sm text-gray-400">{workoutDays.length} días de entrenamiento</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-violet-400 hover:text-violet-300 gap-1"
                              onClick={() => setShowWorkoutDetail(true)}
                            >
                              Ver detalle <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                          {workoutDays.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {workoutDays.sort((a, b) => a.day_number - b.day_number).map(day => (
                                <span key={day.id} className="px-2 py-1 bg-violet-500/20 rounded-lg text-xs text-violet-300">
                                  Día {day.day_number}: {day.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Sin rutina asignada</p>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Asignar / cambiar rutina:</p>
                      <Select onValueChange={handleAssignWorkout} disabled={assigning}>
                        <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white">
                          <SelectValue placeholder="Seleccionar rutina..." />
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
              </TabsContent>

              {/* Tab: Dieta */}
              <TabsContent value="diet" className="mt-4 space-y-4">
                <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
                  <CardContent className="pt-4 space-y-3">
                    {assignedDiet ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-white">{assignedDiet.name}</h4>
                              <p className="text-xs text-gray-400 mt-1">
                                {assignedDiet.calories} kcal · P:{assignedDiet.protein_g}g · HC:{assignedDiet.carbs_g}g · G:{assignedDiet.fat_g}g
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-400 hover:text-green-300 gap-1"
                              onClick={() => setShowDietContent(v => !v)}
                            >
                              {showDietContent ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {showDietContent ? 'Ocultar' : 'Ver dieta'}
                            </Button>
                          </div>
                          {showDietContent && (
                            <div className="mt-3 border-t border-green-500/20 pt-3">
                              <DietViewer dietId={assignedDiet.id} />
                            </div>
                          )}
                        </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-violet-500/30 text-violet-300 hover:bg-violet-500/10 gap-2"
                        onClick={handleRegeneratePlan}
                        disabled={regenerating || !assignedDiet}
                      >
                        {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {regenerating ? 'Generando recetas...' : 'Regenerar plan de recetas'}
                      </Button>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Sin dieta asignada</p>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Asignar / cambiar dieta:</p>
                      <Select onValueChange={handleAssignDiet} disabled={assigning}>
                        <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white">
                          <SelectValue placeholder="Seleccionar dieta..." />
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
              </TabsContent>
            </Tabs>
          </div>
        )}

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
