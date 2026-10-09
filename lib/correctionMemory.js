// Cuando el entrenador pide un ajuste a una dieta/rutina propuesta por la IA
// (botón "Pedir ajuste a la propuesta"), ese texto se usaba una sola vez y se
// perdía para siempre — la próxima generación no sabía que ya se había
// corregido eso antes. Esta función decide si la corrección merece quedar
// guardada como memoria permanente y, si es así, en cuál de los dos niveles:
//   - "member": algo específico de ese socio (lesión, gusto, circunstancia).
//   - "admin": una regla o costumbre general del entrenador, aplicable a
//     cualquier socio en un caso parecido.
// Un comentario puntual sin valor futuro (scope "none") no se guarda.
import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_MODEL_FAST = 'claude-haiku-4-5'

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    scope: { type: 'string', enum: ['member', 'admin', 'none'] },
    note: { type: 'string' },
  },
  required: ['scope', 'note'],
  additionalProperties: false,
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export async function classifyAndStoreCorrection({ correction, supabase, memberId, createdBy }) {
  if (!supabase || !correction?.trim()) return null

  let parsed
  try {
    const prompt = `Un entrenador acaba de pedir este ajuste a una dieta o rutina que había generado la IA para uno de sus socios:

"${correction.trim()}"

Decide si esta corrección merece guardarse como memoria permanente para el futuro, y de qué tipo:
- "member": algo específico de ESTE socio en concreto (lesión, molestia, gusto/aversión, circunstancia personal). Ej: "le molesta la zona lumbar", "no le gusta el pescado".
- "admin": una regla o costumbre general de cómo trabaja este entrenador, aplicable a cualquier socio en un caso parecido. Ej: "nunca bajar de 1400 kcal", "prefiero splits de 5 días", "no poner tomate frito".
- "none": un comentario puntual sin valor para el futuro (una pregunta, una cifra concreta sin patrón general, algo que no se repetirá).

Si el scope es "member" o "admin", "note" debe ser una frase corta y reutilizable, en estilo regla/recordatorio, sin referencias a "esta corrección" ni fechas, lista para guardarse tal cual. Si el scope es "none", "note" puede quedar vacío.`

    const response = await getAnthropic().messages.create({
      model: CLAUDE_MODEL_FAST,
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    })
    if (response.stop_reason === 'refusal') return null
    const text = response.content.find(b => b.type === 'text')?.text || ''
    parsed = JSON.parse(text)
  } catch (e) {
    console.warn('classifyAndStoreCorrection: fallo al clasificar:', e?.message)
    return null
  }

  const note = parsed.note?.trim()
  if (!note || parsed.scope === 'none') return null

  try {
    if (parsed.scope === 'member' && memberId) {
      await supabase.from('member_notes').insert({ member_id: memberId, note, created_by: createdBy || null })
      return { scope: 'member', note }
    }
    if (parsed.scope === 'admin') {
      await supabase.from('gym_assistant_preferences').insert({ note, created_by: createdBy || null })
      return { scope: 'admin', note }
    }
  } catch (e) {
    console.warn('classifyAndStoreCorrection: fallo al guardar:', e?.message)
  }
  return null
}
