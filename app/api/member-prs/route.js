import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET /api/member-prs?memberId=xxx
export async function GET(request) {
  try {
    // Verificar autenticación
    const token = request.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Falta el ID del miembro' }, { status: 400 })
    }

    // Verificar que el usuario es el propio miembro o admin/trainer
    if (user.id !== memberId) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin' && profile?.role !== 'trainer') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('member_prs')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching member PRs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/member-prs
export async function POST(request) {
  try {
    // Verificar autenticación
    const token = request.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const body = await request.json()
    const { exercise_name, weight_kg, reps, date, memberId: passedMemberId } = body
    const memberId = passedMemberId || body.member_id

    if (!memberId || !exercise_name || !weight_kg) {
      return NextResponse.json({ error: 'Faltan datos requeridos (memberId, exercise_name, weight_kg)' }, { status: 400 })
    }

    // Solo el propio miembro puede registrar sus PRs
    if (user.id !== memberId) {
      return NextResponse.json({ error: 'Solo puedes registrar tus propios PRs' }, { status: 403 })
    }

    // Calcular el 1RM estimado usando la fórmula de Brzycki
    const estimated_1rm = (parseFloat(weight_kg) / (1.0278 - (0.0278 * parseInt(reps || 1)))).toFixed(1)

    const { data, error } = await supabaseAdmin
      .from('member_prs')
      .insert([
        {
          member_id: memberId,
          exercise_name,
          weight_kg,
          reps,
          date: date || new Date().toISOString().split('T')[0],
          estimated_1rm: parseFloat(estimated_1rm)
        }
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error creating member PR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
