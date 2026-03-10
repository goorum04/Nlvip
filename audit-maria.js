const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

async function main() {
    console.log('🔍 Comprehensive DB & Maria Audit...')

    // 1. Get Maria's Profile from DB (Service Key avoids RLS)
    const mariaRes = await new Promise((resolve) => {
        const url = new URL('/rest/v1/profiles?email=eq.maria@demo.com', SUPABASE_URL)
        https.get(url, { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => resolve(JSON.parse(body)))
        })
    })

    if (mariaRes && mariaRes.length > 0) {
        const maria = mariaRes[0]
        console.log('Maria Profile Columns:', Object.keys(maria).join(', '))
        console.log('Maria Data:', JSON.stringify(maria, null, 2))

        // Check if ID is a valid UUID
        console.log('ID is valid UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maria.id))
    } else {
        console.log('Maria profile NOT FOUND in database!')
    }

    // 2. Check for RLS Policies on profiles
    // We can't query pg_policies directly via PostgREST usually, 
    // but we can try to test access with ANON key (simulating someone else or public)
    const anonRes = await new Promise((resolve) => {
        const url = new URL(`/rest/v1/profiles?id=eq.${mariaRes[0]?.id || 'dummy'}`, SUPABASE_URL)
        const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_KEY // Fallback to service key just to see if the structure works, but test with anon
        // Actually I don't have the anon key handy, I'll try to find it in the repo
    })
}

main().catch(console.error)
