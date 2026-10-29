// Mensajes automáticos "en la voz del entrenador" (Nacho) para el socio:
//   - 'approval': al aprobar una revisión (dieta y/o rutina nuevas).
//   - 'nudge':    "dar un toque" a un socio que lleva días sin actividad.
//
// Reglas de diseño:
//   - Suenan a Nacho, no a una app: cercano, directo, de gimnasio, sin
//     corporativismos ni emojis a cascoporro.
//   - Concordancia de género correcta según profiles.sex (female/male/otro o
//     desconocido → redacción neutra, sin adjetivos con género).
//   - Varían: se pasan al modelo los últimos mensajes enviados a ese socio
//     para que no repita arranques ni frases, y se elige un "ángulo" al azar.
//   - Si falla la IA, hay plantillas de reserva (también con género).
import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_MODEL_FAST = 'claude-haiku-4-5'

// Cómo escribe Nacho. Si él quiere afinarlo, basta con guardar en
// gym_assistant_preferences una nota que empiece por "Mensajes a socios:" y
// se añade al prompt (ver loadVoiceNotes).
const NACHO_STYLE = `Eres Nacho, entrenador personal y dueño de NL VIP Team (gimnasio en España).
Así escribes a tus socios por la app:
- Tuteas siempre. Castellano de España, coloquial pero sin faltas.
- Directo y cercano, como un mensaje de WhatsApp a alguien a quien entrenas cada semana. Nada de "estimado", "equipo de NL VIP" ni frases de empresa.
- Motivador sin ser cursi: reconoces el curro cuando lo hay y, cuando no, lo dices con cariño pero sin rodeos.
- Frases cortas. Entre 2 y 4 frases en total, máximo unas 45 palabras.
- Como mucho UN emoji, y solo si pega (💪 🔥 👊). Puede no haber ninguno.
- Nada de signos de exclamación en cadena ("!!!") ni mayúsculas gritando.
- Te diriges al socio por su nombre de pila al menos una vez, de forma natural.
- No prometes resultados concretos (kilos, plazos) ni das consejos médicos.
- No inventes datos: solo usa los que te doy. Si no te doy un dato, no lo menciones.`

const APPROVAL_ANGLES = [
  'reconoce el esfuerzo de la última revisión y presenta el cambio como el siguiente paso lógico',
  've al grano: qué cambia y qué quieres que haga esta semana con eso',
  'tono de "seguimos construyendo": constancia, bloque nuevo, a por ello',
  'empieza por el dato más llamativo de su progreso (si lo hay) y enlaza con el ajuste',
  'cercano y breve, como si se lo dijeras al cruzaros en el gimnasio',
]

const NUDGE_ANGLES = [
  'preocupación sincera: preguntas cómo está, sin reproche',
  'recordatorio ligero con humor, dejando claro que te acuerdas de esa persona',
  'reto pequeño y concreto para hoy (marcar una comida, un paseo, un entreno corto)',
  'puerta abierta: si hay algún problema con el plan, que te lo diga y lo cambiáis',
  'directo y cálido: "te echo de menos por aquí", y una invitación a retomar',
]

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function genderInstruction(sex) {
  if (sex === 'female') return 'La socia es MUJER: todos los adjetivos y participios que se refieran a ella van en femenino (lista, preparada, constante, "has estado muy centrada").'
  if (sex === 'male') return 'El socio es HOMBRE: adjetivos y participios en masculino (listo, preparado, "has estado muy centrado").'
  return 'No sabes el género de esta persona: redacta sin adjetivos ni participios con marca de género (usa "con constancia" en vez de "constante", "sigue así" en vez de "estás preparado/a").'
}

