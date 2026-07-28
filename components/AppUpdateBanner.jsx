'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { getApiUrl } from '@/lib/utils'

// Compara versiones tipo "1.34" > "1.33.2" sin depender de una librería semver.
function isNewer(latest, current) {
  const a = String(latest).split('.').map(n => parseInt(n, 10) || 0)
  const b = String(current).split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

const DISMISS_KEY = 'nlvip_update_dismissed_version'

// Comprueba si hay una versión más nueva publicada en la App Store y, si la
// hay, muestra un banner que se puede cerrar (no bloquea la app). Se descarta
// solo hasta la SIGUIENTE versión: si cierra el aviso de la 1.34 y luego sale
// la 1.35, vuelve a verlo.
//
// Nada de esto hace nada en la app instalada ahora mismo (no tiene este
// componente) — empieza a funcionar solo, sin que el admin avise a nadie, a
// partir de la build que YA incluya este código.
export default function AppUpdateBanner() {
  const [info, setInfo] = useState(null) // { message, storeUrl, latestVersion }
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return // solo aplica a la app nativa

        const platform = Capacitor.getPlatform() // 'ios' | 'android'
        const { App } = await import('@capacitor/app')
        const { version: currentVersion } = await App.getInfo()

        const res = await fetch(`${getApiUrl()}/api/app-version?platform=${platform}`)
        const data = await res.json()
        if (cancelled || !data?.configured) return

        if (isNewer(data.latest_version, currentVersion)) {
          const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === data.latest_version
          if (!cancelled) {
            setInfo({
              message: data.update_message,
              storeUrl: data.store_url,
              latestVersion: data.latest_version,
            })
            setDismissed(alreadyDismissed)
          }
        }
      } catch (e) {
        // Silencioso a propósito: si algo falla aquí, la app sigue funcionando
        // con normalidad, simplemente no se muestra el aviso.
        console.warn('AppUpdateBanner check error:', e?.message)
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (!info || dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, info.latestVersion)
    setDismissed(true)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
      <Sparkles className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm flex-1 leading-snug">{info.message}</p>
      <a
        href={info.storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
      >
        Actualizar
      </a>
      <button onClick={handleDismiss} className="flex-shrink-0 p-1" aria-label="Cerrar aviso">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
