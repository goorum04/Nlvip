'use client'

import { useEffect } from 'react'

export default function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Register the service worker
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // SW registration failed silently - app still works
    })

    // Request notification permission (only after a user gesture exists in the session)
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay slightly so it doesn't pop up immediately on load
      const timer = setTimeout(() => {
        Notification.requestPermission()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  return null
}