function firstName(name, email) {
  const raw = (name && name.trim()) || (email ? email.split('@')[0] : '') || ''
  const first = raw.split(/\s+/)[0] || 'crack'
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

async function loadVoiceNotes(supabase) {
  try {
    const { data } = await supabase
      .from('gym_assistant_preferences')
      .select('note')
      .ilike('note', 'mensajes a socios:%')
      .order('created_at', { ascending: false })
      .limit(5)
    return (data || []).map(r => r.note.replace(/^mensajes a socios:\s*/i, '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function loadRecentMessages(supabase, memberId) {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('body')
      .eq('user_id', memberId)
      .in('type', ['trainer_message', 'trainer_nudge'])
      .order('created_at', { ascending: false })
      .limit(4)
    return (data || []).map(r => r.body).filter(Boolean)
  } catch {
    return []
  }
}

function fallbackMessage(kind, { name, sex, trainerName, days }) {
  const f = sex === 'female'
  if (kind === 'approval') {
    return pick([
      `${name}, ya tienes el plan nuevo en la app. He ajustado lo que hablamos en la revisión, échale un vistazo y esta semana a aplicarlo. 💪`,
      `${name}, plan actualizado. ${f ? 'Lista' : sex === 'male' ? 'Listo' : 'Todo listo'} para el siguiente bloque: míralo con calma y cualquier duda me escribes.`,
      `Buen trabajo con la revisión, ${name}. Te he dejado los cambios en la app, seguimos construyendo.`,
    ])
  }
  const d = days ? `${days} días` : 'unos días'
  return pick([
    `${name}, llevas ${d} sin dejar nada en la app. ¿Todo bien? Si algo del plan no te cuadra, dímelo y lo cambiamos.`,
    `Eh ${name}, te echo de menos por aquí. Un entreno corto o marcar las comidas de hoy ya cuenta. 👊`,
    `${name}, ${d} sin registrar nada. No pasa nada, pero retomemos hoy: una comida marcada y seguimos.`,
  ]).replace('{trainer}', trainerName || 'Nacho')
}

/**
 * Genera un mensaje corto en la voz del entrenador.
 * @param {object} p
 * @param {import('@supabase/supabase-js').SupabaseClient} p.supabase service role
 * @param {'approval'|'nudge'} p.kind
 * @param {{id:string, name?:string, email?:string, sex?:string}} p.member
 * @param {string} [p.trainerName]
 * @param {object} [p.context] datos reales para el mensaje (ver llamadas)
 * @returns {Promise<string>}
 */
export async function generateTrainerMessage({ supabase, kind, member, trainerName = 'Nacho', context = {} }) {
  const name = firstName(member?.name, member?.email)
  const sex = member?.sex || null
  const fallback = () => fallbackMessage(kind, { name, sex, trainerName, days: context.daysInactive })

  if (!process.env.ANTHROPIC_API_KEY) return fallback()

  const [voiceNotes, recent] = await Promise.all([loadVoiceNotes(supabase), loadRecentMessages(supabase, member.id)])

  const angle = kind === 'approval' ? pick(APPROVAL_ANGLES) : pick(NUDGE_ANGLES)
  const facts = []
  if (kind === 'approval') {
    if (context.dietChanged) facts.push(`Has aprobado una DIETA nueva.${context.dietSummary ? ` Resumen del cambio: ${context.dietSummary}` : ''}`)
    if (context.routineChanged) facts.push(`Has aprobado una RUTINA nueva.${context.routineSummary ? ` Resumen del cambio: ${context.routineSummary}` : ''}`)
    if (context.weightDelta != null && context.weightDeltaWeeks) {
      const sign = context.weightDelta > 0 ? '+' : ''
      facts.push(`Peso: ${sign}${context.weightDelta.toFixed(1)} kg en las últimas ${context.weightDeltaWeeks} semanas (si cuadra con su objetivo, puedes reconocerlo; si no, no lo menciones).`)
    }
    if (context.goal) facts.push(`Objetivo declarado: ${context.goal}.`)
    if (context.memberNotes?.length) facts.push(`Cosas que sabes de esta persona: ${context.memberNotes.join('; ')}.`)
  } else {
    facts.push(`Lleva ${context.daysInactive ?? 'varios'} días sin registrar nada en la app (ni comidas, ni entrenos, ni pasos).`)
    if (context.lastActivityLabel) facts.push(`Lo último que hizo: ${context.lastActivityLabel}.`)
    if (context.streakBefore) facts.push(`Antes de parar llevaba una racha de ${context.streakBefore} días.`)
    if (context.memberNotes?.length) facts.push(`Cosas que sabes de esta persona: ${context.memberNotes.join('; ')}.`)
  }

  const prompt = `${NACHO_STYLE}
${voiceNotes.length ? `\nMatices que has pedido tú mismo para estos mensajes:\n- ${voiceNotes.join('\n- ')}\n` : ''}
Socio/a: ${name}. ${genderInstruction(sex)}

Situación: ${kind === 'approval'
    ? 'acabas de revisar su última revisión (fotos, medidas, pasos) y le has dejado el plan actualizado en la app. Le escribes para avisarle y animarle.'
    : 'lleva días sin usar la app y quieres darle un toque para que retome, sin que suene a regañina automática.'}

Datos reales (no inventes nada más):
- ${facts.join('\n- ')}

Ángulo para este mensaje: ${angle}.
${recent.length ? `\nMensajes que ya le has enviado antes (NO repitas el arranque, la estructura ni las frases de estos):\n${recent.map(m => `· "${m}"`).join('\n')}\n` : ''}
Escribe SOLO el mensaje final, sin comillas, sin firma, sin "Hola" seco al principio (puedes arrancar con el nombre o directamente con el contenido).`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: CLAUDE_MODEL_FAST,
      max_tokens: 220,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    if (response.stop_reason === 'refusal') return fallback()
    let text = (response.content.find(b => b.type === 'text')?.text || '').trim().replace(/^["“]|["”]$/g, '')
    if (!text || text.length < 15 || text.length > 420) return fallback()
    // El nombre es innegociable: si el modelo se lo salta, se antepone.
    if (!text.toLowerCase().includes(name.toLowerCase())) {
      text = `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
    }
    return text
  } catch (e) {
    console.warn('generateTrainerMessage: fallo IA, usando plantilla:', e?.message)
    return fallback()
  }
}

/** Nombre de pila del entrenador asignado al socio (o del aprobador). */
export async function resolveTrainerName(supabase, memberId, fallbackUserId) {
  try {
    const { data: tm } = await supabase
      .from('trainer_members')
      .select('trainer:profiles!trainer_members_trainer_id_fkey(name)')
      .eq('member_id', memberId)
      .maybeSingle()
    const n = tm?.trainer?.name
    if (n) return firstName(n)
    if (fallbackUserId) {
      const { data: p } = await supabase.from('profiles').select('name').eq('id', fallbackUserId).maybeSingle()
      if (p?.name) return firstName(p.name)
    }
  } catch { /* ignore */ }
  return 'Nacho'
}
