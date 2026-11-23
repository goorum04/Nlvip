'use client'

import { useEffect, useRef } from 'react'

// Casilla "No soy un robot" de Cloudflare Turnstile para el registro.
// Solo se muestra si está configurada la clave pública
// NEXT_PUBLIC_TURNSTILE_SITE_KEY; sin ella el registro funciona igual que
// antes (el servidor solo exige el captcha si tiene TURNSTILE_SECRET_KEY).
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (window.__nlTurnstilePromise) return window.__nlTurnstilePromise
  window.__nlTurnstilePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve(window.turnstile)
    s.onerror = () => { window.__nlTurnstilePromise = null; reject(new Error('turnstile')) }
    document.head.appendChild(s)
  })
  return window.__nlTurnstilePromise
}

export default function TurnstileWidget({ onToken, resetKey = 0 }) {
  const ref = useRef(null)
  const widgetId = useRef(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadScript().then((ts) => {
      if (cancelled || !ts || !ref.current) return
      if (widgetId.current != null) { try { ts.remove(widgetId.current) } catch {} }
      widgetId.current = ts.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        language: 'es',
        callback: (token) => onToken?.(token),
        'expired-callback': () => onToken?.(''),
        'error-callback': () => onToken?.(''),
      })
    }).catch(() => onToken?.(''))
    return () => {
      cancelled = true
      if (widgetId.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch {}
        widgetId.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={ref} className="flex justify-center min-h-[65px]" />
}
