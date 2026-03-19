// Script para actualizar nombres de usuarios demo
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateNames() {
  // Primero hacer login como admin para tener permisos
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@demo.com',
    password: 'Demo1234!'
  })
  
  if (authError) {
    console.error('Error de autenticación:', authError)
    return
  }
  
  console.log('Logged in as admin')
  
  // Actualizar Said (socio)
  const { error: e1 } = await supabase
    .from('profiles')
    .update({ name: 'Said' })
    .eq('email', 'socio@demo.com')
  
  if (e1) console.error('Error actualizando Said:', e1)
  else console.log('✅ Said actualizado')
  
  // Actualizar Didac (entrenador)
  const { error: e2 } = await supabase
    .from('profiles')
    .update({ name: 'Didac' })
    .eq('email', 'entrenador@demo.com')
  
  if (e2) console.error('Error actualizando Didac:', e2)
  else console.log('✅ Didac actualizado')
  
  // Actualizar Nacho (admin)
  const { error: e3 } = await supabase
    .from('profiles')
    .update({ name: 'Nacho' })
    .eq('email', 'admin@demo.com')
  
  if (e3) console.error('Error actualizando Nacho:', e3)
  else console.log('✅ Nacho actualizado')
  
  // Verificar
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email, name, role')
    .in('email', ['socio@demo.com', 'entrenador@demo.com', 'admin@demo.com'])
  
  console.log('\nPerfiles actualizados:')
  console.table(profiles)
  
  await supabase.auth.signOut()
}

updateNames()
