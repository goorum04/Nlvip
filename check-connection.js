const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function checkConnection() {
  console.log('🔍 Verificando conexión con Supabase...\n')
  console.log(`📡 URL: ${supabaseUrl}\n`)

  try {
    // Verificar conexión contando perfiles
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('❌ Error al conectar:', error.message)
      process.exit(1)
    }

    console.log('✅ Conexión exitosa con Supabase!\n')
    console.log(`👥 Perfiles en la base de datos: ${count}`)

    // Verificar tablas principales
    const tables = ['profiles', 'workout_templates', 'diet_templates', 'recipes', 'invitation_codes']
    console.log('\n📋 Verificando tablas principales:')

    for (const table of tables) {
      const { error: tableError, count: tableCount } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (tableError) {
        console.log(`   ⚠️  ${table}: ${tableError.message}`)
      } else {
        console.log(`   ✅ ${table}: ${tableCount} registros`)
      }
    }

    console.log('\n🎉 Todo OK! La conexión con Supabase funciona correctamente.\n')

  } catch (err) {
    console.error('❌ Error inesperado:', err.message)
    process.exit(1)
  }
}

checkConnection()
