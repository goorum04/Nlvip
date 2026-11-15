import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '@/lib/rateLimit'
import { callAboutProblem } from '@/lib/problemCall'

export const maxDuration = 30

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  message: z.string().trim().min(5, 'Cuéntanos un poco más qué ha pasado').max(2000),
  context: z.object({
    screen: z.string().max(120).optional(),
    appVersion: z.string().max(60).optional(),
    platform: z.string().max(40).optional(),
    device: z.string().max(300).optional(),
    errors: z.array(z.string().max(300)).max(5).optional(),
  }).optional(),
})

const ROLE = { member: 'socio', trainer: 'entrenador', admin: 'administrador' }

// La IA convierte el mensaje en un aviso corto para leer por teléfono.
async function summarize({ name, role, message, context }) {
  const fallback = { severity: 'media', spoken: `${name}, ${role}, informa de un problema en la app: ${message.slice(0, 280)}` }
  if (!process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const res = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Un usuario de la app de un gimnasio ha enviado este aviso de un problema. Resúmelo para LEERLO EN VOZ ALTA por teléfono al responsable técnico.

Usuario: ${name} (${role})
Pantalla: ${context?.screen || 'desconocida'} · Plataforma: ${context?.platform || 'desconocida'} · Versión: ${context?.appVersion || 'desconocida'}
Errores técnicos recientes: ${(context?.errors || []).join(' | ') || 'ninguno'}
Mensaje del usuario: """${message}"""

Responde SOLO con JSON: {"severity":"alta|media|baja","spoken":"..."}.
- "spoken": 2 o 3 frases en español, naturales al oído, sin símbolos ni siglas raras: quién es, qué le pasa, en qué pantalla y dispositivo. No inventes nada que no esté en el mensaje.
- "severity": alta si no puede usar la app o pierde datos; media si falla una función; baja si es una duda o un detalle.` }],
    })
    const text = res.content?.[0]?.text || ''
    const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    if (!j.spoken) return fallback
    return { severity: ['alta', 'media', 'baja'].includes(j.severity) ? j.severity : 'media', spoken: String(j.spoken).slice(0, 700) }
  } catch (e) {
    console.warn('report-problem summarize:', e.message)
    return fallback
  }
}

// POST /api/report-problem
// Cualquier usuario con sesión informa de un problema con la app. Se guarda,
// la IA lo resume y se avisa por llamada de voz al responsable.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })

    // Por usuario: cada aviso puede acabar en una llamada de teléfono.
    const limit = await checkRateLimit(`report-problem:${caller.id}`, 3, 15 * 60_000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Ya hemos recibido tus avisos. Espera unos minutos antes de enviar otro.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    const { message, context = {} } = parsed.data

    const { data: profile } = await supabase.from('profiles').select('name, role, app_version').eq('id', caller.id).maybeSingle()
    const name = profile?.name || 'Un usuario'
    const ctx = { ...context, appVersion: context.appVersion || profile?.app_version || undefined }
    const { severity, spoken } = await summarize({ name, role: ROLE[profile?.role] || 'socio', message, context: ctx })

    const callStatus = await callAboutProblem(`Aviso de la app NL VIP Team. Gravedad ${severity}. ${spoken}`)

    const { error: insertError } = await supabase.from('problem_reports').insert({
      user_id: caller.id, message, context: ctx, summary: spoken, severity, call_status: callStatus,
    })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('report-problem:', e)
    return NextResponse.json({ error: 'No se pudo enviar el aviso' }, { status: 500 })
  }
}
