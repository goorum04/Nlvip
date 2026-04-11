// Script para cargar el catálogo de ejercicios en Supabase
// Uso: node scripts/seed-exercises.js
// Requisito previo: ejecutar sql/EJERCICIOS-CATALOGO.sql en Supabase SQL Editor

const https = require('https')
const exercises = require('./exercises-data')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.HIDDEN_KEY'

// Usar proxy si está disponible (entorno de desarrollo)
let agent = undefined
try {
  const { HttpsProxyAgent } = require('https-proxy-agent')
  if (process.env.HTTPS_PROXY) {
    agent = new HttpsProxyAgent(process.env.HTTPS_PROXY)
  }
} catch (_) {}

function upsertBatch(batch) {
  const url = new URL('/rest/v1/exercises', SUPABASE_URL)
  const jsonData = JSON.stringify(batch)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      agent: agent,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
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

async function main() {
  console.log(`\n🏋️  Cargando catálogo de ejercicios en Supabase...\n`)
  console.log(`   Total de ejercicios: ${exercises.length}\n`)

  const BATCH_SIZE = 50
  let inserted = 0
  let failed = 0

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(exercises.length / BATCH_SIZE)

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} ejercicios)... `)

    try {
      const result = await upsertBatch(batch)
      if (result.status >= 200 && result.status < 300) {
        inserted += batch.length
        console.log('✅')
      } else {
        failed += batch.length
        console.log(`❌ (HTTP ${result.status})`)
        console.log(`   Error: ${result.body?.substring(0, 200)}`)
      }
    } catch (err) {
      failed += batch.length
      console.log(`❌ (${err.message})`)
    }
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`   ✅ Insertados/actualizados: ${inserted}`)
  if (failed > 0) {
    console.log(`   ❌ Fallidos: ${failed}`)
  }

  if (failed === 0) {
    console.log(`\n🎉 ¡Catálogo cargado correctamente!`)
    console.log(`   Ya puedes usar el selector de catálogo en el WorkoutBuilder.\n`)
  } else {
    console.log(`\n⚠️  Algunos ejercicios no se cargaron.`)
    console.log(`   Verifica que la tabla 'exercises' exista (ejecuta sql/EJERCICIOS-CATALOGO.sql)\n`)
  }
}

main().catch(console.error)
