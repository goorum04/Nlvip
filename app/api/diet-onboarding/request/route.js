import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authUtils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// POST /api/diet-onboarding/request
// Called by admin or trainer to send the questionnaire to a member
export async function POST(req) {
  const { error: authError } = await requireAuth(req, ['admin', 'trainer'])
  if (authError) return authError

  try {
    const { memberId, requestedBy } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: 'Falta memberId' }, { status: 400 })
    }

    // Check if there's already a pending request
    const { data: existing } = await supabase
      .from('diet_onboarding_requests')
      .select('id, status')
      .eq('member_id', memberId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ 
        success: true, 
        alreadyExists: true,
        message: 'Ya hay un formulario pendiente para este socio.' 
      })
    }

    // Create the request
    const { data, error } = await supabase
      .from('diet_onboarding_requests')
      .insert({ member_id: memberId, requested_by: requestedBy, status: 'pending' })
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
    return NextResponse.json({ error: 'Error al enviar el cuestionario' }, { status: 500 })
  }
}
