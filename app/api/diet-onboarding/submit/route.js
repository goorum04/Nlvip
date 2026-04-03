import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// POST /api/diet-onboarding/submit
// Called when member submits the questionnaire (approvance pending)
export async function POST(req) {
  try {
    const { requestId, memberId, responses } = await req.json()

    if (!requestId || !memberId || !responses) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Update the request with answers and set status to 'submitted'
    // Status 'submitted' means it's waiting for Admin review
    const { error } = await supabase
      .from('diet_onboarding_requests')
      .update({
        responses,
        status: 'submitted',
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (error) throw error

    // Persist health & measurement data to member profile so the AI always has it
    const weightKg = parseFloat(responses['Medida - Peso']) || null
    const heightCm = parseFloat(responses['Medida - Altura']) || null
    const allergies = responses.restricciones || null
    const medicalConditions = responses.condicion_medica || null

    const profileUpdate = {}
    if (weightKg) profileUpdate.weight_kg = weightKg
    if (heightCm) profileUpdate.height_cm = heightCm
    if (allergies && allergies !== 'ninguna') profileUpdate.allergies = allergies
    if (medicalConditions && medicalConditions !== 'ninguna') profileUpdate.medical_conditions = medicalConditions

    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from('profiles').update(profileUpdate).eq('id', memberId)
    }

    return NextResponse.json({
      success: true,
      message: 'Tu cuestionario ha sido enviado al administrador. Te avisaremos cuando tu plan esté listo.'
    })

  } catch (error) {
    console.error('diet-onboarding/submit error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
