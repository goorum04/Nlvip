const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

function request(method, path, data = null) {
  const url = new URL(path, SUPABASE_URL)
  
  return new Promise((resolve, reject) => {
    const jsonData = data ? JSON.stringify(data) : null
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation'
      }
    }
    if (jsonData) options.headers['Content-Length'] = Buffer.byteLength(jsonData)

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        resolve({ 
          status: res.statusCode, 
          body, 
          data: res.statusCode >= 200 && res.statusCode < 300 ? JSON.parse(body || '[]') : null 
        })
      })
    })

    req.on('error', reject)
    if (jsonData) req.write(jsonData)
    req.end()
  })
}

async function main() {
  console.log('🔧 Arreglando perfil de Carlos...\n')

  // Get Carlos from auth
  const authUsersRes = await request('GET', '/auth/v1/admin/users')
  
  if (authUsersRes.data && authUsersRes.data.users) {
    const carlos = authUsersRes.data.users.find(u => u.email === 'carlos@demo.com')
    
    if (carlos) {
      console.log('✅ Carlos encontrado en Auth:', carlos.id)
      
      // Check if profile exists
      const profileRes = await request('GET', `/rest/v1/profiles?id=eq.${carlos.id}`)
      
      if (!profileRes.data || profileRes.data.length === 0) {
        console.log('❌ Perfil no existe, creándolo...')
        const createRes = await request('POST', '/rest/v1/profiles', {
          id: carlos.id,
          email: 'carlos@demo.com',
          name: 'Carlos',
          role: 'trainer'
        })
        console.log(createRes.status < 300 ? '✅ Perfil creado!' : '❌ Error: ' + createRes.body)
      } else {
        console.log('✅ Perfil ya existe')
      }
    } else {
      console.log('❌ Carlos no encontrado en Auth')
    }
  }

  // Verify all users
  console.log('\n📋 Usuarios finales:')
  const profilesRes = await request('GET', '/rest/v1/profiles?select=name,email,role&order=role')
  if (profilesRes.data) {
    profilesRes.data.forEach(p => {
      console.log(`   - ${p.name} (${p.role}): ${p.email}`)
    })
  }
}

main().catch(console.error)
