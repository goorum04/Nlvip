const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function check() {
    const { data, error } = await supabase.from('profiles').select('*').eq('email', 'demo_chica@nlvip.com').single()
    console.log(data)
    if (error) console.error(error)
}
check()
