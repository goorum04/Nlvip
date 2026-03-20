import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function createAdmin() {
  const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'testadmin@nlvip.com',
    password: 'password123',
    email_confirm: true
  })
  
  if (error) {
    console.error('Error creating auth user:', error)
    if (error.message.includes('already registered')) {
        console.log('User already exists, just updating profile role.')
        const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', 'testadmin@nlvip.com').single()
        if (existing) {
             await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', existing.id)
             console.log('Done updating existing testadmin')
        }
        return
    }
    return
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: user.user.id,
    email: 'testadmin@nlvip.com',
    name: 'Test Admin',
    role: 'admin',
    is_active: true
  })

  if (profileError) console.error('Error creating profile:', profileError)
  else console.log('Test Admin created successfully!')
}

createAdmin()
