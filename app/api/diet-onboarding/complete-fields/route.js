import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/diet-onboarding/complete-fields
// Rellena SOLO los campos sueltos que le faltaban al socio en su cuestionario
// ya enviado (edad, favoritos, lesión...), sin tocar el resto de respuestas.
// Las fotos se suben directo desde el cliente a storage + progress_photos
// (mismo camino que OnboardingPhotosCard); aquí solo se actualizan campos de texto.
export async function POST(req) {
  const supabaseAdmin = getSupabase()
  try {
    const token = req.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { memberId, fields } = await req.json()
    if (!memberId || !fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Solo el propio socio o admin/trainer pueden completar estos datos.
    if (user.id !== memberId) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin' && profile?.role !== 'trainer') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    }

    // Último cuestionario del socio (el banner solo se ofrece si ya envió uno)
    const { data: request, error: reqError } = await supabaseAdmin
      .from('diet_onboarding_requests')
      .select('id, responses')
      .eq('member_id', memberId)
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reqError) throw reqError
    if (!request) return NextResponse.json({ error: 'Este socio no tiene ningún cuestionario enviado' }, { status: 404 })

    const mergedResponses = { ...(request.responses || {}), ...fields }

    const { error: updateError } = await supabaseAdmin
      .from('diet_onboarding_requests')
      .update({ responses: mergedResponses })
      .eq('id', request.id)

    if (updateError) throw updateError

    // Igual que en /submit: mantener el perfil sincronizado con lo último
    // que el socio ha dado, para que el resto de la app (asistente admin,
    // generación de dietas/rutinas) lo tenga sin depender solo del jsonb.
    const profileUpdate = {}
    const weightKg = parseFloat(fields['Medida - Peso'])
    const heightCm = parseFloat(fields['Medida - Altura'])
    const ageYears = parseInt(fields['Medida - Edad'])
    if (Number.isFinite(weightKg) && weightKg > 0) profileUpdate.weight_kg = weightKg
    if (Number.isFinite(heightCm) && heightCm > 0) profileUpdate.height_cm = heightCm
    if (Number.isFinite(ageYears) && ageYears > 0 && ageYears < 120) {
      profileUpdate.birth_date = `${new Date().getFullYear() - ageYears}-01-01`
    }

    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', memberId)
    }

    return NextResponse.json({ success: true, responses: mergedResponses })
  } catch (error) {
    console.error('diet-onboarding/complete-fields error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
