'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  User, Dumbbell, Apple, Activity, Calendar, Mail, Phone, 
  Loader2, ChevronRight, X, Edit, Flame, Target, Zap, Star
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { WorkoutViewer } from './WorkoutBuilder'

export function MemberDetailPanel({ member, isOpen, onClose, trainers = [], onRefresh }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [assignedWorkout, setAssignedWorkout] = useState(null)
  const [assignedDiet, setAssignedDiet] = useState(null)
  const [workoutDays, setWorkoutDays] = useState([])
  const [availableWorkouts, setAvailableWorkouts] = useState([])
  const [availableDiets, setAvailableDiets] = useState([])
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(false)
  const [assigning, setAssigning] = useState(false)
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
            {/* Info básica */}
            <div className="grid grid-cols-2 gap-3">
              {memberData?.phone && (
                <div className="flex items-center gap-2 p-3 bg-black/30 rounded-xl">
                  <Phone className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-gray-300">{memberData.phone}</span>
                </div>
              )}
              {memberData?.birth_date && (
                <div className="flex items-center gap-2 p-3 bg-black/30 rounded-xl">
                  <Calendar className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-gray-300">
                    {new Date(memberData.birth_date).toLocaleDateString('es-ES')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 p-3 bg-black/30 rounded-xl">
                <Activity className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-gray-300">
                  {memberData?.has_premium ? 'Premium' : 'Básico'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-black/30 rounded-xl">
                <Calendar className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-gray-300">
                  Desde {new Date(memberData?.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>
            </div>

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
