'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getApiUrl } from '@/lib/utils'

export default function ServiceWorkerInit() {
  useEffect(() => {
    // Force unregister of Service Worker to bypass stale cache
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister()
        console.log('Service Worker unregistered to clear cache')
      }
    })
  }, [])

  return null
}

async function setupPushSubscription(reg) {
  if (!('PushManager' in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  // Ask permission (delayed so it doesn't pop up immediately)
  let permission = Notification.permission
  if (permission === 'default') {
    await new Promise(resolve => setTimeout(resolve, 3000))
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return

  try {
    // Re-use existing subscription or create a new one
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
    }

    // Register subscription on the server (upsert - safe to call multiple times)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    await fetch(getApiUrl() + '/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    }).catch(() => {})
  } catch {
    // Push setup failed silently - app still works
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
