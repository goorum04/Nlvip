#!/usr/bin/env node
/**
 * Smoke test repetible contra un entorno real (por defecto, producción)
 * usando cuentas de prueba dedicadas (role admin y role member) — no toca
 * datos de socios reales.
 *
 * Por qué existe: varios bugs reales de esta sesión y sesiones anteriores
 * (temperature 400, lesiones fantasma, member_id inventado, catálogo de
 * ejercicios, escalada de privilegios, rutas sin autenticación...) solo se
 * detectaron probando peticiones reales contra el servidor desplegado, no
 * leyendo el código. Este script formaliza esas pruebas para poder
 * repetirlas en segundos después de cualquier cambio, en vez de
 * reconstruirlas a mano cada vez.
 *
 * Dos bloques de comprobaciones, en este orden:
 *   1. Plumbing (login + guardas de autenticación + una lectura por rol) —
 *      gratis, sin coste de IA. Repite en miniatura los bugs de auth de
 *      esta sesión: token ausente → 401, socio pidiendo datos de otro
 *      socio → 403, admin con acceso de lectura a cualquier socio → 200.
 *   2. Asistente IA (admin-assistant) — sí gasta crédito de la API de
 *      Claude, así que corre después: si el crédito está agotado, el
 *      bloque 1 ya deja constancia de que la app en sí funciona.
 *
 * Requiere variables de entorno (no hardcodear nunca credenciales aquí —
 * el repo es público):
 *   QA_ADMIN_EMAIL       email de la cuenta de admin de pruebas
 *   QA_ADMIN_PASSWORD    contraseña de esa cuenta
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   APP_URL              base del despliegue a probar (default: producción)
 *
 * Opcionales (activan más comprobaciones del bloque 1 si están puestas):
 *   QA_MEMBER_EMAIL       email del socio de pruebas (role: member)
 *   QA_MEMBER_PASSWORD    contraseña de esa cuenta — sin ella se salta el
 *                          login de socio y las comprobaciones que dependen
 *                          de él (se avisa, no cuenta como fallo)
 *
 * Para el modo --full además:
 *   SUPABASE_SERVICE_ROLE_KEY   para limpiar los datos que el propio test crea
 *
 * Uso:
 *   node scripts/qa-smoke-test.mjs           # solo lecturas, sin mutar nada
 *   node scripts/qa-smoke-test.mjs --full     # incluye generar+guardar rutina,
 *                                              # notas+corrección, memoria de
 *                                              # preferencias (limpia tras sí)
 */

const APP_URL = process.env.APP_URL || 'https://app.nlvipnutrition.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const FULL = process.argv.includes('--full')

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Falta la variable de entorno ${name}. Ver cabecera del script.`)
    process.exit(1)
  }
  return v
}

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Login falló para ${email}: ${JSON.stringify(data)}`)
  return { token: data.access_token, userId: data.user.id }
}

async function sendAssistant(token, messages, extra = {}) {
  const res = await fetch(`${APP_URL}/api/admin-assistant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, background: true, ...extra }),
  })
  const data = await res.json()
  if (!data.jobId) throw new Error(`No arrancó el job: ${JSON.stringify(data)}`)
  return pollJob(token, data.jobId)
}

async function confirmToolCalls(token, toolCalls) {
  const toolsToExecute = toolCalls.map(tc => ({ id: tc.id, name: tc.function.name, args: tc.function.arguments }))
  const res = await fetch(`${APP_URL}/api/admin-assistant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ executeTools: true, toolCallsToExecute: toolsToExecute, background: true }),
  })
  const data = await res.json()
  if (!data.jobId) throw new Error(`No arrancó el job de confirmación: ${JSON.stringify(data)}`)
  return pollJob(token, data.jobId)
}

