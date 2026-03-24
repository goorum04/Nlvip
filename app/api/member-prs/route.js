import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId') || user.id
    const exerciseName = searchParams.get('exerciseName')

    let query = supabase
      .from('member_prs')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false })

    if (exerciseName) {
      query = query.eq('exercise_name', exerciseName)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error GET member-prs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { exercise_name, weight_kg, reps, date } = body

    if (!exercise_name || !weight_kg) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    // Calcular 1RM estimado usando la fórmula de Brzycki
    // 1RM = weight / (1.0278 - (0.0278 * reps))
    const estimated_1rm = reps > 1 
      ? (weight_kg / (1.0278 - (0.0278 * reps))).toFixed(2)
      : weight_kg

    const { data, error } = await supabase
      .from('member_prs')
      .insert({
        member_id: user.id,
        exercise_name,
        weight_kg,
        reps: reps || 1,
        estimated_1rm,
        date: date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error POST member-prs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
