'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

// Enable verbose push diagnostics via a toast whenever we hit a milestone.
// Users on TestFlight see the toasts and can screenshot them for us.
// Set to false before GA if needed.
const PUSH_DEBUG = true

// ⚠️ IMPORTANT: Capacitor native plugin imports MUST be dynamic (inside useEffect).
// Top-level static imports of @capacitor/push-notifications cause an immediate
// crash on iOS because the native bridge isn't ready when the JS module is first evaluated.
export default function CapacitorPushInit() {
  useEffect(() => {
    initNativePush()
  }, [])

  return null
}

async function initNativePush() {
  try {
    // Dynamic import ensures this only runs in the browser/WebView,
    // never during SSG, and only after the DOM is mounted.
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const { PushNotifications } = await import('@capacitor/push-notifications')

    // We do NOT request permissions automatically on app launch anymore.
    // That causes the TestFlight "Start Testing" screen to glitch into a blank white screen.
    // Instead, we check if they ALREADY granted it. If so, initialize silently.
    // We will request permissions ONLY when the user logs in.
    let permStatus = await PushNotifications.checkPermissions()

    // Si ya tienen permiso, inicializamos. Si no, esperamos a que el usuario inicie sesión.
    if (permStatus.receive === 'granted') {
      await registerAndListen(PushNotifications, Capacitor)
    }

    // Subscribe to auth state to request permission after login
    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        // Now that the user is logged in and the TestFlight screen is definitely gone:
        let currentStatus = await PushNotifications.checkPermissions()
        if (currentStatus.receive === 'prompt') {
          // Si es la carga inicial (donde TestFlight muestra su cartel "Start Testing"),
          // le damos 15 segundos enteros para que lo cierre tranquilo.
          // Si es un inicio de sesión manual, le damos solo 3.
          const delayTimeout = event === 'INITIAL_SESSION' ? 15000 : 3000
          await new Promise(resolve => setTimeout(resolve, delayTimeout))
          currentStatus = await PushNotifications.requestPermissions()
        }
        if (currentStatus.receive === 'granted') {
          await registerAndListen(PushNotifications, Capacitor)
        } else if (PUSH_DEBUG) {
          toast({
            title: '⚠️ Permiso push no concedido',
            description: `Estado: ${currentStatus.receive}. Ve a Ajustes → NL VIP Club → Notificaciones.`,
          })
        }
      }
    })
  } catch (e) {
    console.warn('Push init fallback:', e)
  }
}

async function registerAndListen(PushNotifications, Capacitor) {
  try {
    // Evitar duplicados si registerAndListen se llama más de una vez
    await PushNotifications.removeAllListeners()

    // CRITICAL: listeners must be registered BEFORE calling register(),
    // otherwise the 'registration' event may fire before we're listening
    // and the token is silently lost.
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Token recibido:', token.value?.slice(0, 12) + '…')
      if (PUSH_DEBUG) toast({ title: '📱 Token push recibido', description: token.value?.slice(0, 16) + '…' })
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        console.warn('[Push] No hay sesión al registrar token')
        if (PUSH_DEBUG) toast({ title: '⚠️ Push sin sesión', description: 'Token recibido pero no hay usuario logueado.' })
        return
      }

      const { error } = await supabase.from('device_tokens').upsert(
        {
          user_id: session.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      )
      if (error) {
        console.warn('[Push] Error guardando token:', error.message)
        if (PUSH_DEBUG) toast({ title: '❌ Error guardando token', description: error.message, variant: 'destructive' })
      } else {
        console.log('[Push] Token guardado en device_tokens')
        if (PUSH_DEBUG) toast({ title: '✅ Push listo', description: 'Token guardado en device_tokens.' })
      }
    })

    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[Push] registrationError:', err?.error || err)
      if (PUSH_DEBUG) toast({
        title: '❌ Error de registro push',
        description: String(err?.error || err?.message || err),
        variant: 'destructive',
      })
    })

    // Notificación recibida con la app abierta
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Recibida en primer plano:', notification.title)
    })

    // Usuario pulsa la notificación
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action.notification.data?.url
      if (url && typeof window !== 'undefined') {
        window.location.href = url
      }
    })

    // Now it's safe to trigger registration — listeners are in place
    await PushNotifications.register()
  } catch (e) {
    console.warn('Push register error:', e)
  }
}
