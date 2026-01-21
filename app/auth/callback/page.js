'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AuthCallback() {
  const [status, setStatus] = useState('loading') // loading, success, error
  const [message, setMessage] = useState('Verificando tu cuenta...')
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
          // Recuperación de contraseña
          setStatus('success')
          setMessage('Puedes cambiar tu contraseña ahora')
          // Aquí podrías redirigir a una página de cambio de contraseña
          setTimeout(() => {
            router.push('/')
          }, 2000)
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
        </div>

        <p className="text-gray-600 text-xs mt-6">
          © 2025 NL VIP Club
        </p>
      </div>
    </div>
  )
}
