'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export default function CapacitorPushInit() {
  useEffect(() => {
    initNativePush()
  }, [])

  return null
}

async function initNativePush() {
  try {
    if (!Capacitor.isNativePlatform()) return

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
        }
      }
    })
  } catch (e) {
    console.warn('Push init fallback:', e)
  }
}

async function registerAndListen(PushNotifications, Capacitor) {
  try {
    // Evitar registrar múltiples veces
    await PushNotifications.removeAllListeners()
    
    await PushNotifications.register()

    // Save token to Supabase when registration succeeds
    await PushNotifications.addListener('registration', async (token) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      await supabase.from('device_tokens').upsert(
        {
          user_id: session.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      )
    })

    // Error silencioso en registro
    await PushNotifications.addListener('registrationError', () => {})

    // Notificación recibida con la app abierta — mostrar como toast nativo
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
  } catch (e) {
    console.warn('Push register error:', e)
  }
}
