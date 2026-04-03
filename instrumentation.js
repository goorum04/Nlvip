/**
 * Next.js Instrumentation Hook (runs once on server startup)
 * Ensures the Supabase Realtime configuration is applied automatically
 * every time the server starts, without any manual steps.
 *
 * Requires `experimental.instrumentationHook: true` in next.config.js
 */
export async function register() {
  // Only run in the Node.js server runtime, not in the Edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

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
