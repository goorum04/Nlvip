import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        const body = await request.json()
        const { id, updates } = body

        if (!id || !updates) {
            return NextResponse.json({ error: 'Missing id or updates' }, { status: 400 })
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Require a Bearer token so we can verify the caller
        const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
        if (!token) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (authError || !caller) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
        }

        // Only self or admin can update a profile
        let isAdmin = false
        if (caller.id !== id) {
            const { data: callerProfile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', caller.id)
                .maybeSingle()
            isAdmin = callerProfile?.role === 'admin'
            if (!isAdmin) {
                return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
            }
        }

        // Fields that NOBODY can change via this endpoint (not even admins):
        // - id: primary key, changing it would orphan related rows
        // - email: managed by Supabase Auth, not by the profiles row
        // - created_at: historical timestamp
        const ALWAYS_FORBIDDEN = ['id', 'email', 'created_at']
        for (const field of ALWAYS_FORBIDDEN) delete updates[field]

        // Only admins can change role/trainer_id/premium status and the
        // progress-reminder cadence (configured from the admin member panel).
        const SELF_FORBIDDEN = ['role', 'trainer_id', 'is_premium', 'premium_until', 'progress_reminder_days']
        if (!isAdmin) {
            for (const field of SELF_FORBIDDEN) delete updates[field]
        }

        // last_progress_reminder_at is only ever written by the cron job,
        // never by any interactive caller (admin or member).
        delete updates.last_progress_reminder_at

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()

        if (error) {
            console.error(`[API Profile] Database error updating user ${id}:`, error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        // Mirror the member's weight into progress_records so the stats
        // chart picks it up. progress_records is the canonical history
        // source for the weight chart; updating only profiles.weight_kg
        // would leave the chart empty.
        //
        // We compare against the latest progress_record for this member
        // (not the old profile value) so the first time a weight is set
        // it always lands in history, and subsequent saves without a
        // change don't create duplicate rows.
        if (typeof updates.weight_kg !== 'undefined' && updates.weight_kg !== null) {
            const newWeight = Number(updates.weight_kg)
            if (!Number.isNaN(newWeight)) {
                const { data: latest } = await supabaseAdmin
                    .from('progress_records')
                    .select('weight_kg')
                    .eq('member_id', id)
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                const latestWeight = latest?.weight_kg !== undefined && latest?.weight_kg !== null
                    ? Number(latest.weight_kg)
                    : null

                if (latestWeight !== newWeight) {
                    const { error: progressError } = await supabaseAdmin
                        .from('progress_records')
                        .insert({
                            member_id: id,
                            date: new Date().toISOString(),
                            weight_kg: newWeight,
                        })
                    if (progressError) {
                        // Non-fatal: the profile update already succeeded. Just log it.
                        console.warn(`[API Profile] Could not mirror weight to progress_records:`, progressError.message)
                    }
                }
            }
        }

        return NextResponse.json({ success: true, data: data[0] })
    } catch (error) {
        console.error('[API Profile] Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
