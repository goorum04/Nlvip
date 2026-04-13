const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLoadProfile(email) {
  console.log(`Testing profile load for: ${email}`)
  
  // First get the user id (simulating login)
  const { data: users, error: userError } = await supabase.from('profiles').select('id, role').eq('email', email)
  
  if (userError || !users.length) {
    console.error('Error or no user found:', userError || 'User not found')
    return
  }
  
  const userId = users[0].id
  console.log(`Found User ID: ${userId}`)

  // Simulate loadProfile logic
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  
  if (error) {
    console.error('ERROR in .single():', error.message)
    console.error('Code:', error.code)
  } else {
    console.log('Profile found successfully:', data.name, 'Role:', data.role)
  }
}

testLoadProfile('maria@demo.com')
testLoadProfile('admin@demo.com')
testLoadProfile('entrenador@demo.com')
