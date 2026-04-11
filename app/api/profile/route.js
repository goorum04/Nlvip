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
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .upsert([{ id, ...updates }], { onConflict: 'id' })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
