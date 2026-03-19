'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Users, Bot, Dumbbell, Apple, Key, LogOut, Settings, Loader2, MessageSquare
} from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'

// Refactored Components
import AdminAssistant from './AdminAssistant'
import { AdminUsersTab } from './AdminUsersTab'
import { AdminContentTab } from './AdminContentTab'
import { AdminCodesTab } from './AdminCodesTab'
import { AdminFeedTab } from './AdminFeedTab'
import { MemberDetailPanel } from './MemberDetailPanel'
import { WorkoutBuilder } from './WorkoutBuilder'
import { ProfileModal, AvatarBubble } from './UserProfile'

export default function AdminDashboard({ user, profile, onLogout }) {
  const [trainers, setTrainers] = useState([])
  const [codes, setCodes] = useState([])
  const [members, setMembers] = useState([])
  const [workoutTemplates, setWorkoutTemplates] = useState([])
  const [dietTemplates, setDietTemplates] = useState([])
  const [activeTab, setActiveTab] = useState('assistant')
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showMemberDetail, setShowMemberDetail] = useState(false)
  const [showWorkoutBuilder, setShowWorkoutBuilder] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tRes, cRes, mRes, wRes, dRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'trainer').order('name'),
        supabase.from('invitation_codes').select('*, trainer:profiles(name)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'member').order('created_at', { ascending: false }),
        supabase.from('workout_templates').select('*, trainer:profiles(name)').order('created_at', { ascending: false }),
        supabase.from('diet_templates').select('*, trainer:profiles(name)').order('created_at', { ascending: false })
      ])

      if (tRes.data) setTrainers(tRes.data)
      if (cRes.data) setCodes(cRes.data)
      if (mRes.data) setMembers(mRes.data)
      if (wRes.data) setWorkoutTemplates(wRes.data)
      if (dRes.data) setDietTemplates(dRes.data)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTrainer = async (id) => {
    if (!confirm('┬┐Quitar rol de entrenador? (Volver├í a ser socio)')) return
    const { error } = await supabase.from('profiles').update({ role: 'member' }).eq('id', id)
    if (!error) {
      toast({ title: 'Entrenador revocado' })
      loadData()
    }
  }

  const handleDeleteCode = async (id) => {
    if (!confirm('┬┐Eliminar c├│digo?')) return
    const { error } = await supabase.from('invitation_codes').delete().eq('id', id)
    if (!error) {
      toast({ title: 'C├│digo eliminado' })
      loadData()
    }
  }

  const handleCreateWorkout = async (w) => {
    const { error } = await supabase.from('workout_templates').insert([{
      trainer_id: user.id,
      name: w.name,
      description: w.description
    }])
    if (!error) { toast({ title: 'Rutina creada' }); loadData(); }
  }

  const handleCreateDiet = async (d) => {
    const { error } = await supabase.from('diet_templates').insert([{
      trainer_id: user.id,
      name: d.name,
      calories: parseInt(d.calories),
      protein_g: parseInt(d.protein),
      carbs_g: parseInt(d.carbs),
      fat_g: parseInt(d.fat),
      content: d.content
    }])
    if (!error) { toast({ title: 'Dieta creada' }); loadData(); }
  }

  const handleDeleteWorkout = async (id) => {
    if (confirm('┬┐Eliminar rutina?')) {
      const { data, error } = await supabase.from('workout_templates').delete().eq('id', id).select()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else if (!data || data.length === 0) {
        toast({ title: 'Error', description: 'No tienes permisos para borrar esta rutina (RLS)', variant: 'destructive' })
      } else {
        toast({ title: 'Rutina eliminada' })
        loadData()
      }
    }
  }

  const handleDeleteDiet = async (id) => {
    if (confirm('┬┐Eliminar dieta?')) {
      const { data, error } = await supabase.from('diet_templates').delete().eq('id', id).select()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else if (!data || data.length === 0) {
        toast({ title: 'Error', description: 'No tienes permisos para borrar esta dieta (RLS)', variant: 'destructive' })
      } else {
        toast({ title: 'Dieta eliminada' })
        loadData()
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f10] text-gray-100 font-sans pb-20">
      <header className="sticky top-0 z-40 bg-[#0f0f10]/90 backdrop-blur-xl border-b border-white/5 px-6 pt-12 pb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo-nl-vip.jpg" 
              alt="NL VIP TEAM" 
              className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-violet-500/30"
            />
            <div>
              <h1 className="font-black text-lg tracking-tighter text-white uppercase italic">VIP CLUB</h1>
              <p className="text-[10px] text-violet-400 font-bold tracking-widest uppercase">Admin Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
            <div className="text-right hidden md:block">
              <span className="text-sm font-bold text-gray-400">{profile?.name}</span>
            </div>
            <AvatarBubble 
              profile={profile} 
              size="md" 
              onClick={() => setShowProfileModal(true)} 
            />
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-gray-500 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-black/40 p-1.5 rounded-3xl border border-white/5">
            <TabsList className="bg-transparent border-none p-0 h-auto flex flex-wrap gap-1">
              <TabsTrigger value="assistant" className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                <Bot className="w-4 h-4" /> Asistente IA
              </TabsTrigger>
              <TabsTrigger value="users" className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 data-[state=active]:bg-violet-600">
                <Users className="w-4 h-4" /> Usuarios
              </TabsTrigger>
              <TabsTrigger value="content" className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 data-[state=active]:bg-violet-600">
                <Dumbbell className="w-4 h-4" /> Contenido
              </TabsTrigger>
              <TabsTrigger value="codes" className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 data-[state=active]:bg-violet-600">
                <Key className="w-4 h-4" /> C├│digos
              </TabsTrigger>
              <TabsTrigger value="feed" className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 data-[state=active]:bg-violet-600">
                <MessageSquare className="w-4 h-4" /> Feed
              </TabsTrigger>
            </TabsList>

            <Button variant="outline" size="sm" onClick={() => setShowProfileModal(true)} className="rounded-2xl border-white/10 text-gray-400 hover:text-white">
              <Settings className="w-4 h-4 mr-2" /> Ajustes
            </Button>
          </div>

          <TabsContent value="assistant" className="mt-0 ring-0 focus-visible:ring-0">
            <AdminAssistant user={user} />
          </TabsContent>

          <TabsContent value="users" className="mt-0 ring-0 focus-visible:ring-0">
            <AdminUsersTab
              trainers={trainers} members={members} onRefresh={loadData}
              onSelectMember={(m) => { setSelectedMember(m); setShowMemberDetail(true); }}
              onDeleteTrainer={handleDeleteTrainer}
            />
          </TabsContent>

          <TabsContent value="content" className="mt-0 ring-0 focus-visible:ring-0">
            <AdminContentTab
              workoutTemplates={workoutTemplates} dietTemplates={dietTemplates} onRefresh={loadData}
              onCreateWorkout={handleCreateWorkout} onCreateDiet={handleCreateDiet}
              onDeleteWorkout={handleDeleteWorkout} onDeleteDiet={handleDeleteDiet}
              onEditWorkout={(w) => { setEditingWorkout(w); setShowWorkoutBuilder(true); }}
            />
          </TabsContent>

          <TabsContent value="codes" className="mt-0 ring-0 focus-visible:ring-0">
            <AdminCodesTab
              codes={codes} trainers={trainers} onRefresh={loadData}
              onDeleteCode={handleDeleteCode}
            />
          </TabsContent>

          <TabsContent value="feed" className="mt-0 ring-0 focus-visible:ring-0">
            <AdminFeedTab user={user} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Detail Panels */}
      <MemberDetailPanel
        member={selectedMember} isOpen={showMemberDetail}
        onClose={() => setShowMemberDetail(false)}
        onRefresh={loadData}
      />

      {showWorkoutBuilder && (
        <Dialog open={showWorkoutBuilder} onOpenChange={setShowWorkoutBuilder}>
          <DialogContent className="max-w-5xl bg-[#1a1a1a] border-white/5 rounded-[40px] p-0 overflow-hidden">
            <WorkoutBuilder
              trainerId={user.id} existingWorkout={editingWorkout}
              onSave={() => { setShowWorkoutBuilder(false); loadData(); }}
              onCancel={() => setShowWorkoutBuilder(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {showProfileModal && (
        <ProfileModal
          user={user} profile={profile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      <Toaster />
    </div>
  )
}
