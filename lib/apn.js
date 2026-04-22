import apn from 'apn'

const options = {
  token: {
    key: process.env.APNS_P8_KEY || '',
    keyId: process.env.APNS_KEY_ID || '3K7ZQD6V4Y',
    teamId: process.env.APNS_TEAM_ID || '32VQC5P7M6',
  },
  // Default to production (TestFlight/App Store). Set APNS_PRODUCTION=false in
  // Vercel env to temporarily target the sandbox gateway — useful to confirm
  // whether a BadEnvironmentKeyInToken error is caused by a sandbox-only key.
  production: process.env.APNS_PRODUCTION !== 'false',
}

let apnProvider = null
let apnInitError = null

try {
  if (options.token.key) {
    apnProvider = new apn.Provider(options)
    console.log('[APNs] Provider inicializado correctamente')
  } else {
    apnInitError = 'APNS_P8_KEY no definida en env'
    console.warn('[APNs] No se encontró APNS_P8_KEY. Las notificaciones nativas de Apple no funcionarán.')
  }
} catch (error) {
  apnInitError = error.message
  console.error('[APNs] Error inicializando provider:', error)
}

/**
 * Envía una notificación push a todos los dispositivos iOS de un usuario.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 * @returns {Promise<{ sent: number, failed: number, reasons?: string[], tokens?: number, providerReady: boolean }>}
 */
export async function sendNativeApplePush(supabase, userId, payload) {
  if (!apnProvider) {
    return { sent: 0, failed: 0, tokens: 0, providerReady: false, reasons: [apnInitError || 'provider no inicializado'] }
  }

  const { data: devices } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'ios')

  if (!devices?.length) {
    return { sent: 0, failed: 0, tokens: 0, providerReady: true, reasons: ['sin device_tokens ios'] }
  }

  const tokens = devices.map(d => d.token)

  const notification = new apn.Notification()
  notification.topic = process.env.APNS_BUNDLE_ID || 'com.leonardos.app'
  notification.expiry = Math.floor(Date.now() / 1000) + 3600 // 1 hora
  notification.badge = 1
  notification.sound = 'default'
  notification.alert = {
    title: payload.title,
    body: payload.body,
  }
  notification.payload = { url: payload.url || '/' }
  notification.pushType = 'alert'

  try {
    const result = await apnProvider.send(notification, tokens)
    console.log('[APNs] Resultado envío:', result)

    // Si hay tokens fallidos de forma permanente (Unregistered), podríamos limpiarlos aquí
    if (result.failed.length > 0) {
      const tokensToDelete = result.failed
        .filter(f => f.status === '410' || f.response?.reason === 'Unregistered')
        .map(f => f.device)

      if (tokensToDelete.length > 0) {
        await supabase
          .from('device_tokens')
          .delete()
          .in('token', tokensToDelete)
      }
    }

    return {
      sent: result.sent.length,
      failed: result.failed.length,
      tokens: tokens.length,
      providerReady: true,
      reasons: result.failed.map(f => f.response?.reason || f.error?.message || `status ${f.status}`),
    }
  } catch (error) {
    console.error('[APNs] Error crítico de envío:', error)
    return { sent: 0, failed: tokens.length, tokens: tokens.length, providerReady: true, reasons: [error.message] }
  }
}
