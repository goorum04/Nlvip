'use client'
// Sync commit: 2026-03-18 14:15

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
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

const DEMO_ACCOUNTS = {
  ADMIN: { email: 'admin@demo.com', role: 'admin', name: 'Administrador Demo' },
  TRAINER: { email: 'entrenador@demo.com', role: 'trainer', name: 'Entrenador Demo' },
  MEMBER: { email: 'socio@demo.com', role: 'member', name: 'Socio Demo' },
  MARIA: { email: 'maria@demo.com', role: 'member', name: 'Maria Demo' }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regSex, setRegSex] = useState('female')
  const [invitationCode, setInvitationCode] = useState('')
  const { toast } = useToast()
  
  // States for Splash logic
  const [splashVisible, setSplashVisible] = useState(true)
  const [bootReady, setBootReady] = useState(false)
  const [errorDetails, setErrorDetails] = useState(null)

  useEffect(() => {
    async function boot() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        }
      } catch (err) {
        console.error("Boot error:", err)
        setErrorDetails(err.message)
      } finally {
        setLoading(false)
        setBootReady(true)
        // Hide splash after a short aesthetic delay
        setTimeout(async () => {
          setSplashVisible(false)
          // Also try to hide native splash if capacitor is present
          try {
            const { SplashScreen } = await import('@capacitor/splash-screen')
            await SplashScreen.hide()
          } catch(e) {}
        }, 800)
      }
    }
    boot()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    if (profileLoading) return
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      
      if (data) {
        setProfile(data)
      } else {
        // Fallback or demo detection can go here
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error) {
      toast({ title: 'Error de entrada', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email: regEmail, 
        password: regPassword,
        options: {
          data: {
            name: regName,
            sex: regSex,
            invitation_code: invitationCode.trim() || null
          }
        }
      })
      if (error) throw error
      if (data.user) {
        toast({ title: '¡Cuenta creada!', description: 'Ya puedes acceder a tu panel.' })
      }
    } catch (error) {
      toast({ title: 'Error de registro', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // --- RENDERING LOGIC ---

  if (splashVisible) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#030303] flex flex-col items-center justify-center p-6 transition-opacity duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <img 
            src="/logo-nl-vip.jpg" 
            alt="NL VIP Logo" 
            className="relative w-32 h-32 rounded-3xl object-cover shadow-2xl shadow-violet-500/40 animate-in fade-in zoom-in duration-700"
          />
        </div>
        <div className="mt-8 flex flex-col items-center gap-2">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 tracking-tighter">NL VIP CLUB</h1>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" />
          </div>
        </div>
        {errorDetails && (
          <div className="mt-12 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-xs text-center">
            <p className="text-red-400 text-xs font-mono break-all">{errorDetails}</p>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    if ((loading || profileLoading) && !profile) {
      return (
        <div className="min-h-screen bg-[#030303] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-gray-500 font-medium animate-pulse">Sincronizando...</p>
          </div>
        </div>
      )
    }

    if (user && profile) {
      if (profile.role === 'admin') {
        return <AdminDashboard user={user} profile={profile} onLogout={handleLogout} />
      }
      if (profile.role === 'trainer') {
        return <TrainerDashboard user={user} profile={profile} onLogout={handleLogout} />
      }
      return <MemberDashboard user={user} profile={profile} setProfile={setProfile} onLogout={handleLogout} />
    }

    // Login / Register Screen
    return (
      <>
        <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center p-4 overflow-hidden">
          {/* Animated Background Orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
          </div>

          <div className="w-full max-w-md relative animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-6 group">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-[2.5rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <img 
                src="/logo-nl-vip.jpg" 
                alt="NL VIP TEAM" 
                className="relative w-28 h-28 rounded-[2rem] object-cover shadow-2xl border border-white/10"
              />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter text-center leading-none">
              NL VIP <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">CLUB</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium uppercase tracking-[0.2em] text-[10px]">Premium Fitness Experience</p>
          </div>

          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <CardContent className="p-8">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid grid-cols-2 w-full bg-white/5 p-1 rounded-2xl h-14">
                  <TabsTrigger 
                    value="login" 
                    className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white font-bold transition-all duration-300"
                  >
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register"
                    className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white font-bold transition-all duration-300"
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

{/* Botones de demo eliminados - Credenciales disponibles para el administrador */}
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

                    {/* Gender Selection */}
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Sexo</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          onClick={() => setRegSex('male')}
                          className={`rounded-xl h-12 border border-white/10 transition-all ${regSex === 'male' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white border-transparent shadow-lg shadow-violet-600/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                          Hombre
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setRegSex('female')}
                          className={`rounded-xl h-12 border border-white/10 transition-all ${regSex === 'female' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white border-transparent shadow-lg shadow-violet-600/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                          Mujer
                        </Button>
                      </div>
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
      </>
    )
  }

  return renderContent()
}
