'use client'

import { Card, CardContent } from '@/components/ui/card'
import { isGoldDesign } from '@/lib/design'
import { Button } from '@/components/ui/button'
import {
  Coffee, Sun, Moon, Apple, Clock, Flame,
  ChevronRight, Calendar, Info, ShieldCheck, Droplets, Check
} from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { heroBackground, HERO_IMAGES } from '@/lib/heroImages'
import { parseDietOption, formatQty, INLINE_QTY_RE } from '@/lib/dietOptionParser'

// Resalta las cantidades sueltas de un texto (cuando no se puede hacer lista).
function highlightQuantities(text, className, style) {
  return String(text).split(INLINE_QTY_RE).map((part, i) =>
    i % 2 === 1
      ? <span key={i} className={className} style={style}>{part}</span>
      : <span key={i}>{part}</span>
  )
}

// Una opción de la dieta con el gramaje de cada ingrediente en su línea:
//   OPCIÓN 1 · Bowl de skyr
//   200 g   Skyr 0%
//   120 g   Fresas
//   P 30 g · HC 23 g · G 12 g
// Si no se puede separar con seguridad, se muestra el texto como antes, con
// las cantidades resaltadas. La usan el diseño clásico y el negro y oro.
function DietOption({ item, gold = false }) {
  const opt = parseDietOption(item)
  const qtyCh = Math.max(4, ...opt.ingredients.map(i => formatQty(i).length)) + 1
  const ui = gold
    ? {
        label: 'inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-[0.1em]',
        labelStyle: { background: 'var(--nl-soft)', color: 'var(--nl-accent)' },
        title: 'text-[13.5px] font-semibold', titleStyle: { color: 'var(--nl-text)' },
        list: 'mt-2 rounded-[14px] overflow-hidden', listStyle: { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--nl-line)' },
        rowBorder: '1px solid var(--nl-line)',
        qty: 'shrink-0 text-right nl-tabular font-semibold text-[13.5px]', qtyStyle: { color: 'var(--nl-accent2)' },
        name: 'flex-1 min-w-0 text-[14px]', nameStyle: { color: 'rgba(244,241,234,0.9)' },
        note: 'block text-[12px] mt-0.5', noteStyle: { color: 'var(--nl-muted)' },
        text: 'text-[14px] leading-relaxed', textStyle: { color: 'rgba(244,241,234,0.86)' },
        hi: 'nl-tabular font-semibold', hiStyle: { color: 'var(--nl-accent2)' },
        macro: 'text-[11.5px] font-semibold px-2 py-1 rounded-full nl-tabular', macroStyle: { background: 'rgba(255,255,255,0.06)', color: 'var(--nl-muted)' },
        ins: 'text-[12.5px] mt-2 leading-relaxed', insStyle: { color: 'var(--nl-muted)' },
      }
    : {
        label: 'inline-block px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 text-xs font-bold uppercase tracking-wide',
        title: 'text-sm font-semibold text-white',
        list: 'mt-2 rounded-xl overflow-hidden bg-black/20 border border-white/5',
        rowBorder: '1px solid rgba(255,255,255,0.05)',
        qty: 'shrink-0 text-right font-mono font-semibold text-cyan-300/90 text-[13px]',
        name: 'flex-1 min-w-0 text-gray-200',
        note: 'block text-xs text-gray-500 mt-0.5',
        text: '', hi: 'font-mono text-cyan-300/90 font-semibold',
        macro: 'text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-400',
        ins: 'text-xs text-gray-500 mt-2 leading-relaxed',
      }

  return (
    <div>
      {(opt.label || opt.title) && (
        <div className="flex items-center gap-2 flex-wrap">
          {opt.label && <span className={ui.label} style={ui.labelStyle}>{opt.label}</span>}
          {opt.title && <span className={ui.title} style={ui.titleStyle}>{opt.title}</span>}
        </div>
      )}
      {opt.structured ? (
        <ul className={ui.list} style={ui.listStyle}>
          {opt.ingredients.map((ing, i) => (
            <li key={i} className="flex items-baseline gap-3 px-3 py-2" style={{ borderTop: i ? ui.rowBorder : 'none' }}>
              <span className={ui.qty} style={{ ...ui.qtyStyle, width: `${qtyCh}ch` }}>{formatQty(ing)}</span>
              <span className={ui.name} style={ui.nameStyle}>
                {ing.name}
                {ing.note && <span className={ui.note} style={ui.noteStyle}>{ing.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`${ui.text} ${opt.label || opt.title ? 'mt-1' : ''}`} style={ui.textStyle}>
          {highlightQuantities(opt.body, ui.hi, ui.hiStyle)}
        </p>
      )}
      {opt.structured && opt.instructions && <p className={ui.ins} style={ui.insStyle}>{opt.instructions}</p>}
      {opt.macros && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={ui.macro} style={ui.macroStyle}>P {opt.macros.p} g</span>
          <span className={ui.macro} style={ui.macroStyle}>HC {opt.macros.hc} g</span>
          <span className={ui.macro} style={ui.macroStyle}>G {opt.macros.g} g</span>
        </div>
      )}
    </div>
  )
}

// Nombre de tarjeta (tal y como sale parseado del texto de la dieta) -> slot
// estructurado que usan meal_logs / meal_reminders_sent.
const MEAL_NAME_TO_SLOT = {
  'DESAYUNO': 'breakfast',
  'MEDIA MAÑANA': 'snack',
  'COMIDA': 'lunch',
  'ALMUERZO': 'lunch',
  'MERIENDA': 'snack',
  'CENA': 'dinner',
  'BATIDO': 'snack',
}

const MEAL_icons = {
  'DESAYUNO': Coffee,
  'MEDIA MAÑANA': Apple,
  'COMIDA': Sun,
  'ALMUERZO': Sun,
  'MERIENDA': Apple,
  'CENA': Moon,
  'POST-ENTRENO': Flame,
  'PRE-ENTRENO': Flame,
  'BATIDO': Flame,
}

const MEAL_COLORS = {
  'DESAYUNO': 'from-amber-500/20 to-orange-500/20 text-orange-400',
  'MEDIA MAÑANA': 'from-blue-400/20 to-cyan-400/20 text-cyan-400',
  'COMIDA': 'from-green-500/20 to-emerald-500/20 text-emerald-400',
  'ALMUERZO': 'from-green-500/20 to-emerald-500/20 text-emerald-400',
  'MERIENDA': 'from-purple-500/20 to-pink-500/20 text-pink-400',
  'CENA': 'from-indigo-500/20 to-blue-500/20 text-blue-400',
  'POST-ENTRENO': 'from-red-500/20 to-orange-500/20 text-red-400',
  'BATIDO': 'from-red-500/20 to-orange-500/20 text-red-400',
}

// Busca el estilo (icono/color) por nombre exacto de comida y, si no hay
// coincidencia exacta, por la primera clave del diccionario que aparezca
// como palabra dentro del nombre — así "MERIENDA POST-ENTRENO" hereda el
// estilo de "MERIENDA" sin tener que listar cada combinación posible.
function lookupMealStyle(dict, mealName) {
  if (dict[mealName]) return dict[mealName]
  const key = Object.keys(dict).find(k => mealName.includes(k))
  return key ? dict[key] : null
}

// Guideline 1.4.1 (App Store): las recomendaciones nutricionales deben
// llevar citas/fuentes visibles y fáciles de encontrar para el usuario.
// Este pie se muestra en ambas vistas de la dieta (diaria y semanal),
// independientemente de qué entrenador haya escrito el contenido del plan.
function DietSourcesFooter() {
  return (
    <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" />
        Fuentes y referencias
      </p>
      <p className="text-xs text-gray-500 leading-relaxed">
        Este plan ha sido elaborado por tu entrenador/nutricionista siguiendo principios generales de nutrición
        deportiva respaldados por:
      </p>
      <ul className="text-xs text-gray-500 mt-1.5 space-y-1 list-disc list-inside">
        <li>
          <a href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
            Organización Mundial de la Salud (OMS) — Alimentación saludable
          </a>
        </li>
        <li>
          <a href="https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
            EFSA — Valores de referencia de ingesta de nutrientes (UE)
          </a>
        </li>
        <li>
          <a href="https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
            International Society of Sports Nutrition — Position Stand: proteína y ejercicio
          </a>
        </li>
      </ul>
      <p className="text-[11px] text-gray-600 mt-2 italic">
        Esta información es orientativa y educativa, no sustituye el consejo de un profesional sanitario.
      </p>
    </div>
  )
}

// Separa el texto de la dieta en comidas ("🌅 DESAYUNO (08:00):" + líneas "- ...").
export function parseDietMeals(text) {
  const meals = []
  const lines = text.split('\n')
  let currentMeal = null

  lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) return

    // Match meal headers like "🌅 DESAYUNO (08:00):" or "☀️ COMIDA:"
    const mealMatch = trimmed.match(/^(?:[^\w\s]*\s*)?([A-Z\sÑ]+)(\s*\([^)]+\))?:?$/i)
    
    if (mealMatch && !trimmed.includes('REGLAS') && !trimmed.includes('MACROS') && !trimmed.includes('SUPLEMENTACIÓN')) {
      const mealName = mealMatch[1].trim().toUpperCase()
      if (lookupMealStyle(MEAL_icons, mealName) || mealName.includes('COMIDA') || mealName.includes('MAÑANA')) {
        if (currentMeal) meals.push(currentMeal)
        currentMeal = {
          name: mealName,
          time: mealMatch[2] ? mealMatch[2].replace(/[()]/g, '') : null,
          items: []
        }
        return
      }
    }

    if (currentMeal && trimmed.startsWith('-')) {
      currentMeal.items.push(trimmed.substring(1).trim())
    }
  })

  if (currentMeal) meals.push(currentMeal)
  return meals
}

