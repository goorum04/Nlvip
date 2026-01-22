'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Plus, Trash2, Video, Upload, Loader2, ChevronDown, ChevronUp, 
  Dumbbell, Calendar, Play, GripVertical, Save, X, Eye
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Componente para subir video de ejercicio
function ExerciseVideoUploader({ onVideoUploaded, existingVideo, trainerId }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef(null)
  const { toast } = useToast()

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Error', description: 'Solo se permiten videos', variant: 'destructive' })
      return
    }

    // Validar tamaño (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: 'Error', description: 'El video no puede superar 100MB', variant: 'destructive' })
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const ext = file.name.split('.').pop()
      const fileName = `${trainerId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`

      const { data, error } = await supabase.storage
        .from('exercise_videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Obtener URL firmada
      const { data: urlData } = await supabase.storage
        .from('exercise_videos')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 año

      onVideoUploaded(fileName, urlData?.signedUrl)
      toast({ title: '¡Video subido!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleUpload}
        className="hidden"
      />
      
      {existingVideo ? (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-xl">
          <Video className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-400 flex-1">Video subido</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onVideoUploaded(null, null)}
            className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full border-dashed border-violet-500/30 text-violet-400 hover:bg-violet-500/10 rounded-xl"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Subir Video</>
          )}
        </Button>
      )}
    </div>
  )
}

