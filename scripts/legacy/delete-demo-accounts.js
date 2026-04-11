/**
 * Script de borrado de cuentas demo/test
 * Elimina usuarios, perfiles y todos los datos que crearon.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/delete-demo-accounts.js
 *
 * O con dotenv:
 *   node -r dotenv/config scripts/delete-demo-accounts.js dotenv_config_path=.env.local
 */

const { createClient } = require('@supabase/supabase-js')

const DEMO_EMAILS = [
  'socio@demo.com',
  'entrenador@demo.com',
  'carlos@demo.com',
  'admin@demo.com'
]

const DEMO_INVITE_CODES = ['NLVIP-DEMO01', 'NLVIP-DEMO02']

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log('🔍 Buscando cuentas demo en Supabase Auth...')

  // Listar todos los usuarios de Auth y filtrar por email
  const { data: { users: allUsers }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error('❌ Error listando usuarios:', listError.message)
    process.exit(1)
  }

  const demoUsers = allUsers.filter(u => DEMO_EMAILS.includes(u.email))

  if (demoUsers.length === 0) {
    console.log('ℹ️  No se encontraron cuentas demo en Supabase Auth. Puede que ya estén borradas.')
  } else {
    console.log(`📋 Encontradas ${demoUsers.length} cuenta(s) demo: ${demoUsers.map(u => u.email).join(', ')}`)
  }

  const demoIds = demoUsers.map(u => u.id)

  // --- Borrar datos de miembros demo ---
  if (demoIds.length > 0) {
    console.log('\n🗑️  Borrando datos de miembros demo...')

    const memberTables = [
      { table: 'member_workouts',          col: 'member_id' },
      { table: 'member_diets',             col: 'member_id' },
      { table: 'food_logs',                col: 'member_id' },
      { table: 'progress_photos',          col: 'member_id' },
      { table: 'progress_records',         col: 'member_id' },
      { table: 'challenge_participants',   col: 'member_id' },
      { table: 'diet_onboarding_requests', col: 'member_id' },
      { table: 'feed_posts',               col: 'author_id' },
    ]

    for (const { table, col } of memberTables) {
      const { error } = await supabase.from(table).delete().in(col, demoIds)
      if (error) console.warn(`  ⚠️  ${table}: ${error.message}`)
      else console.log(`  ✅ ${table}`)
    }

    // Borrar relaciones trainer_members (ambos lados)
    await supabase.from('trainer_members').delete().in('member_id', demoIds)
    await supabase.from('trainer_members').delete().in('trainer_id', demoIds)
    console.log('  ✅ trainer_members')

    // Borrar avisos creados por entrenadores demo
    await supabase.from('trainer_notices').delete().in('trainer_id', demoIds)
    console.log('  ✅ trainer_notices')

    // Borrar plantillas creadas por entrenadores demo
    await supabase.from('workout_templates').delete().in('trainer_id', demoIds)
    await supabase.from('diet_templates').delete().in('trainer_id', demoIds)
    console.log('  ✅ workout_templates / diet_templates')

    // Borrar códigos de invitación demo
    await supabase.from('invitation_codes').delete().in('trainer_id', demoIds)
    await supabase.from('invitation_codes').delete().in('code', DEMO_INVITE_CODES)
    console.log('  ✅ invitation_codes')

    // Desvincular recetas: se conservan pero sin autor asignado
    const { error: recipesError } = await supabase
      .from('recipes')
      .update({ created_by: null })
      .in('created_by', demoIds)
    if (recipesError) console.warn(`  ⚠️  recipes (desvinculación): ${recipesError.message}`)
    else console.log('  ✅ recipes (created_by → null, recetas conservadas)')

    // Desvincular conversaciones
    await supabase.from('messages').update({ sender_id: null }).in('sender_id', demoIds)
    await supabase.from('conversations').update({ created_by: null }).in('created_by', demoIds)
    console.log('  ✅ conversations / messages (desvinculados)')

    // Borrar perfiles
    await supabase.from('profiles').delete().in('id', demoIds)
    console.log('  ✅ profiles')
  }

  // --- Borrar cuentas de Auth ---
  if (demoUsers.length > 0) {
    console.log('\n🔐 Eliminando cuentas de Supabase Auth...')
    for (const user of demoUsers) {
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      if (error) console.warn(`  ⚠️  ${user.email}: ${error.message}`)
      else console.log(`  ✅ ${user.email} eliminado`)
    }
  }

  console.log('\n✅ Proceso completado. Verifica en el panel de Supabase que no quede ninguna cuenta demo.')
}

main().catch(err => {
  console.error('❌ Error inesperado:', err)
  process.exit(1)
})
