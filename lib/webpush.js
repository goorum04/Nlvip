/**
 * Server-side Web Push helper.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in env.
 */
import webpush from 'web-push'

const vapidReady =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY

if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@nlvipnutrition.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

/**
 * Send a push notification to all subscribed devices of a user.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string, icon?: string }} payload
 */
export async function sendPushToUser(supabase, userId, payload) {
  if (!vapidReady) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  )

  // Remove expired subscriptions (push service returns 410 Gone)
  const expiredEndpoints = subs
    .filter((_, i) => results[i].status === 'rejected' && results[i].reason?.statusCode === 410)
    .map(s => s.endpoint)

  if (expiredEndpoints.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints)
  }
}
