import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { persistRoutine } from '@/lib/routinePersistence'

const exerciseSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.number().int().min(1).max(20),
  reps: z.union([z.string(), z.number()]).transform(v => String(v)),
  rest_seconds: z.number().int().min(0).max(600),
  superset_group: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional()
})

const daySchema = z.object({
  day_number: z.number().int().min(1).max(7),
  day_name: z.string().min(1),
  exercises: z.array(exerciseSchema)
})

const routineSchema = z.object({
  routine_name: z.string().min(1).max(120),
  routine_description: z.string().max(500).nullable().optional(),
  days: z.array(daySchema).min(1).max(7)
})

const bodySchema = z.object({
  trainer_id: z.string().uuid().optional().nullable(),
  member_id: z.string().uuid().optional().nullable(),
  routine: routineSchema
})

export async function POST(request) {
  try {
    const limit = await checkRateLimit(getIdentifier(request), 30, 60_000)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
        { status: 429 }
      )
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { trainer_id, member_id, routine } = parsed.data

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

    const { data: catalog, error: catalogError } = await supabase
      .from('exercises')
      .select('name')
      .eq('is_global', true)
    if (catalogError) throw catalogError

    const catalogSet = new Set((catalog || []).map(e => e.name.trim().toLowerCase()))
    const invalid = []
    for (const day of routine.days) {
      for (const ex of day.exercises) {
        if (!catalogSet.has(ex.exercise_name.trim().toLowerCase())) {
          invalid.push({ day: day.day_name, name: ex.exercise_name })
        }
      }
    }
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Algunos ejercicios no están en el catálogo: ${invalid.map(i => i.name).join(', ')}`,
          invalid
        },
        { status: 400 }
      )
    }

    const template = await persistRoutine(supabase, {
      trainerId: trainer_id || caller.id,
      routine
    })

    return NextResponse.json({
      success: true,
      workout_template_id: template.id
    })

  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'save-routine' } })
    console.error('Save routine error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al guardar la rutina' },
      { status: 500 }
    )
  }
}
