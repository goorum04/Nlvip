const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

async function postRpc(rpcName, params = {}) {
    const url = new URL(`/rest/v1/rpc/${rpcName}`, SUPABASE_URL)
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(params)
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            }
        }
        const req = https.request(options, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => resolve({ status: res.statusCode, body }))
        })
        req.on('error', reject)
        req.write(data)
        req.end()
    })
}

async function main() {
    console.log('🔍 Auditing Database Constraints...')
    // We can use the information schema via a generic RPC if it exists, or just query it if the user has access.
    // But wait, standard PostgREST doesn't expose information_schema.
    // However, we can try to trigger the error in a safe way.

    const testJoin = await new Promise((resolve) => {
        const url = new URL('/rest/v1/trainer_members?select=trainer:profiles!trainer_members_trainer_id_fkey(id,name)&limit=1', SUPABASE_URL)
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        }, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => resolve({ status: res.statusCode, body }))
        })
        req.end()
    })

    console.log('Test join status:', testJoin.status)
    if (testJoin.status >= 400) {
        console.log('Join Error (Potential cause!):', testJoin.body)
    } else {
        console.log('Join successful!')
    }
}

main().catch(console.error)
