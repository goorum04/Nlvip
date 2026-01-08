const https = require('https')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

async function query(sql) {
  const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL)
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ sql })
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': data.length
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: body })
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

async function tableExists(tableName) {
  const url = new URL(`/rest/v1/${tableName}?select=id&limit=1`, SUPABASE_URL)
  
  return new Promise((resolve) => {
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
        // 404 or error means table doesn't exist
        resolve(res.statusCode === 200)
      })
    })

    req.on('error', () => resolve(false))
    req.end()
  })
}

async function insertData(tableName, data) {
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL)
  
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: JSON.parse(body || '[]') })
        } else {
          resolve({ success: false, status: res.statusCode, body })
        }
      })
    })

    req.on('error', reject)
    req.write(jsonData)
    req.end()
  })
}

async function selectData(tableName, query = '') {
  const url = new URL(`/rest/v1/${tableName}${query}`, SUPABASE_URL)
  
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: JSON.parse(body || '[]') })
        } else {
          resolve({ success: false, status: res.statusCode, body })
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function main() {
  console.log('🚀 FASE 3: Verificando tablas existentes...\n')

  // Check existing tables
  const tables = ['challenges', 'challenge_participants', 'badges', 'user_badges', 'workout_checkins', 'profiles']
  
  for (const table of tables) {
    const exists = await tableExists(table)
    console.log(`   ${exists ? '✅' : '❌'} ${table}`)
  }

  // Get profiles for seeding
  console.log('\n📋 Obteniendo usuarios demo...')
  const { success, data: profiles } = await selectData('profiles', '?select=id,email,name,role')
  
  if (success && profiles.length > 0) {
    console.log('   Usuarios encontrados:')
    profiles.forEach(p => console.log(`   - ${p.name} (${p.role}): ${p.id}`))
    
    const trainer = profiles.find(p => p.role === 'trainer')
    const admin = profiles.find(p => p.role === 'admin')
    const member = profiles.find(p => p.role === 'member')

    if (trainer && member) {
      console.log('\n🎯 Intentando insertar datos demo...')
      
      // Check if badges table exists and try to seed
      const badgesExist = await tableExists('badges')
      if (badgesExist) {
        console.log('\n📛 Insertando badges...')
        const badges = [
          { title: 'Primer Paso', description: 'Completaste tu primer entrenamiento', icon: 'footprints', color: 'bronze', condition_type: 'first_workout', condition_value: 1 },
          { title: 'En Racha', description: 'Mantuviste una racha de 7 días', icon: 'flame', color: 'orange', condition_type: 'streak', condition_value: 7 },
          { title: 'Dedicación', description: 'Completaste 10 entrenamientos', icon: 'dumbbell', color: 'silver', condition_type: 'workouts_count', condition_value: 10 },
          { title: 'Imparable', description: 'Completaste 25 entrenamientos', icon: 'trophy', color: 'gold', condition_type: 'workouts_count', condition_value: 25 },
          { title: 'Leyenda', description: 'Completaste 50 entrenamientos', icon: 'crown', color: 'platinum', condition_type: 'workouts_count', condition_value: 50 },
          { title: 'Retador', description: 'Completaste tu primer reto', icon: 'target', color: 'green', condition_type: 'challenge_completed', condition_value: 1 },
          { title: 'Campeón', description: 'Completaste 5 retos', icon: 'medal', color: 'gold', condition_type: 'challenge_completed', condition_value: 5 }
        ]
        
        for (const badge of badges) {
          const result = await insertData('badges', badge)
          console.log(`   ${result.success ? '✅' : '⚠️'} ${badge.title}`)
        }
      }

      // Check if challenges table exists and try to seed
      const challengesExist = await tableExists('challenges')
      if (challengesExist) {
        console.log('\n🎯 Insertando retos...')
        
        const today = new Date()
        const challenges = [
          {
            title: '💪 Desafío de Fuerza',
            description: 'Completa 10 entrenamientos en las próximas 2 semanas. ¡Demuestra tu compromiso!',
            type: 'workouts',
            target_value: 10,
            start_date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date(today.getTime() + 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            created_by: trainer.id,
            is_active: true
          },
          {
            title: '🔥 Racha de Fuego',
            description: 'Entrena al menos 1 vez cada día durante 14 días consecutivos. ¡Sin excusas!',
            type: 'consistency',
            target_value: 14,
            start_date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            created_by: admin?.id || trainer.id,
            is_active: true
          },
          {
            title: '⚖️ Transformación Total',
            description: 'Pierde 3kg de grasa manteniendo tu masa muscular. ¡El verano se acerca!',
            type: 'weight',
            target_value: 3,
            start_date: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date(today.getTime() + 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            created_by: trainer.id,
            is_active: true
          }
        ]

        for (const challenge of challenges) {
          const result = await insertData('challenges', challenge)
          console.log(`   ${result.success ? '✅' : '⚠️'} ${challenge.title}`)
          if (!result.success) console.log(`      ${result.body}`)
        }
      }

      // Insert workout checkins
      const checkinsExist = await tableExists('workout_checkins')
      if (checkinsExist && member) {
        console.log('\n🏋️ Insertando check-ins de entrenamientos...')
        
        const checkins = []
        const durations = [65, 55, 70, 45, 60, 55, 50, 65, 60, 45, 70, 55, 60, 50, 65, 55]
        const notes = ['Día de pierna intenso', 'Upper body', 'Full body', 'Cardio y core', 'Push day', 'Pull day', 'Legs', 'Upper body', 'Full body', 'Cardio', 'Push day', 'Pull day', 'Legs', 'Upper body', 'Full body', 'Push day']
        const daysAgo = [1, 2, 4, 5, 7, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 28]
        
        for (let i = 0; i < daysAgo.length; i++) {
          const date = new Date(today.getTime() - daysAgo[i] * 24 * 60 * 60 * 1000)
          checkins.push({
            member_id: member.id,
            checked_in_at: date.toISOString(),
            duration_minutes: durations[i],
            notes: notes[i]
          })
        }

        for (const checkin of checkins) {
          const result = await insertData('workout_checkins', checkin)
          if (result.success) process.stdout.write('✅')
          else process.stdout.write('⚠️')
        }
        console.log('\n   Insertados ' + checkins.length + ' check-ins')
      }

      console.log('\n✅ Seed completado!')
    }
  } else {
    console.log('   ❌ No se pudieron obtener los usuarios')
  }
}

main().catch(console.error)