// Componente para un ejercicio individual
function ExerciseItem({ exercise, onUpdate, onDelete, trainerId, isEditing }) {
  const [localExercise, setLocalExercise] = useState(exercise)

  useEffect(() => {
    setLocalExercise(exercise)
  }, [exercise])

  const handleChange = (field, value) => {
    const updated = { ...localExercise, [field]: value }
    setLocalExercise(updated)
    onUpdate(updated)
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-[#2a2a2a]">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold">
          {exercise.order_index + 1}
        </div>
        <div className="flex-1">
          <p className="text-white font-medium">{exercise.name}</p>
          <p className="text-xs text-gray-500">{exercise.sets}x{exercise.reps} • {exercise.rest_seconds}s descanso</p>
        </div>
        {exercise.video_url && (
          <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center">
            <Video className="w-3 h-3 text-green-500" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 bg-black/40 rounded-xl border border-violet-500/20 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold cursor-move">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-3">
          <Input
            value={localExercise.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Nombre del ejercicio"
            className="bg-black/50 border-violet-500/20 rounded-xl text-white"
          />
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-gray-500 text-xs">Series</Label>
              <Input
                type="number"
                value={localExercise.sets}
                onChange={(e) => handleChange('sets', parseInt(e.target.value) || 3)}
                className="bg-black/50 border-violet-500/20 rounded-lg text-white text-center"
              />
            </div>
            <div>
              <Label className="text-gray-500 text-xs">Reps</Label>
              <Input
                value={localExercise.reps}
                onChange={(e) => handleChange('reps', e.target.value)}
                placeholder="10-12"
                className="bg-black/50 border-violet-500/20 rounded-lg text-white text-center"
              />
            </div>
            <div>
              <Label className="text-gray-500 text-xs">Descanso (s)</Label>
              <Input
                type="number"
                value={localExercise.rest_seconds}
                onChange={(e) => handleChange('rest_seconds', parseInt(e.target.value) || 60)}
                className="bg-black/50 border-violet-500/20 rounded-lg text-white text-center"
              />
            </div>
          </div>

          <Textarea
            value={localExercise.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Instrucciones o notas (opcional)"
            className="bg-black/50 border-violet-500/20 rounded-xl text-white text-sm min-h-[60px]"
          />

          <ExerciseVideoUploader
            trainerId={trainerId}
            existingVideo={localExercise.video_url}
            onVideoUploaded={(path, url) => {
              handleChange('video_url', path)
            }}
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// Componente para un día de entrenamiento
function WorkoutDayCard({ day, exercises, onUpdateDay, onDeleteDay, onAddExercise, onUpdateExercise, onDeleteExercise, trainerId, isEditing }) {
  const [expanded, setExpanded] = useState(true)
  const [dayName, setDayName] = useState(day.name)

  return (
    <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold">
            {day.day_number}
          </div>
          {isEditing ? (
            <Input
              value={dayName}
              onChange={(e) => setDayName(e.target.value)}
              onBlur={() => onUpdateDay({ ...day, name: dayName })}
              placeholder="Nombre del día (ej: Pecho y Tríceps)"
              className="flex-1 bg-black/50 border-violet-500/20 rounded-xl text-white font-semibold"
            />
          ) : (
            <h3 className="flex-1 text-white font-semibold">{day.name || `Día ${day.day_number}`}</h3>
          )}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">{exercises.length} ejercicios</span>
            {isEditing && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onDeleteDay}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 h-8 w-8"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-3 pt-2">
          {exercises.map((exercise, idx) => (
            <ExerciseItem
              key={exercise.id || idx}
              exercise={{ ...exercise, order_index: idx }}
              onUpdate={(updated) => onUpdateExercise(idx, updated)}
              onDelete={() => onDeleteExercise(idx)}
              trainerId={trainerId}
              isEditing={isEditing}
            />
          ))}
          
          {isEditing && (
            <Button
              variant="outline"
              onClick={onAddExercise}
              className="w-full border-dashed border-violet-500/30 text-violet-400 hover:bg-violet-500/10 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" /> Añadir Ejercicio
            </Button>
          )}
          
          {exercises.length === 0 && !isEditing && (
            <p className="text-center text-gray-500 py-4 text-sm">Sin ejercicios</p>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// Componente principal para crear/editar rutinas
export function WorkoutBuilder({ trainerId, existingWorkout = null, onSave, onCancel }) {
  const [workoutName, setWorkoutName] = useState(existingWorkout?.name || '')
  const [workoutDesc, setWorkoutDesc] = useState(existingWorkout?.description || '')
  const [days, setDays] = useState([])
  const [exercisesByDay, setExercisesByDay] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(!!existingWorkout)
  const { toast } = useToast()

  useEffect(() => {
    if (existingWorkout) {
      loadExistingWorkout()
    }
  }, [existingWorkout])

  const loadExistingWorkout = async () => {
    setLoadingData(true)
    try {
      // Cargar días
      const { data: daysData } = await supabase
        .from('workout_days')
        .select('*')
        .eq('workout_template_id', existingWorkout.id)
        .order('day_number')

      if (daysData) {
        setDays(daysData)
        
        // Cargar ejercicios de cada día
        const exercisesMap = {}
        for (const day of daysData) {
          const { data: exercisesData } = await supabase
            .from('workout_exercises')
            .select('*')
            .eq('workout_day_id', day.id)
            .order('order_index')
          
          exercisesMap[day.id] = exercisesData || []
        }
        setExercisesByDay(exercisesMap)
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' })
    } finally {
      setLoadingData(false)
    }
  }

  const addDay = () => {
    const newDay = {
      id: `temp_${Date.now()}`,
      day_number: days.length + 1,
      name: '',
      description: ''
    }
    setDays([...days, newDay])
    setExercisesByDay({ ...exercisesByDay, [newDay.id]: [] })
  }

  const updateDay = (index, updatedDay) => {
    const newDays = [...days]
    newDays[index] = updatedDay
    setDays(newDays)
  }

  const deleteDay = (index) => {
    const dayToDelete = days[index]
    const newDays = days.filter((_, i) => i !== index).map((d, i) => ({ ...d, day_number: i + 1 }))
    setDays(newDays)
    
    const newExercises = { ...exercisesByDay }
    delete newExercises[dayToDelete.id]
    setExercisesByDay(newExercises)
  }

  const addExercise = (dayId) => {
    const newExercise = {
      id: `temp_${Date.now()}`,
      name: '',
      sets: 3,
      reps: '10',
      rest_seconds: 90,
      description: '',
      video_url: null,
      order_index: (exercisesByDay[dayId] || []).length
    }
    setExercisesByDay({
      ...exercisesByDay,
      [dayId]: [...(exercisesByDay[dayId] || []), newExercise]
    })
  }

  const updateExercise = (dayId, exerciseIndex, updatedExercise) => {
    const dayExercises = [...(exercisesByDay[dayId] || [])]
    dayExercises[exerciseIndex] = updatedExercise
    setExercisesByDay({ ...exercisesByDay, [dayId]: dayExercises })
  }

  const deleteExercise = (dayId, exerciseIndex) => {
    const dayExercises = (exercisesByDay[dayId] || []).filter((_, i) => i !== exerciseIndex)
    setExercisesByDay({ ...exercisesByDay, [dayId]: dayExercises })
  }

  const handleSave = async () => {
    if (!workoutName.trim()) {
      toast({ title: 'Error', description: 'El nombre de la rutina es obligatorio', variant: 'destructive' })
      return
    }

    if (days.length === 0) {
      toast({ title: 'Error', description: 'Añade al menos un día de entrenamiento', variant: 'destructive' })
      return
    }

    // Validar que cada día tenga al menos un ejercicio con video
    for (const day of days) {
      const dayExercises = exercisesByDay[day.id] || []
      if (dayExercises.length === 0) {
        toast({ title: 'Error', description: `El ${day.name || 'Día ' + day.day_number} necesita al menos un ejercicio`, variant: 'destructive' })
        return
      }
      
      for (const exercise of dayExercises) {
        if (!exercise.name.trim()) {
          toast({ title: 'Error', description: 'Todos los ejercicios deben tener nombre', variant: 'destructive' })
          return
        }
      }
    }

    setLoading(true)
    try {
      let workoutId = existingWorkout?.id

      // Crear o actualizar la rutina
      if (existingWorkout) {
        const { error } = await supabase
          .from('workout_templates')
          .update({ name: workoutName, description: workoutDesc })
          .eq('id', existingWorkout.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('workout_templates')
          .insert([{ trainer_id: trainerId, name: workoutName, description: workoutDesc }])
          .select()
          .single()
        if (error) throw error
        workoutId = data.id
      }

      // Eliminar días existentes si es edición (se eliminarán en cascada los ejercicios)
      if (existingWorkout) {
        await supabase.from('workout_days').delete().eq('workout_template_id', workoutId)
      }

      // Crear días y ejercicios
      for (const day of days) {
        const { data: dayData, error: dayError } = await supabase
          .from('workout_days')
          .insert([{
            workout_template_id: workoutId,
            day_number: day.day_number,
            name: day.name || `Día ${day.day_number}`,
            description: day.description
          }])
          .select()
          .single()

        if (dayError) throw dayError

        // Crear ejercicios del día
        const dayExercises = exercisesByDay[day.id] || []
        if (dayExercises.length > 0) {
          const exercisesToInsert = dayExercises.map((ex, idx) => ({
            workout_day_id: dayData.id,
            name: ex.name,
            description: ex.description,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            video_url: ex.video_url,
            order_index: idx
          }))

          const { error: exError } = await supabase
            .from('workout_exercises')
            .insert(exercisesToInsert)

          if (exError) throw exError
        }
      }

      toast({ title: existingWorkout ? '¡Rutina actualizada!' : '¡Rutina creada!' })
      onSave?.()
    } catch (error) {
      console.error('Error saving workout:', error)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Información básica */}
      <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-violet-400" />
            {existingWorkout ? 'Editar Rutina' : 'Nueva Rutina'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-400 text-sm">Nombre de la rutina</Label>
            <Input
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Ej: Hipertrofia 4 días"
              className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">Descripción (opcional)</Label>
            <Textarea
              value={workoutDesc}
              onChange={(e) => setWorkoutDesc(e.target.value)}
              placeholder="Descripción general de la rutina..."
              className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Días de entrenamiento */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-400" />
            Días de Entrenamiento ({days.length})
          </h3>
          <Button
            onClick={addDay}
            className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" /> Añadir Día
          </Button>
        </div>

        {days.map((day, index) => (
          <WorkoutDayCard
            key={day.id}
            day={day}
            exercises={exercisesByDay[day.id] || []}
            onUpdateDay={(updated) => updateDay(index, updated)}
            onDeleteDay={() => deleteDay(index)}
            onAddExercise={() => addExercise(day.id)}
            onUpdateExercise={(exIdx, updated) => updateExercise(day.id, exIdx, updated)}
            onDeleteExercise={(exIdx) => deleteExercise(day.id, exIdx)}
            trainerId={trainerId}
            isEditing={true}
          />
        ))}

        {days.length === 0 && (
          <div className="text-center py-12 bg-[#1a1a1a] rounded-2xl border border-dashed border-violet-500/30">
            <Calendar className="w-12 h-12 mx-auto text-violet-400/30 mb-3" />
            <p className="text-gray-500">Añade días de entrenamiento para comenzar</p>
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 border-gray-600 text-gray-400 hover:bg-gray-800 rounded-xl py-6"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl py-6"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
          ) : (
            <><Save className="w-5 h-5 mr-2" /> Guardar Rutina</>
          )}
        </Button>
      </div>
    </div>
  )
}

// Componente para ver una rutina (modo lectura)
export function WorkoutViewer({ workoutId }) {
  const [workout, setWorkout] = useState(null)
  const [days, setDays] = useState([])
  const [exercisesByDay, setExercisesByDay] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState(null)

  useEffect(() => {
    loadWorkout()
  }, [workoutId])

  const loadWorkout = async () => {
    setLoading(true)
    try {
      // Cargar rutina
      const { data: workoutData } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('id', workoutId)
        .single()

      if (workoutData) {
        setWorkout(workoutData)

        // Cargar días
        const { data: daysData } = await supabase
          .from('workout_days')
          .select('*')
          .eq('workout_template_id', workoutId)
          .order('day_number')

        if (daysData) {
          setDays(daysData)

          // Cargar ejercicios
          const exercisesMap = {}
          for (const day of daysData) {
            const { data: exercisesData } = await supabase
              .from('workout_exercises')
              .select('*')
              .eq('workout_day_id', day.id)
              .order('order_index')

            exercisesMap[day.id] = exercisesData || []
          }
          setExercisesByDay(exercisesMap)
        }
      }
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const getVideoUrl = async (videoPath) => {
    if (!videoPath) return null
    const { data } = await supabase.storage
      .from('exercise_videos')
      .createSignedUrl(videoPath, 3600)
    return data?.signedUrl
  }

  const playVideo = async (exercise) => {
    const url = await getVideoUrl(exercise.video_url)
    if (url) {
      setSelectedVideo({ ...exercise, signedUrl: url })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  if (!workout) {
    return <p className="text-gray-500 text-center py-8">Rutina no encontrada</p>
  }

  return (
    <div className="space-y-4">
      {/* Header de la rutina */}
      <div className="bg-gradient-to-br from-violet-500/20 to-cyan-500/10 rounded-2xl p-5 border border-violet-500/20">
        <h2 className="text-xl font-bold text-white mb-1">{workout.name}</h2>
        {workout.description && (
          <p className="text-gray-400 text-sm">{workout.description}</p>
        )}
        <p className="text-violet-400 text-sm mt-2">{days.length} días de entrenamiento</p>
      </div>

      {/* Días */}
      {days.map((day) => (
        <WorkoutDayCard
          key={day.id}
          day={day}
          exercises={(exercisesByDay[day.id] || []).map((ex, idx) => ({
            ...ex,
            order_index: idx,
            onPlay: ex.video_url ? () => playVideo(ex) : null
          }))}
          onUpdateDay={() => {}}
          onDeleteDay={() => {}}
          onAddExercise={() => {}}
          onUpdateExercise={() => {}}
          onDeleteExercise={() => {}}
          trainerId={null}
          isEditing={false}
        />
      ))}

      {/* Modal de video */}
      {selectedVideo && (
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">{selectedVideo.name}</DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <video
                src={selectedVideo.signedUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
            {selectedVideo.description && (
              <p className="text-gray-400 text-sm">{selectedVideo.description}</p>
            )}
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{selectedVideo.sets} series</span>
              <span>{selectedVideo.reps} reps</span>
              <span>{selectedVideo.rest_seconds}s descanso</span>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default WorkoutBuilder
