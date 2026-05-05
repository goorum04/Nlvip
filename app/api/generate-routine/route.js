import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { generateRoutineForMember } from '@/lib/routineGeneration'

const criteriaSchema = z.object({
  days_per_week: z.number().int().min(1).max(7),
  goal: z.string().min(1),
  level: z.enum(['principiante', 'intermedio', 'avanzado']),
  equipment: z.array(z.string()).optional(),
  session_duration_min: z.number().int().min(15).max(180).optional(),
  notes: z.string().max(500).optional(),
  allow_supersets: z.boolean().optional()
})

const bodySchema = z.object({
  trainer_id: z.string().uuid().optional().nullable(),
  member_id: z.string().uuid().optional().nullable(),
  criteria: criteriaSchema
})

export async function POST(request) {
  try {
    const limit = await checkRateLimit(getIdentifier(request), 10, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Inténtalo de nuevo más tarde.` },
        { status: 429 }
      )
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { trainer_id, member_id, criteria } = parsed.data

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
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    if (trainer_id && callerRole !== 'admin' && trainer_id !== caller.id) {
      return NextResponse.json({ error: 'No puedes asignar rutinas a otro entrenador' }, { status: 403 })
    }

    const { routine, replaced } = await generateRoutineForMember({
      supabase,
      member_id,
      trainer_id,
      criteria
    })

    return NextResponse.json({
      success: true,
      preview: routine,
      replaced
    })

  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'generate-routine' } })
    console.error('Generate routine error:', error)
    let errorMessage = 'Error al generar la rutina'
    let statusCode = error.status || 500

    if (error.status === 401) {
      errorMessage = 'API key de OpenAI inválida o expirada.'
    } else if (error.status === 429) {
      errorMessage = 'Límite de uso de OpenAI alcanzado. Inténtalo más tarde.'
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode })
  }
}
