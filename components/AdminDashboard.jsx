'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Users, Key, Shield, LogOut, UserPlus, Code, Plus, Calculator, Send, Loader2, UtensilsCrossed, Bot, Dumbbell, Apple, Target, Trophy, Camera, Eye, TrendingUp, Settings, ChevronDown, Link, FileCheck, MessageSquare } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { RecipesManager } from './RecipesManager'
import AdminAssistant from './AdminAssistant'
import { ProgressPhotoGallery } from './ProgressPhotos'
import { FeedSection } from './FeedSection'
import { AvatarBubble, ProfileModal } from './UserProfile'

export default function AdminDashboard({ user, profile, onLogout }) {
  const [trainers, setTrainers] = useState([])
  const [codes, setCodes] = useState([])
  const [members, setMembers] = useState([])
  const [feedPosts, setFeedPosts] = useState([])
  const [allProgress, setAllProgress] = useState([])
  const [activeTab, setActiveTab] = useState('assistant')
  const [allAssignments, setAllAssignments] = useState([])
  const [trainingVideos, setTrainingVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // New states for trainer-like features
  const [workoutTemplates, setWorkoutTemplates] = useState([])
  const [dietTemplates, setDietTemplates] = useState([])
  const [challenges, setChallenges] = useState([])
  const [challengeParticipants, setChallengeParticipants] = useState({})
  const [memberProgressPhotos, setMemberProgressPhotos] = useState([])
  const [selectedMemberForPhotos, setSelectedMemberForPhotos] = useState(null)

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Form states
  const [newTrainerEmail, setNewTrainerEmail] = useState('')
  const [newTrainerPassword, setNewTrainerPassword] = useState('')
  const [newTrainerName, setNewTrainerName] = useState('')
  const [selectedTrainerId, setSelectedTrainerId] = useState('')
  const [codeMaxUses, setCodeMaxUses] = useState('10')
  const [codeExpireDays, setCodeExpireDays] = useState('30')
  
  // Video form
  const [videoTitle, setVideoTitle] = useState('')
  const [videoDescription, setVideoDescription] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoThumbnail, setVideoThumbnail] = useState('')

  // Workout/Diet form states
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutDesc, setNewWorkoutDesc] = useState('')
  const [newDietName, setNewDietName] = useState('')
  const [newDietCalories, setNewDietCalories] = useState('')
  const [newDietProtein, setNewDietProtein] = useState('')
  const [newDietCarbs, setNewDietCarbs] = useState('')
  const [newDietFat, setNewDietFat] = useState('')
  const [newDietContent, setNewDietContent] = useState('')

  // Challenge form states
  const [challengeTitle, setChallengeTitle] = useState('')
  const [challengeDesc, setChallengeDesc] = useState('')
  const [challengeType, setChallengeType] = useState('workouts')
  const [challengeTarget, setChallengeTarget] = useState('')
  const [challengeDays, setChallengeDays] = useState('14')

  // Macro calculator states
  const [macroGender, setMacroGender] = useState('male')
  const [macroAge, setMacroAge] = useState('')
  const [macroHeight, setMacroHeight] = useState('')
  const [macroWeight, setMacroWeight] = useState('')
  const [macroActivity, setMacroActivity] = useState('moderate')
  const [macroGoal, setMacroGoal] = useState('maintain')
  const [macroResults, setMacroResults] = useState(null)
  const [selectedMemberForMacros, setSelectedMemberForMacros] = useState('')
  const [selectedTrainerForMacros, setSelectedTrainerForMacros] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadTrainers(),
      loadCodes(),
      loadMembers(),
      loadFeedPosts(),
      loadAllProgress(),
      loadAllAssignments(),
      loadTrainingVideos(),
      loadWorkoutTemplates(),
      loadDietTemplates(),
      loadChallenges()
    ])
  }

  // Load workout templates (all trainers)
  const loadWorkoutTemplates = async () => {
    const { data } = await supabase
      .from('workout_templates')
      .select('*, trainer:profiles!workout_templates_trainer_id_fkey(name)')
      .order('created_at', { ascending: false })
    if (data) setWorkoutTemplates(data)
  }

  // Load diet templates (all trainers)
  const loadDietTemplates = async () => {
    const { data } = await supabase
      .from('diet_templates')
      .select('*, trainer:profiles!diet_templates_trainer_id_fkey(name)')
      .order('created_at', { ascending: false })
    if (data) setDietTemplates(data)
  }

  // Load challenges (all)
  const loadChallenges = async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*, creator:profiles!challenges_created_by_fkey(name)')
      .order('created_at', { ascending: false })
    
    if (data) {
      setChallenges(data)
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

  // Load progress photos for a member (ADMIN ONLY)
  const loadMemberProgressPhotos = async (memberId) => {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false })
    if (data) setMemberProgressPhotos(data)
  }

  // Create workout template
  const handleCreateWorkout = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('workout_templates').insert([{ 
        trainer_id: user.id, 
        name: newWorkoutName, 
        description: newWorkoutDesc 
      }])
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

  // Create diet template
  const handleCreateDiet = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('diet_templates').insert([{
        trainer_id: user.id, 
        name: newDietName, 
        calories: parseInt(newDietCalories),
        protein_g: parseInt(newDietProtein), 
        carbs_g: parseInt(newDietCarbs), 
        fat_g: parseInt(newDietFat), 
        content: newDietContent
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

  // Create challenge
  const handleCreateChallenge = async (e) => {
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

  const loadTrainers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'trainer')
      .order('created_at', { ascending: false })
    
    if (data) setTrainers(data)
  }

  const loadCodes = async () => {
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('*, profiles!invitation_codes_trainer_id_fkey(name)')
      .order('created_at', { ascending: false })
    
    if (data) setCodes(data)
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        trainer_members!trainer_members_member_id_fkey(
          trainer:profiles!trainer_members_trainer_id_fkey(name)
        )
      `)
      .eq('role', 'member')
      .order('created_at', { ascending: false })
    
    if (data) setMembers(data)
  }

  const loadFeedPosts = async () => {
    const { data, error } = await supabase
      .from('feed_posts')
      .select(`
        *,
        author:profiles!feed_posts_author_id_fkey(name),
        feed_reports(id)
      `)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (data) setFeedPosts(data)
  }

  const handleCreateTrainer = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newTrainerEmail,
        password: newTrainerPassword,
        email_confirm: true,
        user_metadata: {
          name: newTrainerName,
          role: 'trainer'
        }
      })

      if (authError) throw authError

      // Crear perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: newTrainerEmail,
          name: newTrainerName,
          role: 'trainer'
        }])

      if (profileError) throw profileError

      toast({
        title: '¡Entrenador creado!',
        description: `${newTrainerName} puede iniciar sesión ahora`
      })

      setNewTrainerEmail('')
      setNewTrainerPassword('')
      setNewTrainerName('')
      loadTrainers()

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCode = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const code = `NLVIP-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(codeExpireDays))

      const { error } = await supabase
        .from('invitation_codes')
        .insert([{
          code,
          trainer_id: selectedTrainerId,
          max_uses: parseInt(codeMaxUses),
          expires_at: expiresAt.toISOString()
        }])

      if (error) throw error

      toast({
        title: '¡Código creado!',
        description: `Código: ${code}`
      })

      loadCodes()

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleCodeStatus = async (codeId, currentStatus) => {
    const { error } = await supabase
      .from('invitation_codes')
      .update({ is_active: !currentStatus })
      .eq('id', codeId)

    if (!error) {
      toast({
        title: 'Estado actualizado',
        description: !currentStatus ? 'Código activado' : 'Código desactivado'
      })
      loadCodes()
    }
  }

  const hidePost = async (postId) => {
    const { error } = await supabase
      .from('feed_posts')
      .update({ is_hidden: true })
      .eq('id', postId)

    if (!error) {
      toast({
        title: 'Post ocultado',
        description: 'El post ya no será visible en el feed'
      })
      loadFeedPosts()
    }
  }

  const loadAllProgress = async () => {
    const { data, error } = await supabase
      .from('progress_records')
      .select(`
        *,
        member:profiles!progress_records_member_id_fkey(name, email)
      `)
      .order('date', { ascending: false })
      .limit(100)
    
    if (data) setAllProgress(data)
  }

  const loadAllAssignments = async () => {
    const { data: workouts } = await supabase
      .from('member_workouts')
      .select(`
        *,
        member:profiles!member_workouts_member_id_fkey(name, email),
        workout:workout_templates(name, description),
        assigned:profiles!member_workouts_assigned_by_fkey(name)
      `)
    
    const { data: diets } = await supabase
      .from('member_diets')
      .select(`
        *,
        member:profiles!member_diets_member_id_fkey(name, email),
        diet:diet_templates(name, calories, protein_g, carbs_g, fat_g),
        assigned:profiles!member_diets_assigned_by_fkey(name)
      `)
    
    setAllAssignments({ workouts: workouts || [], diets: diets || [] })
  }

  const loadTrainingVideos = async () => {
    const { data, error } = await supabase
      .from('training_videos')
      .select(`
        *,
        uploader:profiles!training_videos_uploaded_by_fkey(name, role),
        approver:profiles!training_videos_approved_by_fkey(name)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setTrainingVideos(data)
  }

  const handleCreateVideo = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('training_videos')
        .insert([{
          title: videoTitle,
          description: videoDescription,
          video_url: videoUrl,
          thumbnail_url: videoThumbnail,
          uploaded_by: user.id,
          is_approved: true,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        }])

      if (error) throw error

      toast({
        title: '¡Video publicado!',
        description: 'El video ya está disponible para todos'
      })

      setVideoTitle('')
      setVideoDescription('')
      setVideoUrl('')
      setVideoThumbnail('')
      loadTrainingVideos()

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveVideo = async (videoId) => {
    const { error } = await supabase
      .from('training_videos')
      .update({
        is_approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (!error) {
      toast({
        title: 'Video aprobado',
        description: 'El video ya está visible para todos'
      })
      loadTrainingVideos()
    }
  }

  const handleDeleteVideo = async (videoId) => {
    const { error } = await supabase
      .from('training_videos')
      .delete()
      .eq('id', videoId)

    if (!error) {
      toast({
        title: 'Video eliminado',
        description: 'El video ha sido eliminado'
      })
      loadTrainingVideos()
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
    if (!selectedMemberForMacros || !macroResults || !selectedTrainerForMacros) {
      toast({ title: 'Error', description: 'Selecciona un entrenador, un socio y calcula los macros primero', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const member = members.find(m => m.id === selectedMemberForMacros)
      const dietName = `Plan Nutricional - ${member?.name || 'Socio'}`
      
      // Create the diet template
      const { data: diet, error: dietError } = await supabase.from('diet_templates').insert([{
        trainer_id: selectedTrainerForMacros,
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
        assigned_by: selectedTrainerForMacros
      }], { onConflict: 'member_id' })

      if (assignError) throw assignError

      toast({ title: '¡Macros asignados!', description: `Se ha creado y asignado la dieta a ${member?.name}` })
      setSelectedMemberForMacros('')
      setSelectedTrainerForMacros('')
      setMacroResults(null)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      {/* Modern Admin Header */}
      <header className="bg-gradient-to-br from-black via-[#1a1a1a] to-black border-b border-violet-500/20 sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/logo-nl-vip.jpg" 
                alt="NL VIP TEAM" 
                className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-violet-500/30"
              />
              <div>
                <h1 className="text-2xl font-bold text-violet-400">NL VIP TEAM</h1>
                <p className="text-xs text-gray-400">Panel de Administrador</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm text-gray-300 font-semibold">{profile.name}</p>
                <p className="text-xs text-violet-400">Administrador</p>
              </div>
              <AvatarBubble 
                profile={profile} 
                size="md" 
                onClick={() => setShowProfileModal(true)} 
              />
              <Button 
                variant="outline" 
                size="sm"
                className="border-violet-500/40 text-violet-400 hover:bg-gradient-to-r from-violet-600 to-cyan-600/10 rounded-full"
                onClick={onLogout}
              >
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Salir</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <ProfileModal
        user={user}
        profile={profile}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={(updatedProfile) => {
          // Forzar recarga de la página para reflejar cambios
          window.location.reload()
        }}
        onLogout={onLogout}
      />

      <main className="container mx-auto px-4 py-8 overflow-x-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center gap-2 pb-2 flex-wrap">
            
            {/* Tabs principales - Solo 2 */}
            <TabsList className="bg-[#1a1a1a] border border-violet-500/20 inline-flex">
              <TabsTrigger value="assistant" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black whitespace-nowrap px-4">
                <Bot className="w-4 h-4 mr-2" />
                Asistente IA
              </TabsTrigger>
              <TabsTrigger value="feed" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black whitespace-nowrap px-4">
                <MessageSquare className="w-4 h-4 mr-2" />
                Feed
              </TabsTrigger>
            </TabsList>

            {/* Menú SOCIOS */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`border-violet-500/30 bg-[#1a1a1a] hover:bg-violet-500/10 rounded-xl gap-2 h-10 ${
                    ['members', 'progress'].includes(activeTab) 
                      ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-black border-transparent' 
                      : 'text-gray-300'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Socios
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a1a] border-violet-500/30 text-white min-w-[180px]">
                <DropdownMenuItem 
                  onClick={() => setActiveTab('members')}
                  className={`cursor-pointer gap-3 ${activeTab === 'members' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Users className="w-4 h-4" />
                  Lista de Socios
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab('progress')}
                  className={`cursor-pointer gap-3 ${activeTab === 'progress' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Camera className="w-4 h-4" />
                  Fotos de Progreso
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menú ENTRENAMIENTOS */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`border-violet-500/30 bg-[#1a1a1a] hover:bg-violet-500/10 rounded-xl gap-2 h-10 ${
                    ['challenges', 'workouts', 'diets', 'recipes', 'calculator'].includes(activeTab) 
                      ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-black border-transparent' 
                      : 'text-gray-300'
                  }`}
                >
                  <Dumbbell className="w-4 h-4" />
                  Entrenamientos
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a1a] border-violet-500/30 text-white min-w-[180px]">
                <DropdownMenuItem 
                  onClick={() => setActiveTab('challenges')}
                  className={`cursor-pointer gap-3 ${activeTab === 'challenges' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Target className="w-4 h-4" />
                  Retos
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab('workouts')}
                  className={`cursor-pointer gap-3 ${activeTab === 'workouts' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Dumbbell className="w-4 h-4" />
                  Rutinas
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-violet-500/20" />
                <DropdownMenuItem 
                  onClick={() => setActiveTab('diets')}
                  className={`cursor-pointer gap-3 ${activeTab === 'diets' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Apple className="w-4 h-4" />
                  Dietas
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab('recipes')}
                  className={`cursor-pointer gap-3 ${activeTab === 'recipes' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Recetas
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-violet-500/20" />
                <DropdownMenuItem 
                  onClick={() => setActiveTab('calculator')}
                  className={`cursor-pointer gap-3 ${activeTab === 'calculator' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Calculator className="w-4 h-4" />
                  Calculadora Macros
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menú GESTIÓN */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`border-violet-500/30 bg-[#1a1a1a] hover:bg-violet-500/10 rounded-xl gap-2 h-10 ${
                    ['trainers', 'codes', 'assignments', 'moderation'].includes(activeTab) 
                      ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-black border-transparent' 
                      : 'text-gray-300'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Gestión
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a1a] border-violet-500/30 text-white min-w-[200px]">
                <DropdownMenuLabel className="text-violet-400 text-xs">Administración</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-violet-500/20" />
                <DropdownMenuItem 
                  onClick={() => setActiveTab('trainers')}
                  className={`cursor-pointer gap-3 ${activeTab === 'trainers' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Users className="w-4 h-4" />
                  Entrenadores
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab('codes')}
                  className={`cursor-pointer gap-3 ${activeTab === 'codes' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Key className="w-4 h-4" />
                  Códigos de Invitación
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab('assignments')}
                  className={`cursor-pointer gap-3 ${activeTab === 'assignments' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Link className="w-4 h-4" />
                  Asignaciones
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-violet-500/20" />
                <DropdownMenuItem 
                  onClick={() => setActiveTab('moderation')}
                  className={`cursor-pointer gap-3 ${activeTab === 'moderation' ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-violet-500/10'}`}
                >
                  <Shield className="w-4 h-4" />
                  Moderación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {/* Asistente IA */}
          <TabsContent value="assistant" className="space-y-4">
            <AdminAssistant userId={user.id} />
          </TabsContent>

          {/* Entrenadores */}
          <TabsContent value="trainers" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Crear Entrenador</CardTitle>
                <CardDescription className="text-gray-400">
                  Agrega un nuevo entrenador al sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTrainer} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Nombre</Label>
                      <Input
                        value={newTrainerName}
                        onChange={(e) => setNewTrainerName(e.target.value)}
                        placeholder="Juan Pérez"
                        required
                        className="bg-black border-violet-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Email</Label>
                      <Input
                        type="email"
                        value={newTrainerEmail}
                        onChange={(e) => setNewTrainerEmail(e.target.value)}
                        placeholder="entrenador@nlvip.com"
                        required
                        className="bg-black border-violet-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Contraseña</Label>
                      <Input
                        type="password"
                        value={newTrainerPassword}
                        onChange={(e) => setNewTrainerPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="bg-black border-violet-500/20 text-white"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:bg-[rgb(6, 182, 212)] text-black"
                    disabled={loading}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Crear Entrenador
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Entrenadores Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trainers.map((trainer) => (
                    <div key={trainer.id} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div>
                        <p className="font-semibold text-white">{trainer.name}</p>
                        <p className="text-sm text-gray-400">{trainer.email}</p>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(trainer.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {trainers.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay entrenadores registrados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Códigos */}
          <TabsContent value="codes" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Generar Código de Invitación</CardTitle>
                <CardDescription className="text-gray-400">
                  Crea un código para que nuevos socios puedan registrarse
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateCode} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Entrenador Asignado</Label>
                      <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId} required>
                        <SelectTrigger className="bg-black border-violet-500/20 text-white">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {trainers.map((trainer) => (
                            <SelectItem key={trainer.id} value={trainer.id}>
                              {trainer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Máx. Usos</Label>
                      <Input
                        type="number"
                        value={codeMaxUses}
                        onChange={(e) => setCodeMaxUses(e.target.value)}
                        min="1"
                        required
                        className="bg-black border-violet-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Expira en (días)</Label>
                      <Input
                        type="number"
                        value={codeExpireDays}
                        onChange={(e) => setCodeExpireDays(e.target.value)}
                        min="1"
                        required
                        className="bg-black border-violet-500/20 text-white"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:bg-[rgb(6, 182, 212)] text-black"
                    disabled={loading || !selectedTrainerId}
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Generar Código
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Códigos Generados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {codes.map((code) => (
                    <div key={code.id} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div className="flex-1">
                        <p className="font-mono font-bold text-violet-400 text-lg">{code.code}</p>
                        <p className="text-sm text-gray-400">Entrenador: {code.profiles?.name}</p>
                        <p className="text-xs text-gray-500">
                          Usos: {code.uses_count}/{code.max_uses} | 
                          Expira: {new Date(code.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={code.is_active ? "destructive" : "default"}
                        className={code.is_active ? "" : "bg-gradient-to-r from-violet-600 to-cyan-600 hover:bg-[rgb(6, 182, 212)] text-black"}
                        onClick={() => toggleCodeStatus(code.id, code.is_active)}
                      >
                        {code.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  ))}
                  {codes.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay códigos generados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Socios */}
          <TabsContent value="members" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Socios Registrados ({members.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div>
                        <p className="font-semibold text-white">{member.name}</p>
                        <p className="text-sm text-gray-400">{member.email}</p>
                        <p className="text-xs text-violet-400 mt-1">
                          Entrenador: {member.trainer_members?.[0]?.trainer?.name || 'No asignado'}
                        </p>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(member.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay socios registrados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RETOS / CHALLENGES */}
          <TabsContent value="challenges" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Crear Nuevo Reto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateChallenge} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-gray-400 text-xs">Título del Reto</Label>
                      <Input 
                        placeholder="💪 Desafío de Fuerza" 
                        value={challengeTitle}
                        onChange={(e) => setChallengeTitle(e.target.value)}
                        className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-gray-400 text-xs">Descripción</Label>
                      <Textarea 
                        placeholder="Describe el reto..." 
                        value={challengeDesc}
                        onChange={(e) => setChallengeDesc(e.target.value)}
                        className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Tipo de Reto</Label>
                      <Select value={challengeType} onValueChange={setChallengeType}>
                        <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1">
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
                        className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Duración (días)</Label>
                      <Select value={challengeDays} onValueChange={setChallengeDays}>
                        <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1">
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
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-2xl py-6"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Target className="w-5 h-5 mr-2" />}
                    Crear Reto
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Todos los Retos ({challenges.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {challenges.map(challenge => {
                  const participants = challengeParticipants[challenge.id] || []
                  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / 86400000))
                  
                  return (
                    <div key={challenge.id} className="p-4 bg-black/50 rounded-2xl border border-violet-500/10">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-white text-lg">{challenge.title}</h3>
                          <p className="text-sm text-gray-400">{challenge.description}</p>
                          <p className="text-xs text-violet-400 mt-1">Creado por: {challenge.creator?.name}</p>
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
                          <p className="text-xs text-gray-500 font-semibold">Progreso:</p>
                          {participants.map(p => (
                            <div key={p.id} className="flex items-center gap-3">
                              <span className="text-white text-sm w-24 truncate">{p.member?.name}</span>
                              <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${p.completed ? 'bg-green-500' : 'bg-gradient-to-r from-violet-500 to-cyan-500'}`}
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
                  <p className="text-center text-gray-400 py-8">No hay retos creados</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RUTINAS / WORKOUTS */}
          <TabsContent value="workouts" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Crear Rutina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkout} className="space-y-4">
                  <div>
                    <Label className="text-gray-400 text-sm">Nombre</Label>
                    <Input 
                      value={newWorkoutName} 
                      onChange={(e) => setNewWorkoutName(e.target.value)} 
                      placeholder="Ej: Full Body Explosivo" 
                      required 
                      className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1" 
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Descripción / Ejercicios</Label>
                    <Textarea 
                      value={newWorkoutDesc} 
                      onChange={(e) => setNewWorkoutDesc(e.target.value)} 
                      placeholder="Detalla los ejercicios, series, repeticiones..." 
                      required 
                      className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1 min-h-[150px]" 
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-2xl py-6">
                    <Dumbbell className="w-5 h-5 mr-2" /> Crear Rutina
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Todas las Rutinas ({workoutTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workoutTemplates.map(workout => (
                  <div key={workout.id} className="p-4 bg-black/50 rounded-2xl border border-violet-500/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white">{workout.name}</h4>
                        <p className="text-sm text-gray-400 line-clamp-2 mt-1">{workout.description}</p>
                        <p className="text-xs text-violet-400 mt-2">Creado por: {workout.trainer?.name || 'Admin'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {workoutTemplates.length === 0 && <p className="text-center text-gray-400 py-8">No hay rutinas creadas</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DIETAS */}
          <TabsContent value="diets" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Crear Dieta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDiet} className="space-y-4">
                  <div>
                    <Label className="text-gray-400 text-sm">Nombre</Label>
                    <Input 
                      value={newDietName} 
                      onChange={(e) => setNewDietName(e.target.value)} 
                      placeholder="Ej: Definición 2000kcal" 
                      required 
                      className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1" 
                    />
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
                        <Input 
                          type="number" 
                          value={f.value} 
                          onChange={(e) => f.setter(e.target.value)} 
                          placeholder={f.placeholder} 
                          required 
                          className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1" 
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Plan de Comidas</Label>
                    <Textarea 
                      value={newDietContent} 
                      onChange={(e) => setNewDietContent(e.target.value)} 
                      placeholder="Desayuno:&#10;Almuerzo:&#10;Cena:..." 
                      required 
                      className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1 min-h-[150px]" 
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-2xl py-6">
                    <Apple className="w-5 h-5 mr-2" /> Crear Dieta
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Todas las Dietas ({dietTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dietTemplates.map(diet => (
                  <div key={diet.id} className="p-4 bg-black/50 rounded-2xl border border-violet-500/10">
                    <h4 className="font-bold text-white mb-2">{diet.name}</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-violet-400 font-semibold">{diet.calories} kcal</span>
                      <span className="text-gray-400">P: {diet.protein_g}g</span>
                      <span className="text-gray-400">C: {diet.carbs_g}g</span>
                      <span className="text-gray-400">G: {diet.fat_g}g</span>
                    </div>
                    <p className="text-xs text-violet-400 mt-2">Creado por: {diet.trainer?.name || 'Admin'}</p>
                  </div>
                ))}
                {dietTemplates.length === 0 && <p className="text-center text-gray-400 py-8">No hay dietas creadas</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recetas */}
          <TabsContent value="recipes" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  Gestión de Recetas
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Crea y gestiona las recetas del sistema. Puedes subir fotos desde tu dispositivo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecipesManager userId={user.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEED - Admin puede publicar y moderar */}
          <TabsContent value="feed" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Feed del Gimnasio
                  <span className="text-xs bg-cyan-500/20 px-2 py-1 rounded-full text-cyan-300">Moderador</span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Publica anuncios y modera el contenido del feed. Como admin puedes ocultar o eliminar posts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FeedSection userId={user.id} userRole="admin" canModerate={true} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* FOTOS DE PROGRESO - SOLO ADMIN */}
          <TabsContent value="progress" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Fotos de Progreso de Socios
                  <span className="text-xs bg-violet-500/20 px-2 py-1 rounded-full text-violet-300">Solo Admin</span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Solo tú como administrador puedes ver las fotos de progreso de todos los socios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedMemberForPhotos ? (
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm mb-4">Selecciona un socio para ver sus fotos de progreso:</p>
                    {members.map(member => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMemberForPhotos(member)
                          loadMemberProgressPhotos(member.id)
                        }}
                        className="w-full flex items-center justify-between p-4 bg-black/50 rounded-2xl border border-violet-500/10 hover:border-violet-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 flex items-center justify-center text-violet-400 font-bold">
                            {member.name?.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <Eye className="w-5 h-5 text-violet-400" />
                      </button>
                    ))}
                    {members.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto text-violet-400/20 mb-2" />
                        <p className="text-gray-400">No hay socios registrados</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedMemberForPhotos(null)
                        setMemberProgressPhotos([])
                      }}
                      className="mb-4 text-violet-400 hover:text-cyan-400"
                    >
                      ← Volver a la lista
                    </Button>
                    
                    <div className="flex items-center gap-3 mb-4 p-3 bg-black/50 rounded-xl border border-violet-500/20">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold">
                        {selectedMemberForPhotos.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{selectedMemberForPhotos.name}</p>
                        <p className="text-xs text-gray-400">{memberProgressPhotos.length} fotos de progreso</p>
                      </div>
                    </div>
                    
                    <ProgressPhotoGallery
                      photos={memberProgressPhotos}
                      canDelete={true}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rutinas y Dietas Asignadas */}
          <TabsContent value="assignments" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Rutinas Asignadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allAssignments.workouts?.map((assignment) => (
                    <div key={assignment.id} className="p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-white">{assignment.member?.name}</p>
                          <p className="text-sm text-violet-400 mt-1">{assignment.workout?.name}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Asignado por: {assignment.assigned?.name}
                          </p>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                          {new Date(assignment.assigned_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!allAssignments.workouts || allAssignments.workouts.length === 0) && (
                    <p className="text-center text-gray-400 py-8">No hay rutinas asignadas</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Dietas Asignadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allAssignments.diets?.map((assignment) => (
                    <div key={assignment.id} className="p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-white">{assignment.member?.name}</p>
                          <p className="text-sm text-violet-400 mt-1">
                            {assignment.diet?.name} - {assignment.diet?.calories} kcal
                          </p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-400">
                            <span>P: {assignment.diet?.protein_g}g</span>
                            <span>C: {assignment.diet?.carbs_g}g</span>
                            <span>G: {assignment.diet?.fat_g}g</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Asignado por: {assignment.assigned?.name}
                          </p>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                          {new Date(assignment.assigned_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!allAssignments.diets || allAssignments.diets.length === 0) && (
                    <p className="text-center text-gray-400 py-8">No hay dietas asignadas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Videos de Entrenamiento */}
          <TabsContent value="videos" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Publicar Video de Entrenamiento</CardTitle>
                <CardDescription className="text-gray-400">
                  Como admin, tus videos se publican automáticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateVideo} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-200">Título del Video</Label>
                    <Input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Ej: Técnica correcta de sentadilla"
                      required
                      className="bg-black border-violet-500/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Descripción</Label>
                    <Textarea
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="Describe el contenido del video..."
                      className="bg-black border-violet-500/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">URL del Video (YouTube, Vimeo, etc.)</Label>
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      required
                      className="bg-black border-violet-500/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">URL de la Miniatura (opcional)</Label>
                    <Input
                      value={videoThumbnail}
                      onChange={(e) => setVideoThumbnail(e.target.value)}
                      placeholder="https://..."
                      className="bg-black border-violet-500/20 text-white"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:bg-[rgb(6, 182, 212)] text-black"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Publicar Video
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Todos los Videos</CardTitle>
                <CardDescription className="text-gray-400">
                  Gestiona y aprueba videos de entrenadores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trainingVideos.map((video) => (
                    <div key={video.id} className="p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white">{video.title}</p>
                          <p className="text-sm text-gray-400 mt-1">{video.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Subido por: {video.uploader?.name} ({video.uploader?.role === 'admin' ? 'Admin' : 'Trainer'})
                          </p>
                          {video.is_approved && (
                            <p className="text-xs text-violet-400 mt-1">
                              ✓ Aprobado por {video.approver?.name}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!video.is_approved && (
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:bg-[rgb(6, 182, 212)] text-black"
                              onClick={() => handleApproveVideo(video.id)}
                            >
                              Aprobar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteVideo(video.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                      <a 
                        href={video.video_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-violet-400 hover:underline"
                      >
                        Ver video →
                      </a>
                    </div>
                  ))}
                  {trainingVideos.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay videos publicados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculator / Macros */}
          <TabsContent value="calculator" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Calculadora de Macros
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Fórmula Mifflin-St Jeor • Calcula y asigna macros a cualquier socio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-400 text-xs">Género</Label>
                    <Select value={macroGender} onValueChange={setMacroGender}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Hombre</SelectItem>
                        <SelectItem value="female">Mujer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Edad (años)</Label>
                    <Input type="number" placeholder="25" value={macroAge} onChange={(e) => setMacroAge(e.target.value)} className="bg-black/50 border-[#2a2a2a] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Altura (cm)</Label>
                    <Input type="number" placeholder="175" value={macroHeight} onChange={(e) => setMacroHeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Peso (kg)</Label>
                    <Input type="number" placeholder="70" value={macroWeight} onChange={(e) => setMacroWeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Nivel de Actividad</Label>
                    <Select value={macroActivity} onValueChange={setMacroActivity}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] text-white mt-1"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cut">Definición (-15%)</SelectItem>
                        <SelectItem value="maintain">Mantener peso</SelectItem>
                        <SelectItem value="bulk">Volumen (+15%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={calculateMacros} className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold py-5">
                  <Calculator className="w-5 h-5 mr-2" /> Calcular Macros
                </Button>

                {macroResults && (
                  <div className="space-y-4 pt-4 border-t border-violet-500/20">
                    <h3 className="text-white font-bold text-lg">Resultados del Cálculo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Calorías', value: macroResults.calories, unit: 'kcal', color: 'from-orange-500/20' },
                        { label: 'Proteína', value: macroResults.protein, unit: 'g', color: 'from-blue-500/20' },
                        { label: 'Carbohidratos', value: macroResults.carbs, unit: 'g', color: 'from-yellow-500/20' },
                        { label: 'Grasas', value: macroResults.fat, unit: 'g', color: 'from-purple-500/20' },
                      ].map(m => (
                        <div key={m.label} className={`bg-gradient-to-br ${m.color} to-transparent rounded-xl p-4 border border-white/5`}>
                          <p className="text-2xl font-black text-white">{m.value}<span className="text-sm font-normal text-gray-400 ml-1">{m.unit}</span></p>
                          <p className="text-xs text-gray-500">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-black/30 rounded-xl p-5 border border-violet-500/20 space-y-4">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Send className="w-4 h-4 text-violet-400" />
                        Asignar a un Socio
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-400 text-xs">Entrenador responsable</Label>
                          <Select value={selectedTrainerForMacros} onValueChange={setSelectedTrainerForMacros}>
                            <SelectTrigger className="bg-black/50 border-[#2a2a2a] text-white mt-1">
                              <SelectValue placeholder="Selecciona entrenador..." />
                            </SelectTrigger>
                            <SelectContent>
                              {trainers.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Socio</Label>
                          <Select value={selectedMemberForMacros} onValueChange={setSelectedMemberForMacros}>
                            <SelectTrigger className="bg-black/50 border-[#2a2a2a] text-white mt-1">
                              <SelectValue placeholder="Selecciona socio..." />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button 
                        onClick={assignMacrosToMember} 
                        disabled={loading || !selectedMemberForMacros || !selectedTrainerForMacros}
                        className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-5"
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

          {/* Moderación - Solo para revisar reportes */}
          <TabsContent value="moderation" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Moderación del Feed
                  <span className="text-xs bg-red-500/20 px-2 py-1 rounded-full text-red-300">
                    {feedPosts.filter(p => p.feed_reports?.length > 0).length} reportados
                  </span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Revisa posts reportados y modera el contenido del feed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feedPosts.filter(p => p.feed_reports?.length > 0 || !p.is_hidden).map((post) => (
                    <div key={post.id} className={`p-4 bg-black/50 rounded-lg border ${post.feed_reports?.length > 0 ? 'border-red-500/30' : 'border-violet-500/10'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white">{post.author?.name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(post.created_at).toLocaleString()}
                          </p>
                        </div>
                        {post.feed_reports && post.feed_reports.length > 0 && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            ⚠️ {post.feed_reports.length} reportes
                          </span>
                        )}
                      </div>
                      <p className="text-gray-200 mb-3">{post.content}</p>
                      {post.image_url && (
                        <img 
                          src={post.image_url} 
                          alt="Post" 
                          className="rounded-lg max-h-64 object-cover mb-3"
                        />
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => hidePost(post.id)}
                        >
                          Ocultar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            await supabase.from('feed_posts').delete().eq('id', post.id)
                            loadFeedPosts()
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {feedPosts.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay posts para moderar</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Toaster />
    </div>
  )
}