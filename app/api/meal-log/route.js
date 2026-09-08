import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const VALID_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getAuthedUser(req, supabase) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// Marca (o desmarca) una comida como "ya comida" hoy, en la zona horaria del gimnasio.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const user = await getAuthedUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { mealSlot, date } = await req.json()
    if (!VALID_SLOTS.includes(mealSlot)) {
      return NextResponse.json({ error: 'mealSlot inválido' }, { status: 400 })
    }
    const day = date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

    const { error } = await supabase
      .from('meal_logs')
      .upsert({ member_id: user.id, date: day, meal_slot: mealSlot, logged_at: new Date().toISOString() }, { onConflict: 'member_id,date,meal_slot' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('meal-log POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const supabase = getSupabase()
  try {
    const user = await getAuthedUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { mealSlot, date } = await req.json()
    if (!VALID_SLOTS.includes(mealSlot)) {
      return NextResponse.json({ error: 'mealSlot inválido' }, { status: 400 })
    }
    const day = date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

    const { error } = await supabase
      .from('meal_logs')
      .delete()
      .eq('member_id', user.id)
      .eq('date', day)
      .eq('meal_slot', mealSlot)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('meal-log DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Devuelve qué comidas de hoy ya están marcadas, para pintar el estado al cargar.
export async function GET(req) {
  const supabase = getSupabase()
  try {
    const user = await getAuthedUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const day = searchParams.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

    const { data, error } = await supabase
      .from('meal_logs')
      .select('meal_slot, logged_at')
      .eq('member_id', user.id)
      .eq('date', day)

    if (error) throw error
    return NextResponse.json({ date: day, logs: data || [] })
  } catch (error) {
    console.error('meal-log GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
