import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

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

    return Response.json({
      configured: data.configured,
      latest_version: data.latest_version,
      update_message: data.update_message,
      store_url: data.store_url,
    })
  } catch (e) {
    console.error('app-version error:', e.message)
    return Response.json({ configured: false })
  }
}
