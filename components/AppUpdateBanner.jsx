'use client'

import { useEffect, useState } from 'react'
import { Sparkles, ShieldAlert, X } from 'lucide-react'
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

// Comprueba si hay actualización disponible y, si la hay, muestra un aviso.
//
// Dos niveles, según lo que configure el admin en `app_version_config`:
//
// 1. Aviso normal (descartable): la versión instalada no es la última que
//    hay en la App Store. La versión "última" ya NO depende de que alguien
//    la escriba a mano — /api/app-version consulta la propia App Store
//    (iTunes Lookup) en tiempo real. Se puede cerrar hasta la SIGUIENTE
//    versión: si cierra el aviso de la 1.34 y luego sale la 1.35, vuelve a
//    verlo.
//
// 2. Actualización OBLIGATORIA (bloquea la app): solo si el admin ha
//    rellenado `min_supported_version` en la base de datos y la versión
//    instalada queda por debajo. Pantalla completa, sin botón de cerrar,
//    solo "Actualizar ahora". Pensada para cuando una versión antigua ya no
//    puede funcionar bien (p. ej. rompe con la API actual) — no para cada
//    lanzamiento, porque bloquearía a todo el club por una actualización
//    menor. Si `min_supported_version` se deja vacío, nunca bloquea nada.
//
// Nada de esto hace nada en la app instalada ahora mismo (no tiene este
// componente) — empieza a funcionar solo, sin que el admin avise a nadie, a
// partir de la build que YA incluya este código.
export default function AppUpdateBanner() {
  const [info, setInfo] = useState(null) // { message, storeUrl, latestVersion, mandatory }
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

        // Sin no-store, el WebView nativo puede quedarse con una respuesta
        // vieja cacheada y seguir avisando de una versión que ya se instaló.
        const res = await fetch(`${getApiUrl()}/api/app-version?platform=${platform}`, { cache: 'no-store' })
        const data = await res.json()
        if (cancelled || !data?.configured) return

        // El bloqueo obligatorio manda sobre el aviso normal, y solo se activa
        // si el admin ha puesto explícitamente una versión mínima.
        const mandatory = !!data.min_supported_version && isNewer(data.min_supported_version, currentVersion)
        const optional = !mandatory && isNewer(data.latest_version, currentVersion)

        if (mandatory) {
          setInfo({
            message: data.update_message,
            storeUrl: data.store_url,
            latestVersion: data.latest_version,
            mandatory: true,
          })
          setDismissed(false)
          return
        }

        if (optional) {
          const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === data.latest_version
          setInfo({
            message: data.update_message,
            storeUrl: data.store_url,
            latestVersion: data.latest_version,
            mandatory: false,
          })
          setDismissed(alreadyDismissed)
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

  if (info.mandatory) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/92 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-3xl shadow-2xl p-7 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 flex items-center justify-center mb-4">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-white font-bold text-lg leading-snug">Actualización obligatoria</h2>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">{info.message}</p>
          <a
            href={info.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm py-3 rounded-2xl"
          >
            Actualizar ahora
          </a>
        </div>
      </div>
    )
  }

  return (
    // Anclado ABAJO (no arriba): pegado al techo tapaba la cabecera de la
    // app y sus botones quedaban debajo, sin poder tocarlos ni leer el
    // aviso completo. Envuelto en un div con padding + safe-area para que
    // flote separado del borde y del home indicator del iPhone.
    <div
      className="fixed left-0 right-0 bottom-0 z-[100] px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <div className="max-w-lg mx-auto bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-3xl shadow-2xl shadow-black/40 p-5 flex items-start gap-4 pointer-events-auto">
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-snug">{info.message}</p>
          <div className="flex items-center gap-2 mt-3">
            <a
              href={info.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-violet-700 hover:bg-white/90 transition-colors font-bold text-sm px-4 py-2 rounded-xl"
            >
              Actualizar ahora
            </a>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white text-sm font-semibold px-3 py-2"
            >
              Más tarde
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 p-1 text-white/70 hover:text-white" aria-label="Cerrar aviso">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
