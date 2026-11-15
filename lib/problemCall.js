// Llamada de voz para avisar de un problema enviado desde la app.
// Usa Twilio (API REST, sin SDK). Si faltan las variables de entorno no llama
// y devuelve 'not_configured': el problema queda guardado igualmente.
//
// Variables (en Vercel):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  → credenciales de la cuenta
//   TWILIO_FROM_NUMBER                     → número de Twilio que llama (+34...)
//   PROBLEM_REPORT_PHONE                   → teléfono que recibe la llamada (+34...)

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function problemCallConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && process.env.PROBLEM_REPORT_PHONE)
}

export async function callAboutProblem(spokenText) {
  if (!problemCallConfigured()) return 'not_configured'
  const sid = process.env.TWILIO_ACCOUNT_SID
  const say = `<Say language="es-ES" voice="Polly.Lucia-Neural">${esc(spokenText)}</Say>`
  // Se lee dos veces, con una pausa, por si se descuelga tarde.
  const twiml = `<Response><Pause length="1"/>${say}<Pause length="2"/><Say language="es-ES" voice="Polly.Lucia-Neural">Repito.</Say>${say}</Response>`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: process.env.PROBLEM_REPORT_PHONE, From: process.env.TWILIO_FROM_NUMBER, Twiml: twiml }),
    })
    if (!res.ok) {
      console.error('Twilio call failed:', res.status, (await res.text()).slice(0, 300))
      return `failed_${res.status}`
    }
    return 'called'
  } catch (e) {
    console.error('Twilio call error:', e.message)
    return 'failed_network'
  }
}
