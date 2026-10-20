import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIdentifier } from '@/lib/rateLimit'
import { sendNativePush } from '@/lib/push'
import { sendPushToUser } from '@/lib/webpush'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const schema = z.object({
  postId: z.string().uuid().optional().nullable(),
  commentId: z.string().uuid().optional().nullable(),
  reason: z.string().min(1).max(500),
}).refine(d => d.postId || d.commentId, { message: 'Falta postId o commentId' })

// POST /api/feed/report
// Un socio denuncia un post o comentario del feed. Se guarda la denuncia y
// se avisa por push a los admins para que la revisen (Guideline 1.2).
export async function POST(req) {
  const supabase = getSupabase()
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })

    const limit = await checkRateLimit(getIdentifier(req), 20, 60_000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { postId, commentId, reason } = parsed.data

    const { error: insertError } = await supabase.from('feed_reports').insert({
      post_id: postId || null,
      comment_id: commentId || null,
      reporter_id: caller.id,
      reason,
    })
    // Ya denunciado por este mismo usuario: lo tratamos como éxito.
    if (insertError && insertError.code !== '23505') {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    try {
      const { data: reporter } = await supabase.from('profiles').select('name').eq('id', caller.id).maybeSingle()
      const { data: admins } = await supabase
        .from('profiles').select('id').eq('role', 'admin')
        .not('email', 'like', '%@nlvipnutrition.internal')
      const payload = {
        title: '🚩 Denuncia en el feed',
        body: `${reporter?.name || 'Un socio'} ha denunciado ${commentId ? 'un comentario' : 'una publicación'}: ${reason}. Revísalo en el feed.`,
        url: '/',
      }
      const notifRows = []
      for (const admin of (admins || [])) {
        await sendNativePush(supabase, admin.id, payload)
        await sendPushToUser(supabase, admin.id, { ...payload, icon: '/icons/icon-192x192.png' })
        notifRows.push({ user_id: admin.id, title: payload.title, body: payload.body, type: 'feed_report', reference_id: postId || commentId, url: payload.url })
      }
      if (notifRows.length > 0) await supabase.from('notifications').insert(notifRows)
    } catch (notifErr) {
      console.warn('[feed/report] Error notificando denuncia:', notifErr.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('feed/report error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
