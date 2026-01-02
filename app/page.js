'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DEMO_ACCOUNTS } from '@/lib/demo-credentials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dumbbell, Crown, Sparkles } from 'lucide-react'
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
          <Crown className="w-16 h-16 text-[#C9A24D]" />
          <p className="text-[#C9A24D] text-lg">Cargando...</p>
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
    <div className="min-h-screen bg-[#0B0B0B] relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80)',
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/90 border-[#C9A24D]/20">
          <CardHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Crown className="w-10 h-10 text-[#C9A24D]" />
              <Sparkles className="w-6 h-6 text-[#C9A24D]" />
            </div>
            <CardTitle className="text-3xl font-bold text-[#C9A24D]">
              NL VIP CLUB
            </CardTitle>
            <CardDescription className="text-gray-300">
              Tu gimnasio premium de alto nivel
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={authMode} onValueChange={setAuthMode} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-[#1a1a1a]">
                <TabsTrigger value="login" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
                  Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black">
                  Registro
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-200">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-[#1a1a1a] border-[#C9A24D]/20 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-200">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-[#1a1a1a] border-[#C9A24D]/20 text-white"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-[#C9A24D] hover:bg-[#D4AF37] text-black font-semibold"
                    disabled={loading}
                  >
                    Entrar
                  </Button>
                </form>

                <div className="space-y-2 pt-4 border-t border-[#C9A24D]/20">
                  <p className="text-sm text-center text-gray-400 mb-3">Cuentas Demo</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-[#C9A24D]/40 text-[#C9A24D] hover:bg-[#C9A24D]/10"
                    onClick={() => handleDemoLogin('member')}
                  >
                    <Dumbbell className="w-4 h-4 mr-2" />
                    Entrar como Socio Demo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-[#C9A24D]/40 text-[#C9A24D] hover:bg-[#C9A24D]/10"
                    onClick={() => handleDemoLogin('trainer')}
                  >
                    <Dumbbell className="w-4 h-4 mr-2" />
                    Entrar como Entrenador Demo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-[#C9A24D]/40 text-[#C9A24D] hover:bg-[#C9A24D]/10"
                    onClick={() => handleDemoLogin('admin')}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Entrar como Admin Demo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-gray-200">Nombre Completo</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Juan Pérez"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      className="bg-[#1a1a1a] border-[#C9A24D]/20 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-gray-200">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="bg-[#1a1a1a] border-[#C9A24D]/20 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-gray-200">Contraseña</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      className="bg-[#1a1a1a] border-[#C9A24D]/20 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invitation-code" className="text-gray-200">Código de Invitación</Label>
                    <Input
                      id="invitation-code"
                      type="text"
                      placeholder="NLVIP-XXXX"
                      value={invitationCode}
                      onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                      required
                      className="bg-[#1a1a1a] border-[#C9A24D]/20 text-white"
                    />
                    <p className="text-xs text-gray-400">
                      Solicita tu código a tu entrenador o administrador
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-[#C9A24D] hover:bg-[#D4AF37] text-black font-semibold"
                    disabled={loading}
                  >
                    Crear Cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Toaster />
    </div>
  )
}