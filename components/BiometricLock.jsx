'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanFace, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  checkBiometry,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  authenticateBiometric,
} from '@/lib/biometric'

// Si la app pasa más de este tiempo en segundo plano, se vuelve a bloquear.
// El propio diálogo de Face ID manda la app a "inactiva" un instante, así que
// sin este margen se bloquearía en bucle.
const RELOCK_AFTER_MS = 60 * 1000

// Pantalla de bloqueo que se pone encima del panel cuando el usuario ha
// activado el desbloqueo con Face ID. El panel sigue montado debajo para no
// perder su estado al volver de segundo plano.
export default function BiometricLock({ children, onLogout }) {
  const [status, setStatus] = useState('checking') // checking | locked | unlocked
  const [label, setLabel] = useState('Face ID')
  const backgroundedAt = useRef(null)
  const prompting = useRef(false)

  const unlock = async () => {
    if (prompting.current) return
    prompting.current = true
    const ok = await authenticateBiometric()
    prompting.current = false
    if (ok) setStatus('unlocked')
  }

  useEffect(() => {
    let cancelled = false
    let appListener = null

    async function init() {
      const enabled = await isBiometricLockEnabled()
      if (cancelled) return
      if (!enabled) {
        setStatus('unlocked')
        return
      }
      const { label } = await checkBiometry()
      if (cancelled) return
      setLabel(label)
      setStatus('locked')
      unlock()
    }
    init()

    async function listenAppState() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        appListener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) {
            if (!prompting.current) backgroundedAt.current = Date.now()
            return
          }
          const since = backgroundedAt.current
          backgroundedAt.current = null
          if (!since || Date.now() - since < RELOCK_AFTER_MS) return
          if (!(await isBiometricLockEnabled())) return
          setStatus('locked')
          unlock()
        })
        if (cancelled) appListener.remove()
      } catch (err) {
        console.error('[Biometric] appStateChange listener error:', err)
      }
    }
    listenAppState()

    return () => {
      cancelled = true
      appListener?.remove()
    }
  }, [])

  return (
    <>
      {children}
      {status !== 'unlocked' && (
        <div className="fixed inset-0 z-[9999] bg-[#030303] flex items-center justify-center p-6 text-center">
          {status === 'locked' && (
            <div className="flex flex-col items-center gap-6 max-w-sm w-full">
              <img
                src="/logo-nl-vip.jpg"
                alt="NL VIP TEAM"
                className="w-20 h-20 rounded-2xl shadow-2xl border border-white/5"
              />
              <div className="space-y-2">
                <p className="text-white text-lg font-semibold">NL VIP TEAM está bloqueada</p>
                <p className="text-gray-400 text-sm">Usa {label} para entrar.</p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <Button
                  onClick={unlock}
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold rounded-xl"
                >
                  <ScanFace className="w-5 h-5 mr-2" /> Desbloquear con {label}
                </Button>
                <Button
                  onClick={onLogout}
                  variant="ghost"
                  className="w-full h-12 text-gray-400 hover:text-white rounded-xl"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Interruptor para el perfil. Solo aparece en dispositivos con biometría.
// Para activarlo se pide Face ID una vez, así confirmamos que funciona.
export function BiometricLockToggle() {
  const { toast } = useToast()
  const [available, setAvailable] = useState(false)
  const [label, setLabel] = useState('Face ID')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const info = await checkBiometry()
      const isOn = await isBiometricLockEnabled()
      if (cancelled) return
      setAvailable(info.available)
      setLabel(info.label)
      setEnabled(isOn)
    })()
    return () => { cancelled = true }
  }, [])

  if (!available) return null

  const handleChange = async (next) => {
    setBusy(true)
    try {
      if (next) {
        const ok = await authenticateBiometric(`Activa el desbloqueo con ${label}`)
        if (!ok) return
      }
      await setBiometricLockEnabled(next)
      setEnabled(next)
      toast({
        title: next ? `${label} activado` : `${label} desactivado`,
        description: next
          ? `Te pediremos ${label} al abrir la app.`
          : 'La app ya no pedirá desbloqueo al abrirse.',
      })
    } catch (err) {
      toast({ title: 'No se pudo cambiar el ajuste', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1 pt-4 border-t border-white/5">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300 text-sm">Desbloquear con {label}</Label>
        <Switch checked={enabled} disabled={busy} onCheckedChange={handleChange} />
      </div>
      <p className="text-xs text-gray-500">
        Al abrir la app, o al volver tras más de un minuto fuera, te pediremos {label}.
      </p>
    </div>
  )
}