// Huecos de comida (breakfast, lunch...) que tiene la dieta, sin repetir, en orden.
// Son los mismos que se marcan en meal_logs al pulsar "Marcar como comida".
export function getDietMealSlots(content) {
  if (!content) return []
  const slots = parseDietMeals(content).map(m => lookupMealStyle(MEAL_NAME_TO_SLOT, m.name)).filter(Boolean)
  return [...new Set(slots)]
}

export function DietDailyView({ content, loggedSlots, onToggleMealLog }) {
  if (!content) return null

  const meals = parseDietMeals(content)
  // Diseño negro y oro: cabeceras de comida sobrias en vez de un color por comida.
  const gold = isGoldDesign()

  if (meals.length === 0) {
    // Fallback if parsing fails or structure is different
    return (
      <div>
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <DietSourcesFooter />
      </div>
    )
  }

  if (gold) return <GoldDietDaily meals={meals} loggedSlots={loggedSlots} onToggleMealLog={onToggleMealLog} />

  return (
    <div className="space-y-6 relative">
      {/* Vertical line for timeline */}
      <div className="absolute left-[21px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/50 via-cyan-500/50 to-transparent hidden sm:block" />

      {meals.map((meal, idx) => {
        const Icon = lookupMealStyle(MEAL_icons, meal.name) || Clock
        const colorClass = gold
          ? 'from-white/[0.06] to-white/[0.02] text-amber-300'
          : (lookupMealStyle(MEAL_COLORS, meal.name) || 'from-gray-500/20 to-gray-600/20 text-gray-400')
        const slot = lookupMealStyle(MEAL_NAME_TO_SLOT, meal.name)
        const isLogged = slot && loggedSlots?.includes(slot)

        return (
          <div key={idx} className="relative pl-0 sm:pl-12 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            {/* Timeline dot */}
            <div className="absolute left-4 top-1 w-3.5 h-3.5 rounded-full bg-[#1a1a1a] border-2 border-violet-500 z-10 hidden sm:block shadow-[0_0_10px_rgb(var(--nlc-violet-500)/0.5)]" />
            
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300">
              <CardContent className="p-0">
                <div className={`p-4 bg-gradient-to-r ${colorClass} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <h4 className={gold ? 'nl-display text-[22px] text-white' : 'font-black tracking-tight text-white uppercase'}>{meal.name}</h4>
                  </div>
                  {meal.time && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-black/20 rounded-full text-xs font-bold text-white/90">
                      <Clock className="w-3.5 h-3.5" />
                      {meal.time}
                    </div>
                  )}
                </div>
                
                <div className="p-5 space-y-3">
                  {meal.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 group/item">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/50 group-hover/item:bg-violet-500 transition-colors" />
                      <div className="flex-1 min-w-0 text-gray-300 text-sm leading-relaxed">
                        <DietOption item={item} />
                      </div>
                    </div>
                  ))}

                  {slot && onToggleMealLog && (
                    <Button
                      onClick={() => onToggleMealLog(slot, isLogged)}
                      variant="ghost"
                      className={`w-full mt-2 rounded-xl font-bold text-sm ${
                        isLogged
                          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/15 hover:text-green-400'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      {isLogged ? 'Comida registrada' : 'Marcar como comida'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}

      <DietSourcesFooter />
    </div>
  )
}


// ───────────── Diseño negro y oro ─────────────

const G = {
  text: 'var(--nl-text)', muted: 'var(--nl-muted)', dim: 'var(--nl-dim)', accent: 'var(--nl-accent)',
  accent2: 'var(--nl-accent2)', surface: 'var(--nl-surface)', surface2: 'var(--nl-surface2)',
  line: 'var(--nl-line)', ink: 'var(--nl-ink)', soft: 'var(--nl-soft)',
}

const mealTitle = (name) => name.charAt(0) + name.slice(1).toLowerCase()

function GoldDietDaily({ meals, loggedSlots, onToggleMealLog }) {
  return (
    <div>
      <div className="relative">
        <span aria-hidden className="absolute left-[27px] top-6 bottom-6 w-px" style={{ background: 'linear-gradient(180deg, rgba(212,175,106,0.5), rgba(212,175,106,0.06))' }} />
        <div className="space-y-3 nl-stagger">
          {meals.map((meal, idx) => {
            const Icon = lookupMealStyle(MEAL_icons, meal.name) || Clock
            const slot = lookupMealStyle(MEAL_NAME_TO_SLOT, meal.name)
            const isLogged = !!(slot && loggedSlots?.includes(slot))
            return (
              <div key={idx} className="relative flex gap-3">
                <div className="w-[56px] shrink-0 flex flex-col items-center pt-4">
                  <span
                    className="relative z-[1] w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors duration-300"
                    style={isLogged
                      ? { background: G.accent, color: G.ink, boxShadow: '0 0 0 4px rgba(212,175,106,0.15)' }
                      : { background: '#151517', border: '1px solid rgba(212,175,106,0.35)', color: G.accent }}
                  >
                    {isLogged ? <Check className="w-4 h-4" strokeWidth={2.6} /> : <Icon className="w-4 h-4" />}
                  </span>
                  {meal.time && (
                    <span className="nl-display nl-tabular text-[15px] mt-1.5" style={{ color: isLogged ? G.accent : G.muted }}>{meal.time}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 nl-card p-4 transition-colors duration-300" style={isLogged ? { borderColor: 'rgba(212,175,106,0.3)' } : undefined}>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="nl-display text-[24px]" style={{ color: G.text }}>{mealTitle(meal.name)}</h4>
                    {isLogged && (
                      <span className="shrink-0 mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-full" style={{ background: G.soft, color: G.accent }}>Hecha</span>
                    )}
                  </div>
                  <ul className="mt-3 space-y-4">
                    {meal.items.map((item, i) => (
                      <li key={i}>
                        <DietOption item={item} gold />
                      </li>
                    ))}
                  </ul>
                  {slot && onToggleMealLog && (
                    <button
                      type="button"
                      onClick={() => onToggleMealLog(slot, isLogged)}
                      className="nl-btn nl-btn-ghost w-full h-11 mt-4 text-[14px]"
                      style={isLogged ? { background: G.soft, color: G.accent } : undefined}
                    >
                      <Check className="w-4 h-4" strokeWidth={2.6} style={{ color: G.accent }} />
                      {isLogged ? 'Comida registrada' : 'Marcar como comida'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <DietSourcesFooter />
    </div>
  )
}

// Cabecera de la dieta en el diseño nuevo: calorías del día, reparto de
// macros, comidas hechas y el cambio Diario / Semanal.
export function GoldDietHero({ diet, assignedAt, loggedSlots = [], mode, onMode }) {
  const slots = getDietMealSlots(diet?.content)
  const done = slots.filter(sl => loggedSlots.includes(sl)).length
  const kcal = Number(diet?.calories) || null
  const p = Number(diet?.protein_g) || 0
  const c = Number(diet?.carbs_g) || 0
  const f = Number(diet?.fat_g) || 0
  const total = p * 4 + c * 4 + f * 9
  const R = 34
  const CIRC = 2 * Math.PI * R
  const pct = slots.length ? done / slots.length : 0
  const macros = [
    { key: 'p', label: 'Proteína', grams: p, kcal: p * 4, color: '#D4AF6A' },
    { key: 'c', label: 'Carbos', grams: c, kcal: c * 4, color: '#E9CF97' },
    { key: 'f', label: 'Grasas', grams: f, kcal: f * 9, color: '#8E7444' },
  ]
  return (
    <div
      className="nl-card relative overflow-hidden p-5 nl-hero-photo"
      style={{ ...heroBackground(HERO_IMAGES.nutricion), borderColor: 'rgba(212,175,106,0.2)' }}
    >
      <p className="nl-label">
        Mi dieta{assignedAt ? ` · desde el ${new Date(assignedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}` : ''}
      </p>
      <h2 className="nl-display text-[34px] mt-1.5" style={{ color: G.text }}>{diet?.name || 'Tu plan'}</h2>

      <div className="flex items-center gap-5 mt-5">
        {slots.length > 0 && (
          <div className="relative w-[84px] h-[84px] shrink-0">
            <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
              <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <circle
                cx="42" cy="42" r={R} fill="none" stroke="#D4AF6A" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.2,0.7,0.2,1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="nl-display nl-tabular text-[24px] leading-none" style={{ color: G.text }}>{done}/{slots.length}</span>
              <span className="text-[10px] mt-0.5" style={{ color: G.muted }}>comidas</span>
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="nl-display nl-tabular text-[42px] leading-none" style={{ color: G.text }}>
            {kcal ? kcal.toLocaleString('es-ES') : '—'}<span className="text-[16px] ml-1.5" style={{ color: G.muted }}>kcal</span>
          </p>
          {total > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden mt-3 gap-[2px]">
              {macros.map(m => (
                <span key={m.key} className="h-full nl-grow-x" style={{ width: `${(m.kcal / total) * 100}%`, background: m.color }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {macros.map(m => (
            <div key={m.key} className="rounded-[14px] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="flex items-center gap-1.5 text-[11px]" style={{ color: G.muted }}>
                <span className="w-2 h-2 rounded-full" style={{ background: m.color }} /> {m.label}
              </p>
              <p className="nl-display nl-tabular text-[22px] mt-0.5" style={{ color: G.text }}>{m.grams}<span className="text-[13px] ml-0.5" style={{ color: G.muted }}>g</span></p>
            </div>
          ))}
        </div>
      )}

      {onMode && (
        <div className="grid grid-cols-2 p-1 rounded-[14px] mt-4" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${G.line}` }}>
          {[['daily', 'Hoy', Sun], ['weekly', 'Semana completa', Calendar]].map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => onMode(value)}
              aria-pressed={mode === value}
              className="h-9 rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
              style={mode === value ? { background: G.text, color: '#0B0B0C' } : { color: G.muted }}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DietWeeklyView({ content, calories, protein, carbs, fat }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Macro Summary for Weekly View */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'CALORÍAS', value: calories, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'PROTEÍNA', value: `${protein}g`, icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'CARBOS', value: `${carbs}g`, icon: Droplets, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'GRASAS', value: `${fat}g`, icon: Info, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} rounded-2xl p-4 border border-white/5 flex flex-col items-center text-center`}>
            <m.icon className={`w-5 h-5 ${m.color} mb-2`} />
            <p className="text-white font-black text-xl">{m.value || '-'}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Full Content */}
      <div className="prose prose-invert max-w-none bg-white/[0.02] rounded-3xl p-6 sm:p-8 border border-white/5 shadow-2xl">
        <style>{`
          .prose h1, .prose h2, .prose h3 { color: white; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-top: 2.5rem; }
          .prose h2 { font-size: 1.25rem; background: linear-gradient(to right, rgb(var(--nlc-violet-500)), rgb(var(--nlc-cyan-500))); -webkit-background-clip: text; -webkit-text-fill-color: transparent; border-bottom: none; }
          .prose p { color: #d1d5db; line-height: 1.8; }
          .prose strong { color: rgb(var(--nlc-violet-500)); }
          .prose ul { list-style: none; padding-left: 0; }
          .prose li { position: relative; padding-left: 1.5rem; margin-bottom: 0.75rem; color: #9ca3af; }
          .prose li::before { content: "→"; position: absolute; left: 0; color: rgb(var(--nlc-violet-500)); font-weight: bold; }
          .prose hr { border-color: rgba(255,255,255,0.05); margin: 3rem 0; }
          .prose blockquote { border-left-color: rgb(var(--nlc-violet-500)); background: rgb(var(--nlc-violet-500) / 0.05); padding: 1.5rem; border-radius: 0 1rem 1rem 0; font-style: italic; }
        `}</style>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>

      <DietSourcesFooter />
    </div>
  )
}
