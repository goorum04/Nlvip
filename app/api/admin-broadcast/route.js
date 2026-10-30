import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(5).max(300),
  url: z.string().max(300).optional(),
  // 'new_version' solo marca el aviso como prioritario en la pestaña Avisos.
  kind: z.enum(['general', 'new_version']).optional().default('general'),
})

// POST /api/admin-broadcast  { title, body, url?, kind? }
// Aviso a TODOS los socios: push (iPhone/Android y web) + un aviso en la
// pestaña "Avisos" (trainer_notices con member_id NULL = para todos).
// Solo admin.
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    const { title, body, url, kind } = parsed.data

    const { data: members, error: mErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'member')
      .not('email', 'like', '%@nlvipnutrition.internal')
    if (mErr) throw new Error(mErr.message)

    const { error: nErr } = await supabase.from('trainer_notices').insert({
      trainer_id: user.id,
      member_id: null,
      title,
      message: body,
      priority: kind === 'new_version' ? 'high' : 'normal',
    })
    if (nErr) throw new Error(`No se pudo crear el aviso: ${nErr.message}`)

    const payload = { title, body, url: url || '/', icon: '/icons/icon-192x192.png' }
    let sent = 0
    let failed = 0
    for (const m of members || []) {
      try {
        const r = await sendNativePush(supabase, m.id, payload)
        sent += r?.sent || 0
        failed += r?.failed || 0
        await sendPushToUser(supabase, m.id, payload).catch(() => {})
      } catch (e) {
        failed++
        console.warn('[admin-broadcast] push error', m.id, e.message)
      }
    }

    return NextResponse.json({ success: true, members: members?.length || 0, pushSent: sent, pushFailed: failed })
  } catch (error) {
    console.error('admin-broadcast error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
