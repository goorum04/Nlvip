// Evita que el nombre de un socio aparezca en la rutina o la dieta de OTRO.
//
// Visto en producción: el admin pidió al asistente una rutina "del estilo de
// Daniela" para Gabriela y la IA tituló la rutina "… ESTILO DANIELA - GABRIELA",
// que Gabriela vio en su app. El nombre de un cliente nunca debe salir en el
// plan de otro, diga lo que diga el texto que se le pase a la IA. Este filtro se
// aplica justo antes de guardar; en la base de datos hay además un bloqueo al
// asignar (migración 20261124000001) por si algo se cuela por otro camino.

// Nombres de pila que coinciden con palabras o ejercicios habituales: solo se
// tratan como nombre si van con el apellido.
const FIRST_NAME_STOPLIST = new Set([
  'socio', 'demo', 'cuenta', 'arnold', 'scott', 'larsen', 'pallof', 'zottman',
  'jefferson', 'nordic', 'copenhagen', 'mar', 'sol', 'luz', 'paz', 'pilar', 'rosa',
  'probe', 'qa', 'test',
])

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Nombres de los demás socios/entrenadores (no del propio socio).
export async function getOtherPeopleNames(supabase, memberId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['member', 'trainer'])
  const own = (data || []).find(p => p.id === memberId)
  const ownFirst = strip(own?.name).split(/\s+/)[0] || ''
  const out = []
  for (const p of data || []) {
    if (p.id === memberId || !p.name) continue
    const parts = p.name.trim().split(/\s+/)
    const first = parts[0]
    const full = parts.slice(0, 2).join(' ')
    const firstNorm = strip(first)
    const useFirst = firstNorm.length >= 4 && firstNorm !== ownFirst && !FIRST_NAME_STOPLIST.has(firstNorm)
    out.push({ full: parts.length >= 2 ? full : null, first: useFirst ? first : null })
  }
  return out
}

// Patrón tolerante a tildes y mayúsculas para un nombre ("Daniela" ~ "DANIELA").
function namePattern(name) {
  const letters = [...strip(name)].map(ch => {
    const variants = { a: 'aáàäâ', e: 'eéèëê', i: 'iíìïî', o: 'oóòöô', u: 'uúùüû', n: 'nñ', c: 'cç' }[ch]
    return variants ? `[${variants}${variants.toUpperCase()}]` : escapeRe(ch)
  }).join('')
  return letters.replace(/\\ |\s+/g, '\\s+')
}

export function scrubNames(text, names) {
  if (!text || typeof text !== 'string' || !names?.length) return text
  let out = text
  const found = []
  const terms = []
  for (const n of names) {
    if (n.full) terms.push(n.full)
    if (n.first) terms.push(n.first)
  }
  // Los nombres completos primero, para no dejar apellidos sueltos.
  terms.sort((a, b) => b.length - a.length)
  for (const term of terms) {
    const pat = namePattern(term)
    const withLead = new RegExp(`(?:\\b(?:estilo|al\\s+estilo\\s+de|como|tipo|igual\\s+que|copia\\s+de|basad[ao]\\s+en|de)\\s+)?(?<![\\p{L}])${pat}(?![\\p{L}])`, 'giu')
    if (withLead.test(out)) {
      found.push(term)
      out = out.replace(withLead, '')
    }
  }
  if (!found.length) return text
  // Limpia separadores que quedan colgando: "Rutina X -  - Gabriela", "( )", dobles espacios.
  out = out
    .replace(/\(\s*\)/g, '')
    .replace(/\s*[-–—|/]\s*(?=[-–—|/])/g, '')
    .replace(/(^|\n)\s*[-–—|/]\s+/g, '$1')
    .replace(/\s+[-–—|/]\s*($|\n)/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:])/g, '$1')
    .trim()
  return out
}

export function scrubRoutine(routine, names) {
  if (!routine || !names?.length) return routine
  return {
    ...routine,
    routine_name: scrubNames(routine.routine_name, names) || 'Rutina personalizada',
    routine_description: scrubNames(routine.routine_description, names),
    medical_rationale: scrubNames(routine.medical_rationale, names),
    days: (routine.days || []).map(d => ({
      ...d,
      day_name: scrubNames(d.day_name, names),
      exercises: (d.exercises || []).map(ex => ({ ...ex, notes: scrubNames(ex.notes, names) })),
    })),
  }
}
