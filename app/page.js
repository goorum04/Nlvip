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
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DietOnboardingForm } from '@/components/DietOnboardingForm'
import { getApiUrl } from '@/lib/utils'
const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), { ssr: false })
const TrainerDashboard = dynamic(() => import('@/components/TrainerDashboard'), { ssr: false })
const MemberDashboard = dynamic(() => import('@/components/MemberDashboard'), { ssr: false })

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
  const [profileLoading, setProfileLoading] = useState(false) // New state to track profile fetch
  const profileLoadingRef = useRef(false) // Prevent concurrent loading
  const loadedUserIdRef = useRef(null) // Prevent loading screen on resume
  const [authMode, setAuthMode] = useState('login')
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regSex, setRegSex] = useState('female')
  const [invitationCode, setInvitationCode] = useState('')
  const [onboardingData, setOnboardingData] = useState(null)

  useEffect(() => {
    console.log('App Mounted - Checking session...')
    checkUser()

    // Handle app resume (tab switch or background to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App Resumed - Re-checking session...')
        // We re-check but without forcing the global loading state if we already have a profile
        checkUser()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for auth changes - crucial for mobile session persistence
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth State Changed:', event, session?.user?.id)
      if (session?.user) {
        setUser(session.user)
        if (!profile) {
          await loadProfile(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        loadedUserIdRef.current = null
      }
    })

    // Panic rescue: If app is still loading after 10 seconds, force unlock it.
    const rescueTimeout = setTimeout(() => {
      if (loading || profileLoading) {
        console.warn('Rescue timer triggered: Forcing app unlock after 10s hang.')
        setLoading(false)
        setProfileLoading(false)
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(rescueTimeout)
    }
  }, []) // Empty dependency array: run once on mount

  const checkUser = async () => {
    try {
      // Avoid hanging forever if Supabase API stalls (e.g. offline with SW crash)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth Timeout')), 5000)
      )
      
      const { data: { user } } = await Promise.race([
        supabase.auth.getUser(),
        timeoutPromise
      ])
      
      if (user) {
        setUser(user)
        await loadProfile(user)
      }
    } catch (error) {
      console.error('Error in checkUser (network or timeout):', error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadProfile = async (authUser) => {
    if (!authUser || !authUser.id) return;
    if (profileLoadingRef.current) return;
    
    const userId = authUser.id;
    const isBackgroundLoad = (loadedUserIdRef.current === userId && profile !== null);
    
    console.log(`[loadProfile] Starting for ID: ${userId} (Background Load: ${isBackgroundLoad})`)
    
    profileLoadingRef.current = true;
    if (!isBackgroundLoad) {
      setProfileLoading(true)
    }
    let timeoutId;
    try {
      console.log('Intentando cargar perfil para:', userId)

      // Timeout de 10 segundos para mayor robustez en conexiones móviles
      const fetchPromise = supabase.from('profiles').select('*').eq('id', userId).single()
      const timeoutPromise = new Promise((_, reject) =>
        timeoutId = setTimeout(() => reject(new Error('Timeout DB')), 10000)
      )

      let result;
      try {
        result = await Promise.race([fetchPromise, timeoutPromise])
      } catch (err) {
        console.warn('Error o timeout al cargar perfil:', err.message)
        result = { data: null, error: err }
      }

      if (result.data) {
        console.log('Perfil cargado desde DB. Role:', result.data.role)
        const metadata = authUser.user_metadata || {}
        if ((!result.data.sex && metadata.sex) || (result.data.has_premium === false && metadata.has_premium === true)) {
          console.log('Sincronizando campos desde metadatos (sex/premium)...')
          const sex = metadata.sex || result.data.sex
          const hasPremium = metadata.has_premium === true || result.data.has_premium === true
          const updates = { 
            sex, 
            has_premium: hasPremium,
            cycle_enabled: sex === 'female', 
            life_stage: (sex === 'female' && !result.data.life_stage) ? 'cycle' : result.data.life_stage 
          }
          fetch(getApiUrl() + '/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, updates })
          }).catch(e => console.warn('Sync profile error:', e))
          result.data = { ...result.data, ...updates }
        }
        loadedUserIdRef.current = userId
        setProfile(result.data)
        return result.data
      }

      // PERMANENT FIX: Si el perfil falta o dio error, asegurar fallback robusto con upsert.
      const metadata = authUser.user_metadata || {}
      const currentEmail = (authUser.email || '').toLowerCase()
      const metaPremium = metadata.has_premium === true
      
      const baseProfile = {
        id: authUser.id,
        email: currentEmail,
        name: metadata.full_name || metadata.name || currentEmail.split('@')[0],
        role: metadata.role || 'member',
        sex: metadata.sex || (currentEmail.includes('maria') ? 'female' : (regSex || null)),
        has_premium: metaPremium
      }

      // Check if it's a demo account to assign correct role
      const demoAccount = Object.values(DEMO_ACCOUNTS).find(acc => acc.email === baseProfile.email)
      if (demoAccount) {
          baseProfile.name = demoAccount.name
          baseProfile.role = demoAccount.role
          console.log(`[loadProfile] Identified Demo Account: ${demoAccount.role}`)
        }

        if (result.error && (result.error.code === 'PGRST116' || result.error.message?.includes('0 rows'))) {
          console.log('[loadProfile] Profile missing, creating via API...')
          const response = await fetch(getApiUrl() + '/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, updates: baseProfile })
          })
          const resData = await response.json()
          const createdProfile = resData.data
          const createError = resData.error
          
          if (createdProfile) {
            console.log('[loadProfile] Fallback profile created successfully via API')
            loadedUserIdRef.current = userId
            setProfile(createdProfile)
            return createdProfile
          } else {
            console.error('[loadProfile] API Fallback creation failed:', createError)
          }
        }
        
      // RAM Fallback si falla DB o error persistente
      console.warn('Usando perfil fallback en RAM')
      loadedUserIdRef.current = userId
      setProfile({
        ...baseProfile,
        has_premium: true, // premium in demo
        cycle_enabled: baseProfile.sex === 'female' || currentEmail.includes('maria'),
        is_fallback: true
      })
    } catch (err) {
      console.error('[loadProfile] Unexpected error:', err)
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      profileLoadingRef.current = false
      if (!isBackgroundLoad) {
        setProfileLoading(false)
      }
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)
      await loadProfile(data.user)
      toast({ title: '¡Bienvenido!' })
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
          .eq('code', invitationCode.toUpperCase().trim())
          .eq('is_active', true)
          .maybeSingle()

        if (codeError) {
          throw new Error('Error al validar el código. Inténtalo de nuevo.')
        }

        if (!codeData) {
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

      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            name: regName,
            sex: regSex || null,
            role: 'member',
            has_premium: hasPremium
          }
        }
      })
      if (error) throw error

      // Check if user was created (not just confirmation email sent)
      if (data.user) {
        // Create profile via API to leverage hardening and centralized logic
        console.log('[handleRegister] Creating profile via API for:', data.user.id)
        const response = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: data.user.id, 
            updates: {
              email: regEmail,
              name: regName,
              sex: regSex || null,
              cycle_enabled: regSex === 'female',
              life_stage: regSex === 'female' ? 'cycle' : null,
              role: 'member',
              has_premium: hasPremium
            }
          })
        })
        const resData = await response.json()
        const profileError = resData.error

        if (profileError) {
          console.error('Profile creation API error:', profileError)
          // Don't throw - the auth user is created, profile might have issues but we continue
        }

        // If premium (had valid code), update code usage and assign trainer
        if (hasPremium && invitationCode.trim()) {
          // Update code usage count
          const { data: currentCode } = await supabase
            .from('invitation_codes')
            .select('uses_count')
            .eq('code', invitationCode.toUpperCase())
            .single()
          
          if (currentCode) {
            console.log(`[handleRegister] Consuming code ${invitationCode} for user ${data.user.id}`)
            await supabase
              .from('invitation_codes')
              .update({ 
                uses_count: (currentCode.uses_count || 0) + 1,
                used_by: data.user.id
              })
              .eq('code', invitationCode.toUpperCase())
          }

          if (trainerId) {
            console.log(`[handleRegister] Assigning trainer ${trainerId}`)
            await supabase.from('trainer_members').insert([{
              trainer_id: trainerId,
              member_id: data.user.id
            }])
          }

          // CRITICAL: Refresh profile state now that DB is updated
          await loadProfile(data.user)

          // Create onboarding request and show the form immediately
          try {
            const onbRes = await fetch(getApiUrl() + '/api/diet-onboarding/request', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.session?.access_token}`
              },
              body: JSON.stringify({ memberId: data.user.id, requestedBy: data.user.id })
            })
            const onbResult = await onbRes.json()
            if (onbResult.requestId) {
              setOnboardingData({ requestId: onbResult.requestId, memberId: data.user.id })
              setRegEmail('')
              setRegPassword('')
              setRegName('')
              setInvitationCode('')
              setAuthMode('onboarding')
              return
            }
          } catch {
            // If request creation fails, fall through to normal login flow
          }
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
    loadedUserIdRef.current = null
    toast({ title: 'Sesión cerrada' })
  }

  // Loading screen
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-6">
          <div className="flex justify-center relative">
            <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full" />
            <img 
              src="/logo-nl-vip.jpg" 
              alt="NL VIP TEAM" 
              className="w-32 h-32 object-contain rounded-2xl shadow-2xl shadow-violet-500/30 animate-pulse relative z-10"
            />
          </div>
          <div className="space-y-2">
            <p className="text-gray-300 text-lg font-medium">
              {profileLoading ? 'Preparando tu experiencia...' : 'Cargando sesión...'}
            </p>
            <p className="text-violet-400 text-sm animate-pulse">
              No más empezar de cero.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Post-registration onboarding screen
  if (authMode === 'onboarding' && onboardingData) {
    return (
      <div className="min-h-screen bg-[#030303] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}} />
        </div>
        <div className="relative z-10 min-h-screen py-8 px-4">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <img
                src="/logo-nl-vip.jpg"
                alt="NL VIP TEAM"
                className="w-16 h-16 object-contain rounded-xl shadow-lg shadow-violet-500/30 mx-auto"
              />
            </div>

            <Card className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="mb-5">
                  <h2 className="text-white text-lg font-bold">¡Ya eres parte del club! 🎉</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Rellena tu perfil nutricional para que tu entrenador pueda prepararte un plan a medida. Solo tarda unos minutos.
                  </p>
                </div>
                <DietOnboardingForm
                  requestId={onboardingData.requestId}
                  memberId={onboardingData.memberId}
                  onComplete={async () => {
                    setOnboardingData(null)
                    setAuthMode('login')
                    toast({ title: '¡Formulario enviado!', description: 'Tu entrenador preparará tu plan. Cargando tu panel...' })
                    await checkUser()
                  }}
                />
              </CardContent>
            </Card>

            <p className="text-center mt-4">
              <button
                onClick={async () => { 
                  setOnboardingData(null)
                  setAuthMode('login')
                  setRegEmail('')
                  setRegPassword('')
                  setRegName('')
                  setInvitationCode('')
                  await checkUser() 
                }}
                className="text-gray-600 text-xs underline hover:text-gray-400 transition-colors"
                id="skip-onboarding-btn"
              >
                Rellenar más tarde
              </button>
            </p>

            <p className="text-center text-gray-600 text-xs mt-3">
              © 2025 NL VIP Club. Premium Fitness Experience.
            </p>
          </div>
        </div>
        <Toaster />
      </div>
    )
  }

  // Dashboard routing
  if (user && profile) {
    if (profile.role === 'admin') {
      return (
        <ErrorBoundary>
          <AdminDashboard user={user} profile={profile} setProfile={setProfile} onLogout={handleLogout} />
        </ErrorBoundary>
      )
    }
    if (profile.role === 'trainer') return (
      <ErrorBoundary>
        <TrainerDashboard user={user} profile={profile} setProfile={setProfile} onLogout={handleLogout} />
      </ErrorBoundary>
    )
    if (profile.role === 'member') return (
      <ErrorBoundary>
        <MemberDashboard user={user} profile={profile} setProfile={setProfile} onLogout={handleLogout} />
      </ErrorBoundary>
    )
  }

  // Post-registration onboarding screen
  if (authMode === 'onboarding' && onboardingData) {
    return (
      <div className="min-h-screen bg-[#030303] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}} />
        </div>
        <div className="relative z-10 min-h-screen py-8 px-4">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <img
                src="/logo-nl-vip.jpg"
                alt="NL VIP TEAM"
                className="w-16 h-16 object-contain rounded-xl shadow-lg shadow-violet-500/30 mx-auto"
              />
            </div>

            <Card className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="mb-5">
                  <h2 className="text-white text-lg font-bold">¡Ya eres parte del club! 🎉</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Rellena tu perfil nutricional para que tu entrenador pueda prepararte un plan a medida. Solo tarda unos minutos.
                  </p>
                </div>
                <DietOnboardingForm
                  requestId={onboardingData.requestId}
                  memberId={onboardingData.memberId}
                  onComplete={async () => {
                    setOnboardingData(null)
                    toast({ title: '¡Formulario enviado!', description: 'Tu entrenador preparará tu plan. Cargando tu panel...' })
                    await checkUser()
                  }}
                />
              </CardContent>
            </Card>

            <p className="text-center mt-4">
              <button
                onClick={async () => { setOnboardingData(null); await checkUser() }}
                className="text-gray-600 text-xs underline hover:text-gray-400 transition-colors"
              >
                Completar más tarde
              </button>
            </p>

            <p className="text-center text-gray-600 text-xs mt-3">
              © 2025 NL VIP Club. Premium Fitness Experience.
            </p>
          </div>
        </div>
        <Toaster />
      </div>
    )
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
            <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
              <img 
                src="/logo-nl-vip.jpg" 
                alt="NL VIP Club" 
                className="w-24 h-24 object-contain rounded-xl shadow-lg shadow-violet-500/30"
              />
              <div className="text-center">
                <span className="text-2xl font-black text-white tracking-tight">NL VIP Club</span>
                <p className="text-xs text-gray-400 mt-1">Premium Fitness</p>
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
    </div>
  )
}
