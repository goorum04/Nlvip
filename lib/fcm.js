import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// FIREBASE_SERVICE_ACCOUNT_JSON contiene el JSON completo de la cuenta de
// servicio de Firebase (Project settings → Service accounts → Generate new
// private key), pegado tal cual como una sola línea. Igual que con
// APNS_P8_KEY, Vercel no admite saltos de línea reales dentro de un valor de
// env var normal, así que la private_key interna del JSON lleva "\n"
// literales — JSON.parse ya los interpreta bien sin tocar nada.
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''

let messaging = null
let fcmInitError = null

try {
  if (rawServiceAccount) {
    const serviceAccount = JSON.parse(rawServiceAccount)
    const app = getApps().find(a => a.name === 'nlvip-fcm')
      || initializeApp({ credential: cert(serviceAccount) }, 'nlvip-fcm')
    messaging = getMessaging(app)
    console.log('[FCM] Provider inicializado correctamente')
  } else {
    fcmInitError = 'FIREBASE_SERVICE_ACCOUNT_JSON no definida en env'
    console.warn('[FCM] No se encontró FIREBASE_SERVICE_ACCOUNT_JSON. Las notificaciones nativas de Android no funcionarán.')
  }
} catch (error) {
  fcmInitError = error.message
  console.error('[FCM] Error inicializando provider:', error)
}

/**
 * Envía una notificación push a todos los dispositivos Android de un usuario.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 * @returns {Promise<{ sent: number, failed: number, reasons?: string[], tokens?: number, providerReady: boolean }>}
 */
export async function sendNativeAndroidPush(supabase, userId, payload) {
  if (!messaging) {
    return { sent: 0, failed: 0, tokens: 0, providerReady: false, reasons: [fcmInitError || 'provider no inicializado'] }
  }

  const { data: devices } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'android')

  if (!devices?.length) {
    return { sent: 0, failed: 0, tokens: 0, providerReady: true, reasons: ['sin device_tokens android'] }
  }

  const tokens = devices.map(d => d.token)

  const message = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url || '/',
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
  }

  try {
    const result = await messaging.sendEachForMulticast(message)
    console.log('[FCM] Resultado envío:', { success: result.successCount, failure: result.failureCount })

    // Limpiar tokens muertos (desinstalado / token caducado) igual que hacemos con APNs
    const tokensToDelete = []
    const reasons = []
    result.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || ''
        reasons.push(code || r.error?.message || 'error desconocido')
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          tokensToDelete.push(tokens[i])
        }
      }
    })

    if (tokensToDelete.length > 0) {
      await supabase.from('device_tokens').delete().in('token', tokensToDelete)
    }

    return {
      sent: result.successCount,
      failed: result.failureCount,
      tokens: tokens.length,
      providerReady: true,
      reasons,
    }
  } catch (error) {
    console.error('[FCM] Error crítico de envío:', error)
    return { sent: 0, failed: tokens.length, tokens: tokens.length, providerReady: true, reasons: [error.message] }
  }
}
