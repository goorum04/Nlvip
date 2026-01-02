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
import { Dumbbell, Users, Bell, LogOut, Plus, Calendar, Apple, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

export default function TrainerDashboard({ user, profile, onLogout }) {
  const [members, setMembers] = useState([])
  const [workoutTemplates, setWorkoutTemplates] = useState([])
  const [dietTemplates, setDietTemplates] = useState([])
  const [notices, setNotices] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Form states
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadMembers(),
      loadWorkoutTemplates(),
      loadDietTemplates(),
      loadNotices()
    ])
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('trainer_members')
      .select(`
        member_id,
        member:profiles!trainer_members_member_id_fkey(
          id,
          name,
          email,
          created_at
        )
      `)
      .eq('trainer_id', user.id)
    
    if (data) {
      const membersData = data.map(tm => tm.member)
      setMembers(membersData)
    }
  }

  const loadWorkoutTemplates = async () => {
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })
    
    if (data) setWorkoutTemplates(data)
  }

  const loadDietTemplates = async () => {
    const { data, error } = await supabase
      .from('diet_templates')
      .select('*')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })
    
    if (data) setDietTemplates(data)
  }

  const loadNotices = async () => {
    const { data, error } = await supabase
      .from('trainer_notices')
      .select('*')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (data) setNotices(data)
  }

  const handleCreateWorkout = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('workout_templates')
        .insert([{
          trainer_id: user.id,
          name: newWorkoutName,
          description: newWorkoutDesc
        }])

      if (error) throw error

      toast({
        title: '¡Rutina creada!',
        description: 'La rutina se ha guardado correctamente'
      })

      setNewWorkoutName('')
      setNewWorkoutDesc('')
      loadWorkoutTemplates()

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

  const handleCreateDiet = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('diet_templates')
        .insert([{
          trainer_id: user.id,
          name: newDietName,
          calories: parseInt(newDietCalories),
          protein_g: parseInt(newDietProtein),
          carbs_g: parseInt(newDietCarbs),
          fat_g: parseInt(newDietFat),
          content: newDietContent
        }])

      if (error) throw error

      toast({
        title: '¡Dieta creada!',
        description: 'La dieta se ha guardado correctamente'
      })

      setNewDietName('')
      setNewDietCalories('')
      setNewDietProtein('')
      setNewDietCarbs('')
      setNewDietFat('')
      setNewDietContent('')
      loadDietTemplates()

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

  const handleAssignWorkout = async (memberId, templateId) => {
    try {
      const { error } = await supabase
        .from('member_workouts')
        .upsert({
          member_id: memberId,
          workout_template_id: templateId,
          assigned_by: user.id
        }, {
          onConflict: 'member_id'
        })

      if (error) throw error

      toast({
        title: '¡Rutina asignada!',
        description: 'El socio ahora puede ver su rutina'
      })

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleAssignDiet = async (memberId, templateId) => {
    try {
      const { error } = await supabase
        .from('member_diets')
        .upsert({
          member_id: memberId,
          diet_template_id: templateId,
          assigned_by: user.id
        }, {
          onConflict: 'member_id'
        })

      if (error) throw error

      toast({
        title: '¡Dieta asignada!',
        description: 'El socio ahora puede ver su dieta'
      })

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleCreateNotice = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('trainer_notices')
        .insert([{
          trainer_id: user.id,
          member_id: noticeRecipient !== 'all' ? noticeRecipient : null,
          title: noticeTitle,
          message: noticeMessage,
          priority: noticePriority
        }])

      if (error) throw error

      toast({
        title: '¡Aviso enviado!',
        description: noticeRecipient === 'all' ? 'Todos tus socios verán este aviso' : 'El socio verá este aviso'
      })

      setNoticeTitle('')
      setNoticeMessage('')
      setNoticePriority('normal')
      setNoticeRecipient('all')
      loadNotices()

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

  const loadMemberProgress = async (memberId) => {
    const { data, error } = await supabase
      .from('progress_records')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false })
      .limit(10)
    
    return data || []
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      {/* Modern Header */}
      <header className="bg-gradient-to-br from-black via-[#1a1a1a] to-black border-b border-[#C9A24D]/20 sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center shadow-lg">
                <Dumbbell className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#C9A24D]">NL VIP CLUB</h1>
                <p className="text-xs text-gray-400">Panel de Entrenador</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm text-gray-300 font-semibold">{profile.name}</p>
                <p className="text-xs text-[#C9A24D]">Entrenador</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#C9A24D]/40 text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-full"
                onClick={onLogout}
              >
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Salir</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Modern Tab Navigation */}
        <div className="bg-[#1a1a1a] rounded-2xl p-2 mb-6 shadow-lg border border-[#C9A24D]/10">
          <Tabs defaultValue="members" className="space-y-6">
            <TabsList className="bg-transparent grid grid-cols-2 md:grid-cols-4 gap-2 p-0">
              <TabsTrigger 
                value="members" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Users className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Mis Socios</span>
              </TabsTrigger>
              <TabsTrigger 
                value="workouts" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Dumbbell className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Rutinas</span>
              </TabsTrigger>
              <TabsTrigger 
                value="diets" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Apple className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Dietas</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notices" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Bell className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Avisos</span>
              </TabsTrigger>
            </TabsList>

          {/* Socios */}
          <TabsContent value="members" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Mis Socios ({members.length})</CardTitle>
                <CardDescription className="text-gray-400">
                  Gestiona a tus socios asignados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <Dialog key={member.id}>
                      <DialogTrigger asChild>
                        <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10 cursor-pointer hover:border-[#C9A24D]/30 transition">
                          <div>
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-sm text-gray-400">{member.email}</p>
                          </div>
                          <Button size="sm" className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black">
                            Ver Detalles
                          </Button>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="bg-[#1a1a1a] border-[#C9A24D]/20 max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-[#C9A24D]">{member.name}</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Gestiona la rutina y dieta de este socio
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-white font-semibold mb-2">Asignar Rutina</h4>
                            <Select onValueChange={(value) => handleAssignWorkout(member.id, value)}>
                              <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                                <SelectValue placeholder="Seleccionar rutina..." />
                              </SelectTrigger>
                              <SelectContent>
                                {workoutTemplates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <h4 className="text-white font-semibold mb-2">Asignar Dieta</h4>
                            <Select onValueChange={(value) => handleAssignDiet(member.id, value)}>
                              <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                                <SelectValue placeholder="Seleccionar dieta..." />
                              </SelectTrigger>
                              <SelectContent>
                                {dietTemplates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name} ({template.calories} kcal)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                  {members.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No tienes socios asignados aún</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rutinas */}
          <TabsContent value="workouts" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Crear Nueva Rutina</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkout} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-200">Nombre de la Rutina</Label>
                    <Input
                      value={newWorkoutName}
                      onChange={(e) => setNewWorkoutName(e.target.value)}
                      placeholder="Ej: Rutina Full Body"
                      required
                      className="bg-black border-[#C9A24D]/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Descripción</Label>
                    <Textarea
                      value={newWorkoutDesc}
                      onChange={(e) => setNewWorkoutDesc(e.target.value)}
                      placeholder="Describe la rutina..."
                      required
                      className="bg-black border-[#C9A24D]/20 text-white min-h-[100px]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Rutina
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Mis Rutinas ({workoutTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workoutTemplates.map((template) => (
                    <div key={template.id} className="p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <h4 className="font-semibold text-white mb-1">{template.name}</h4>
                      <p className="text-sm text-gray-400">{template.description}</p>
                    </div>
                  ))}
                  {workoutTemplates.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No has creado rutinas aún</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dietas */}
          <TabsContent value="diets" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Crear Nueva Dieta</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDiet} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-200">Nombre de la Dieta</Label>
                    <Input
                      value={newDietName}
                      onChange={(e) => setNewDietName(e.target.value)}
                      placeholder="Ej: Dieta Definición 2000kcal"
                      required
                      className="bg-black border-[#C9A24D]/20 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Calorías</Label>
                      <Input
                        type="number"
                        value={newDietCalories}
                        onChange={(e) => setNewDietCalories(e.target.value)}
                        placeholder="2000"
                        required
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Proteína (g)</Label>
                      <Input
                        type="number"
                        value={newDietProtein}
                        onChange={(e) => setNewDietProtein(e.target.value)}
                        placeholder="150"
                        required
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Carbos (g)</Label>
                      <Input
                        type="number"
                        value={newDietCarbs}
                        onChange={(e) => setNewDietCarbs(e.target.value)}
                        placeholder="200"
                        required
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Grasas (g)</Label>
                      <Input
                        type="number"
                        value={newDietFat}
                        onChange={(e) => setNewDietFat(e.target.value)}
                        placeholder="60"
                        required
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Contenido / Plan de Comidas</Label>
                    <Textarea
                      value={newDietContent}
                      onChange={(e) => setNewDietContent(e.target.value)}
                      placeholder="Desayuno: ...\nAlmuerzo: ...\nCena: ..."
                      required
                      className="bg-black border-[#C9A24D]/20 text-white min-h-[150px]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Dieta
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Mis Dietas ({dietTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dietTemplates.map((template) => (
                    <div key={template.id} className="p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <h4 className="font-semibold text-white mb-2">{template.name}</h4>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400">Calorías</p>
                          <p className="text-[#C9A24D] font-semibold">{template.calories}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Proteína</p>
                          <p className="text-white">{template.protein_g}g</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Carbos</p>
                          <p className="text-white">{template.carbs_g}g</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Grasas</p>
                          <p className="text-white">{template.fat_g}g</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dietTemplates.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No has creado dietas aún</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avisos */}
          <TabsContent value="notices" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Crear Aviso</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateNotice} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Destinatario</Label>
                      <Select value={noticeRecipient} onValueChange={setNoticeRecipient}>
                        <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos mis socios</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Prioridad</Label>
                      <Select value={noticePriority} onValueChange={setNoticePriority}>
                        <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Título</Label>
                    <Input
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="Ej: Cambio de horario"
                      required
                      className="bg-black border-[#C9A24D]/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Mensaje</Label>
                    <Textarea
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      placeholder="Escribe tu mensaje..."
                      required
                      className="bg-black border-[#C9A24D]/20 text-white min-h-[100px]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                    disabled={loading}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Enviar Aviso
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Avisos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notices.map((notice) => (
                    <div key={notice.id} className="p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-white">{notice.title}</h4>
                        <span className={`text-xs px-2 py-1 rounded ${
                          notice.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          notice.priority === 'normal' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {notice.priority === 'high' ? 'Alta' : notice.priority === 'normal' ? 'Normal' : 'Baja'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{notice.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(notice.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {notices.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No has enviado avisos aún</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </main>

      <Toaster />
    </div>
  )
}
