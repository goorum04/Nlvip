import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, password, name, adminToken } = await request.json()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Verificar que quien llama es administrador
    if (!adminToken) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 })
    }
    
    const { data: { user: adminUser }, error: verifyError } = await supabaseAdmin.auth.getUser(adminToken)
    if (verifyError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 })
    }
    
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()
      
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: only admins can create trainers' }, { status: 403 })
    }
    
    // Crear el usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'trainer'
      }
    })
    
    if (authError) throw authError
    
    // Crear el perfil correspondiente
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: authData.user.id,
        email,
        name,
        role: 'trainer'
      }])
      
    if (profileError) {
      // Rollback en caso de error
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }
    
    return NextResponse.json({ success: true, user: authData.user })
    
  } catch (error) {
    console.error('Error creating trainer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
