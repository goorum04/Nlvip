const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

function postRequest(path, data) {
    const url = new URL(path, SUPABASE_URL)

    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data)

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
            res.on('end', () => {
                resolve({ status: res.statusCode, body })
            })
        })

        req.on('error', reject)
        req.write(jsonData)
        req.end()
    })
}

async function main() {
    console.log('🔍 Testing RPCs...')
    const rpc1 = await postRequest('/rest/v1/rpc/rpc_get_today_activity', {})
    console.log('rpc_get_today_activity status:', rpc1.status)
    if (rpc1.status >= 400) console.log('Error:', rpc1.body)

    const rpc2 = await postRequest('/rest/v1/rpc/rpc_get_activity_history', { p_days: 7 })
    console.log('rpc_get_activity_history status:', rpc2.status)

    console.log('\n🌟 Setting Maria to Premium...')
    const patchRes = await new Promise((resolve, reject) => {
        const url = new URL('/rest/v1/profiles?email=eq.maria@demo.com', SUPABASE_URL)
        const data = JSON.stringify({ has_premium: true, is_premium: true })
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Prefer': 'return=representation'
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
    console.log('Update Maria status:', patchRes.status)
    console.log('Response:', patchRes.body)
}

main().catch(console.error)
