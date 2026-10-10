'use client'

// Face ID / Touch ID / huella para desbloquear una sesión ya iniciada.
// Solo funciona en la app nativa (Capacitor). En la web todo devuelve
// "no disponible" y el bloqueo nunca se activa.
//
// ⚠️ Los plugins nativos se importan dinámicamente: una importación estática
// rompe el arranque en iOS (ver CapacitorPushInit.jsx).

const ENABLED_KEY = 'biometric_lock_enabled'

async function isNative() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

async function getPlugin() {
  const mod = await import('@aparajita/capacitor-biometric-auth')
  return mod
}

// Nombre legible del método disponible en el dispositivo.
function biometryLabel(type, BiometryType) {
  switch (type) {
    case BiometryType.faceId: return 'Face ID'
    case BiometryType.touchId: return 'Touch ID'
    case BiometryType.fingerprintAuthentication: return 'huella'
    case BiometryType.faceAuthentication: return 'reconocimiento facial'
    case BiometryType.irisAuthentication: return 'iris'
    default: return 'biometría'
  }
}

// { available, label }
export async function checkBiometry() {
  if (!(await isNative())) return { available: false, label: 'Face ID' }
  try {
    const { BiometricAuth, BiometryType } = await getPlugin()
    const result = await BiometricAuth.checkBiometry()
    return {
      available: result.isAvailable,
      label: biometryLabel(result.biometryType, BiometryType),
    }
  } catch (err) {
    console.error('[Biometric] checkBiometry error:', err)
    return { available: false, label: 'Face ID' }
  }
}

export async function isBiometricLockEnabled() {
  if (!(await isNative())) return false
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: ENABLED_KEY })
    return value === 'true'
  } catch {
    return false
  }
}

export async function setBiometricLockEnabled(enabled) {
  if (!(await isNative())) return
  const { Preferences } = await import('@capacitor/preferences')
  if (enabled) {
    await Preferences.set({ key: ENABLED_KEY, value: 'true' })
  } else {
    await Preferences.remove({ key: ENABLED_KEY })
  }
}

// Lanza el diálogo del sistema. Devuelve true si el usuario se ha verificado.
// Si falla la biometría, iOS/Android ofrecen el código del dispositivo.
export async function authenticateBiometric(reason = 'Desbloquea NL VIP TEAM') {
  try {
    const { BiometricAuth } = await getPlugin()
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Usar código',
      androidTitle: 'NL VIP TEAM',
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    })
    return true
  } catch (err) {
    console.warn('[Biometric] authenticate failed:', err?.code || err)
    return false
  }
}
