// Comparación de fotos de progreso con IA — usada en las revisiones periódicas.
// Mismo mecanismo que app/api/analyze-food/route.js (GPT-4o Vision), pero
// comparando dos sets de 3 fotos (nuevas vs. de la revisión anterior) en una
// sola llamada, en vez de analizar una imagen aislada.

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const TYPE_LABELS = { front: 'Frente', side: 'Lado izquierdo', side_right: 'Lado derecho', back: 'Espalda' }

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// photos: [{ type: 'front'|'side'|'back', url: signedUrl }]
function buildImageContent(photos, label) {
  const content = [{ type: 'text', text: `${label}:` }]
  for (const p of photos) {
    content.push({ type: 'text', text: TYPE_LABELS[p.type] || p.type })
    content.push({ type: 'image_url', image_url: { url: p.url } })
  }
  return content
}

// compareProgressPhotos({ newPhotos, previousPhotos })
// newPhotos / previousPhotos: [{ type, url }] (URLs firmadas, privadas)
// Devuelve un resumen corto en español de los cambios visibles, o null si no
// hay fotos anteriores con las que comparar (primera revisión del socio).
export async function compareProgressPhotos({ newPhotos, previousPhotos }) {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) return null
  if (!Array.isArray(newPhotos) || newPhotos.length === 0) return null

  const hasPrevious = Array.isArray(previousPhotos) && previousPhotos.length > 0

  const userContent = [
    {
      type: 'text',
      text: hasPrevious
        ? 'Compara estas fotos de progreso físico. Primero las fotos ANTERIORES (revisión previa), luego las NUEVAS (revisión actual).'
        : 'Estas son las primeras fotos de progreso físico de este socio (no hay revisión anterior con la que comparar). Descríbelas para dejar una referencia de partida.'
    },
    ...(hasPrevious ? buildImageContent(previousPhotos, 'FOTOS ANTERIORES') : []),
    ...buildImageContent(newPhotos, hasPrevious ? 'FOTOS NUEVAS' : 'FOTOS ACTUALES')
  ]

  const systemPrompt = `Eres un preparador físico y asesor nutricional profesional. Formas parte del equipo de un club deportivo y tu trabajo, dentro de tu responsabilidad profesional, es valorar las fotos de seguimiento físico que los socios ADULTOS envían VOLUNTARIAMENTE y con su consentimiento en cada revisión periódica, exactamente igual que haría un entrenador personal, para ajustar su dieta y su entrenamiento.
Estas son fotos estándar de seguimiento corporal (postura frontal, lateral y de espalda) en ropa deportiva. Analizarlas es una tarea legítima y rutinaria de tu profesión; NO las rechaces.
Responde SIEMPRE en español, en tono profesional, técnico y objetivo, con un resumen breve (máximo 5 frases o bullets) sobre cambios visibles en:
- Grasa corporal / definición
- Retención de líquidos / hinchazón
- Volumen o tono muscular
- Postura general
Habla solo de composición corporal y progreso físico-deportivo. No comentes identidad, edad ni atractivo. Si no hay fotos anteriores, describe el punto de partida en esos mismos términos. Si la calidad de la imagen no permite valorar algo, dilo con naturalidad, pero da igualmente tu mejor lectura profesional.`

  // Si el modelo se niega a analizar las fotos, NO devolvemos el texto de rechazo
  // (contaminaría la adaptación de dieta/rutina).
  const refusal = /(lo siento|no puedo|no me es posible|no soy capaz|i('m| am) sorry|i can(no|')t|i'm unable|as an ai)/i
  const usable = (t) => Boolean(t) && !(refusal.test(t) && t.length < 300)

  // 1º GPT-4o. A veces se niega con fotos de cuerpo aunque sean de seguimiento
  // deportivo (visto en producción el 28/11): entonces lo intenta Claude.
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
      const text = response.choices[0]?.message?.content?.trim() || ''
      if (usable(text)) return text
      console.warn('compareProgressPhotos: GPT-4o no analizó las fotos (rechazo o vacío); probando con Claude.')
    } catch (e) {
      console.warn('compareProgressPhotos: error de GPT-4o, probando con Claude:', e.message)
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const content = userContent.map(part => part.type === 'image_url'
        ? { type: 'image', source: { type: 'url', url: part.image_url.url } }
        : part)
      const res = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content }]
      })
      const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      if (usable(text)) return text
      console.warn('compareProgressPhotos: Claude tampoco analizó las fotos (rechazo o vacío).')
    } catch (e) {
      console.warn('compareProgressPhotos: error de Claude:', e.message)
    }
  }

  return null
}

// Analiza las fotos de progreso MÁS RECIENTES de un socio, fuera del flujo de
// revisión periódica (que ya comparaba nuevas vs. anteriores dentro de esa
// misma revisión). Se usa al generar o corregir una rutina/dieta desde el
// asistente admin o el onboarding, para que el punto de partida SIEMPRE tenga
// en cuenta cómo se ve el socio realmente y no solo lo que dijo por texto —
// antes no existía ningún análisis visual fuera de las revisiones periódicas,
// así que un punto débil visible (ej. gemelo poco desarrollado) nunca llegaba
// a influir en el diseño de la rutina si no se mencionaba por escrito.
// Devuelve null si el socio no tiene fotos de progreso aún.
export async function getLatestPhysiqueAnalysis(supabase, memberId) {
  if (!memberId) return null
  try {
    const { data: latestPhotoRow } = await supabase
      .from('progress_photos')
      .select('group_id, date')
      .eq('member_id', memberId)
      .not('group_id', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latestPhotoRow?.group_id) return null

    const { data: photoRows } = await supabase
      .from('progress_photos')
      .select('photo_url, photo_type')
      .eq('group_id', latestPhotoRow.group_id)
    if (!Array.isArray(photoRows) || photoRows.length === 0) return null

    const { data: signed } = await supabase.storage
      .from('progress_photos')
      .createSignedUrls(photoRows.map(p => p.photo_url), 600)
    const photos = (signed || [])
      .map((s, i) => ({ type: photoRows[i].photo_type, url: s?.signedUrl }))
      .filter(p => p.url)
    if (photos.length === 0) return null

    return await compareProgressPhotos({ newPhotos: photos, previousPhotos: [] })
  } catch (e) {
    console.warn('getLatestPhysiqueAnalysis error:', e.message)
    return null
  }
}
