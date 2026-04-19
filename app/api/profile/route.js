import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
    try {
        const body = await request.json()
        const { id, updates } = body

        console.log(`[API Profile] Update request for ID: ${id}`, { 
            fields: Object.keys(updates || {}),
            hasEmail: updates && 'email' in updates
        })

        if (!id || !updates) {
            return NextResponse.json({ error: 'Missing id or updates' }, { status: 400 })
        }

        // Hardening: Nunca permitir que el email sea null si viene en el objeto updates
        // Si el email es null o está vacío, lo eliminamos de las actualizaciones para no machacar el valor actual
        if ('email' in updates && (updates.email === null || updates.email === undefined || updates.email === '')) {
            console.warn(`[API Profile] Warning: Attempted to nullify email for user ${id}. Field removed from updates.`)
            delete updates.email
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

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
            console.warn(`[API Profile] No profile found to update for ID: ${id}`)
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        console.log(`[API Profile] Successfully updated user ${id}`)
        return NextResponse.json({ success: true, data: data[0] })
    } catch (error) {
        console.error('[API Profile] Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
