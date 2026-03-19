'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  User, Dumbbell, Apple, Heart, Activity, Calendar, Mail, Phone,
  Loader2, ChevronRight, X, Edit, Flame, Target, Zap, Star, TrendingUp, ClipboardList
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { WorkoutViewer } from './WorkoutBuilder'
import { CycleModule } from './CycleModule'
import { PregnancyMode, PostpartumMode, LactationTracker } from './LifeStageModules'

export function MemberDetailPanel({ member, isOpen, onClose, trainers = [], onRefresh }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [assignedWorkout, setAssignedWorkout] = useState(null)
  const [assignedDiet, setAssignedDiet] = useState(null)
  const [workoutDays, setWorkoutDays] = useState([])
  const [availableWorkouts, setAvailableWorkouts] = useState([])
  const [availableDiets, setAvailableDiets] = useState([])
  const [progressRecords, setProgressRecords] = useState([])
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [sendingOnboarding, setSendingOnboarding] = useState(false)
  const { toast } = useToast()

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
      
      // Cargar historial de progreso
      const { data: progress } = await supabase
        .from('progress_records')
        .select('*')
        .eq('member_id', member.id)
        .order('date', { ascending: false })
        .limit(10)

      setProgressRecords(progress || [])

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

  const handleAssignDiet = async (dietId) => {
    setAssigning(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('member_diets')
        .upsert([{
          member_id: member.id,
          diet_template_id: dietId,
          assigned_by: user?.id
        }], { onConflict: 'member_id' })

      if (error) throw error
      
      // GENERAR PLAN DE RECETAS AUTOMÁTICO
      toast({ title: 'Generando plan de recetas...', description: 'Buscando las mejores recetas para tu dieta.' })
      
      try {
        const response = await fetch('/api/generate-recipe-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: member.id,
            dietId: dietId,
            trainerId: user?.id
          })
        })
        
        const result = await response.json()
        if (result.success) {
          toast({ title: '¡Plan de recetas actualizado!', description: `${result.itemsCount} recetas asignadas para tu semana.` })
        }
      } catch (genError) {
        console.error('Error generating recipe plan:', genError)
        // No bloqueamos el éxito de la asignación de dieta si falla el plan de recetas
      }

      toast({ title: '¡Dieta asignada!' })
      loadMemberData()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const handleSendOnboarding = async () => {
    setSendingOnboarding(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check for existing pending request
      const { data: existing, error: checkError } = await supabase
        .from('diet_onboarding_requests')
        .select('id, status')
        .eq('member_id', member.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (checkError) console.error(checkError)

      if (existing) {
        toast({ title: 'Ya existe un cuestionario pendiente', description: 'El socio aún no ha respondido el formulario.' })
        return
      }

      // Create new request
      const { error: insertError } = await supabase
        .from('diet_onboarding_requests')
        .insert({
          member_id: member.id,
          requested_by: user?.id,
          status: 'pending'
        })

      if (insertError) throw insertError

      toast({ title: '✅ Cuestionario enviado', description: 'El socio verá el formulario la próxima vez que abra su app.' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSendingOnboarding(false)
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
              <Card className="bg-gradient-to-br from-pink-500/10 to-violet-500/5 border-pink-500/20 rounded-2xl overflow-hidden">
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
                      {memberData?.life_stage === 'cycle' ? 'Ciclo Natural' :
                        memberData?.life_stage === 'pregnant' ? 'Embarazo' :
                          memberData?.life_stage === 'postpartum' ? 'Post-parto' :
                            memberData?.life_stage === 'lactating' ? 'Lactancia' : 'No configurado'}
                    </span>
                  </div>

                  {(!memberData?.life_stage || memberData.life_stage === 'cycle') && (
                    <CycleModule user={{ id: member.id }} profile={memberData} variant="compact" onProfileUpdate={loadMemberData} />
                  )}
                  {memberData?.life_stage === 'pregnant' && (
                    <PregnancyMode userId={member.id} profile={memberData} onUpdate={loadMemberData} />
                  )}
                  {memberData?.life_stage === 'postpartum' && (
                    <PostpartumMode userId={member.id} profile={memberData} onUpdate={loadMemberData} />
                  )}
                  {memberData?.life_stage === 'lactating' && (
                    <div className="space-y-4">
                      <LactationTracker userId={member.id} />
                      <PostpartumMode userId={member.id} profile={memberData} onUpdate={loadMemberData} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                        {[...workoutDays].sort((a, b) => (a.day_number || 0) - (b.day_number || 0)).map(day => (
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

                      {/* Macros Grid */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-orange-500/20 rounded-xl p-3 text-center">
                          <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{assignedDiet.calories}</p>
                          <p className="text-xs text-gray-400">kcal</p>
                        </div>
                        <div className="bg-blue-500/20 rounded-xl p-3 text-center">
                          <Target className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{assignedDiet.protein_g}g</p>
                          <p className="text-xs text-gray-400">Proteína</p>
                        </div>
                        <div className="bg-yellow-500/20 rounded-xl p-3 text-center">
                          <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{assignedDiet.carbs_g}g</p>
                          <p className="text-xs text-gray-400">Carbos</p>
                        </div>
                        <div className="bg-purple-500/20 rounded-xl p-3 text-center">
                          <Star className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{assignedDiet.fat_g}g</p>
                          <p className="text-xs text-gray-400">Grasas</p>
                        </div>
                      </div>

                      {assignedDiet.content && (
                        <div className="mt-3 p-3 bg-black/30 rounded-xl">
                          <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-4">
                            {assignedDiet.content}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Sin dieta asignada</p>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <Select onValueChange={handleAssignDiet} disabled={assigning || sendingOnboarding}>
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

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-wider">O</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <Button 
                    onClick={handleSendOnboarding}
                    disabled={sendingOnboarding || assigning}
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700 text-white shadow-lg shadow-violet-500/20"
                  >
                    {sendingOnboarding ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ClipboardList className="w-4 h-4 mr-2" />
                    )}
                    Solicitar cuestionario (IA)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Historial de Medidas */}
            <Card className="bg-black/30 border-violet-500/20 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                  Historial de Medidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {progressRecords.length > 0 ? (
                  progressRecords.map(r => (
                    <div key={r.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-violet-400 text-xs font-bold">{new Date(r.date).toLocaleDateString()}</p>
                        {r.weight_kg && <p className="text-sm font-black text-white">{r.weight_kg} kg</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-400">
                        {r.chest_cm && <span>Pecho: {r.chest_cm}cm</span>}
                        {r.waist_cm && <span>Cintura: {r.waist_cm}cm</span>}
                        {r.hips_cm && <span>Cadera: {r.hips_cm}cm</span>}
                        {r.arms_cm && <span>Brazos: {r.arms_cm}cm</span>}
                        {r.legs_cm && <span>Piernas: {r.legs_cm}cm</span>}
                        {r.glutes_cm && <span>Glúteo: {r.glutes_cm}cm</span>}
                        {r.calves_cm && <span>Gemelo: {r.calves_cm}cm</span>}
                      </div>
                      {r.notes && (
                        <p className="text-[10px] text-gray-500 mt-2 italic border-t border-white/5 pt-1">
                          "{r.notes}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm py-4 text-center">Sin registros de progreso</p>
                )}
              </CardContent>
            </Card>
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
