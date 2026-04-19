/**
 * Script de prueba manual para conectar con Apple APNs.
 * Ejecución: node scripts/test-apn.js <device_token>
 */
const apn = require('apn')
require('dotenv').config({ path: '.env.local' })

const token = process.argv[2]
if (!token) {
  console.log('Uso: node scripts/test-apn.js <device_token>')
  process.exit(1)
}

const keyContent = process.env.APNS_P8_KEY
if (!keyContent) {
  console.error('Error: No se encontró APNS_P8_KEY en .env.local')
  process.exit(1)
}

const options = {
  token: {
    key: keyContent.replace(/\\n/g, '\n'), // Manejar saltos de línea en .env
    keyId: process.env.APNS_KEY_ID || '3K7ZQD6V4Y',
    teamId: process.env.APNS_TEAM_ID || '32VQC5P7M6',
  },
  production: false, // Usar Sandbox para pruebas manuales si es necesario
}

console.log('--- Configuración APNs ---')
console.log('Key ID:', options.token.keyId)
console.log('Team ID:', options.token.teamId)
console.log('Bundle ID:', process.env.APNS_BUNDLE_ID)
console.log('Modo Prod:', options.production)
console.log('--------------------------')

const provider = new apn.Provider(options)

const note = new apn.Notification()
note.expiry = Math.floor(Date.now() / 1000) + 3600
note.badge = 3
note.sound = 'default'
note.alert = {
  title: '🚀 Prueba de Notificación',
  body: 'Si ves esto, la conexión directa con Apple funciona correctamente.',
}
note.topic = process.env.APNS_BUNDLE_ID || 'com.nlvipnutrition.app'
note.payload = { test: true }

console.log('Enviando a token:', token)

provider.send(note, token).then((result) => {
  console.log('\n--- Resultado ---')
  if (result.sent.length > 0) {
    console.log('✅ Éxito:', result.sent)
  }
  if (result.failed.length > 0) {
    console.error('❌ Error:', JSON.stringify(result.failed, null, 2))
  }
  console.log('-----------------')
  provider.shutdown()
})
