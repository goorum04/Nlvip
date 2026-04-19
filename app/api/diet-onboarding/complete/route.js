import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/webpush'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// POST /api/diet-onboarding/complete
// Called when admin/trainer CONFIRMS and assigns the reviewed draft
export async function POST(req) {
  try {
    const { requestId, memberId, responses, macros, fullDietContent } = await req.json()

    if (!requestId || !memberId || !responses || !macros || !fullDietContent) {
      return NextResponse.json({ error: 'Datos incompletos para completar asignación' }, { status: 400 })
    }

    // 1. Get member profile for diet name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', memberId)
      .single()

    const rawName = (profile?.name && profile.name.trim() !== '') 
      ? profile.name.trim()
      : (profile?.email ? profile.email.split('@')[0] : 'Socio')
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
    
    // 2. We skip OpenAI since the admin already passed the manipulated `fullDietContent`.

    // 3. Get admin for created_by
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single()

    // 4. Save as diet_template and assign to member using RPC (SECURITY DEFINER)
    const dietName = `Dieta personalizada (${name})`
    
    // Ejecuta el procedimiento que guarda y asigna oficialmente al usuario
    const { data: generatedDietId, error: rpcError } = await supabase.rpc('complete_diet_onboarding', {
      p_member_id: memberId,
      p_request_id: requestId,
      p_diet_name: dietName,
      p_calories: macros.calories,
      p_protein_g: macros.protein_g,
      p_carbs_g: macros.carbs_g,
      p_fat_g: macros.fat_g,
      p_content: fullDietContent,
      p_admin_id: adminProfile?.id,
      p_responses: responses
    })

    if (rpcError) throw new Error('Error en el proceso de guardado: ' + rpcError.message)

    const newDietId = generatedDietId

    // 5. Get requester info for generate-recipe-plan
    const { data: reqData } = await supabase
      .from('diet_onboarding_requests')
      .select('requested_by')
      .eq('id', requestId)
      .single()

    // 6. Notify the member that their diet plan is ready
    try {
      await sendPushToUser(supabase, memberId, {
        title: '¡Tu plan nutricional está listo!',
        body: `${dietName} ha sido asignado a tu cuenta. ¡Échale un vistazo!`,
        url: '/nutrition',
        icon: '/icons/icon-192x192.png',
      })
    } catch (e) {
      console.warn('Could not send push notification:', e.message)
    }

    // 7. Also generate recipe plan
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/generate-recipe-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          dietId: newDietId,
          trainerId: reqData?.requested_by
        })
      })
    } catch (e) {
      console.warn('Could not generate recipe plan:', e.message)
    }

    return NextResponse.json({
      success: true,
      message: '¡Tu plan nutricional modificado ha sido guardado y asignado!',
      dietName,
      macros
    })

  } catch (error) {
    console.error('diet-onboarding/complete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
