'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getApiUrl } from '@/lib/utils'

const JOB_STALE_MS = 15 * 60 * 1000
const POLL_MAX_MS = 5 * 60 * 1000
const POLL_INTERVAL_MS = 1500

// Mismo patrón que ya usa el asistente de IA (components/AdminAssistant.jsx):
// el servidor arranca el trabajo real (background: true), responde YA con un
// jobId, y sigue generando aunque el cliente se desconecte. Este hook lo
// sondea hasta que termine y, si la app se minimiza/cierra a medias, retoma
// el sondeo solo al volver gracias al jobId guardado en localStorage — sin
// esto, minimizar mientras se genera una dieta/rutina corta la conexión y el
// resultado se pierde aunque el servidor lo hubiera terminado.
export function useBackgroundJob({ storageKey, statusUrlBase, onResume, onResumeError }) {
  const activeJobRef = useRef(null)

  const savePendingJob = useCallback((jobId, extra = {}) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ jobId, ts: Date.now(), ...extra })) } catch {}
  }, [storageKey])

  const clearPendingJob = useCallback(() => {
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey])

  const fetchJobStatus = useCallback(async (jobId) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${getApiUrl()}${statusUrlBase}?jobId=${jobId}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    })
    return res.json()
  }, [statusUrlBase])

  // Sondea hasta que termine. Un fallo de red (p.ej. la app estaba
  // minimizada) reintenta en vez de abortar — el job sigue vivo en el
  // servidor. Nunca sondea más de 5 minutos seguidos.
  const pollJob = useCallback((jobId) => new Promise((resolve, reject) => {
    let cancelled = false
    let timeoutId = null
    const startedAt = Date.now()

    const cleanup = () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (activeJobRef.current?.jobId === jobId) activeJobRef.current = null
    }

    const check = async () => {
      if (cancelled) return
      if (Date.now() - startedAt > POLL_MAX_MS) {
        cleanup()
        reject(new Error('La generación está tardando demasiado. Inténtalo de nuevo en un momento.'))
        return
      }
      try {
        const data = await fetchJobStatus(jobId)
        if (data.status === 'done') { cleanup(); resolve(data.result); return }
        if (data.status === 'error') { cleanup(); reject(new Error(data.error || 'Error generando')); return }
      } catch {
        // Fallo de red consultando el estado: reintentamos, no abortamos.
      }
      if (!cancelled) timeoutId = setTimeout(check, POLL_INTERVAL_MS)
    }

    activeJobRef.current = { jobId, checkNow: check }
    check()
  }), [fetchJobStatus])

  // Al volver a primer plano, sondea ya mismo en vez de esperar al siguiente intervalo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && activeJobRef.current) {
        activeJobRef.current.checkNow()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // Si la app se cerró/recargó con un job aún en curso, lo retoma solo.
  useEffect(() => {
    let raw = null
    try { raw = localStorage.getItem(storageKey) } catch {}
    if (!raw) return
    let saved = null
    try { saved = JSON.parse(raw) } catch {}
    if (!saved?.jobId || Date.now() - (saved.ts || 0) > JOB_STALE_MS) {
      clearPendingJob()
      return
    }
    pollJob(saved.jobId)
      .then((result) => onResume?.(result, saved))
      .catch((error) => onResumeError?.(error, saved))
      .finally(() => clearPendingJob())
    // Solo al montar: retomar un job guardado no debe repetirse en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { savePendingJob, clearPendingJob, pollJob }
}
