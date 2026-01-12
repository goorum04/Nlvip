'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DEMO_ACCOUNTS } from '@/lib/demo-credentials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dumbbell, Sparkles, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import AdminDashboard from '@/components/AdminDashboard'
import TrainerDashboard from '@/components/TrainerDashboard'
import MemberDashboard from '@/components/MemberDashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const { toast } = useToast()

  // Login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register form
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [invitationCode, setInvitationCode] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      console.log('Checking user...')
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Auth error:', error)
      }
      if (user) {
        console.log('User found:', user.email)
        setUser(user)
        await loadProfile(user.id)
      } else {
        console.log('No user logged in')
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (data) {
      setProfile(data)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      setUser(data.user)
      await loadProfile(data.user.id)
      
      toast({
        title: '¡Bienvenido!',
        description: 'Sesión iniciada correctamente'
      })
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

  const handleDemoLogin = async (role) => {
    const account = DEMO_ACCOUNTS[role]
    setEmail(account.email)
    setPassword(account.password)
    
    // Simulate form submission
    setTimeout(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: account.password
        })

        if (error) throw error

        setUser(data.user)
        await loadProfile(data.user.id)
        
        toast({
          title: '¡Demo activada!',
          description: `Iniciaste sesión como ${role === 'member' ? 'Socio' : role === 'trainer' ? 'Entrenador' : 'Admin'}`
        })
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo iniciar la demo. Asegúrate de haber ejecutado el script de seed.',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }, 100)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Verificar código de invitación
      const { data: codeData, error: codeError } = await supabase
        .from('invitation_codes')
        .select('*, profiles!invitation_codes_trainer_id_fkey(name)')
        .eq('code', invitationCode)
        .single()

      if (codeError || !codeData) {
        throw new Error('Código de invitación inválido')
      }

      if (!codeData.is_active) {
        throw new Error('Este código ya no está activo')
      }

      if (codeData.max_uses && codeData.uses_count >= codeData.max_uses) {
        throw new Error('Este código ha alcanzado el límite de usos')
      }

      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        throw new Error('Este código ha expirado')
      }

      // Crear cuenta
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            name: regName,
            role: 'member'
          }
        }
      })

      if (authError) throw authError

      // Crear perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: regEmail,
          name: regName,
          role: 'member'
        }])

      if (profileError) throw profileError

      // Asignar al entrenador
      const { error: assignError } = await supabase
        .from('trainer_members')
        .insert([{
          trainer_id: codeData.trainer_id,
          member_id: authData.user.id
        }])

      if (assignError) throw assignError

      // Incrementar contador del código
      await supabase
        .from('invitation_codes')
        .update({ uses_count: codeData.uses_count + 1 })
        .eq('code', invitationCode)

      toast({
        title: '¡Cuenta creada!',
        description: `Has sido asignado al entrenador ${codeData.profiles.name}`
      })

      // Auto login
      setUser(authData.user)
      await loadProfile(authData.user.id)
      
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    toast({
      title: 'Sesión cerrada',
      description: 'Hasta pronto'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="text-4xl font-black tracking-tight">
            <span className="text-white">NL</span>
            <span className="text-[#00D4FF]"> VIP</span>
          </div>
          <p className="text-[#00D4FF] text-lg">Cargando...</p>
        </div>
      </div>
    )
  }

  // Si hay usuario autenticado, mostrar dashboard según rol
  if (user && profile) {
    if (profile.role === 'admin') {
      return <AdminDashboard user={user} profile={profile} onLogout={handleLogout} />
    }
    if (profile.role === 'trainer') {
      return <TrainerDashboard user={user} profile={profile} onLogout={handleLogout} />
    }
    if (profile.role === 'member') {
      return <MemberDashboard user={user} profile={profile} onLogout={handleLogout} />
    }
  }

  // Pantalla de login/registro
  return (
    <div className="min-h-screen bg-[#030303] relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-transparent to-cyan-950/30" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
      </div>
      
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{
          backgroundImage: 'url(https://customer-assets.emergentagent.com/job_39287fc6-01ac-45b2-aba3-268b6afd68e6/artifacts/6b3h6oyj_unnamed.webp)',
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-transparent" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {/* Glassmorphism Card */}
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-black text-sm">NL</span>
              </div>
              <span className="text-2xl font-black text-white tracking-tight">VIP CLUB</span>
            </div>
            <p className="text-gray-400 text-sm">Tu gimnasio premium de alto nivel</p>
          </div>

          {/* Glass Card */}
          <Card className="bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <Tabs value={authMode} onValueChange={setAuthMode} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-black/40 rounded-2xl p-1">
                  <TabsTrigger 
                    value="login" 
                    className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    Iniciar Sesión
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    Registro
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-300 text-sm font-medium">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-black/40 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all"
                      />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300 text-sm font-medium">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-black/40 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>

                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <p className="text-xs text-gray-500">Cuentas Demo</p>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-black/30 border-white/10 text-gray-300 hover:bg-violet-600/20 hover:border-violet-500/30 hover:text-white rounded-xl h-11 transition-all"
                      onClick={() => handleDemoLogin('member')}
                    >
                      <Dumbbell className="w-4 h-4 mr-1" />
                      Socio
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-black/30 border-white/10 text-gray-300 hover:bg-cyan-600/20 hover:border-cyan-500/30 hover:text-white rounded-xl h-11 transition-all"
                      onClick={() => handleDemoLogin('trainer')}
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Trainer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-black/30 border-white/10 text-gray-300 hover:bg-purple-600/20 hover:border-purple-500/30 hover:text-white rounded-xl h-11 transition-all"
                      onClick={() => handleDemoLogin('admin')}
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Admin
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-gray-300 text-sm font-medium">Nombre Completo</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Juan Pérez"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      className="bg-black/40 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-gray-300 text-sm font-medium">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="bg-black/40 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-gray-300 text-sm font-medium">Contraseña</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      className="bg-black/40 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invitation-code" className="text-gray-300 text-sm font-medium">Código de Invitación</Label>
                    <Input
                      id="invitation-code"
                      type="text"
                      placeholder="NLVIP-XXXX"
                      value={invitationCode}
                      onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                      required
                      className="bg-black/40 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                    />
                    <p className="text-xs text-gray-500">
                      Solicita tu código a tu entrenador o administrador
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? 'Creando...' : 'Crear Cuenta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>

      <Toaster />
    </div>
  )
}