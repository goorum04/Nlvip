/**
 * Rate limiter en memoria con ventana deslizante.
 * Protege endpoints de OpenAI contra abuso y bucles infinitos.
 *
 * Limitaciones: cada instancia serverless tiene su propio estado.
 * Es suficiente para proteger contra bucles en el cliente y usuarios
 * abusivos dentro de una misma instancia.
 */

// Map de userId → array de timestamps de peticiones
const requestLog = new Map()

// Limpiar entradas antiguas cada 5 minutos para evitar memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 60_000
    for (const [key, timestamps] of requestLog.entries()) {
      const recent = timestamps.filter(t => t > cutoff)
      if (recent.length === 0) {
        requestLog.delete(key)
      } else {
        requestLog.set(key, recent)
      }
    }
  }, 5 * 60_000)
}

/**
 * Comprueba si el identificador ha superado el límite de peticiones.
 *
 * @param {string} identifier  - userId o IP
 * @param {number} maxRequests - máximo de peticiones permitidas en la ventana
 * @param {number} windowMs    - tamaño de la ventana en ms (default: 60 segundos)
 * @returns {{ allowed: boolean, remaining: number, resetInMs: number }}
 */
export function checkRateLimit(identifier, maxRequests = 10, windowMs = 60_000) {
  const now = Date.now()
  const cutoff = now - windowMs

  const timestamps = (requestLog.get(identifier) || []).filter(t => t > cutoff)

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetInMs: oldest + windowMs - now
    }
  }

  timestamps.push(now)
  requestLog.set(identifier, timestamps)

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    resetInMs: 0
  }
}

/**
 * Extrae el identificador del usuario desde la request de Next.js.
 * Usa el header Authorization si existe, si no usa la IP.
 */
export function getIdentifier(request) {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    // Usar los últimos 16 chars del token como ID anónimo (no exponer el token completo)
    const token = auth.slice(7)
    return `token:${token.slice(-16)}`
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  return `ip:${ip}`
}
