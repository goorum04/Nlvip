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

        // Never allow clients to promote themselves or change ownership fields.
        // Only admins can change role/trainer_id.
        const SELF_FORBIDDEN = ['role', 'trainer_id', 'is_premium', 'premium_until']
        if (!isAdmin) {
            for (const field of SELF_FORBIDDEN) delete updates[field]
        }

        // Never null out the email accidentally
        if ('email' in updates && !updates.email) {
            delete updates.email
        }

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

        return NextResponse.json({ success: true, data: data[0] })
    } catch (error) {
        console.error('[API Profile] Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
