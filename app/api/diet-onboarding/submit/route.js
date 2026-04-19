import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendNativeApplePush } from '@/lib/apn'
import { sendPushToUser } from '@/lib/webpush'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/diet-onboarding/submit
// Called when member submits the questionnaire (approvance pending)
export async function POST(req) {
  const supabaseAdmin = getSupabase()
  try {
    // Verificar autenticación
    const token = req.headers.get('Authorization')?.slice(7) || null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { requestId, memberId, responses } = await req.json()

    if (!requestId || !memberId || !responses) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Verificar que el usuario es el propio miembro o admin/trainer
    if (user.id !== memberId) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin' && profile?.role !== 'trainer') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    }

    // Update the request with answers and set status to 'submitted'
    // Status 'submitted' means it's waiting for Admin review
    const { error } = await supabaseAdmin
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
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', memberId)
    }

    // 2. NEW: Create initial progress record for charts/history
    try {
      await supabaseAdmin.from('progress_records').insert({
        member_id: memberId,
        date: new Date().toISOString(),
        weight_kg: weightKg,
        chest_cm: parseFloat(responses['Medida - Pecho']) || null,
        waist_cm: parseFloat(responses['Medida - Cintura']) || null,
        hips_cm: parseFloat(responses['Medida - Cadera']) || null,
        arms_cm: parseFloat(responses['Medida - Bíceps']) || null,
        legs_cm: parseFloat(responses['Medida - Muslo']) || null,
        glutes_cm: parseFloat(responses['Medida - Glúteo']) || null,
        calves_cm: parseFloat(responses['Medida - Gemelo']) || null,
        notes: 'Medidas iniciales (desde cuestionario)'
      })
    } catch (err) {
      console.warn('Failed to insert initial progress record:', err)
      // Non-blocking
    }

    // Notify admin: socio ha completado el cuestionario
    try {
      // Obtener nombre del socio
      const { data: memberProfile } = await supabaseAdmin
        .from('profiles')
        .select('name, email')
        .eq('id', memberId)
        .single()
      const memberName = memberProfile?.name || memberProfile?.email?.split('@')[0] || 'Un socio'

      // Obtener admin
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()

      if (adminProfile?.id) {
        const notifPayload = {
          title: '📋 Cuestionario completado',
          body: `${memberName} ha rellenado el formulario nutricional. ¡Ya puedes preparar su plan!`,
          url: '/admin/nutrition',
        }
        // Push nativo (iOS)
        await sendNativeApplePush(supabaseAdmin, adminProfile.id, notifPayload)
        // Web Push (PWA)
        await sendPushToUser(supabaseAdmin, adminProfile.id, { ...notifPayload, icon: '/icons/icon-192x192.png' })
      }
    } catch (notifErr) {
      console.warn('[Push] Error notificando admin:', notifErr.message)
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
