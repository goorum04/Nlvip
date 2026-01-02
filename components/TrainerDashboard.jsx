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
import { 
  Dumbbell, Users, Bell, LogOut, Plus, Apple, 
  Sparkles, Eye, Send
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import FloatingChat from './FloatingChat'

export default function TrainerDashboard({ user, profile, onLogout }) {
  const [members, setMembers] = useState([])
  const [workoutTemplates, setWorkoutTemplates] = useState([])
  const [dietTemplates, setDietTemplates] = useState([])
  const [notices, setNotices] = useState([])
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

  const setupChatSubscription = () => {
    const channel = supabase
      .channel('trainer_chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `trainer_id=eq.${user.id}`
      }, () => {
        if (selectedMember) loadChatMessages(selectedMember.id)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadData = async () => {
    await Promise.all([loadMembers(), loadWorkoutTemplates(), loadDietTemplates(), loadNotices()])
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
    if (data) setWorkoutTemplates(data)
  }

  const loadDietTemplates = async () => {
    const { data } = await supabase.from('diet_templates').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false })
    if (data) setDietTemplates(data)
  }

  const loadNotices = async () => {
    const { data } = await supabase.from('trainer_notices').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false }).limit(10)
    if (data) setNotices(data)
  }

  const loadChatMessages = async (memberId) => {
    const { data } = await supabase
      .from('chat_messages')
      .select(`*, sender:profiles!chat_messages_sender_id_fkey(name, role)`)
      .eq('trainer_id', user.id)
      .eq('member_id', memberId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setChatMessages(data)
      setTimeout(scrollToBottom, 100)
    }
  }

  const handleSelectMemberChat = (member) => {
    setSelectedMember(member)
    loadChatMessages(member.id)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedMember) return

    setLoading(true)
    try {
      const { error } = await supabase.from('chat_messages').insert([{
        sender_id: user.id,
        trainer_id: user.id,
        member_id: selectedMember.id,
        message: newMessage
      }])
      if (error) throw error
      setNewMessage('')
      loadChatMessages(selectedMember.id)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0B0B0B] to-[#0a0a0a]">
      {/* ULTRA MODERN HEADER */}
      <header className="relative overflow-hidden border-b border-[#2a2a2a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A24D]/10 via-transparent to-[#C9A24D]/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A24D]/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center shadow-lg shadow-[#C9A24D]/30">
                <Dumbbell className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#C9A24D] to-[#D4AF37]">NL VIP CLUB</h1>
                <p className="text-sm text-gray-500">Panel de Entrenador</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-white font-semibold">{profile.name}</p>
                <div className="flex items-center gap-1 justify-end">
                  <Sparkles className="w-3 h-3 text-[#C9A24D]" />
                  <p className="text-xs text-[#C9A24D]">Entrenador</p>
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
                { value: 'chat', icon: MessageCircle, label: 'Chat' },
                { value: 'workouts', icon: Dumbbell, label: 'Rutinas' },
                { value: 'diets', icon: Apple, label: 'Dietas' },
                { value: 'notices', icon: Bell, label: 'Avisos' }
              ].map(tab => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="px-5 py-3 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#C9A24D] data-[state=active]:to-[#D4AF37] data-[state=active]:text-black data-[state=active]:border-transparent data-[state=active]:shadow-lg data-[state=active]:shadow-[#C9A24D]/20 transition-all"
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
                  <Users className="w-5 h-5 text-[#C9A24D]" />
                  Mis Socios ({members.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <Dialog key={member.id}>
                    <DialogTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] cursor-pointer hover:border-[#C9A24D]/30 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A24D]/20 to-[#D4AF37]/10 flex items-center justify-center text-[#C9A24D] font-bold border border-[#C9A24D]/20">
                            {member.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
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
                    <Users className="w-16 h-16 mx-auto text-[#C9A24D]/20 mb-4" />
                    <p className="text-gray-500">No tienes socios asignados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 h-[600px]">
              {/* Members List */}
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl md:col-span-1 overflow-hidden">
                <CardHeader className="border-b border-[#2a2a2a]">
                  <CardTitle className="text-white text-lg">Conversaciones</CardTitle>
                </CardHeader>
                <CardContent className="p-2 overflow-y-auto h-[calc(100%-80px)]">
                  {members.map(member => (
                    <div 
                      key={member.id}
                      onClick={() => handleSelectMemberChat(member)}
                      className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${selectedMember?.id === member.id ? 'bg-[#C9A24D]/20 border border-[#C9A24D]/30' : 'hover:bg-black/30'}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A24D]/20 to-[#D4AF37]/10 flex items-center justify-center text-[#C9A24D] font-bold text-sm">
                        {member.name?.charAt(0)}
                      </div>
                      <p className="font-medium text-white text-sm">{member.name}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Chat Area */}
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl md:col-span-2 flex flex-col overflow-hidden">
                {selectedMember ? (
                  <>
                    <CardHeader className="border-b border-[#2a2a2a] py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center text-black font-bold">
                          {selectedMember.name?.charAt(0)}
                        </div>
                        <div>
                          <CardTitle className="text-white text-lg">{selectedMember.name}</CardTitle>
                          <p className="text-xs text-gray-500">{selectedMember.email}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0">
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.map((msg) => {
                          const isMe = msg.sender_id === user.id
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] ${isMe ? 'bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black' : 'bg-[#2a2a2a] text-white'} rounded-2xl px-4 py-3 ${isMe ? 'rounded-br-md' : 'rounded-bl-md'}`}>
                                <p className="text-sm">{msg.message}</p>
                                <p className={`text-xs mt-1 ${isMe ? 'text-black/60' : 'text-gray-500'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                      <form onSubmit={handleSendMessage} className="p-4 border-t border-[#2a2a2a] flex gap-2">
                        <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribe un mensaje..." className="bg-black/50 border-[#2a2a2a] rounded-2xl text-white" />
                        <Button type="submit" disabled={loading || !newMessage.trim()} className="bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black rounded-2xl px-6">
                          <Send className="w-5 h-5" />
                        </Button>
                      </form>
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageCircle className="w-20 h-20 mx-auto text-[#C9A24D]/20 mb-4" />
                      <p className="text-gray-500">Selecciona un socio para chatear</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* WORKOUTS TAB */}
          <TabsContent value="workouts" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#C9A24D]" />
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
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-2xl py-6">
                    <Dumbbell className="w-5 h-5 mr-2" /> Crear Rutina
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white">Mis Rutinas ({workoutTemplates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workoutTemplates.map(t => (
                  <div key={t.id} className="p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
                    <h4 className="font-bold text-white mb-2">{t.name}</h4>
                    <p className="text-sm text-gray-400 line-clamp-2">{t.description}</p>
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
                  <Plus className="w-5 h-5 text-[#C9A24D]" />
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
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-2xl py-6">
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
                      <span className="text-[#C9A24D] font-semibold">{t.calories} kcal</span>
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

          {/* NOTICES TAB */}
          <TabsContent value="notices" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#C9A24D]" />
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
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-2xl py-6">
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
                  <div key={n.id} className={`p-4 bg-black/30 rounded-2xl border border-[#2a2a2a] ${n.priority === 'high' ? 'border-l-4 border-l-red-500' : n.priority === 'normal' ? 'border-l-4 border-l-[#C9A24D]' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{n.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${n.priority === 'high' ? 'bg-red-500/20 text-red-400' : n.priority === 'normal' ? 'bg-[#C9A24D]/20 text-[#C9A24D]' : 'bg-blue-500/20 text-blue-400'}`}>
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
      <Toaster />
    </div>
  )
}
