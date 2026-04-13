const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.HIDDEN_KEY'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function check() {
    const { data: users, error } = await supabase.auth.admin.listUsers()
    if (error) console.error(error)
    const demoChica = users.users.find(u => u.email === 'demo_chica@nlvip.com')
    console.log('Last sign in:', demoChica.last_sign_in_at)
}
check()
