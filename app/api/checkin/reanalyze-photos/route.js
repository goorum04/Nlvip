import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { compareProgressPhotos } from '@/lib/photoAnalysis'
import { checkRateLimit } from '@/lib/rateLimit'

export const maxDuration = 60

// POST /api/checkin/reanalyze-photos  { checkinId }
// Vuelve a hacer la comparación de fotos con IA de una revisión ya enviada
// (p. ej. cuando el modelo se negó a analizarlas y el panel se quedó sin la
// comparación). Solo staff. No toca la dieta ni la rutina propuestas.
const schema = z.object({ checkinId: z.string().uuid() })

async function signedPhotos(supabase, groupId) {
  if (!groupId) return []
  const { data: rows } = await supabase
    .from('progress_photos')
    .select('photo_url, photo_type')
    .eq('group_id', groupId)
  if (!rows?.length) return []
  const { data: signed } = await supabase.storage
    .from('progress_photos')
    .createSignedUrls(rows.map(r => r.photo_url), 600)
  return (signed || [])
    .map((s, i) => ({ type: rows[i].photo_type, url: s?.signedUrl }))
    .filter(p => p.url)
}

export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!caller || !['admin', 'trainer'].includes(caller.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const limit = await checkRateLimit(`reanalyze-photos:${user.id}`, 10, 10 * 60_000)
    if (!limit.success) return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 })

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'checkinId inválido' }, { status: 400 })

    const { data: checkin } = await supabase
      .from('member_checkins')
      .select('id, member_id, photo_group_id, previous_photo_group_id')
      .eq('id', parsed.data.checkinId)
      .maybeSingle()
    if (!checkin) return NextResponse.json({ error: 'Revisión no encontrada' }, { status: 404 })

    if (caller.role === 'trainer') {
      const { data: link } = await supabase.from('trainer_members').select('id')
        .eq('trainer_id', user.id).eq('member_id', checkin.member_id).maybeSingle()
      if (!link) return NextResponse.json({ error: 'Este socio no es tuyo' }, { status: 403 })
    }

    const [newPhotos, previousPhotos] = await Promise.all([
      signedPhotos(supabase, checkin.photo_group_id),
      signedPhotos(supabase, checkin.previous_photo_group_id),
    ])
    if (!newPhotos.length) return NextResponse.json({ error: 'Esta revisión no tiene fotos' }, { status: 400 })

    const analysis = await compareProgressPhotos({ newPhotos, previousPhotos })
    if (!analysis) {
      return NextResponse.json({ error: 'La IA no ha podido analizar las fotos. Puedes compararlas a mano con el deslizador.' }, { status: 502 })
    }

    await supabase.from('member_checkins').update({ photo_analysis: analysis }).eq('id', checkin.id)
    return NextResponse.json({ success: true, photo_analysis: analysis })
  } catch (error) {
    console.error('reanalyze-photos error:', error)
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
