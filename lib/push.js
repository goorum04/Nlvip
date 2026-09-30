import { sendNativeApplePush } from '@/lib/apn'
import { sendNativeAndroidPush } from '@/lib/fcm'

/**
 * Envía una notificación push nativa a TODOS los dispositivos de un usuario,
 * sea iPhone (APNs) o Android (FCM). Sustituye a llamar sendNativeApplePush
 * directamente — mismo payload, misma forma de respuesta, pero ahora cubre
 * los dos sistemas operativos.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 * @returns {Promise<{ sent: number, failed: number, tokens: number, ios: object, android: object }>}
 */
export async function sendNativePush(supabase, userId, payload) {
  const [ios, android] = await Promise.all([
    sendNativeApplePush(supabase, userId, payload),
    sendNativeAndroidPush(supabase, userId, payload),
  ])

  return {
    sent: (ios.sent || 0) + (android.sent || 0),
    failed: (ios.failed || 0) + (android.failed || 0),
    tokens: (ios.tokens || 0) + (android.tokens || 0),
    ios,
    android,
  }
}
