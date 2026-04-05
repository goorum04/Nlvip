import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authUtils'

// Configuración de Supabase usando variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/member-prs?memberId=xxx
export async function GET(request) {
  const { user, role, error: authError } = await requireAuth(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Falta el ID del miembro' }, { status: 400 })
    }

    if (!UUID_REGEX.test(memberId)) {
      return NextResponse.json({ error: 'ID de miembro inválido' }, { status: 400 })
    }

    // Verificar propiedad: solo el propio miembro, trainers o admins pueden leer
    if (user.id !== memberId) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['admin', 'trainer'].includes(profile.role)) {
        return NextResponse.json({ error: 'Sin permisos para ver estos récords' }, { status: 403 })
      }
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
    return NextResponse.json({ error: 'Error al obtener los récords' }, { status: 500 })
  }
}

// POST /api/member-prs
export async function POST(request) {
  try {
    // Verificar el token del usuario autenticado
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const { exercise_name, weight_kg, reps, date } = body

    // El memberId siempre viene del token verificado, no del body
    const memberId = user.id

    if (!exercise_name || !weight_kg) {
      return NextResponse.json({ error: 'Faltan datos requeridos (exercise_name, weight_kg)' }, { status: 400 })
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
    return NextResponse.json({ error: 'Error al guardar el récord' }, { status: 500 })
  }
}
