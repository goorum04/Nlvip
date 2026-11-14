// Lee una opción de dieta tal y como la escriben la IA y los entrenadores y
// separa el título, cada ingrediente con su cantidad y los macros, para
// mostrar el gramaje de cada ingrediente en su propia línea. Si la opción no
// se puede leer con seguridad (p. ej. "Ternera 150g con puré 150g y judías
// 100g"), structured = false y la app la muestra como texto, igual que antes.
//
// Formatos reales que entiende (vistos en las dietas guardadas):
//   "72g tortitas de arroz + 50g jamón serrano + 2 huevos"
//   "Avena 15g + Proteína 30g | P: 30g | HC: 16g | G: 4g"
//   "Copos de avena: 80 g + Yogur griego/proteico 0%: 250 g"
//   "Tortilla de claras 250g, Pan integral 80g, Leche 250ml | P:50g HC:50g G:10g"
//   "Pechuga de pollo (250g) + Aceite de oliva (10ml)"
//   "Yogur proteico natural (250/200/180g) + Avena (50/25/30g)"  (por persona)
//   "Pasta 90 g en crudo", "Verduras 150-200g", "Sardinas enlatadas 1 lata"
//   "Aceite de oliva 5g (o 25g de aguacate)", "Hamburguesas 2 uds (220g)"
//   "Opción 2 — Apple Pie Pancakes: ... + Canela + Sirope 0 kcal. Cocinar..."

const UNIT = '(?:kg|grs?|gramos|g|ml|cl|l|uds?|unidad(?:es)?|latas?|rebanadas?|rodajas?|piezas?|cucharad(?:a|as|ita|itas)|cdas?|cdtas?|scoops?|cazos?)'
const NUM = '\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?'
const QTY_ONLY_RE = new RegExp(`^\\s*(${NUM}(?:\\s*\\/\\s*${NUM})*)\\s*(${UNIT})?\\s*$`, 'i')
const HAS_QTY_RE = new RegExp(`\\d+\\s*(?:${UNIT})(?![a-záéíóúñ])`, 'i')

function normUnit(u) {
  if (!u) return ''
  const x = u.toLowerCase()
  if (/^(g|gr|grs|gramos)$/.test(x)) return 'g'
  if (x === 'ud' || x === 'uds' || x.startsWith('unidad')) return x === 'ud' ? 'ud' : 'uds'
  return x
}

