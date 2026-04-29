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
  Video, Camera, TrendingUp, Trash2, Loader2, Calculator, Target, Trophy, UtensilsCrossed, MessageSquare, ChefHat, Heart
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { getApiUrl, authFetch } from '@/lib/utils'
import { calculateMacros as sharedCalculateMacros } from '@/lib/macroCalculator'
import FloatingChat from './FloatingChat'
import VideoUploader from './VideoUploader'
import { VideoCard } from './VideoPlayer'
import { ProgressPhotoGallery } from './ProgressPhotos'
import { RecipesManager } from './RecipesManager'
import { FeedSection } from './FeedSection'
import { AvatarBubble, ProfileModal } from './UserProfile'
import { WorkoutBuilder } from './WorkoutBuilder'
import { DietBuilder } from './DietBuilder'

export default function TrainerDashboard({ user, profile, setProfile, onLogout }) {
  const [members, setMembers] = useState([])
  const [workoutTemplates, setWorkoutTemplates] = useState([])
  const [dietTemplates, setDietTemplates] = useState([])
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMemberForProgress, setSelectedMemberForProgress] = useState(null)
  const [memberProgressPhotos, setMemberProgressPhotos] = useState([])
  const [showVideoUploader, setShowVideoUploader] = useState(null)
  const [showWorkoutBuilder, setShowWorkoutBuilder] = useState(false)
  const [showDietBuilder, setShowDietBuilder] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [editingDiet, setEditingDiet] = useState(null)
  const [activeTab, setActiveTab] = useState('members')
  const [dietRequests, setDietRequests] = useState([])
  const [selectedRequestAnswers, setSelectedRequestAnswers] = useState(null)
  const [dietDraft, setDietDraft] = useState(null)
  const [draftCorrection, setDraftCorrection] = useState('')
  const [draftCorrectionHistory, setDraftCorrectionHistory] = useState([])
  const [refining, setRefining] = useState(false)
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

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    loadData()

    // Realtime: alert trainer when a member submits the diet questionnaire
    const dietRequestsChannel = supabase
      .channel(`trainer_diet_requests_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'diet_onboarding_requests'
      }, (payload) => {
        if (payload.new?.status === 'submitted' && payload.new?.requested_by === user.id) {
          loadDietRequests()
          toast({
            title: '📋 Cuestionario recibido',
            description: 'Un socio ha rellenado el cuestionario nutricional. Puedes generar su dieta.'
          })
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('NL VIP Team', {
              body: 'Un socio ha rellenado el cuestionario nutricional',
              icon: '/icons/icon-192x192.png'
            })
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(dietRequestsChannel)
    }
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadMembers(),
      loadWorkoutTemplates(),
      loadDietTemplates(),
      loadNotices(),
      loadChallenges(),
      loadDietRequests()
    ])
  }

  const loadChallenges = async () => {
    // Load challenges + participants in one query (eliminates N+1)
    const { data } = await supabase
      .from('challenges')
      .select('*, challenge_participants(*, member:profiles!challenge_participants_member_id_fkey(name))')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setChallenges(data)
      const map = {}
      for (const challenge of data) {
        map[challenge.id] = challenge.challenge_participants || []
      }
      setChallengeParticipants(map)
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
      .select(`member_id, member:profiles!trainer_members_member_id_fkey(id, name, email, created_at, sex, life_stage)`)
      .eq('trainer_id', user.id)
    if (data) setMembers(data.map(tm => tm.member))
  }

  const loadWorkoutTemplates = async () => {
    // Load workouts + videos in one query (eliminates N+1)
    const { data } = await supabase
      .from('workout_templates')
      .select('*, workout_videos(*)')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setWorkoutTemplates(data)
      const videos = {}
      for (const workout of data) {
        videos[workout.id] = (workout.workout_videos || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }
      setWorkoutVideos(videos)
    }
  }

  const loadDietTemplates = async () => {
    const { data } = await supabase.from('diet_templates').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false })
    if (data) setDietTemplates(data)
  }

  const loadDietRequests = async () => {
    const { data } = await supabase
      .from('diet_onboarding_requests')
      .select('*, member:profiles!diet_onboarding_requests_member_id_fkey(name, email)')
      .eq('status', 'submitted')
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false })
      
    if (data) {
      // Show only the latest form per member to prevent duplicates
      const uniqueRequests = []
      const seenMembers = new Set()
      
      for (const req of data) {
        if (!seenMembers.has(req.member_id)) {
          seenMembers.add(req.member_id)
          uniqueRequests.push(req)
        }
      }
      setDietRequests(uniqueRequests)
    }
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

  const handleGenerateDietFromRequest = async (request) => {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl() + '/api/diet-onboarding/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestId: request.id, 
          memberId: request.member_id, 
          responses: request.responses 
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al generar borrador')
      
      setDietDraft({
        requestId: request.id,
        memberId: request.member_id,
        responses: request.responses,
        macros: result.macros,
        fullDietContent: result.fullDietContent
      })
    } catch (error) {
      toast({ title: 'Error calculando borrador IA', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleRefineDraft = async () => {
    if (!draftCorrection.trim() || !dietDraft) return
    setRefining(true)
    const correctionText = draftCorrection.trim()
    try {
      const res = await fetch(getApiUrl() + '/api/diet-onboarding/refine-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalDraft: dietDraft.fullDietContent,
          correction: correctionText,
          macros: dietDraft.macros,
          memberContext: {
            weight: dietDraft.responses?.['Medida - Peso'],
            goal: dietDraft.responses?.objetivo,
            restrictions: dietDraft.responses?.restricciones,
            numMeals: dietDraft.responses?.num_comidas || dietDraft.responses?.['Comidas - Número']
          }
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al refinar')
      setDietDraft(prev => ({ ...prev, fullDietContent: result.updatedDietContent }))
      setDraftCorrectionHistory(prev => [...prev, correctionText])
      setDraftCorrection('')
      toast({ title: 'Corrección aplicada', description: 'El borrador ha sido actualizado por la IA.' })
    } catch (error) {
      toast({ title: 'Error al corregir', description: error.message, variant: 'destructive' })
    } finally {
      setRefining(false)
    }
  }

  const handleAssignDraftDiet = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/diet-onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dietDraft)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al completar la dieta')
      
      toast({ title: '¡Plan Asignado!', description: 'La dieta revisada ha sido asignada al socio.' })
      setDietDraft(null)
      loadDietRequests()
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
    const result = sharedCalculateMacros({
      weight: macroWeight,
      height: macroHeight,
      age: macroAge,
      sex: macroGender,
      activity: macroActivity,
      goal: macroGoal,
    })
    if (!result) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos', variant: 'destructive' })
      return
    }
    setMacroResults({
      calories: result.calories,
      protein: result.protein_g,
      carbs: result.carbs_g,
      fat: result.fat_g,
    })
  }

  const assignMacrosToMember = async () => {
    if (!selectedMemberForMacros || !macroResults) {
      toast({ title: 'Error', description: 'Selecciona un socio y calcula los macros primero', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const member = members.find(m => m.id === selectedMemberForMacros)
      const rawName = (member?.name && member.name.trim() !== '') 
        ? member.name.trim()
        : (member?.email ? member.email.split('@')[0] : 'Socio')
      const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
      const dietName = `Dieta personalizada (${formattedName})`

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
      {/* Navbar Estática */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-violet-500/5 header-gradient opacity-50" />
        
        <div className="relative container mx-auto px-4 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo-nl-vip.jpg" 
                alt="NL VIP TEAM" 
                className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-violet-500/20"
              />
              <div>
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-500 tracking-tight">NL VIP Team</h1>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Trainer Panel</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AvatarBubble 
                profile={profile} 
                size="md" 
                onClick={() => setShowProfileModal(true)} 
              />
              <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome Section (Scrollable) */}
      <div className="relative overflow-hidden pt-4 pb-4 border-b border-white/5 bg-black/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-2xl font-black text-black shadow-xl shadow-violet-500/30 overflow-hidden">
              {profile.avatar_url ? (
                <AvatarBubble profile={profile} size="lg" onClick={() => setShowProfileModal(true)} />
              ) : (
                profile.name?.charAt(0)
              )}
            </div>
            <div>
              <p className="text-gray-400 text-sm font-medium">Panel de Gestión,</p>
              <h2 className="text-2xl font-black text-white">{profile.name}</h2>
              <div className="flex items-center gap-1 mt-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <p className="text-xs text-violet-400 font-bold uppercase tracking-wider">Entrenador Oficial</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        user={user}
        profile={profile}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={(updatedProfile) => {
          setProfile(updatedProfile)
        }}
        onLogout={onLogout}
      />

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {activeTab !== 'members' && (
            <button
              onClick={() => setActiveTab('members')}
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors mb-2 group"
            >
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-violet-500/15 border border-violet-500/30 group-hover:bg-violet-500/25 transition-all">←</span>
              <span>Volver a Socios</span>
            </button>
          )}
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="inline-flex gap-2 bg-transparent p-0 min-w-max">
              {[
                { value: 'members', icon: Users, label: 'Mis Socios' },
                { value: 'feed', icon: MessageSquare, label: 'Feed' },
                { value: 'challenges', icon: Target, label: 'Retos' },
                { value: 'workouts', icon: Dumbbell, label: 'Rutinas' },
                { value: 'diets', icon: Apple, label: 'Dietas' },
                { value: 'recipes', icon: UtensilsCrossed, label: 'Recetas' },
                { value: 'calculator', icon: Calculator, label: 'Macros' },
                { value: 'progress', icon: TrendingUp, label: 'Progreso' },
                { value: 'notices', icon: Bell, label: 'Avisos' }
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="px-5 py-3 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-cyan-500 data-[state=active]:text-black data-[state=active]:border-transparent data-[state=active]:shadow-lg data-[state=active]:shadow-[rgb(139, 92, 246)]/20 transition-all"
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
                  <Users className="w-5 h-5 text-violet-400" />
                  Mis Socios ({members.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <Dialog key={member.id}>
                    <DialogTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] cursor-pointer hover:border-violet-500/30 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 flex items-center justify-center text-violet-400 font-bold border border-violet-500/20">
                            {member.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white flex items-center gap-2">
                              {member.name}
                              {member.sex === 'female' && <Heart className="w-3 h-3 text-pink-400" />}
                            </p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-gradient-to-r from-violet-500 to-cyan-500 text-black rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] rounded-3xl max-w-lg">
                      <DialogHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <DialogTitle className="text-white text-xl">{member.name}</DialogTitle>
                            <DialogDescription className="text-gray-500">{member.email}</DialogDescription>
                          </div>
                          {member.sex === 'female' && (
                            <div className="bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full flex items-center gap-2">
                              <Heart className="w-4 h-4 text-pink-500" />
                              <span className="text-xs text-pink-400 font-bold uppercase tracking-wider">
                                {member.life_stage === 'pregnant' ? 'Embarazada' :
                                  member.life_stage === 'postpartum' ? 'Post-parto' :
                                    member.life_stage === 'lactating' ? 'Lactancia' : 'Ciclo Regular'}
                              </span>
                            </div>
                          )}
                        </div>
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
                    <Users className="w-16 h-16 mx-auto text-violet-400/20 mb-4" />
                    <p className="text-gray-500">No tienes socios asignados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEED TAB - Trainers can post and interact */}
          <TabsContent value="feed" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-violet-400" />
                  Feed del Gimnasio
                  <span className="text-xs bg-cyan-500/20 px-2 py-1 rounded-full text-cyan-300 ml-2">Entrenador</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FeedSection userId={user.id} userRole="trainer" canModerate={false} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHALLENGES TAB */}
          <TabsContent value="challenges" className="space-y-4">
            {/* Crear nuevo reto */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-violet-400" />
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
                    className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-2xl py-6"
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
                  <Trophy className="w-5 h-5 text-violet-400" />
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
                  <div className="text-center py-12">
                    <Target className="w-16 h-16 mx-auto text-violet-400/20 mb-4" />
                    <p className="text-gray-500">No has creado ningún reto todavía</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WORKOUTS TAB */}
          <TabsContent value="workouts" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white">Nuevas Plantillas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => { setEditingWorkout(null); setShowWorkoutBuilder(true); }}
                  className="h-32 rounded-3xl bg-violet-600/10 border border-violet-600/20 hover:bg-violet-600/20 flex flex-col gap-2 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/40">
                    <Dumbbell className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold">Nueva Rutina</span>
                </Button>

                <Button
                  onClick={() => { setEditingDiet(null); setShowDietBuilder(true); }}
                  className="h-32 rounded-3xl bg-green-600/10 border border-green-600/20 hover:bg-green-600/20 flex flex-col gap-2 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/40">
                    <Apple className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold">Nueva Dieta</span>
                </Button>
              </CardContent>
            </Card>

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
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingWorkout(workout); setShowWorkoutBuilder(true); }} className="h-8 w-8 text-violet-400 hover:bg-violet-400/10">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteWorkout(workout.id)} className="h-8 w-8 text-red-400 hover:bg-red-400/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Videos section */}
                    <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                          <Video className="w-4 h-4 text-violet-400" />
                          Vídeos ({workoutVideos[workout.id]?.length || 0})
                        </h5>
                        <Button
                          size="sm"
                          onClick={() => setShowVideoUploader(workout.id)}
                          className="bg-gradient-to-r from-violet-600 to-cyan-600/20 text-violet-400 hover:bg-gradient-to-r from-violet-600 to-cyan-600/30 rounded-lg text-xs"
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
                              <VideoCard video={video} onClick={() => { }} />
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
            {/* Solicitudes Pendientes */}
            {dietRequests.length > 0 && (
              <Card className="bg-gradient-to-br from-violet-900/40 to-cyan-900/20 border-violet-500/40 shadow-xl shadow-violet-500/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-violet-400" />
                    Solicitudes de Dieta Pendientes ({dietRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dietRequests.map(req => (
                    <div key={req.id} className="p-4 bg-black/60 rounded-2xl border border-violet-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold">
                          {req.member?.name?.[0] || 'M'}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{req.member?.name}</p>
                          <p className="text-gray-500 text-xs">{req.member?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10">
                              <Sparkles className="w-4 h-4 mr-2" /> Ver Respuestas
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#1a1a1a] border-violet-500/30 text-white max-w-md max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Cuestionario de {req.member?.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              {Object.entries(req.responses || {}).map(([key, value]) => (
                                <div key={key} className="border-b border-white/5 pb-2">
                                  <p className="text-[10px] text-violet-400 uppercase font-bold">{key.replace(/_/g, ' ')}</p>
                                  <p className="text-sm text-gray-200 mt-1">{String(value)}</p>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          size="sm"
                          disabled={loading}
                          onClick={() => handleGenerateDietFromRequest(req)}
                          className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                          Generar con Asistente
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-white">Mis Dietas ({dietTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dietTemplates.map(t => (
                  <div key={t.id} className="p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white mb-2">{t.name}</h4>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-400 font-semibold">{t.calories} kcal</span>
                        <span className="text-gray-400">P: {t.protein_g}g</span>
                        <span className="text-gray-400">C: {t.carbs_g}g</span>
                        <span className="text-gray-400">G: {t.fat_g}g</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingDiet(t); setShowDietBuilder(true); }} className="h-8 w-8 text-green-400 hover:bg-green-400/10">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteDiet(t.id)} className="h-8 w-8 text-red-400 hover:bg-red-400/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {dietTemplates.length === 0 && <p className="text-center text-gray-500 py-8">No has creado dietas aún</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECIPES TAB - Recipe management for trainers */}
          <TabsContent value="recipes" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-violet-400" />
                  Gestión de Recetas
                </CardTitle>
                <p className="text-sm text-gray-500">Crea y gestiona recetas para tus socios. Puedes subir fotos desde tu dispositivo.</p>
              </CardHeader>
              <CardContent>
                <RecipesManager userId={user.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CALCULATOR TAB - Macro calculator for trainers */}
          <TabsContent value="calculator" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-violet-400" />
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

                <Button onClick={calculateMacros} className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-2xl py-6">
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
                        <Send className="w-4 h-4 text-violet-400" />
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
                  <Camera className="w-5 h-5 text-violet-400" />
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
                        className="w-full flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] hover:border-violet-500/30 transition-all"
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
                      className="mb-4 text-violet-400 hover:text-[rgb(6, 182, 212)]"
                    >
                      ← Volver a la lista
                    </Button>

                    <div className="flex items-center gap-3 mb-4 p-3 bg-black/30 rounded-xl">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold">
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
                  <Bell className="w-5 h-5 text-violet-400" />
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
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-2xl py-6">
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
                  <div key={n.id} className={`p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] ${n.priority === 'high' ? 'border-l-4 border-l-red-500' : n.priority === 'normal' ? 'border-l-4 border-l-[rgb(139, 92, 246)]' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{n.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${n.priority === 'high' ? 'bg-red-500/20 text-red-400' : n.priority === 'normal' ? 'bg-gradient-to-r from-violet-600 to-cyan-600/20 text-violet-400' : 'bg-blue-500/20 text-blue-400'}`}>
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
        </Tabs >
      </main >

      {/* Diet Validation Modal */}
      <Dialog open={dietDraft !== null} onOpenChange={(val) => { if (!val) { setDietDraft(null); setDraftCorrectionHistory([]) } }}>
        <DialogContent className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-violet-400" />
              Revisar Propuesta de Inteligencia Artificial
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Edita las macros y las comidas sugeridas por el sistema antes de enviarlas al socio.
            </DialogDescription>
          </DialogHeader>

          {dietDraft && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-gray-400">Calorías (kcal)</Label>
                  <Input 
                    type="number"
                    className="bg-black/50 border-[#2a2a2a] text-white"
                    value={dietDraft.macros.calories}
                    onChange={(e) => setDietDraft({ ...dietDraft, macros: { ...dietDraft.macros, calories: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Proteínas (g)</Label>
                  <Input 
                    type="number"
                    className="bg-black/50 border-[#2a2a2a] text-white"
                    value={dietDraft.macros.protein_g}
                    onChange={(e) => setDietDraft({ ...dietDraft, macros: { ...dietDraft.macros, protein_g: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Carbohidratos (g)</Label>
                  <Input 
                    type="number"
                    className="bg-black/50 border-[#2a2a2a] text-white"
                    value={dietDraft.macros.carbs_g}
                    onChange={(e) => setDietDraft({ ...dietDraft, macros: { ...dietDraft.macros, carbs_g: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Grasas (g)</Label>
                  <Input 
                    type="number"
                    className="bg-black/50 border-[#2a2a2a] text-white"
                    value={dietDraft.macros.fat_g}
                    onChange={(e) => setDietDraft({ ...dietDraft, macros: { ...dietDraft.macros, fat_g: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-400 mb-2 block">Menú Diario Propuesto</Label>
                <Textarea
                  className="w-full bg-black/50 border-[#2a2a2a] text-gray-200 h-[400px] font-mono text-sm leading-relaxed"
                  value={dietDraft.fullDietContent}
                  onChange={(e) => setDietDraft({ ...dietDraft, fullDietContent: e.target.value })}
                />
              </div>

              {/* AI Correction Chat */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <Label className="text-violet-300 text-sm font-semibold">Corregir con IA</Label>
                </div>
                {draftCorrectionHistory.length > 0 && (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {draftCorrectionHistory.map((msg, i) => (
                      <div key={i} className="text-xs text-gray-400 bg-white/5 rounded-lg px-3 py-1.5 flex items-start gap-2">
                        <span className="text-violet-400 shrink-0">✓</span>
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder='Ej: "cambia el pollo por merluza en la comida" o "sube la proteína del desayuno"'
                    className="bg-black/50 border-[#2a2a2a] text-white text-sm flex-1"
                    value={draftCorrection}
                    onChange={(e) => setDraftCorrection(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRefineDraft()}
                    disabled={refining}
                  />
                  <Button
                    onClick={handleRefineDraft}
                    disabled={refining || !draftCorrection.trim()}
                    className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                  >
                    {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Escribe una instrucción y pulsa Enter o el botón. La IA actualizará el menú manteniendo los macros.</p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="w-1/3 border-[#2a2a2a] text-white" onClick={() => { setDietDraft(null); setDraftCorrectionHistory([]) }}>
                  Cancelar
                </Button>
                <Button
                  disabled={loading}
                  className="w-2/3 bg-gradient-to-r from-violet-600 to-cyan-600 text-black font-bold"
                  onClick={handleAssignDraftDiet}
                >
                  {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                  Confirmar y Asignar Dieta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Chat */}
      < FloatingChat
        userId={user.id}
        userRole="trainer"
        members={members}
      />

      <Toaster />
      {
        showWorkoutBuilder && (
          <Dialog open={showWorkoutBuilder} onOpenChange={setShowWorkoutBuilder}>
            <DialogContent className="max-w-5xl bg-[#1a1a1a] border-white/5 rounded-[40px] p-0 overflow-hidden">
              <WorkoutBuilder
                trainerId={user.id} existingWorkout={editingWorkout}
                onSave={() => { setShowWorkoutBuilder(false); loadWorkoutTemplates(); }}
                onCancel={() => setShowWorkoutBuilder(false)}
              />
            </DialogContent>
          </Dialog>
        )
      }

      {
        showDietBuilder && (
          <Dialog open={showDietBuilder} onOpenChange={setShowDietBuilder}>
            <DialogContent className="max-w-4xl bg-[#1a1a1a] border-white/5 rounded-[40px] p-0 overflow-hidden">
              <DietBuilder
                trainerId={user.id} existingDiet={editingDiet}
                onSave={() => { setShowDietBuilder(false); loadDietTemplates(); }}
                onCancel={() => setShowDietBuilder(false)}
              />
            </DialogContent>
          </Dialog>
        )
      }
    </div >
  )
}
