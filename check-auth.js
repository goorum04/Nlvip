const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

async function getAuthUsers() {
    const url = new URL('/auth/v1/admin/users', SUPABASE_URL)
    return new Promise((resolve, reject) => {
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'GET',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`
            }
        }
        const req = https.request(options, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }))
        })
        req.on('error', reject)
        req.end()
    })
}

async function main() {
    console.log('🔍 Checking Auth Users...')
    const res = await getAuthUsers()
    if (res.data && res.data.users) {
        const maria = res.data.users.find(u => u.email === 'maria@demo.com')
        console.log('Maria Auth User:', JSON.stringify(maria, null, 2))
    } else {
        console.log('Error fetching users:', res)
    }
}

main().catch(console.error)
