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
import { Users, Key, Shield, LogOut, UserPlus, Code, Plus, Calculator, Send, Loader2, UtensilsCrossed } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

export default function AdminDashboard({ user, profile, onLogout }) {
  const [trainers, setTrainers] = useState([])
  const [codes, setCodes] = useState([])
  const [members, setMembers] = useState([])
  const [feedPosts, setFeedPosts] = useState([])
  const [allProgress, setAllProgress] = useState([])
  const [allAssignments, setAllAssignments] = useState([])
  const [trainingVideos, setTrainingVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

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
      loadTrainingVideos()
    ])
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
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <span className="text-black font-black text-sm">NL</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-violet-400">NL VIP CLUB</h1>
                <p className="text-xs text-gray-400">Panel de Administrador</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm text-gray-300 font-semibold">{profile.name}</p>
                <p className="text-xs text-violet-400">Administrador</p>
              </div>
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

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="trainers" className="space-y-6">
          <TabsList className="bg-[#1a1a1a] border border-violet-500/20">
            <TabsTrigger value="trainers" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Entrenadores
            </TabsTrigger>
            <TabsTrigger value="codes" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Key className="w-4 h-4 mr-2" />
              Códigos
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Socios
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Progreso Global
            </TabsTrigger>
            <TabsTrigger value="assignments" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Rutinas/Dietas
            </TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="calculator" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Calculator className="w-4 h-4 mr-2" />
              Macros
            </TabsTrigger>
            <TabsTrigger value="feed" className="data-[state=active]:bg-gradient-to-r from-violet-600 to-cyan-600 data-[state=active]:text-black">
              <Shield className="w-4 h-4 mr-2" />
              Moderación
            </TabsTrigger>
          </TabsList>

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

          {/* Progreso Global */}
          <TabsContent value="progress" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Progreso de Todos los Socios</CardTitle>
                <CardDescription className="text-gray-400">
                  Visualiza el progreso de todos los miembros del gimnasio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allProgress.map((record) => (
                    <div key={record.id} className="p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-white">{record.member?.name}</p>
                          <p className="text-xs text-gray-400">{record.member?.email}</p>
                          <p className="text-sm text-violet-400 mt-1">
                            {new Date(record.date).toLocaleDateString()}
                          </p>
                        </div>
                        {record.weight_kg && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-violet-400">{record.weight_kg} kg</p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        {record.chest_cm && <p className="text-gray-400">Pecho: {record.chest_cm}cm</p>}
                        {record.waist_cm && <p className="text-gray-400">Cintura: {record.waist_cm}cm</p>}
                        {record.hips_cm && <p className="text-gray-400">Cadera: {record.hips_cm}cm</p>}
                      </div>
                      {record.notes && (
                        <p className="text-sm text-gray-300 mt-2 italic">{record.notes}</p>
                      )}
                    </div>
                  ))}
                  {allProgress.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay registros de progreso</p>
                  )}
                </div>
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

          {/* Feed / Moderación */}
          <TabsContent value="feed" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-violet-500/20">
              <CardHeader>
                <CardTitle className="text-violet-400">Moderación del Feed</CardTitle>
                <CardDescription className="text-gray-400">
                  Revisa y modera el contenido del feed social
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feedPosts.map((post) => (
                    <div key={post.id} className="p-4 bg-black/50 rounded-lg border border-violet-500/10">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white">{post.author?.name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(post.created_at).toLocaleString()}
                          </p>
                        </div>
                        {post.feed_reports && post.feed_reports.length > 0 && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            {post.feed_reports.length} reportes
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
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => hidePost(post.id)}
                      >
                        Ocultar Post
                      </Button>
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