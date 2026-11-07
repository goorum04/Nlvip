// Agregación de pasos leídos de Apple Health (HealthKit).
//
// Problema que resuelve: queryHKitSampleType devuelve TODAS las muestras en
// bruto de TODAS las fuentes (iPhone, Apple Watch, Garmin, WHOOP, Oura...).
// La app Salud de Apple las deduplica por prioridad de fuente antes de
// enseñar el total, pero una consulta de muestras no lo hace. Si el socio
// lleva iPhone y reloj a la vez, sumar todo a lo bruto cuenta cada paso dos
// veces (confirmado: un socio con Apple Watch veía ~2x sus pasos reales).
//
// Estrategia: sumar los pasos POR FUENTE y quedarse con la fuente que más
// pasos registró ese día. Es la aproximación estándar del lado cliente a lo
// que hace Apple: cuando un reloj está presente, es la fuente que más
// cobertura tiene (lo llevas puesto todo el día, el móvil no). Limitación
// conocida: si el socio alterna reloj y móvil en distintos tramos del día,
// esto cuenta un poco de menos frente a la fusión por intervalos de Apple,
// pero nunca cuenta de más, que es lo que importa para rachas y retos.
//
// Es una función pura sin dependencias de Capacitor para poder probarla
// fuera de iOS.

const APPLE_BUNDLE_PREFIX = 'com.apple.health'

/**
 * Nombre legible de la fuente para enseñarlo al socio.
 * HealthKit da `source` (p.ej. "Apple Watch de Nacho", "iPhone de Nacho",
 * "WHOOP", "Garmin Connect") y opcionalmente `device.model`.
 */
export function describeHealthKitSource(sample) {
  if (!sample) return 'Apple Health'
  const source = (sample.source || '').trim()
  const model = (sample.device?.model || '').trim()
  // Las fuentes nativas de Apple traen bundle com.apple.health.<UDID> y el
  // nombre "iPhone de X" / "Apple Watch de X". El nombre ya es suficiente.
  if (source) return source
  if (model) return model
  return 'Apple Health'
}

function sourceKey(sample) {
  // Un mismo dispositivo siempre llega con el mismo sourceBundleId. Las
  // fuentes de Apple llevan el UDID en el bundle, así que un iPhone y un
  // Apple Watch del mismo socio NO colisionan.
  return (sample.sourceBundleId || '').trim() || (sample.source || '').trim() || 'unknown'
}

/**
 * @param {Array<{value?: number, source?: string, sourceBundleId?: string, device?: {model?: string}|null}>} samples
 * @returns {{ steps: number, sourceName: string|null, sourceCount: number, perSource: Array<{key: string, name: string, steps: number, isApple: boolean}> }}
 */
export function aggregateHealthKitSteps(samples) {
  const list = Array.isArray(samples) ? samples : []
  const bySource = new Map()

  for (const sample of list) {
    const value = Number(sample?.value)
    if (!Number.isFinite(value) || value <= 0) continue
    const key = sourceKey(sample)
    const entry = bySource.get(key) || {
      key,
      name: describeHealthKitSource(sample),
      steps: 0,
      isApple: (sample.sourceBundleId || '').startsWith(APPLE_BUNDLE_PREFIX),
    }
    entry.steps += value
    bySource.set(key, entry)
  }

  const perSource = [...bySource.values()].sort((a, b) => b.steps - a.steps)
  if (perSource.length === 0) {
    return { steps: 0, sourceName: null, sourceCount: 0, perSource }
  }

  const best = perSource[0]
  return {
    steps: Math.round(best.steps),
    sourceName: best.name,
    sourceCount: perSource.length,
    perSource,
  }
}
