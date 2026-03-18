const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'
const supabase = createClient(supabaseUrl, serviceRoleKey)

async function refreshCacheAndCheck() {
    // Doing a dummy schema change to force PostgREST to reload schema cache
    const sql = "COMMENT ON TABLE profiles IS 'Perfil de usuario " + Date.now() + "';"

    // Actually, we can't run raw SQL without an RPC. Let's just create an RPC if not exists.
    // Wait, I can't do raw SQL easily. 

    // Let's test the ANON KEY directly to see if the sex column is returned.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzM2ODksImV4cCI6MjA4MjkwOTY4OX0.3Y9zOQ1025y-V_8J0_L4_v_3-RItn5tXqP4dZ0i0mHk'
    const anonClient = createClient(supabaseUrl, anonKey)

    // login
    const { data, error } = await anonClient.auth.signInWithPassword({
        email: 'demo_chica@nlvip.com',
        password: '12345678'
    })
    if (error) { console.error('Anon login error:', error); return; }

    const { data: profile } = await anonClient.from('profiles').select('*').eq('id', data.user.id).single()
    console.log('Anon Profile keys:', Object.keys(profile))
    console.log('Anon Profile sex:', profile.sex)
}
refreshCacheAndCheck()