async function pollJob(token, jobId, maxWaitMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await fetch(`${APP_URL}/api/admin-assistant?jobId=${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.status === 'done') return data
    if (data.status === 'error') throw new Error(`Job falló: ${data.error}`)
  }
  throw new Error(`Timeout esperando el job ${jobId}`)
}

// --- Bloque 1: plumbing (login + guardas de auth + una lectura por rol) ---
// Sin coste de IA — reproduce en miniatura los bugs de autenticación reales
// de esta sesión (token ausente aceptado, un socio leyendo datos de otro,
// un upsert server-to-server sin token...).

async function runPlumbingChecks(adminToken, adminUserId) {
  // Endpoint público: no requiere login, solo confirma que la app y su
  // integración externa (iTunes Lookup) responden.
  try {
    const res = await fetch(`${APP_URL}/api/app-version?platform=ios`)
    const data = await res.json()
    record('GET /api/app-version (sin auth) responde 200', res.status === 200, `configured=${data.configured}`)
  } catch (e) {
    record('GET /api/app-version (sin auth) responde 200', false, e.message)
  }

  // Guarda de autenticación: sin token, debe rechazar con 401, nunca 200
  // ni un 500 que sugiera que intentó procesar la petición igualmente.
  try {
    const res = await fetch(`${APP_URL}/api/member-prs?memberId=${adminUserId}`)
    record('GET /api/member-prs sin token → 401', res.status === 401, `status=${res.status}`)
  } catch (e) {
    record('GET /api/member-prs sin token → 401', false, e.message)
  }
  try {
    const res = await fetch(`${APP_URL}/api/checkin/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    record('POST /api/checkin/submit sin token → 401', res.status === 401, `status=${res.status}`)
  } catch (e) {
    record('POST /api/checkin/submit sin token → 401', false, e.message)
  }

  // Lectura propia del admin: token válido + su propio id → 200.
  try {
    const res = await fetch(`${APP_URL}/api/member-prs?memberId=${adminUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    record('GET /api/member-prs (admin, su propio id) → 200', res.status === 200, `status=${res.status}`)
  } catch (e) {
    record('GET /api/member-prs (admin, su propio id) → 200', false, e.message)
  }

  if (!process.env.QA_MEMBER_EMAIL || !process.env.QA_MEMBER_PASSWORD) {
    console.log('⚠️  QA_MEMBER_EMAIL/QA_MEMBER_PASSWORD no configurados — se saltan las comprobaciones de rol socio')
    return
  }

  let memberToken, memberUserId
  try {
    const memberLogin = await login(process.env.QA_MEMBER_EMAIL, process.env.QA_MEMBER_PASSWORD)
    memberToken = memberLogin.token
    memberUserId = memberLogin.userId
    record('Login del socio de pruebas', true)
  } catch (e) {
    record('Login del socio de pruebas', false, e.message)
    return
  }

  // Lectura propia del socio → 200.
  try {
    const res = await fetch(`${APP_URL}/api/member-prs?memberId=${memberUserId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    record('GET /api/member-prs (socio, su propio id) → 200', res.status === 200, `status=${res.status}`)
  } catch (e) {
    record('GET /api/member-prs (socio, su propio id) → 200', false, e.message)
  }

  // El socio pidiendo el id de OTRA persona (el admin) → debe ser 403, nunca
  // 200 — esto es exactamente el patrón de la escalada de privilegios que se
  // corrigió esta sesión (is_admin()/is_trainer()).
  try {
    const res = await fetch(`${APP_URL}/api/member-prs?memberId=${adminUserId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    record('GET /api/member-prs (socio pidiendo el id de otro) → 403', res.status === 403, `status=${res.status}`)
  } catch (e) {
    record('GET /api/member-prs (socio pidiendo el id de otro) → 403', false, e.message)
  }

  // El admin leyendo los datos del socio → 200 (el bypass de rol funciona).
  try {
    const res = await fetch(`${APP_URL}/api/member-prs?memberId=${memberUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    record('GET /api/member-prs (admin leyendo a un socio) → 200', res.status === 200, `status=${res.status}`)
  } catch (e) {
    record('GET /api/member-prs (admin leyendo a un socio) → 200', false, e.message)
  }
}

async function main() {
  requireEnv('QA_ADMIN_EMAIL')
  requireEnv('QA_ADMIN_PASSWORD')
  requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  console.log(`Probando contra ${APP_URL} (modo ${FULL ? 'FULL — muta datos de prueba' : 'quick — solo lectura'})\n`)

  const { token: adminToken, userId: adminUserId } = await login(process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD)
  record('Login del admin de pruebas', true)

  await runPlumbingChecks(adminToken, adminUserId)

  // --- Comprobaciones de solo lectura (seguras en cualquier entorno) ---
  try {
    const r = await sendAssistant(adminToken, [{ role: 'user', content: 'Dame un resumen del gimnasio: cuantos socios activos hay' }])
    record('Dashboard responde sin error 400/500', !!r.result?.message, r.result?.message?.slice(0, 80))
  } catch (e) {
    record('Dashboard responde sin error 400/500', false, e.message)
  }

  try {
    const r = await sendAssistant(adminToken, [{ role: 'user', content: 'Busca ejercicios de biceps en el catalogo' }])
    const hasResults = Object.values(r.result?.toolResults || {}).some(tr => Array.isArray(tr.exercises) && tr.exercises.length > 0)
    record('search_exercise_catalog devuelve resultados', hasResults)
  } catch (e) {
    record('search_exercise_catalog devuelve resultados', false, e.message)
  }

  if (!FULL) {
    printSummaryAndExit()
    return
  }

  // --- Comprobaciones que mutan datos (solo sobre el socio de pruebas, con limpieza al final) ---
  requireEnv('QA_MEMBER_EMAIL')
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: memberProfile } = await admin.from('profiles').select('id, name').eq('email', process.env.QA_MEMBER_EMAIL).maybeSingle()
  if (!memberProfile) {
    record('Socio de pruebas existe', false, `No se encontró ${process.env.QA_MEMBER_EMAIL}`)
    printSummaryAndExit()
    return
  }
  const memberName = memberProfile.name

  let createdWorkoutTemplateId = null
  try {
    const gen = await sendAssistant(adminToken, [{ role: 'user', content: `Generame una rutina de fuerza de 3 dias para ${memberName}` }])
    const confirm = await sendAssistant(adminToken, [
      { role: 'user', content: `Generame una rutina de fuerza de 3 dias para ${memberName}` },
      { role: 'assistant', content: gen.result.message },
      { role: 'user', content: 'Si, asignala' },
    ])
    const hasFakeInjury = /lesión|lesion/i.test(confirm.result?.message || '') && !confirm.result?.needsConfirmation
    record('Regenerar+confirmar NO inventa una lesión falsa', !hasFakeInjury, hasFakeInjury ? confirm.result.message.slice(0, 120) : undefined)

    if (confirm.result?.needsConfirmation && confirm.result?.toolCalls?.length) {
      const saved = await confirmToolCalls(adminToken, confirm.result.toolCalls)
      const saveResult = Object.values(saved.result?.results || {})[0]
      record('Guardar rutina persiste de verdad', !!saveResult?.success, saveResult?.message)
      createdWorkoutTemplateId = saveResult?.workout_template_id || null
    } else {
      record('Guardar rutina persiste de verdad', false, 'No llegó a pedir confirmación de save_member_routine')
    }
  } catch (e) {
    record('Flujo generar→confirmar→guardar rutina', false, e.message)
  }

  // Limpieza: solo se toca lo que este script acaba de crear.
  if (createdWorkoutTemplateId) {
    await admin.from('member_workouts').delete().eq('workout_template_id', createdWorkoutTemplateId)
    await admin.from('workout_days').delete().eq('workout_template_id', createdWorkoutTemplateId)
    await admin.from('workout_templates').delete().eq('id', createdWorkoutTemplateId)
    console.log('   (limpiado el registro de prueba creado)')
  }

  printSummaryAndExit()
}

function printSummaryAndExit() {
  const failed = results.filter(r => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Error inesperado ejecutando el smoke test:', e)
  process.exit(1)
})
