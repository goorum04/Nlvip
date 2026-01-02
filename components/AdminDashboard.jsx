'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Crown, Users, Key, Shield, LogOut, UserPlus, Code } from 'lucide-react'
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadTrainers(),
      loadCodes(),
      loadMembers(),
      loadFeedPosts()
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

  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      {/* Modern Admin Header */}
      <header className="bg-gradient-to-br from-black via-[#1a1a1a] to-black border-b border-[#C9A24D]/20 sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#C9A24D]">NL VIP CLUB</h1>
                <p className="text-xs text-gray-400">Panel de Administrador</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm text-gray-300 font-semibold">{profile.name}</p>
                <p className="text-xs text-[#C9A24D]">Administrador</p>
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

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="trainers" className="space-y-6">
          <TabsList className="bg-[#1a1a1a] border border-[#C9A24D]/20">
            <TabsTrigger value="trainers" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Entrenadores
            </TabsTrigger>
            <TabsTrigger value="codes" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Key className="w-4 h-4 mr-2" />
              Códigos
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Socios
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Progreso Global
            </TabsTrigger>
            <TabsTrigger value="assignments" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Rutinas/Dietas
            </TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="feed" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
              <Shield className="w-4 h-4 mr-2" />
              Moderación
            </TabsTrigger>
          </TabsList>

          {/* Entrenadores */}
          <TabsContent value="trainers" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Crear Entrenador</CardTitle>
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
                        className="bg-black border-[#C9A24D]/20 text-white"
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
                        className="bg-black border-[#C9A24D]/20 text-white"
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
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                    disabled={loading}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Crear Entrenador
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Entrenadores Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trainers.map((trainer) => (
                    <div key={trainer.id} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
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
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Generar Código de Invitación</CardTitle>
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
                        <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
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
                        className="bg-black border-[#C9A24D]/20 text-white"
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
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                    disabled={loading || !selectedTrainerId}
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Generar Código
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Códigos Generados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {codes.map((code) => (
                    <div key={code.id} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <div className="flex-1">
                        <p className="font-mono font-bold text-[#C9A24D] text-lg">{code.code}</p>
                        <p className="text-sm text-gray-400">Entrenador: {code.profiles?.name}</p>
                        <p className="text-xs text-gray-500">
                          Usos: {code.uses_count}/{code.max_uses} | 
                          Expira: {new Date(code.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={code.is_active ? "destructive" : "default"}
                        className={code.is_active ? "" : "bg-[#C9A24D] hover:bg-[#D4AF37] text-black"}
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
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Socios Registrados ({members.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <div>
                        <p className="font-semibold text-white">{member.name}</p>
                        <p className="text-sm text-gray-400">{member.email}</p>
                        <p className="text-xs text-[#C9A24D] mt-1">
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

          {/* Feed / Moderación */}
          <TabsContent value="feed" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Moderación del Feed</CardTitle>
                <CardDescription className="text-gray-400">
                  Revisa y modera el contenido del feed social
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feedPosts.map((post) => (
                    <div key={post.id} className="p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
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