'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CapacitorPushInit() {
  useEffect(() => {
    initNativePush()
  }, [])

  return null
}

async function initNativePush() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Check/request permission
    let permStatus = await PushNotifications.checkPermissions()
    if (permStatus.receive === 'prompt') {
      // Small delay so it doesn't pop up nada más abrir la app
      await new Promise(resolve => setTimeout(resolve, 3000))
      permStatus = await PushNotifications.requestPermissions()
    }
    if (permStatus.receive !== 'granted') return

    // Register with APNs
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
  } catch {
    // Push init falla silenciosamente — la app sigue funcionando
  }
}