function tidy(name) {
  const s = String(name || '').trim().replace(/[:.;,]+$/, '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function titleCase(s) {
  const t = String(s || '').trim()
  if (!t) return null
  const base = t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// Divide por un separador ignorando lo que va entre paréntesis.
function splitTopLevel(text, sep) {
  const out = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && text.startsWith(sep, i)) {
      out.push(cur)
      cur = ''
      i += sep.length - 1
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim()).filter(Boolean)
}

function qtyOnly(s) {
  const m = String(s || '').match(QTY_ONLY_RE)
  return m ? { qty: m[1].replace(/\s+/g, ''), unit: normUnit(m[2]) } : null
}

export function parseIngredient(part) {
  let s = String(part || '').trim().replace(/[.;]+$/, '').trim()
  let note = null
  let parenQty = null

  // Paréntesis final: cantidad "(250g)" / "(250/200/180g)" o nota "(o 25g de aguacate)".
  const paren = s.match(/^(.*\S)\s*\(([^()]*)\)$/)
  if (paren) {
    const q = qtyOnly(paren[2])
    if (q) parenQty = q
    else note = paren[2].trim()
    s = paren[1].trim()
  }

  const done = (qty, unit, name, extraNote) => {
    const n = tidy(name)
    const finalNote = [extraNote, note].filter(Boolean).join(' · ') || null
    // Si en el nombre sigue habiendo una cantidad, no se ha entendido bien:
    // mejor no separar que mostrar un gramaje equivocado.
    if (HAS_QTY_RE.test(n)) return { qty: null, unit: '', name: tidy(part), note: null }
    return { qty, unit, name: n, note: finalNote }
  }

  let r
  // "72g tortitas de arroz", "2 huevos", "1 plátano"
  r = s.match(new RegExp(`^(${NUM})\\s*(${UNIT})?\\.?\\s+(?:de\\s+)?([a-záéíóúñü].*)$`, 'i'))
  if (r) return done(r[1].replace(/\s+/g, ''), normUnit(r[2]), r[3], parenQty ? `${parenQty.qty} ${parenQty.unit}`.trim() : null)
  // "Copos de avena: 80 g"
  r = s.match(new RegExp(`^(.+?)\\s*:\\s*(${NUM})\\s*(${UNIT})?$`, 'i'))
  if (r) return done(r[2].replace(/\s+/g, ''), normUnit(r[3]), r[1], parenQty ? `${parenQty.qty} ${parenQty.unit}`.trim() : null)
  // "Pasta 90 g en crudo", "Proteína ISO 25g con agua"
  r = s.match(new RegExp(`^(.+?)\\s+(${NUM})\\s*(${UNIT})\\s+((?:con|en|sin|al|a la|de|para|bien)\\b.*)$`, 'i'))
  if (r) return done(r[2].replace(/\s+/g, ''), normUnit(r[3]), r[1], [r[4], parenQty ? `${parenQty.qty} ${parenQty.unit}`.trim() : null].filter(Boolean).join(' · '))
  // "Avena 15g", "Skyr 0% 200 g", "Sardinas enlatadas 1 lata", "Hamburguesas 2 uds (220g)"
  r = s.match(new RegExp(`^(.+?)\\s+(${NUM})\\s*(${UNIT})$`, 'i'))
  if (r) return done(r[2].replace(/\s+/g, ''), normUnit(r[3]), r[1], parenQty ? `${parenQty.qty} ${parenQty.unit}`.trim() : null)
  // "Pechuga de pollo (250g)", "Yogur proteico (250/200/180g)"
  if (parenQty) return done(parenQty.qty, parenQty.unit, s, null)
  // Sin cantidad: "Canela", "Ensalada al gusto"
  return done(null, '', s, null)
}

export function parseDietOption(raw) {
  let text = String(raw || '').trim()
  let label = null
  let title = null

  const m = text.match(/^(opci[oó]n\s*\d+)\s*(?:[—–-]\s*([^:]+?)|\(([^)]+)\))?\s*:\s*(.*)$/i)
  if (m) {
    label = `Opción ${m[1].match(/\d+/)[0]}`
    title = titleCase(m[2] || m[3])
    text = m[4]
  }

  // Macros al final: "| P: 38g | HC: 85g | G: 23g" o "| P:44g HC:78g G:10g"
  let macros = null
  const mm = text.match(/\|?\s*P\s*:\s*(\d+(?:[.,]\d+)?)\s*g?\s*\|?\s*HC\s*:\s*(\d+(?:[.,]\d+)?)\s*g?\s*\|?\s*G\s*:\s*(\d+(?:[.,]\d+)?)\s*g?\s*\|?\s*$/i)
  if (mm) {
    macros = { p: mm[1], hc: mm[2], g: mm[3] }
    text = text.slice(0, mm.index).trim()
  }
  text = text.replace(/\s*\|\s*$/, '').trim()
  const body = text

  // Instrucciones al final ("... + Sirope 0 kcal. Cocinar primero las claras")
  let instructions = null
  const ins = text.match(/^(.*?\S)\.\s+([A-ZÁÉÍÓÚÑ¡¿].*)$/)
  if (ins && /\s\+\s/.test(ins[1])) {
    text = ins[1]
    instructions = ins[2].trim()
  }

  let parts
  if (/\s\+\s/.test(text)) parts = splitTopLevel(text, ' + ')
  else if (/,\s/.test(text)) parts = splitTopLevel(text, ', ')
  else parts = [text]

  const ingredients = parts.map(parseIngredient).filter(i => i.name || i.qty)
  const withQty = ingredients.filter(i => i.qty).length
  const structured = ingredients.length >= 2 && withQty >= Math.ceil(ingredients.length / 2)
  return { label, title, ingredients, macros, instructions, structured, body }
}

// Cantidades sueltas dentro de un texto ("150g", "(250 ml)", "2 uds"), para
// resaltarlas cuando la opción no se puede separar por ingredientes.
export const INLINE_QTY_RE = /(\(?\d+(?:[.,]\d+)?(?:\s*[-–\/]\s*\d+(?:[.,]\d+)?)*\s?(?:kg|grs?|g|ml|cl|uds?)(?![a-záéíóúñ])\)?)/gi

// "72 g", "250 ml", "2", "250/200/180 g"
export function formatQty(ing) {
  if (!ing?.qty) return ''
  const q = String(ing.qty).replace(/\./g, ',')
  return ing.unit ? `${q} ${ing.unit}` : q
}
