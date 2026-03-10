const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

function getRequest(path) {
  const url = new URL(path, SUPABASE_URL)
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        resolve({ status: res.statusCode, body, data: res.statusCode === 200 ? JSON.parse(body || '[]') : null })
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function main() {
  console.log('🔍 Checking Maria user...')
  const mariaRes = await getRequest('/rest/v1/profiles?email=eq.maria@demo.com&select=*')
  console.log('Profile:', JSON.stringify(mariaRes.data, null, 2))

  if (mariaRes.data && mariaRes.data[0]) {
    const userId = mariaRes.data[0].id
    console.log('\n🔍 Checking Assignments for', userId)
    
    const trainerRes = await getRequest(`/rest/v1/trainer_members?member_id=eq.${userId}&select=*`)
    console.log('Trainer assignment:', JSON.stringify(trainerRes.data, null, 2))
    
    const workoutRes = await getRequest(`/rest/v1/member_workouts?member_id=eq.${userId}&select=*`)
    console.log('Workout assignment:', JSON.stringify(workoutRes.data, null, 2))
  }
}

main().catch(console.error)
