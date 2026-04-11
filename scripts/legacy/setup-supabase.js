/**
 * Script de configuración inicial de Supabase
 *
 * Ejecuta el schema SQL en Supabase.
 * Las cuentas demo han sido eliminadas — usa cuentas reales.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-supabase.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function setup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log('🚀 Iniciando configuración de NL VIP CLUB...\n')

  try {
    console.log('📦 Ejecutando schema SQL...')
    const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'sql', 'supabase-schema.sql'), 'utf8')

    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL })
    if (schemaError) {
      console.warn('⚠️  No se pudo ejecutar via RPC. Aplica el SQL manualmente desde el panel de Supabase.')
      console.warn('   Archivo:', path.join(__dirname, '..', 'sql', 'supabase-schema.sql'))
    } else {
      console.log('✅ Schema aplicado correctamente\n')
    }

    console.log('\n✅ Configuración completada.')
    console.log('   Crea el primer usuario admin desde el panel de Supabase o mediante el registro de la app.')

  } catch (error) {
    console.error('❌ Error durante la configuración:', error.message)
    process.exit(1)
  }
}

setup()
