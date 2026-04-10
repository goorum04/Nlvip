/**
 * Next.js Instrumentation Hook (runs once on server startup)
 * - Inicializa Sentry para captura de errores en servidor
 * - Configura Supabase Realtime automáticamente
 */
export async function register() {
  // Inicializar Sentry según el runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }

  // Solo ejecutar setup de Supabase en Node.js
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Call the migration function created by supabase/migrations/20260403000100_enable_realtime.sql
    // This is idempotent - safe to call on every server start
    const { error } = await supabase.rpc('setup_nlvip_realtime')
    if (error) {
      // Function may not exist yet (first deploy before migration runs) - that's fine
      console.warn('[NL VIP] Realtime setup skipped:', error.message)
    } else {
      console.log('[NL VIP] Supabase Realtime configured successfully')
    }
  } catch {
    // Never block server startup
  }
}
