import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Configuración de Supabase usando variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// GET /api/member-prs?memberId=xxx
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Falta el ID del miembro' }, { status: 400 })
    }

    const { data, error } = await supabase
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
    const body = await request.json()
    const { exercise_name, weight_kg, reps, date, memberId: passedMemberId } = body

    // En un entorno real, aquí verificaríamos el token de la sesión 
    // Pero siguiendo el patrón del proyecto, usaremos el ID proporcionado o el del usuario si pudiéramos obtenerlo
    // Para simplificar y mantener compatibilidad, permitimos pasar el memberId
    const memberId = passedMemberId || body.member_id

    if (!memberId || !exercise_name || !weight_kg) {
      return NextResponse.json({ error: 'Faltan datos requeridos (memberId, exercise_name, weight_kg)' }, { status: 400 })
    }

    // Calcular el 1RM estimado usando la fórmula de Brzycki
    // 1RM = Peso / (1.0278 - (0.0278 * reps))
    const estimated_1rm = (parseFloat(weight_kg) / (1.0278 - (0.0278 * parseInt(reps || 1)))).toFixed(1)

    const { data, error } = await supabase
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
