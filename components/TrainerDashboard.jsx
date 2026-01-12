'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Dumbbell, Users, Bell, LogOut, Plus, Apple, Sparkles, Eye, Send, 
  Video, Camera, TrendingUp, Trash2, Loader2, Calculator, Target, Trophy
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import FloatingChat from './FloatingChat'
import VideoUploader from './VideoUploader'
import { VideoCard } from './VideoPlayer'
import { ProgressPhotoGallery } from './ProgressPhotos'

export default function TrainerDashboard({ user, profile, onLogout }) {
  const [members, setMembers] = useState([])
  const [workoutTemplates, setWorkoutTemplates] = useState([])
  const [dietTemplates, setDietTemplates] = useState([])
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMemberForProgress, setSelectedMemberForProgress] = useState(null)
  const [memberProgressPhotos, setMemberProgressPhotos] = useState([])
  const [selectedWorkoutForVideos, setSelectedWorkoutForVideos] = useState(null)
  const [workoutVideos, setWorkoutVideos] = useState({})
  const [showVideoUploader, setShowVideoUploader] = useState(null)
  const { toast } = useToast()

  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutDesc, setNewWorkoutDesc] = useState('')
  const [newDietName, setNewDietName] = useState('')
  const [newDietCalories, setNewDietCalories] = useState('')
  const [newDietProtein, setNewDietProtein] = useState('')
  const [newDietCarbs, setNewDietCarbs] = useState('')
  const [newDietFat, setNewDietFat] = useState('')
  const [newDietContent, setNewDietContent] = useState('')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [noticePriority, setNoticePriority] = useState('normal')
  const [noticeRecipient, setNoticeRecipient] = useState('all')

  // Macro calculator states
  const [macroGender, setMacroGender] = useState('male')
  const [macroAge, setMacroAge] = useState('')
  const [macroHeight, setMacroHeight] = useState('')
  const [macroWeight, setMacroWeight] = useState('')
  const [macroActivity, setMacroActivity] = useState('moderate')
  const [macroGoal, setMacroGoal] = useState('maintain')
  const [macroResults, setMacroResults] = useState(null)
  const [selectedMemberForMacros, setSelectedMemberForMacros] = useState('')

  // Challenge states
  const [challenges, setChallenges] = useState([])
  const [challengeTitle, setChallengeTitle] = useState('')
  const [challengeDesc, setChallengeDesc] = useState('')
  const [challengeType, setChallengeType] = useState('workouts')
  const [challengeTarget, setChallengeTarget] = useState('')
  const [challengeDays, setChallengeDays] = useState('14')
  const [challengeParticipants, setChallengeParticipants] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([loadMembers(), loadWorkoutTemplates(), loadDietTemplates(), loadNotices(), loadChallenges()])
  }

  const loadChallenges = async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    
    if (data) {
      setChallenges(data)
      // Load participants for each challenge
      for (const challenge of data) {
        const { data: parts } = await supabase
          .from('challenge_participants')
          .select('*, member:profiles!challenge_participants_member_id_fkey(name)')
          .eq('challenge_id', challenge.id)
        if (parts) {
          setChallengeParticipants(prev => ({ ...prev, [challenge.id]: parts }))
        }
      }
    }
  }

  const createChallenge = async (e) => {
    e.preventDefault()
    if (!challengeTitle || !challengeTarget) {
      toast({ title: 'Error', description: 'Completa todos los campos', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const startDate = new Date()
      const endDate = new Date(startDate.getTime() + parseInt(challengeDays) * 86400000)
      
      const { error } = await supabase.from('challenges').insert([{
        title: challengeTitle,
        description: challengeDesc,
        type: challengeType,
        target_value: parseFloat(challengeTarget),
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        created_by: user.id,
        is_active: true
      }])
      
      if (error) throw error
      toast({ title: '¡Reto creado!', description: 'Los socios ya pueden unirse' })
      setChallengeTitle('')
      setChallengeDesc('')
      setChallengeTarget('')
      loadChallenges()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    const { data } = await supabase
      .from('trainer_members')
      .select(`member_id, member:profiles!trainer_members_member_id_fkey(id, name, email, created_at)`)
      .eq('trainer_id', user.id)
    if (data) setMembers(data.map(tm => tm.member))
  }

  const loadWorkoutTemplates = async () => {
    const { data } = await supabase.from('workout_templates').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false })
    if (data) {
      setWorkoutTemplates(data)
      // Load videos for each workout
      const videos = {}
      for (const workout of data) {
        const { data: workoutVids } = await supabase
          .from('workout_videos')
          .select('*')
          .eq('workout_template_id', workout.id)
          .order('created_at')
        if (workoutVids) videos[workout.id] = workoutVids
      }
      setWorkoutVideos(videos)
    }
  }

  const loadDietTemplates = async () => {
    const { data } = await supabase.from('diet_templates').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false })
    if (data) setDietTemplates(data)
  }

  const loadNotices = async () => {
    const { data } = await supabase.from('trainer_notices').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false }).limit(10)
    if (data) setNotices(data)
  }

  const loadMemberProgressPhotos = async (memberId) => {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false })
    if (data) setMemberProgressPhotos(data)
  }

  const handleViewMemberProgress = (member) => {
    setSelectedMemberForProgress(member)
    loadMemberProgressPhotos(member.id)
  }

  const handleCreateWorkout = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('workout_templates').insert([{ trainer_id: user.id, name: newWorkoutName, description: newWorkoutDesc }])
      if (error) throw error
      toast({ title: '¡Rutina creada!' })
      setNewWorkoutName(''); setNewWorkoutDesc('')
      loadWorkoutTemplates()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDiet = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('diet_templates').insert([{
        trainer_id: user.id, name: newDietName, calories: parseInt(newDietCalories),
        protein_g: parseInt(newDietProtein), carbs_g: parseInt(newDietCarbs), fat_g: parseInt(newDietFat), content: newDietContent
      }])
      if (error) throw error
      toast({ title: '¡Dieta creada!' })
      setNewDietName(''); setNewDietCalories(''); setNewDietProtein(''); setNewDietCarbs(''); setNewDietFat(''); setNewDietContent('')
      loadDietTemplates()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleAssignWorkout = async (memberId, templateId) => {
    try {
      const { error } = await supabase.from('member_workouts').upsert({ member_id: memberId, workout_template_id: templateId, assigned_by: user.id }, { onConflict: 'member_id' })
      if (error) throw error
      toast({ title: '¡Rutina asignada!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleAssignDiet = async (memberId, templateId) => {
    try {
      const { error } = await supabase.from('member_diets').upsert({ member_id: memberId, diet_template_id: templateId, assigned_by: user.id }, { onConflict: 'member_id' })
      if (error) throw error
      toast({ title: '¡Dieta asignada!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteVideo = async (videoId) => {
    if (!confirm('¿Eliminar este vídeo?')) return
    
    const { error } = await supabase.from('workout_videos').delete().eq('id', videoId)
    if (!error) {
      toast({ title: 'Vídeo eliminado' })
      loadWorkoutTemplates()
    }
  }

  const handleCreateNotice = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('trainer_notices').insert([{
        trainer_id: user.id, member_id: noticeRecipient !== 'all' ? noticeRecipient : null,
        title: noticeTitle, message: noticeMessage, priority: noticePriority
      }])
      if (error) throw error
      toast({ title: '¡Aviso enviado!' })
      setNoticeTitle(''); setNoticeMessage(''); setNoticePriority('normal'); setNoticeRecipient('all')
      loadNotices()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const calculateMacros = () => {
    const age = parseInt(macroAge), height = parseInt(macroHeight), weight = parseFloat(macroWeight)
    if (!age || !height || !weight) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos', variant: 'destructive' })
      return
    }
    let bmr = macroGender === 'male' ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
    let tdee = bmr * multipliers[macroActivity]
    if (macroGoal === 'cut') tdee *= 0.85
    else if (macroGoal === 'bulk') tdee *= 1.15
    const protein = weight * 1.8, fat = weight * 0.8
    const carbs = (tdee - protein * 4 - fat * 9) / 4
    setMacroResults({ calories: Math.round(tdee), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) })
  }

  const assignMacrosToMember = async () => {
    if (!selectedMemberForMacros || !macroResults) {
      toast({ title: 'Error', description: 'Selecciona un socio y calcula los macros primero', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const member = members.find(m => m.id === selectedMemberForMacros)
      const dietName = `Plan Nutricional - ${member?.name || 'Socio'}`
      
      // Create the diet template
      const { data: diet, error: dietError } = await supabase.from('diet_templates').insert([{
        trainer_id: user.id,
        name: dietName,
        calories: macroResults.calories,
        protein_g: macroResults.protein,
        carbs_g: macroResults.carbs,
        fat_g: macroResults.fat,
        content: `Plan personalizado:\n- Calorías: ${macroResults.calories} kcal\n- Proteína: ${macroResults.protein}g\n- Carbohidratos: ${macroResults.carbs}g\n- Grasas: ${macroResults.fat}g`
      }]).select().single()
      
      if (dietError) throw dietError

      // Assign to member
      const { error: assignError } = await supabase.from('member_diets').upsert([{
        member_id: selectedMemberForMacros,
        diet_template_id: diet.id,
        assigned_by: user.id
      }], { onConflict: 'member_id' })

      if (assignError) throw assignError

      toast({ title: '¡Macros asignados!', description: `Se ha creado y asignado la dieta a ${member?.name}` })
      setSelectedMemberForMacros('')
      setMacroResults(null)
      loadDietTemplates()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0B0B0B] to-[#0a0a0a]">
      {/* HEADER */}
      <header className="relative overflow-hidden border-b border-[#2a2a2a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D4FF]/10 via-transparent to-[#00D4FF]/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00D4FF]/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D4FF] to-[#00B4E6] flex items-center justify-center shadow-lg shadow-[#00D4FF]/30">
                <Dumbbell className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#00B4E6]">NL VIP CLUB</h1>
                <p className="text-sm text-gray-500">Panel de Entrenador</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-white font-semibold">{profile.name}</p>
                <div className="flex items-center gap-1 justify-end">
                  <Sparkles className="w-3 h-3 text-[#00D4FF]" />
                  <p className="text-xs text-[#00D4FF]">Entrenador</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="members" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="inline-flex gap-2 bg-transparent p-0 min-w-max">
              {[
                { value: 'members', icon: Users, label: 'Mis Socios' },
                { value: 'challenges', icon: Target, label: 'Retos' },
                { value: 'workouts', icon: Dumbbell, label: 'Rutinas' },
                { value: 'diets', icon: Apple, label: 'Dietas' },
                { value: 'calculator', icon: Calculator, label: 'Macros' },
                { value: 'progress', icon: TrendingUp, label: 'Progreso' },
                { value: 'notices', icon: Bell, label: 'Avisos' }
              ].map(tab => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="px-5 py-3 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#00D4FF] data-[state=active]:to-[#00B4E6] data-[state=active]:text-black data-[state=active]:border-transparent data-[state=active]:shadow-lg data-[state=active]:shadow-[#00D4FF]/20 transition-all"
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* MEMBERS TAB */}
          <TabsContent value="members" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#00D4FF]" />
                  Mis Socios ({members.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <Dialog key={member.id}>
                    <DialogTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] cursor-pointer hover:border-[#00D4FF]/30 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00D4FF]/20 to-[#00B4E6]/10 flex items-center justify-center text-[#00D4FF] font-bold border border-[#00D4FF]/20">
                            {member.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] rounded-3xl max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-white text-xl">{member.name}</DialogTitle>
                        <DialogDescription className="text-gray-500">{member.email}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label className="text-gray-400 text-sm">Asignar Rutina</Label>
                          <Select onValueChange={(val) => handleAssignWorkout(member.id, val)}>
                            <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                              {workoutTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-sm">Asignar Dieta</Label>
                          <Select onValueChange={(val) => handleAssignDiet(member.id, val)}>
                            <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                              {dietTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.calories} kcal)</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
                {members.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-[#00D4FF]/20 mb-4" />
                    <p className="text-gray-500">No tienes socios asignados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHALLENGES TAB */}
          <TabsContent value="challenges" className="space-y-4">
            {/* Crear nuevo reto */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#00D4FF]" />
                  Crear Nuevo Reto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createChallenge} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-gray-400 text-xs">Título del Reto</Label>
                      <Input 
                        placeholder="💪 Desafío de Fuerza" 
                        value={challengeTitle}
                        onChange={(e) => setChallengeTitle(e.target.value)}
                        className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-gray-400 text-xs">Descripción</Label>
                      <Textarea 
                        placeholder="Describe el reto..." 
                        value={challengeDesc}
                        onChange={(e) => setChallengeDesc(e.target.value)}
                        className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Tipo de Reto</Label>
                      <Select value={challengeType} onValueChange={setChallengeType}>
                        <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="workouts">🏋️ Entrenamientos</SelectItem>
                          <SelectItem value="consistency">🔥 Días consecutivos</SelectItem>
                          <SelectItem value="weight">⚖️ Pérdida de peso (kg)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">
                        Objetivo ({challengeType === 'workouts' ? 'entrenos' : challengeType === 'consistency' ? 'días' : 'kg'})
                      </Label>
                      <Input 
                        type="number" 
                        placeholder="10" 
                        value={challengeTarget}
                        onChange={(e) => setChallengeTarget(e.target.value)}
                        className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Duración (días)</Label>
                      <Select value={challengeDays} onValueChange={setChallengeDays}>
                        <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">1 semana</SelectItem>
                          <SelectItem value="14">2 semanas</SelectItem>
                          <SelectItem value="30">1 mes</SelectItem>
                          <SelectItem value="60">2 meses</SelectItem>
                          <SelectItem value="90">3 meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black font-bold rounded-2xl py-6"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Target className="w-5 h-5 mr-2" />}
                    Crear Reto
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lista de retos */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#00D4FF]" />
                  Mis Retos ({challenges.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {challenges.map(challenge => {
                  const participants = challengeParticipants[challenge.id] || []
                  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / 86400000))
                  
                  return (
                    <div key={challenge.id} className="p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-white text-lg">{challenge.title}</h3>
                          <p className="text-sm text-gray-400">{challenge.description}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${challenge.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {challenge.is_active ? `${daysLeft}d restantes` : 'Finalizado'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                        <span>🎯 Meta: {challenge.target_value} {challenge.type === 'workouts' ? 'entrenos' : challenge.type === 'consistency' ? 'días' : 'kg'}</span>
                        <span>👥 {participants.length} participantes</span>
                      </div>

                      {participants.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 font-semibold">Progreso de participantes:</p>
                          {participants.map(p => (
                            <div key={p.id} className="flex items-center gap-3">
                              <span className="text-white text-sm w-24 truncate">{p.member?.name}</span>
                              <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${p.completed ? 'bg-green-500' : 'bg-gradient-to-r from-[#00D4FF] to-[#00B4E6]'}`}
                                  style={{ width: `${Math.min((p.progress_value / challenge.target_value) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-16 text-right">
                                {p.progress_value}/{challenge.target_value}
                              </span>
                              {p.completed && <span className="text-green-400">✓</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {challenges.length === 0 && (
                  <div className="text-center py-12">
                    <Target className="w-16 h-16 mx-auto text-[#00D4FF]/20 mb-4" />
                    <p className="text-gray-500">No has creado ningún reto todavía</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WORKOUTS TAB */}
          <TabsContent value="workouts" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#00D4FF]" />
                  Crear Rutina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkout} className="space-y-4">
                  <div>
                    <Label className="text-gray-400 text-sm">Nombre</Label>
                    <Input value={newWorkoutName} onChange={(e) => setNewWorkoutName(e.target.value)} placeholder="Ej: Full Body Explosivo" required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Descripción / Ejercicios</Label>
                    <Textarea value={newWorkoutDesc} onChange={(e) => setNewWorkoutDesc(e.target.value)} placeholder="Detalla los ejercicios, series, repeticiones..." required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1 min-h-[150px]" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black font-bold rounded-2xl py-6">
                    <Dumbbell className="w-5 h-5 mr-2" /> Crear Rutina
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Workout Templates with Videos */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white">Mis Rutinas ({workoutTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workoutTemplates.map(workout => (
                  <div key={workout.id} className="p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-white">{workout.name}</h4>
                        <p className="text-sm text-gray-400 line-clamp-2 mt-1">{workout.description}</p>
                      </div>
                    </div>
                    
                    {/* Videos section */}
                    <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                          <Video className="w-4 h-4 text-[#00D4FF]" />
                          Vídeos ({workoutVideos[workout.id]?.length || 0})
                        </h5>
                        <Button
                          size="sm"
                          onClick={() => setShowVideoUploader(workout.id)}
                          className="bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30 rounded-lg text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Añadir
                        </Button>
                      </div>
                      
                      {showVideoUploader === workout.id ? (
                        <VideoUploader
                          workoutTemplateId={workout.id}
                          uploaderId={user.id}
                          onSuccess={() => {
                            setShowVideoUploader(null)
                            loadWorkoutTemplates()
                            toast({ title: '¡Vídeo subido!' })
                          }}
                          onCancel={() => setShowVideoUploader(null)}
                        />
                      ) : workoutVideos[workout.id]?.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {workoutVideos[workout.id].map(video => (
                            <div key={video.id} className="relative group">
                              <VideoCard video={video} onClick={() => {}} />
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => handleDeleteVideo(video.id)}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-4">Sin vídeos aún</p>
                      )}
                    </div>
                  </div>
                ))}
                {workoutTemplates.length === 0 && <p className="text-center text-gray-500 py-8">No has creado rutinas aún</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DIETS TAB */}
          <TabsContent value="diets" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#00D4FF]" />
                  Crear Dieta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDiet} className="space-y-4">
                  <div>
                    <Label className="text-gray-400 text-sm">Nombre</Label>
                    <Input value={newDietName} onChange={(e) => setNewDietName(e.target.value)} placeholder="Ej: Definición 2000kcal" required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Calorías', value: newDietCalories, setter: setNewDietCalories, placeholder: '2000' },
                      { label: 'Proteína (g)', value: newDietProtein, setter: setNewDietProtein, placeholder: '150' },
                      { label: 'Carbos (g)', value: newDietCarbs, setter: setNewDietCarbs, placeholder: '200' },
                      { label: 'Grasas (g)', value: newDietFat, setter: setNewDietFat, placeholder: '60' },
                    ].map(f => (
                      <div key={f.label}>
                        <Label className="text-gray-400 text-xs">{f.label}</Label>
                        <Input type="number" value={f.value} onChange={(e) => f.setter(e.target.value)} placeholder={f.placeholder} required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Plan de Comidas</Label>
                    <Textarea value={newDietContent} onChange={(e) => setNewDietContent(e.target.value)} placeholder="Desayuno:&#10;Almuerzo:&#10;Cena:..." required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1 min-h-[150px]" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black font-bold rounded-2xl py-6">
                    <Apple className="w-5 h-5 mr-2" /> Crear Dieta
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white">Mis Dietas ({dietTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dietTemplates.map(t => (
                  <div key={t.id} className="p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
                    <h4 className="font-bold text-white mb-2">{t.name}</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-[#00D4FF] font-semibold">{t.calories} kcal</span>
                      <span className="text-gray-400">P: {t.protein_g}g</span>
                      <span className="text-gray-400">C: {t.carbs_g}g</span>
                      <span className="text-gray-400">G: {t.fat_g}g</span>
                    </div>
                  </div>
                ))}
                {dietTemplates.length === 0 && <p className="text-center text-gray-500 py-8">No has creado dietas aún</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CALCULATOR TAB - Macro calculator for trainers */}
          <TabsContent value="calculator" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#00D4FF]" />
                  Calculadora de Macros
                </CardTitle>
                <p className="text-sm text-gray-500">Fórmula Mifflin-St Jeor • Calcula y asigna macros a tus socios</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-400 text-xs">Género</Label>
                    <Select value={macroGender} onValueChange={setMacroGender}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Hombre</SelectItem>
                        <SelectItem value="female">Mujer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Edad (años)</Label>
                    <Input type="number" placeholder="25" value={macroAge} onChange={(e) => setMacroAge(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Altura (cm)</Label>
                    <Input type="number" placeholder="175" value={macroHeight} onChange={(e) => setMacroHeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Peso (kg)</Label>
                    <Input type="number" placeholder="70" value={macroWeight} onChange={(e) => setMacroWeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Nivel de Actividad</Label>
                    <Select value={macroActivity} onValueChange={setMacroActivity}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">Sedentario (poco ejercicio)</SelectItem>
                        <SelectItem value="light">Ligera (1-3 días/sem)</SelectItem>
                        <SelectItem value="moderate">Moderada (3-5 días/sem)</SelectItem>
                        <SelectItem value="active">Activa (6-7 días/sem)</SelectItem>
                        <SelectItem value="very_active">Muy activa (atleta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Objetivo</Label>
                    <Select value={macroGoal} onValueChange={setMacroGoal}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cut">Definición (-15%)</SelectItem>
                        <SelectItem value="maintain">Mantener peso</SelectItem>
                        <SelectItem value="bulk">Volumen (+15%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={calculateMacros} className="w-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black font-bold rounded-2xl py-6">
                  <Calculator className="w-5 h-5 mr-2" /> Calcular Macros
                </Button>

                {macroResults && (
                  <div className="space-y-4 pt-4 border-t border-[#2a2a2a]">
                    <h3 className="text-white font-bold text-lg">Resultados del Cálculo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Calorías', value: macroResults.calories, unit: 'kcal', color: 'from-orange-500/20' },
                        { label: 'Proteína', value: macroResults.protein, unit: 'g', color: 'from-blue-500/20' },
                        { label: 'Carbohidratos', value: macroResults.carbs, unit: 'g', color: 'from-yellow-500/20' },
                        { label: 'Grasas', value: macroResults.fat, unit: 'g', color: 'from-purple-500/20' },
                      ].map(m => (
                        <div key={m.label} className={`bg-gradient-to-br ${m.color} to-transparent rounded-2xl p-4 border border-white/5`}>
                          <p className="text-2xl font-black text-white">{m.value}<span className="text-sm font-normal text-gray-400 ml-1">{m.unit}</span></p>
                          <p className="text-xs text-gray-500">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-black/30 rounded-2xl p-5 border border-[#2a2a2a] space-y-4">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Send className="w-4 h-4 text-[#00D4FF]" />
                        Asignar a un Socio
                      </h4>
                      <Select value={selectedMemberForMacros} onValueChange={setSelectedMemberForMacros}>
                        <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white">
                          <SelectValue placeholder="Selecciona un socio..." />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={assignMacrosToMember} 
                        disabled={loading || !selectedMemberForMacros}
                        className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-2xl py-5"
                      >
                        {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                        Crear y Asignar Dieta
                      </Button>
                      <p className="text-xs text-gray-500 text-center">Se creará una nueva dieta con estos macros y se asignará automáticamente al socio</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROGRESS TAB - View member progress photos */}
          <TabsContent value="progress" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#00D4FF]" />
                  Fotos de Progreso de Socios
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedMemberForProgress ? (
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm mb-4">Selecciona un socio para ver sus fotos de progreso:</p>
                    {members.map(member => (
                      <button
                        key={member.id}
                        onClick={() => handleViewMemberProgress(member)}
                        className="w-full flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] hover:border-[#00D4FF]/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4FF]/20 to-[#00B4E6]/10 flex items-center justify-center text-[#00D4FF] font-bold">
                            {member.name?.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <Eye className="w-5 h-5 text-[#00D4FF]" />
                      </button>
                    ))}
                    {members.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto text-[#00D4FF]/20 mb-2" />
                        <p className="text-gray-500">No tienes socios asignados</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedMemberForProgress(null)
                        setMemberProgressPhotos([])
                      }}
                      className="mb-4 text-[#00D4FF] hover:text-[#00B4E6]"
                    >
                      ← Volver a la lista
                    </Button>
                    
                    <div className="flex items-center gap-3 mb-4 p-3 bg-black/30 rounded-xl">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#00B4E6] flex items-center justify-center text-black font-bold">
                        {selectedMemberForProgress.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{selectedMemberForProgress.name}</p>
                        <p className="text-xs text-gray-500">{memberProgressPhotos.length} fotos</p>
                      </div>
                    </div>
                    
                    <ProgressPhotoGallery
                      photos={memberProgressPhotos}
                      canDelete={false}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTICES TAB */}
          <TabsContent value="notices" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#00D4FF]" />
                  Enviar Aviso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateNotice} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 text-sm">Destinatario</Label>
                      <Select value={noticeRecipient} onValueChange={setNoticeRecipient}>
                        <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos mis socios</SelectItem>
                          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Prioridad</Label>
                      <Select value={noticePriority} onValueChange={setNoticePriority}>
                        <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Título</Label>
                    <Input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="Ej: Cambio de horario" required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Mensaje</Label>
                    <Textarea value={noticeMessage} onChange={(e) => setNoticeMessage(e.target.value)} placeholder="Escribe tu mensaje..." required className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1 min-h-[100px]" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black font-bold rounded-2xl py-6">
                    <Send className="w-5 h-5 mr-2" /> Enviar Aviso
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white">Avisos Enviados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notices.map(n => (
                  <div key={n.id} className={`p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] ${n.priority === 'high' ? 'border-l-4 border-l-red-500' : n.priority === 'normal' ? 'border-l-4 border-l-[#00D4FF]' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{n.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${n.priority === 'high' ? 'bg-red-500/20 text-red-400' : n.priority === 'normal' ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-blue-500/20 text-blue-400'}`}>
                        {n.priority === 'high' ? 'Alta' : n.priority === 'normal' ? 'Normal' : 'Baja'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{n.message}</p>
                    <p className="text-xs text-gray-600 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
                {notices.length === 0 && <p className="text-center text-gray-500 py-8">No has enviado avisos</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Chat */}
      <FloatingChat 
        userId={user.id}
        userRole="trainer"
        members={members}
      />

      <Toaster />
    </div>
  )
}
