import apn from 'apn'

const options = {
  token: {
    key: process.env.APNS_P8_KEY || '',
    keyId: process.env.APNS_KEY_ID || '3K7ZQD6V4Y',
    teamId: process.env.APNS_TEAM_ID || '32VQC5P7M6',
  },
  production: process.env.NODE_ENV === 'production',
}

let apnProvider = null

try {
  if (options.token.key) {
    apnProvider = new apn.Provider(options)
    console.log('[APNs] Provider inicializado correctamente')
  } else {
    console.warn('[APNs] No se encontró APNS_P8_KEY. Las notificaciones nativas de Apple no funcionarán.')
  }
} catch (error) {
  console.error('[APNs] Error inicializando provider:', error)
}

/**
 * Envía una notificación push a todos los dispositivos iOS de un usuario.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function sendNativeApplePush(supabase, userId, payload) {
  if (!apnProvider) return

  const { data: devices } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'ios')

  if (!devices?.length) return

  const tokens = devices.map(d => d.token)

  const notification = new apn.Notification()
  notification.topic = process.env.APNS_BUNDLE_ID || 'com.nlvipnutrition.app'
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
  } catch (error) {
    console.error('[APNs] Error crítico de envío:', error)
  }
}
