/**
 * Simple in-memory rate limiting
 */

const rates = new Map()

// Clean up memory every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rates.entries()) {
    if (now - value.lastRequest > 300000) { // 5 minutes
      rates.delete(key)
    }
  }
}, 300000)

/**
 * Check if a request should be rate limited
 * @param {string} identifier - Unique ID (token hash or IP)
 * @param {number} limit - Max requests per window
 * @param {number} windowMs - Window size in ms
 * @returns {Promise<{success: boolean, remaining: number}>}
 */
export async function checkRateLimit(identifier, limit = 10, windowMs = 60000) {
  const now = Date.now()
  if (!rates.has(identifier)) {
    rates.set(identifier, { count: 1, firstRequest: now, lastRequest: now })
    return { success: true, remaining: limit - 1 }
  }

  const data = rates.get(identifier)
  data.lastRequest = now

  // Reset window if expired
  if (now - data.firstRequest > windowMs) {
    data.count = 1
    data.firstRequest = now
    return { success: true, remaining: limit - 1 }
  }

  if (data.count >= limit) {
    return { success: false, remaining: 0 }
  }

  data.count++
  return { success: true, remaining: limit - data.count }
}

export function getIdentifier(req) {
  // Use authorization token if available (last 16 chars for privacy)
  const auth = req.headers.get('authorization')
  if (auth) {
    return `auth_${auth.slice(-16)}`
  }
  
  // Fallback to IP
  return req.headers.get('x-forwarded-for') || 'anonymous'
}
