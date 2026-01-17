'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DEMO_ACCOUNTS } from '@/lib/demo-credentials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dumbbell, Sparkles, Shield, Gift, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import AdminDashboard from '@/components/AdminDashboard'
import TrainerDashboard from '@/components/TrainerDashboard'
import MemberDashboard from '@/components/MemberDashboard'

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [invitationCode, setInvitationCode] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        await loadProfile(user.id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)
      await loadProfile(data.user.id)
      toast({ title: '¡Bienvenido!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Demo login - available for testing
  const handleDemoLogin = async (role) => {
    const account = DEMO_ACCOUNTS[role]
    if (!account) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password
      })
      if (error) throw error
      setUser(data.user)
      await loadProfile(data.user.id)
      toast({ title: `¡Bienvenido ${account.name}!` })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      let trainerId = null
      let hasPremium = false
      
      // If invitation code provided, validate it
      if (invitationCode.trim()) {
        const { data: codeData, error: codeError } = await supabase
          .from('invitation_codes')
          .select('*')
          .eq('code', invitationCode.toUpperCase())
          .eq('is_active', true)
          .single()

        if (codeError || !codeData) {
          throw new Error('Código de invitación inválido o expirado')
        }

        // Check if code has uses left
        if (codeData.uses_count >= codeData.max_uses) {
          throw new Error('Este código ya ha alcanzado el límite de usos')
        }

        // Check expiration
        if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
          throw new Error('Este código ha expirado')
        }

        trainerId = codeData.trainer_id
        hasPremium = true
      }

      // Create auth user
      const { data, error } = await supabase.auth.signUp({ 
        email: regEmail, 
        password: regPassword 
      })
      if (error) throw error

      // Create profile
      await supabase.from('profiles').insert([{
        id: data.user.id,
        email: regEmail,
        name: regName,
        role: 'member',
        has_premium: hasPremium
      }])

      // If premium (had valid code), update code usage and assign trainer
      if (hasPremium && invitationCode.trim()) {
        await supabase
          .from('invitation_codes')
          .update({ uses_count: supabase.raw('uses_count + 1') })
          .eq('code', invitationCode.toUpperCase())

        if (trainerId) {
          await supabase.from('trainer_members').insert([{
            trainer_id: trainerId,
            member_id: data.user.id
          }])
        }
      }

      toast({ 
        title: '¡Cuenta creada!', 
        description: hasPremium 
          ? 'Tienes acceso completo. Ya puedes iniciar sesión.' 
          : 'Cuenta básica creada. Usa un código para acceso premium.'
      })
      setAuthMode('login')
      setRegEmail('')
      setRegPassword('')
      setRegName('')
      setInvitationCode('')
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    toast({ title: 'Sesión cerrada' })
  }

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-black text-sm">NL</span>
            </div>
            <span className="text-2xl font-black text-white">VIP CLUB</span>
          </div>
          <p className="text-gray-300 text-lg font-medium leading-relaxed">
            No más empezar de cero.<br/>
            <span className="text-violet-400">Esta vez hay estrategia, guía y resultados reales.</span>
          </p>
        </div>
      </div>
    )
  }

  // Dashboard routing
  if (user && profile) {
    if (profile.role === 'admin') return <AdminDashboard user={user} profile={profile} onLogout={handleLogout} />
    if (profile.role === 'trainer') return <TrainerDashboard user={user} profile={profile} onLogout={handleLogout} />
    if (profile.role === 'member') return <MemberDashboard user={user} profile={profile} onLogout={handleLogout} />
  }

  // Login/Register screen
  return (
    <div className="min-h-screen bg-[#030303] relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" style={{animationDelay: '2s'}} />
      </div>
      
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-[#030303]/60" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <span className="text-white font-black">NL</span>
              </div>
              <div>
                <span className="text-3xl font-black text-white tracking-tight">VIP CLUB</span>
                <p className="text-xs text-gray-400 -mt-1">Premium Fitness</p>
              </div>
            </div>
          </div>

          {/* Glass Card */}
          <Card className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-8">
              <Tabs value={authMode} onValueChange={setAuthMode} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-black/40 rounded-2xl p-1.5 gap-1">
                  <TabsTrigger 
                    value="login" 
                    className="rounded-xl py-3 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-400 transition-all duration-300"
                  >
                    Iniciar Sesión
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    className="rounded-xl py-3 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-400 transition-all duration-300"
                  >
                    Registro
                  </TabsTrigger>
                </TabsList>

                {/* Login Form */}
                <TabsContent value="login" className="space-y-5 mt-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Contraseña</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-[1.02]"
                    >
                      {loading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </form>

                  {/* Demo buttons - ONLY IN DEVELOPMENT */}
                  {isDevelopment && (
                    <div className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        <span className="text-xs text-gray-500 font-medium">🔧 Acceso Demo (Dev)</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Button
                          type="button"
                          onClick={() => handleDemoLogin('member')}
                          className="bg-white/5 hover:bg-violet-600/30 border border-white/10 hover:border-violet-500/50 text-gray-300 hover:text-white rounded-xl h-12 transition-all duration-300 group"
                        >
                          <Dumbbell className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                          Socio
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDemoLogin('trainer')}
                          className="bg-white/5 hover:bg-cyan-600/30 border border-white/10 hover:border-cyan-500/50 text-gray-300 hover:text-white rounded-xl h-12 transition-all duration-300 group"
                        >
                          <Sparkles className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                          Trainer
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDemoLogin('admin')}
                          className="bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/50 text-gray-300 hover:text-white rounded-xl h-12 transition-all duration-300 group"
                        >
                          <Shield className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                          Admin
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Register Form */}
                <TabsContent value="register" className="space-y-5 mt-6">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Nombre Completo</Label>
                      <Input
                        type="text"
                        placeholder="Juan Pérez"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        placeholder="tu@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Contraseña</Label>
                      <Input
                        type="password"
                        placeholder="Mínimo 8 caracteres"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                        className="bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all"
                      />
                    </div>
                    
                    {/* Invitation Code - OPTIONAL */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-300 text-sm font-medium flex items-center gap-2">
                          <Gift className="w-4 h-4 text-violet-400" />
                          Código de Invitación
                        </Label>
                        <span className="text-xs text-gray-500">(Opcional)</span>
                      </div>
                      <Input
                        type="text"
                        placeholder="NLVIP-XXXX"
                        value={invitationCode}
                        onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                        className="bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-gray-500 focus:border-violet-500/50 transition-all font-mono"
                      />
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                        <Lock className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-400">
                          <span className="text-violet-300 font-medium">¿Tienes código?</span> Obtén acceso a rutinas, dietas personalizadas, seguimiento de progreso y más.
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-[1.02]"
                    >
                      {loading ? 'Creando...' : 'Crear Cuenta'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Footer */}
          <p className="text-center text-gray-600 text-xs mt-6">
            © 2025 NL VIP Club. Premium Fitness Experience.
          </p>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
