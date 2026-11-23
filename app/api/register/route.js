import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'

// POST /api/register
// Alta de socios desde el servidor, con captcha (Cloudflare Turnstile).
//
// Antes la app llamaba directamente a supabase.auth.signUp desde el
// navegador, y un programa automático creó cuentas de prueba en bucle (18 y
// 20/11). Ahora el alta pasa por aquí: se comprueba el captcha y un límite de
// altas por IP, y se crea el usuario con la clave de servicio. Cuando todas
// las apps instaladas usen esta ruta, se puede desactivar el registro
// público en Supabase (Authentication → Sign In / Providers → "Allow new
// users to sign up") sin afectar a los inicios de sesión.

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(6).max(200),
  name: z.string().trim().min(1).max(120),
  sex: z.enum(['male', 'female', 'other']).optional().nullable(),
  invitationCode: z.string().trim().max(60).optional().nullable(),
  captchaToken: z.string().max(4096).optional().nullable(),
})

function clientIp(req) {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true, skipped: true }
  if (!token) return { ok: false }
  const body = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'unknown') body.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
  const data = await res.json().catch(() => ({}))
  return { ok: data.success === true }
}

export async function POST(req) {
  try {
    const ip = clientIp(req)
    const limit = await checkRateLimit(`register:${ip}`, 5, 60 * 60_000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Demasiados intentos de registro. Inténtalo más tarde.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Revisa los datos del formulario.' }, { status: 400 })
    }
    const { email, password, name, sex, invitationCode, captchaToken } = parsed.data

    const captcha = await verifyTurnstile(captchaToken, ip)
    if (!captcha.ok) {
      return NextResponse.json({ error: 'No hemos podido comprobar que no eres un robot. Vuelve a intentarlo.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        sex: sex || null,
        invitation_code: invitationCode ? invitationCode.toUpperCase() : null,
      },
    })

    if (error) {
      const msg = /already|registered|exists/i.test(error.message)
        ? 'Ya existe una cuenta con este email. Prueba a iniciar sesión.'
        : 'No se pudo crear la cuenta. Inténtalo de nuevo.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err) {
    console.error('[register] unexpected error:', err)
    return NextResponse.json({ error: 'Error inesperado al crear la cuenta.' }, { status: 500 })
  }
}
