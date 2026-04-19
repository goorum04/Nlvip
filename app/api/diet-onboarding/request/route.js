import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST /api/diet-onboarding/request
// Called by admin/trainer to send the questionnaire to a member, or by the member themselves at registration
export async function POST(req) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  try {
    // Verificar autenticación
    const token = req.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { memberId, requestedBy } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: 'Falta memberId' }, { status: 400 })
    }

    // Verificar que el usuario es el propio miembro (auto-registro) o admin/trainer
    if (user.id !== memberId) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin' && profile?.role !== 'trainer') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    }

    // Check if there's ANY existing request for this member
    const { data: existingData } = await supabaseAdmin
      .from('diet_onboarding_requests')
      .select('id, status')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(1)
      
    const existing = existingData?.[0]

    if (existing) {
      if (existing.status === 'pending') {
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          requestId: existing.id,
          message: 'Ya hay un formulario pendiente para este socio.'
        })
      }

      // If it exists but is completed/submitted, we reset it to pending to act as a new request
      const { error: updateError } = await supabaseAdmin
        .from('diet_onboarding_requests')
        .update({ status: 'pending', requested_by: requestedBy || user.id })
        .eq('id', existing.id)

      if (updateError) throw new Error(updateError.message)

      return NextResponse.json({
        success: true,
        requestId: existing.id,
        message: 'Cuestionario reenviado al socio correctamente.'
      })
    }

    // Create the request
    const { data, error } = await supabaseAdmin
      .from('diet_onboarding_requests')
      .insert({ member_id: memberId, requested_by: requestedBy || user.id, status: 'pending' })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      requestId: data.id,
      message: 'Cuestionario enviado al socio correctamente.'
    })
  } catch (error) {
    console.error('diet-onboarding/request error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
