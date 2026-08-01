import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const limit = await checkRateLimit(getIdentifier(request), 30, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
        { status: 429 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    const callerRole = callerProfile?.role
    if (callerRole !== 'admin' && callerRole !== 'trainer') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!audio || typeof audio === 'string') {
      return NextResponse.json({ error: 'Falta el archivo de audio' }, { status: 400 })
    }

    const sizeBytes = audio.size || 0
    if (sizeBytes <= 0) {
      return NextResponse.json({ error: 'Audio vacío' }, { status: 400 })
    }
    const MAX_BYTES = 25 * 1024 * 1024
    if (sizeBytes > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio demasiado grande (máx. 25MB)' }, { status: 413 })
    }

    const openai = new OpenAI({ apiKey })

    const fileForOpenAI = audio instanceof File
      ? audio
      : new File([audio], 'audio.webm', { type: audio.type || 'audio/webm' })

    // El prompt no transcribe nada por sí mismo, pero le da a Whisper
    // vocabulario y nombres que de otra forma tiende a transcribir mal
    // (jerga de gimnasio, términos técnicos de dieta/rutina, nombres propios
    // frecuentes en el club) — reduce bastante el "no entiende lo que digo".
    const transcription = await openai.audio.transcriptions.create({
      file: fileForOpenAI,
      model: 'whisper-1',
      language: 'es',
      response_format: 'json',
      prompt: 'NL VIP Team, gimnasio, entrenador, socio, rutina, bi-serie, tri-serie, hipertrofia, definición, volumen, pérdida de grasa, series, repeticiones, descanso, dieta, macros, proteína, carbohidratos, TDEE, déficit calórico, recomposición corporal.',
    })

    const text = (transcription?.text || '').trim()

    return NextResponse.json({ success: true, text })
  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'transcribe-audio' } })
    console.error('Transcribe audio error:', error)
    const status = error?.status === 401 ? 401 : (error?.status === 429 ? 429 : 500)
    return NextResponse.json(
      { error: error.message || 'Error al transcribir el audio' },
      { status }
    )
  }
}
