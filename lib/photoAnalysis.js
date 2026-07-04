// Comparación de fotos de progreso con IA — usada en las revisiones periódicas.
// Mismo mecanismo que app/api/analyze-food/route.js (GPT-4o Vision), pero
// comparando dos sets de 3 fotos (nuevas vs. de la revisión anterior) en una
// sola llamada, en vez de analizar una imagen aislada.

import OpenAI from 'openai'

const TYPE_LABELS = { front: 'Frente', side: 'Lado', back: 'Espalda' }

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
  if (!process.env.OPENAI_API_KEY) return null
  if (!Array.isArray(newPhotos) || newPhotos.length === 0) return null

  const openai = getOpenAI()

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

  const systemPrompt = `Eres un preparador físico de élite analizando fotos de seguimiento de un socio (con su consentimiento, para ajustar su dieta y rutina).
Responde SIEMPRE en español, en tono profesional y objetivo, con un resumen breve (máximo 5 frases o bullets) sobre cambios visibles en:
- Grasa corporal / definición
- Retención de líquidos / hinchazón
- Volumen o tono muscular
- Postura general
No hagas comentarios sobre identidad, edad, atractivo ni nada ajeno al progreso físico-deportivo. Si no hay fotos anteriores, simplemente describe el punto de partida en los mismos términos.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    max_tokens: 500,
    temperature: 0.3
  })

  return response.choices[0]?.message?.content?.trim() || null
}
