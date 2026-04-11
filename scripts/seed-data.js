const https = require('https')

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

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
        resolve({ status: res.statusCode, body })
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

async function insertData(tableName, data) {
  const result = await postRequest(`/rest/v1/${tableName}`, data)
  return result.status >= 200 && result.status < 300
}

async function main() {
  console.log('🚀 FASE 3: Insertando datos demo...\n')

  // Get profiles
  const profilesRes = await getRequest('/rest/v1/profiles?select=id,email,name,role')
  const profiles = profilesRes.data || []
  
  const trainer = profiles.find(p => p.role === 'trainer')
  const admin = profiles.find(p => p.role === 'admin')
  const member = profiles.find(p => p.role === 'member')

  console.log('👥 Usuarios:')
  console.log(`   Trainer: ${trainer?.name} (${trainer?.id})`)
  console.log(`   Admin: ${admin?.name} (${admin?.id})`)
  console.log(`   Member: ${member?.name} (${member?.id})`)

  if (!trainer || !member) {
    console.log('❌ Faltan usuarios necesarios')
    return
  }

  const today = new Date()

  // 1. Insert Badges
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
    const ok = await insertData('badges', badge)
    console.log(`   ${ok ? '✅' : '❌'} ${badge.title}`)
  }

  // 2. Insert Challenges
  console.log('\n🎯 Insertando retos...')
  const challenges = [
    {
      title: '💪 Desafío de Fuerza',
      description: 'Completa 10 entrenamientos en las próximas 2 semanas.',
      type: 'workouts',
      target_value: 10,
      start_date: new Date(today.getTime() - 3 * 86400000).toISOString().split('T')[0],
      end_date: new Date(today.getTime() + 11 * 86400000).toISOString().split('T')[0],
      created_by: trainer.id,
      is_active: true
    },
    {
      title: '🔥 Racha de Fuego',
      description: 'Entrena al menos 1 vez cada día durante 14 días consecutivos.',
      type: 'consistency',
      target_value: 14,
      start_date: new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0],
      end_date: new Date(today.getTime() + 9 * 86400000).toISOString().split('T')[0],
      created_by: admin.id,
      is_active: true
    },
    {
      title: '⚖️ Transformación Total',
      description: 'Pierde 3kg de grasa manteniendo tu masa muscular.',
      type: 'weight',
      target_value: 3,
      start_date: new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0],
      end_date: new Date(today.getTime() + 50 * 86400000).toISOString().split('T')[0],
      created_by: trainer.id,
      is_active: true
    }
  ]

  const challengeIds = []
  for (const challenge of challenges) {
    const result = await postRequest('/rest/v1/challenges', challenge)
    const ok = result.status >= 200 && result.status < 300
    if (ok && result.body) {
      try {
        const data = JSON.parse(result.body)
        if (data[0]?.id) challengeIds.push(data[0].id)
      } catch(e) {}
    }
    console.log(`   ${ok ? '✅' : '❌'} ${challenge.title}`)
    if (!ok) console.log(`      Status: ${result.status}, Body: ${result.body?.substring(0, 100)}`)
  }

  // 3. Insert challenge participations
  if (challengeIds.length > 0) {
    console.log('\n🏃 Inscribiendo al socio en retos...')
    const participations = [
      { challenge_id: challengeIds[0], member_id: member.id, progress_value: 6, completed: false },
      { challenge_id: challengeIds[1], member_id: member.id, progress_value: 8, completed: false },
      { challenge_id: challengeIds[2], member_id: member.id, progress_value: 0.8, completed: false }
    ]

    for (let i = 0; i < participations.length; i++) {
      const ok = await insertData('challenge_participants', participations[i])
      console.log(`   ${ok ? '✅' : '❌'} Reto ${i + 1}`)
    }
  }

  // 4. Get badge IDs and assign to member
  console.log('\n🏆 Asignando badges al socio...')
  const badgesRes = await getRequest('/rest/v1/badges?select=id,title')
  const badgesList = badgesRes.data || []
  
  const badgesToAssign = ['Primer Paso', 'En Racha', 'Dedicación', 'Retador']
  for (const badgeTitle of badgesToAssign) {
    const badge = badgesList.find(b => b.title === badgeTitle)
    if (badge) {
      const ok = await insertData('user_badges', {
        badge_id: badge.id,
        member_id: member.id,
        awarded_at: new Date(today.getTime() - Math.random() * 30 * 86400000).toISOString()
      })
      console.log(`   ${ok ? '✅' : '❌'} ${badgeTitle}`)
    }
  }

  // 5. Insert workout checkins
  console.log('\n🏋️ Insertando check-ins de entrenamientos...')
  const daysAgo = [1, 2, 4, 5, 7, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 28]
  const durations = [65, 55, 70, 45, 60, 55, 50, 65, 60, 45, 70, 55, 60, 50, 65, 55]
  
  let checkinCount = 0
  for (let i = 0; i < daysAgo.length; i++) {
    const date = new Date(today.getTime() - daysAgo[i] * 86400000)
    const ok = await insertData('workout_checkins', {
      member_id: member.id,
      checked_in_at: date.toISOString(),
      duration_minutes: durations[i],
      notes: `Entrenamiento día ${daysAgo[i]}`
    })
    if (ok) checkinCount++
    process.stdout.write(ok ? '✅' : '❌')
  }
  console.log(`\n   Total: ${checkinCount}/${daysAgo.length} check-ins`)

  // 6. Insert progress records for weight chart
  console.log('\n📊 Insertando registros de peso...')
  const weights = [
    { days: 30, weight: 82.5 },
    { days: 25, weight: 82.0 },
    { days: 20, weight: 81.3 },
    { days: 15, weight: 80.8 },
    { days: 10, weight: 80.2 },
    { days: 5, weight: 79.5 },
    { days: 0, weight: 79.0 }
  ]

  for (const w of weights) {
    const date = new Date(today.getTime() - w.days * 86400000)
    const ok = await insertData('progress_records', {
      member_id: member.id,
      date: date.toISOString().split('T')[0],
      weight_kg: w.weight,
      notes: `Peso registrado`
    })
    console.log(`   ${ok ? '✅' : '❌'} ${w.weight}kg (hace ${w.days} días)`)
  }

  console.log('\n✅ ¡Seed completado!')
}

main().catch(console.error)
