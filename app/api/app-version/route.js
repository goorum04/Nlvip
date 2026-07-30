import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Id numérico de la ficha de la App Store (de la propia store_url configurada).
// La API pública de iTunes Lookup no necesita ninguna clave ni login de
// App Store Connect: devuelve la versión que está publicada AHORA MISMO.
const IOS_APP_STORE_ID = '6759666320'

// Consulta la versión real publicada en la App Store. Si falla por lo que
// sea (red, Apple caído, etc.), devuelve null y el aviso simplemente usa el
// valor manual de la tabla como respaldo — nunca rompe la comprobación.
async function fetchRealIosVersion() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://itunes.apple.com/lookup?id=${IOS_APP_STORE_ID}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const version = data?.results?.[0]?.version
    return typeof version === 'string' && version.length > 0 ? version : null
  } catch (e) {
    console.warn('fetchRealIosVersion error:', e.message)
    return null
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'ios'

    // Validar platform
    if (!['ios', 'android'].includes(platform)) {
      return Response.json({ configured: false }, { status: 400 })
    }

    // Conectar a Supabase con service role (sin autenticación necesaria)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { data, error } = await supabase
      .from('app_version_config')
      .select('*')
      .eq('platform', platform)
      .eq('configured', true)
      .single()

    if (error || !data) {
      return Response.json({ configured: false })
    }

    // iOS: la versión "disponible" ya no depende de que alguien la actualice
    // a mano en la base de datos — se comprueba de verdad contra la App
    // Store. Si la consulta falla, cae al valor de la tabla como respaldo.
    // Android no tiene un endpoint público equivalente sin credenciales de
    // Google Play, así que sigue usando el valor configurado a mano.
    const realVersion = platform === 'ios' ? await fetchRealIosVersion() : null
    const latestVersion = realVersion || data.latest_version

    return Response.json({
      configured: data.configured,
      latest_version: latestVersion,
      latest_version_source: realVersion ? 'app_store' : 'manual_fallback',
      min_supported_version: data.min_supported_version || null,
      update_message: data.update_message,
      store_url: data.store_url,
    })
  } catch (e) {
    console.error('app-version error:', e.message)
    return Response.json({ configured: false })
  }
}
