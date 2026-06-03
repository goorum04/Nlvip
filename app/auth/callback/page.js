'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LoaderCircle as Loader2, CheckCircle, CircleX as XCircle, KeyRound } from 'lucide-react'

// Componente interno que usa useSearchParams
function AuthCallbackContent() {
  const [status, setStatus] = useState('loading') // loading, success, error, password_recovery
  const [message, setMessage] = useState('Verificando tu cuenta...')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    handleAuthCallback()
  }, [])

  const handleAuthCallback = async () => {
    try {
      // Obtener el código de la URL si existe
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        setStatus('error')
        setMessage(errorDescription || 'Error en la verificación')
        return
      }

      if (code) {
        // Intercambiar el código por una sesión
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          throw exchangeError
        }

        if (data.session) {
          // Si es un enlace de recuperación de contraseña, mostrar el formulario
          if (searchParams.get('type') === 'recovery') {
            setStatus('password_recovery')
            return
          }
          setStatus('success')
          setMessage('¡Cuenta verificada correctamente!')

          // Esperar un momento y redirigir
          setTimeout(() => {
            router.push('/')
          }, 2000)
          return
        }
      }

      // Intentar obtener la sesión actual (por si ya está autenticado)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setStatus('success')
        setMessage('¡Ya estás conectado!')
        setTimeout(() => {
          router.push('/')
        }, 1500)
      } else {
        // Si no hay sesión ni código, verificar hash de la URL (para tokens de email)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (accessToken && type === 'signup') {
          // Establecer la sesión manualmente
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })

          if (setSessionError) {
            throw setSessionError
          }

          setStatus('success')
          setMessage('¡Cuenta verificada! Redirigiendo...')
          setTimeout(() => {
            router.push('/')
          }, 2000)
        } else if (accessToken && type === 'recovery') {
          // Recuperación de contraseña — establecer sesión y mostrar formulario
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })

          if (setSessionError) {
            throw setSessionError
          }

          setStatus('password_recovery')
        } else {
          // No hay información de autenticación
          setStatus('error')
          setMessage('No se encontró información de verificación. Por favor, intenta iniciar sesión.')
          setTimeout(() => {
            router.push('/')
          }, 3000)
        }
      }
    } catch (error) {
      console.error('Auth callback error:', error)
      setStatus('error')
      setMessage(error.message || 'Error al verificar la cuenta')
      setTimeout(() => {
        router.push('/')
      }, 3000)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Las contraseñas no coinciden')
      return
    }
    setChangingPassword(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setStatus('success')
      setMessage('¡Contraseña cambiada correctamente!')
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      setMessage(error.message || 'Error al cambiar la contraseña')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6">
      <div className="text-center max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <img
            src="/logo-nl-vip.jpg"
            alt="NL VIP TEAM"
            className="w-24 h-24 object-contain rounded-2xl shadow-2xl shadow-violet-500/30"
          />
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-white text-lg font-medium">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-white text-lg font-medium">{message}</p>
              <p className="text-gray-400 text-sm mt-2">Redirigiendo...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-white text-lg font-medium">Error</p>
              <p className="text-gray-400 text-sm mt-2">{message}</p>
            </>
          )}

          {status === 'password_recovery' && (
            <form onSubmit={handlePasswordChange} className="text-left space-y-4">
              <div className="flex justify-center mb-2">
                <KeyRound className="w-10 h-10 text-violet-400" />
              </div>
              <p className="text-white text-lg font-medium text-center">Nueva contraseña</p>
              <div className="space-y-1">
                <label className="text-gray-300 text-sm">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl h-11 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-300 text-sm">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl h-11 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
              {message && (
                <p className="text-red-400 text-sm">{message}</p>
              )}
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-60"
              >
                {changingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          )}
        </div>

        <p className="text-gray-600 text-xs mt-6">
          © 2025 NL VIP Team
        </p>
      </div>
    </div>
  )
}

// Componente de loading para el Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-6">
          <img 
            src="/logo-nl-vip.jpg" 
            alt="NL VIP TEAM" 
            className="w-24 h-24 object-contain rounded-2xl shadow-2xl shadow-violet-500/30"
          />
        </div>
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Cargando...</p>
        </div>

        <p className="text-gray-600 text-xs mt-6">
          © 2025 NL VIP Team
        </p>
      </div>
    </div>
  )
}

// Componente principal exportado con Suspense boundary
export default function AuthCallback() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
