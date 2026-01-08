const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.sb_secret_EfEbvV9N4L0dOvVdDL741w_QZN8j9L5'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runMigrations() {
  console.log('🚀 Iniciando migración FASE 3: Retos, Badges y Gráficas...\n')

  try {
    // 1. Create challenge_type enum
    console.log('1️⃣ Creando tipos enum...')
    await supabase.rpc('exec_sql', { 
      sql: `
        DO $$ BEGIN
          CREATE TYPE challenge_type AS ENUM ('workouts', 'weight', 'consistency');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `
    }).catch(() => {})

    await supabase.rpc('exec_sql', { 
      sql: `
        DO $$ BEGIN
          CREATE TYPE badge_condition_type AS ENUM ('workouts_count', 'streak', 'challenge_completed', 'first_workout', 'weight_goal');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `
    }).catch(() => {})

    // 2. Create challenges table
    console.log('2️⃣ Creando tabla challenges...')
    const { error: e1 } = await supabase.from('challenges').select('id').limit(1)
    if (e1?.code === '42P01') {
      // Table doesn't exist, create it via REST workaround
      console.log('   → Tabla challenges no existe, necesita crearse via SQL Editor')
    } else {
      console.log('   ✅ Tabla challenges ya existe')
    }

    // Let's try direct SQL approach
    const tables = ['challenges', 'challenge_participants', 'badges', 'user_badges', 'workout_checkins']
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error?.code === '42P01') {
        console.log(`   ❌ Tabla ${table} no existe`)
      } else if (error) {
        console.log(`   ⚠️ Tabla ${table}: ${error.message}`)
      } else {
        console.log(`   ✅ Tabla ${table} existe`)
      }
    }

    console.log('\n📋 Las tablas necesitan crearse manualmente en el SQL Editor.')
    console.log('Por favor, ejecuta el archivo FASE3-RETOS-BADGES.sql en Supabase.\n')

  } catch (error) {
    console.error('Error:', error.message)
  }
}

runMigrations()
