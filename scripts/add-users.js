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
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(jsonData)
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        resolve({ status: res.statusCode, body, data: res.statusCode >= 200 && res.statusCode < 300 ? JSON.parse(body || '[]') : null })
      })
    })

    req.on('error', reject)
    req.write(jsonData)
    req.end()
  })
}

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

async function createAuthUser(email, password, name, role) {
  // Create user via Supabase Auth Admin API
  const authUrl = new URL('/auth/v1/admin/users', SUPABASE_URL)
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    })
    
    const options = {
      hostname: authUrl.hostname,
      path: authUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: JSON.parse(body) })
        } else {
          resolve({ success: false, status: res.statusCode, body })
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function insertProfile(id, email, name, role) {
  return postRequest('/rest/v1/profiles', { id, email, name, role })
}

async function main() {
  console.log('🚀 Creando nuevos usuarios...\n')

  // 1. Crear nuevo entrenador: Carlos
  console.log('👨‍🏫 Creando Entrenador: Carlos...')
  const trainerResult = await createAuthUser('carlos@demo.com', 'Demo1234!', 'Carlos', 'trainer')
  
  if (trainerResult.success) {
    console.log('   ✅ Usuario Auth creado')
    const userId = trainerResult.data.user?.id || trainerResult.data.id
    const profileResult = await insertProfile(
      userId,
      'carlos@demo.com',
      'Carlos',
      'trainer'
    )
    console.log(`   ${profileResult.status < 300 ? '✅' : '❌'} Perfil creado`)
  } else {
    console.log(`   ⚠️ ${trainerResult.body}`)
  }

  // 2. Crear nuevo socio: María
  console.log('\n👩 Creando Socio: María...')
  const memberResult = await createAuthUser('maria@demo.com', 'Demo1234!', 'María', 'member')
  
  if (memberResult.success) {
    console.log('   ✅ Usuario Auth creado')
    const memberId = memberResult.data.user?.id || memberResult.data.id
    const profileResult = await insertProfile(
      memberId,
      'maria@demo.com',
      'María',
      'member'
    )
    console.log(`   ${profileResult.status < 300 ? '✅' : '❌'} Perfil creado`)

    // Asignar María al entrenador Didac
    if (profileResult.status < 300) {
      const memberId = memberResult.data.user?.id || memberResult.data.id
      const didacRes = await getRequest('/rest/v1/profiles?role=eq.trainer&name=eq.Didac&select=id')
      if (didacRes.data && didacRes.data[0]) {
        const assignResult = await postRequest('/rest/v1/trainer_members', {
          trainer_id: didacRes.data[0].id,
          member_id: memberId
        })
        console.log(`   ${assignResult.status < 300 ? '✅' : '❌'} Asignada a Didac`)
      }

      // Darle algunos badges a María
      const badgesRes = await getRequest('/rest/v1/badges?select=id,title')
      if (badgesRes.data) {
        const primerPaso = badgesRes.data.find(b => b.title === 'Primer Paso')
        if (primerPaso) {
          await postRequest('/rest/v1/user_badges', {
            badge_id: primerPaso.id,
            member_id: memberId
          })
          console.log('   ✅ Badge "Primer Paso" asignado')
        }
      }

      // Crear algunos checkins para María
      const today = new Date()
      for (let i = 0; i < 5; i++) {
        const date = new Date(today.getTime() - (i * 2 + 1) * 86400000)
        await postRequest('/rest/v1/workout_checkins', {
          member_id: memberId,
          checked_in_at: date.toISOString(),
          duration_minutes: 45 + Math.floor(Math.random() * 30),
          notes: `Entrenamiento ${i + 1}`
        })
      }
      console.log('   ✅ 5 check-ins creados')

      // Inscribir a María en un reto
      const challengesRes = await getRequest('/rest/v1/challenges?is_active=eq.true&select=id,title&limit=1')
      if (challengesRes.data && challengesRes.data[0]) {
        await postRequest('/rest/v1/challenge_participants', {
          challenge_id: challengesRes.data[0].id,
          member_id: memberId,
          progress_value: 2
        })
        console.log(`   ✅ Inscrita en reto: ${challengesRes.data[0].title}`)
      }
    }
  } else {
    console.log(`   ⚠️ ${memberResult.body}`)
  }

  // Verificar usuarios
  console.log('\n📋 Usuarios actuales:')
  const profilesRes = await getRequest('/rest/v1/profiles?select=name,email,role&order=role')
  if (profilesRes.data) {
    profilesRes.data.forEach(p => {
      console.log(`   - ${p.name} (${p.role}): ${p.email}`)
    })
  }

  console.log('\n✅ ¡Completado!')
  console.log('\n📝 Credenciales:')
  console.log('   Entrenador Carlos: carlos@demo.com / Demo1234!')
  console.log('   Socio María: maria@demo.com / Demo1234!')
}

main().catch(console.error)
