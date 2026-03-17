import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase con service role key - SOLO para uso en server (API routes)
// NUNCA importar este archivo en componentes de cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('⚠️  Faltan variables de entorno de Supabase. Verifica tu .env.local')
}

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  serviceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
