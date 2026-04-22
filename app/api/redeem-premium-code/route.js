import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST /api/redeem-premium-code
// Body: { code: string }
// Header: Authorization: Bearer <supabase-access-token>
//
// Validates the invitation code, marks the caller as premium, increments
// the code's usage counter, assigns the caller to the trainer that owns
// the code (if any), and creates a pending diet_onboarding_requests row
// so the diet questionnaire banner appears in the member dashboard.
//
// Called from:
//   - app/page.js (handleRegister, right after supabase.auth.signUp)
//   - MemberDashboard.jsx ("Canjear código premium" button, for members
//     who signed up before this endpoint existed or whose redeem call
//     failed the first time)
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawCode = (body.code || '').trim().toUpperCase()
    if (!rawCode) {
      return NextResponse.json({ error: 'Falta el código' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { data: code, error: codeError } = await supabaseAdmin
      .from('invitation_codes')
      .select('code, trainer_id, max_uses, current_uses, expires_at, is_active')
      .eq('code', rawCode)
      .maybeSingle()

    if (codeError) {
      console.error('[redeem-premium-code] lookup error:', codeError)
      return NextResponse.json({ error: 'Error al comprobar el código' }, { status: 500 })
    }
    if (!code) {
      return NextResponse.json({ error: 'Código no válido' }, { status: 400 })
    }
    if (code.is_active === false) {
      return NextResponse.json({ error: 'Este código ha sido desactivado' }, { status: 400 })
    }
    if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este código ha caducado' }, { status: 400 })
    }
    if (typeof code.max_uses === 'number' && typeof code.current_uses === 'number'
        && code.current_uses >= code.max_uses) {
      return NextResponse.json({ error: 'Este código ya se ha usado el máximo de veces' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, has_premium')
      .eq('id', caller.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (profile.has_premium === true) {
      return NextResponse.json({ success: true, alreadyPremium: true })
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_premium: true })
      .eq('id', caller.id)

    if (updateError) {
      console.error('[redeem-premium-code] could not mark premium:', updateError)
      return NextResponse.json({ error: 'No se pudo activar premium' }, { status: 500 })
    }

    // Increment usage counter. Non-fatal if it fails — the user is already premium.
    await supabaseAdmin
      .from('invitation_codes')
      .update({ current_uses: (code.current_uses || 0) + 1 })
      .eq('code', rawCode)
      .then(({ error }) => {
        if (error) console.warn('[redeem-premium-code] could not bump current_uses:', error.message)
      })

    // Assign to trainer if the code has one.
    if (code.trainer_id) {
      await supabaseAdmin
        .from('trainer_members')
        .upsert(
          { trainer_id: code.trainer_id, member_id: caller.id },
          { onConflict: 'trainer_id,member_id' }
        )
        .then(({ error }) => {
          if (error) console.warn('[redeem-premium-code] could not attach trainer:', error.message)
        })
    }

    // Create pending diet onboarding request so the questionnaire banner
    // appears for the newly-premium member. If one already exists pending,
    // do nothing.
    const { data: existingReq } = await supabaseAdmin
      .from('diet_onboarding_requests')
      .select('id, status')
      .eq('member_id', caller.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const existing = existingReq?.[0]
    if (!existing || existing.status !== 'pending') {
      if (existing) {
        await supabaseAdmin
          .from('diet_onboarding_requests')
          .update({ status: 'pending', requested_by: code.trainer_id || caller.id })
          .eq('id', existing.id)
      } else {
        await supabaseAdmin
          .from('diet_onboarding_requests')
          .insert({
            member_id: caller.id,
            requested_by: code.trainer_id || caller.id,
            status: 'pending',
          })
      }
    }

    return NextResponse.json({ success: true, premium: true })
  } catch (err) {
    console.error('[redeem-premium-code] unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: 500 })
  }
}
