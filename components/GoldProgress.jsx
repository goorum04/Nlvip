'use client'

// Progreso (pestaña Revisión) del diseño negro y oro: el peso como
// protagonista con su gráfica, el estado de la revisión, un comparador
// antes/ahora deslizable con las fotos, las medidas con su evolución y la
// galería. Mismos datos y mismas acciones que el diseño clásico.

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Camera, Lock, Plus, Trash2, ChevronDown, ChevronsLeftRight, ClipboardList, Images,
} from 'lucide-react'
import { EvolutionCard } from './EvolutionCard'
import { ProgressPhotoGallery } from './ProgressPhotos'

const C = {
  text: 'var(--nl-text)', muted: 'var(--nl-muted)', dim: 'var(--nl-dim)', accent: 'var(--nl-accent)',
  accent2: 'var(--nl-accent2)', surface: 'var(--nl-surface)', surface2: 'var(--nl-surface2)',
  line: 'var(--nl-line)', ink: 'var(--nl-ink)', soft: 'var(--nl-soft)',
}
const PHOTO_LABELS = { front: 'Frente', side: 'Lado izq.', side_right: 'Lado der.', back: 'Espalda' }
const MEASURES = [
  ['chest_cm', 'Pecho'], ['waist_cm', 'Cintura'], ['hips_cm', 'Cadera'], ['glutes_cm', 'Glúteo'],
  ['arms_cm', 'Brazo'], ['legs_cm', 'Pierna'], ['calves_cm', 'Gemelo'],
]

const fmt = (n, digits = 1) => {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Math.round(Number(n) * 10 ** digits) / 10 ** digits
  return String(v).replace('.', ',')
}
const dateShort = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
const dateLong = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
const signed = (n, digits = 1) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), digits)

// Curva suave que no se pasa de los puntos (interpolación monótona).
function monotonePath(pts) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x},${pts[0].y}`
  if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`
  const dx = []
  const m = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x
    m[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1)
  }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0
    else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i])
    }
  }
  t[n - 1] = m[n - 2]
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${pts[i].x + h},${pts[i].y + h * t[i]} ${pts[i + 1].x - h},${pts[i + 1].y - h * t[i + 1]} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  return d
}

export function GoldProgressView({
  memberId, memberName, weightSeries = [], records = [], photos = [],
  checkinState, nextCheckinDueAt, reminderDays, checkInForm,
  onNewCheckin, onOnboarding, onDeletePhoto, onDeleteRecord,
}) {
  if (checkinState === 'form') return <div className="space-y-4">{checkInForm}</div>

  return (
    <div className="space-y-5">
      <WeightHero series={weightSeries} />
      <CheckinStatus state={checkinState} nextCheckinDueAt={nextCheckinDueAt} reminderDays={reminderDays} onNew={onNewCheckin} onOnboarding={onOnboarding} />
      <BeforeAfter photos={photos} memberId={memberId} memberName={memberName} />
      <Measurements records={records} onDelete={onDeleteRecord} />
      <section>
        <div className="flex items-end justify-between mb-2.5 px-0.5">
          <span className="nl-label">Fotos de progreso</span>
          <Images className="w-4 h-4" style={{ color: C.dim }} />
        </div>
        <div className="nl-card p-4">
          <ProgressPhotoGallery photos={photos} canDelete onDelete={onDeletePhoto} />
        </div>
      </section>
    </div>
  )
}

// ───────────────────────── peso ─────────────────────────

function WeightHero({ series }) {
  const pts = useMemo(() => (series || [])
    .filter(p => p.weight != null && p.rawDate && Number.isFinite(Number(p.weight)))
    .map(p => ({ t: new Date(p.rawDate).getTime(), w: Number(p.weight), date: p.rawDate }))
    .sort((a, b) => a.t - b.t), [series])

  const shell = (children) => (
    <div
      className="nl-card relative overflow-hidden p-5"
      style={{
        background: 'radial-gradient(110% 80% at 100% 0%, rgba(212,175,106,0.16) 0%, rgba(212,175,106,0) 55%), linear-gradient(165deg,#1C1A15 0%,#151517 60%)',
        borderColor: 'rgba(212,175,106,0.16)',
      }}
    >
      {children}
    </div>
  )

  if (pts.length === 0) {
    return shell(
      <>
        <p className="nl-label">Tu peso</p>
        <p className="nl-display text-[56px] mt-1.5" style={{ color: C.dim }}>— kg</p>
        <p className="text-[13.5px] mt-2 leading-relaxed max-w-[34ch]" style={{ color: C.muted }}>
          Tu evolución aparecerá aquí en cuanto envíes tu primera revisión.
        </p>
      </>
    )
  }

  const first = pts[0]
  const last = pts[pts.length - 1]
  const delta = last.w - first.w
  const min = Math.min(...pts.map(p => p.w))
  return shell(
    <>
      <p className="nl-label">Peso actual</p>
      <div className="flex items-end justify-between gap-3 mt-1">
        <p className="nl-display nl-tabular text-[66px] leading-none" style={{ color: C.text }}>
          {fmt(last.w)}<span className="text-[24px] ml-1.5" style={{ color: C.muted }}>kg</span>
        </p>
        {pts.length > 1 && (
          <div className="text-right pb-1">
            <p className="nl-display nl-tabular text-[28px]" style={{ color: C.accent }}>{signed(delta)} kg</p>
            <p className="text-[12px]" style={{ color: C.muted }}>desde el {dateShort(first.date)}</p>
          </div>
        )}
      </div>
      {pts.length > 1 && <WeightChart pts={pts} />}
      <div className="flex flex-wrap gap-1.5 mt-4">
        <span className="nl-chip" style={{ background: 'rgba(255,255,255,0.06)' }}>Inicio {fmt(first.w)} kg</span>
        <span className="nl-chip" style={{ background: 'rgba(255,255,255,0.06)' }}>Mínimo {fmt(min)} kg</span>
        <span className="nl-chip" style={{ background: 'rgba(255,255,255,0.06)' }}>{pts.length} {pts.length === 1 ? 'registro' : 'registros'}</span>
      </div>
    </>
  )
}

function WeightChart({ pts }) {
  const boxRef = useRef(null)
  const [W, setW] = useState(320)
  const [hover, setHover] = useState(null)
  const H = 140
  const PAD_T = 14
  const PAD_B = 10
  const PAD_X = 8

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setW(Math.max(160, Math.round(el.clientWidth)))
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const t0 = pts[0].t
  const t1 = pts[pts.length - 1].t
  const minW = Math.min(...pts.map(p => p.w))
  const maxW = Math.max(...pts.map(p => p.w))
  const span = Math.max(1, maxW - minW)
  const lo = minW - span * 0.3
  const hi = maxW + span * 0.3
  const xy = pts.map((p, i) => ({
    x: PAD_X + (t1 === t0 ? i / (pts.length - 1) : (p.t - t0) / (t1 - t0)) * (W - 2 * PAD_X),
    y: PAD_T + (1 - (p.w - lo) / (hi - lo)) * (H - PAD_T - PAD_B),
  }))
  const line = monotonePath(xy)
  const area = `${line}L${xy[xy.length - 1].x},${H}L${xy[0].x},${H}Z`
  const lastPt = xy[xy.length - 1]
  const active = hover != null ? hover : null

  const onMove = (e) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    let best = 0
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i].x - x) < Math.abs(xy[best].x - x)) best = i
    setHover(best)
  }

  return (
    <div
      ref={boxRef}
      className="relative mt-4 select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onMove}
      onPointerMove={(e) => { if (e.pointerType === 'mouse' || e.buttons) onMove(e) }}
      onPointerLeave={() => setHover(null)}
      onPointerUp={(e) => { if (e.pointerType !== 'mouse') setTimeout(() => setHover(null), 1400) }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" aria-label="Evolución de tu peso" role="img">
        <defs>
          <linearGradient id="nlWeightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D4AF6A" stopOpacity="0.30" />
            <stop offset="1" stopColor="#D4AF6A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nlWeightLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8E7444" />
            <stop offset="1" stopColor="#E9CF97" />
          </linearGradient>
        </defs>
        {[0.2, 0.5, 0.8].map(f => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" />
        ))}
        <path d={area} fill="url(#nlWeightFill)" className="nl-fade-in" />
        <path d={line} fill="none" stroke="url(#nlWeightLine)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="nl-draw" />
        {xy.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === xy.length - 1 ? 0 : 2.2} fill="#0B0B0C" stroke="rgba(233,207,151,0.7)" strokeWidth="1.4" className="nl-fade-in" />
        ))}
        <circle cx={lastPt.x} cy={lastPt.y} r="9" fill="rgba(212,175,106,0.22)" className="nl-pop" />
        <circle cx={lastPt.x} cy={lastPt.y} r="4.5" fill="#E9CF97" className="nl-pop" />
        {active != null && (
          <>
            <line x1={xy[active].x} x2={xy[active].x} y1={0} y2={H} stroke="rgba(233,207,151,0.35)" strokeWidth="1" />
            <circle cx={xy[active].x} cy={xy[active].y} r="5" fill="#E9CF97" stroke="#0B0B0C" strokeWidth="2" />
          </>
        )}
      </svg>
      {active != null && (
        <div
          className="absolute -translate-x-1/2 px-2.5 py-1.5 rounded-[10px] text-center pointer-events-none whitespace-nowrap z-[1]"
          style={{
            left: Math.min(Math.max(xy[active].x, 48), W - 48),
            // Encima del punto si cabe; si el punto está muy arriba, debajo.
            top: xy[active].y > 64 ? xy[active].y - 12 : xy[active].y + 14,
            transform: `translate(-50%, ${xy[active].y > 64 ? '-100%' : '0'})`,
            background: '#26231C',
            border: '1px solid rgba(212,175,106,0.3)',
            boxShadow: '0 10px 24px -8px rgba(0,0,0,0.8)',
          }}
        >
          <p className="nl-display nl-tabular text-[18px]" style={{ color: C.text }}>{fmt(pts[active].w)} kg</p>
          <p className="text-[10.5px]" style={{ color: C.muted }}>{dateLong(pts[active].date)}</p>
        </div>
      )}
      <div className="flex justify-between text-[11px] mt-1.5" style={{ color: C.dim }}>
        <span>{dateShort(pts[0].date)}</span>
        <span>{dateShort(pts[pts.length - 1].date)}</span>
      </div>
    </div>
  )
}

// ───────────────────────── revisión ─────────────────────────

function CheckinStatus({ state, nextCheckinDueAt, reminderDays, onNew, onOnboarding }) {
  if (state === 'onboarding') {
    return (
      <div className="nl-card p-[18px]">
        <p className="nl-label">Antes de tu primera revisión</p>
        <p className="nl-display text-[30px] mt-1.5" style={{ color: C.text }}>Completa tu cuestionario</p>
        <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: C.muted }}>Necesitamos esos datos antes de poder revisar tu progreso.</p>
        <button type="button" onClick={onOnboarding} className="nl-btn w-full mt-4"><ClipboardList className="w-[18px] h-[18px]" /> Rellenar cuestionario</button>
      </div>
    )
  }
  if (state === 'cooldown' && nextCheckinDueAt) {
    const msLeft = nextCheckinDueAt.getTime() - Date.now()
    const daysLeft = Math.max(1, Math.ceil(msLeft / 86400000))
    const pct = reminderDays ? Math.min(1, Math.max(0, 1 - msLeft / (reminderDays * 86400000))) : null
    return (
      <div className="nl-card p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="nl-label">Próxima revisión</p>
            <p className="nl-display text-[32px] mt-1.5" style={{ color: C.text }}>
              {nextCheckinDueAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" style={{ background: C.surface2 }}>
            <Lock className="w-[18px] h-[18px]" style={{ color: C.muted }} />
          </span>
        </div>
        <p className="text-[13.5px] mt-1.5" style={{ color: C.muted }}>
          Ya has enviado tu revisión. {daysLeft === 1 ? 'Mañana' : `En ${daysLeft} días`} podrás enviar la siguiente.
        </p>
        {pct != null && (
          <div className="h-1.5 rounded-full overflow-hidden mt-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full nl-grow-x" style={{ width: `${Math.round(pct * 100)}%`, background: 'linear-gradient(90deg,#B8914F,#E9CF97)' }} />
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="nl-card relative overflow-hidden p-[18px]" style={{ background: 'linear-gradient(160deg,#211D14 0%,#151517 60%)', borderColor: 'rgba(212,175,106,0.28)' }}>
      <Camera aria-hidden className="absolute -right-3 -bottom-4 w-28 h-28" style={{ color: 'rgba(212,175,106,0.07)' }} />
      <div className="relative">
        <p className="nl-label" style={{ color: C.accent }}>Toca revisión</p>
        <p className="nl-display text-[34px] mt-1.5" style={{ color: C.text }}>Envía tu revisión</p>
        <p className="text-[13.5px] mt-1.5" style={{ color: C.muted }}>Peso, medidas, cómo te sientes y tus 3 fotos. Tu entrenador la revisa y ajusta tu plan.</p>
        <button type="button" onClick={onNew} className="nl-btn w-full mt-4"><Plus className="w-5 h-5" /> Nueva revisión</button>
      </div>
    </div>
  )
}

// ───────────────────────── antes / ahora ─────────────────────────

function BeforeAfter({ photos, memberId, memberName }) {
  const groups = useMemo(() => {
    const map = new Map()
    for (const p of photos || []) {
      if (!p.photo_url) continue
      const key = p.group_id || p.date
      if (!map.has(key)) map.set(key, { key, date: p.date, byType: {} })
      const g = map.get(key)
      if (!g.byType[p.photo_type]) g.byType[p.photo_type] = p
    }
    return [...map.values()].sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [photos])

  const first = groups[0]
  const last = groups[groups.length - 1]
  const types = groups.length >= 2
    ? ['front', 'side', 'side_right', 'back'].filter(t => first.byType[t] && last.byType[t])
    : []
  const [type, setType] = useState(null)
  const [urls, setUrls] = useState({})
  const current = type && types.includes(type) ? type : types[0]

  const pathsKey = types.map(t => `${first.byType[t].photo_url}|${last.byType[t].photo_url}`).join(',')
  useEffect(() => {
    if (!pathsKey) return
    let cancelled = false
    const paths = types.flatMap(t => [first.byType[t].photo_url, last.byType[t].photo_url])
    supabase.storage.from('progress_photos').createSignedUrls(paths, 3600).then(({ data }) => {
      if (cancelled || !data) return
      const out = {}
      for (const s of data) if (s.signedUrl) out[s.path] = s.signedUrl
      setUrls(out)
    })
    return () => { cancelled = true }
  }, [pathsKey])

  if (!current) return null
  const before = urls[first.byType[current].photo_url]
  const after = urls[last.byType[current].photo_url]
  const weeks = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / (7 * 86400000)))

  return (
    <section>
      <div className="flex items-end justify-between mb-2.5 px-0.5">
        <span className="nl-label">Antes y ahora</span>
        <span className="text-[12.5px]" style={{ color: C.muted }}>{weeks} {weeks === 1 ? 'semana' : 'semanas'}</span>
      </div>
      <div className="nl-card p-3">
        {before && after ? (
          <CompareSlider before={before} after={after} beforeLabel={dateShort(first.date)} afterLabel={dateShort(last.date)} />
        ) : (
          <div className="aspect-[3/4] rounded-[18px] animate-pulse" style={{ background: C.surface2 }} />
        )}
        {types.length > 1 && (
          <div className="flex gap-1.5 mt-3 justify-center">
            {types.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={t === current}
                className="h-8 px-3 rounded-full text-[12.5px] font-semibold transition-colors"
                style={t === current ? { background: C.text, color: '#0B0B0C' } : { background: C.surface2, color: C.muted }}
              >
                {PHOTO_LABELS[t] || t}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3">
          <EvolutionCard memberId={memberId} memberName={memberName} variant="gold" />
        </div>
      </div>
    </section>
  )
}

function CompareSlider({ before, after, beforeLabel, afterLabel }) {
  const boxRef = useRef(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)

  const move = (clientX) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div
      ref={boxRef}
      className="relative aspect-[3/4] rounded-[18px] overflow-hidden select-none cursor-ew-resize"
      style={{ touchAction: 'pan-y', background: '#000' }}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); move(e.clientX) }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
      role="slider"
      aria-label="Comparar antes y ahora"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPos(p => Math.max(0, p - 5))
        if (e.key === 'ArrowRight') setPos(p => Math.min(100, p + 5))
      }}
    >
      <img src={after} alt="Ahora" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="Antes" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <span className="absolute left-3 top-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.1em]" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(6px)' }}>
        Antes · {beforeLabel}
      </span>
      <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.1em]" style={{ background: 'rgba(212,175,106,0.9)', color: '#1B150A' }}>
        Ahora · {afterLabel}
      </span>
      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute top-0 bottom-0 -translate-x-1/2 w-[2px]" style={{ background: 'linear-gradient(180deg, rgba(233,207,151,0.2), #E9CF97 30%, #E9CF97 70%, rgba(233,207,151,0.2))' }} />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#E9CF97', color: '#1B150A', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <ChevronsLeftRight className="w-5 h-5" strokeWidth={2.4} />
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── medidas ─────────────────────────

function Measurements({ records, onDelete }) {
  const [showHistory, setShowHistory] = useState(false)
  if (!records || records.length === 0) return null
  const asc = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
  const rows = MEASURES.map(([key, label]) => {
    const vals = asc.filter(r => r[key] != null && Number.isFinite(Number(r[key])))
    if (vals.length === 0) return null
    const first = Number(vals[0][key])
    const last = Number(vals[vals.length - 1][key])
    return { key, label, first, last, delta: last - first, count: vals.length, lastDate: vals[vals.length - 1].date }
  }).filter(Boolean)
  const desc = [...asc].reverse()

  return (
    <section>
      <div className="flex items-end justify-between mb-2.5 px-0.5">
        <span className="nl-label">Medidas</span>
        {asc.length > 1 && <span className="text-[12.5px]" style={{ color: C.muted }}>desde el {dateShort(asc[0].date)}</span>}
      </div>
      <div className="nl-card overflow-hidden">
        {rows.length > 0 && (
          <div>
            <div className="grid grid-cols-[1fr_64px_64px_70px] gap-2 px-4 pt-3.5 pb-2">
              <span className="nl-label">Zona</span>
              <span className="nl-label text-right">Inicio</span>
              <span className="nl-label text-right">Ahora</span>
              <span />
            </div>
            {rows.map(r => (
              <div key={r.key} className="grid grid-cols-[1fr_64px_64px_70px] gap-2 items-center px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                <span className="text-[14px] font-medium" style={{ color: C.text }}>{r.label}</span>
                <span className="text-right nl-tabular text-[13.5px]" style={{ color: C.muted }}>{r.count > 1 ? fmt(r.first) : '—'}</span>
                <span className="text-right nl-display nl-tabular text-[20px]" style={{ color: C.text }}>{fmt(r.last)}</span>
                <span className="justify-self-end">
                  {r.count > 1 && Math.abs(r.delta) >= 0.05 ? (
                    <span className="inline-flex items-center h-6 px-2 rounded-full text-[12px] font-semibold nl-tabular" style={{ background: C.soft, color: C.accent }}>
                      {signed(r.delta)} cm
                    </span>
                  ) : r.count === 1 ? (
                    // Solo se ha medido una vez: se indica cuándo, sin comparar.
                    <span className="text-[11.5px]" style={{ color: C.dim }}>{dateShort(r.lastDate)}</span>
                  ) : (
                    <span className="text-[12px]" style={{ color: C.dim }}>cm</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowHistory(s => !s)}
          aria-expanded={showHistory}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
          style={{ borderTop: rows.length > 0 ? `1px solid ${C.line}` : 'none' }}
        >
          <span className="text-[13.5px] font-semibold" style={{ color: C.text }}>Historial de revisiones ({desc.length})</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} style={{ color: C.muted }} />
        </button>
        {showHistory && (
          <div>
            {desc.map(r => (
              <div key={r.id} className="flex items-start gap-3 pl-4 pr-2 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-semibold" style={{ color: C.accent }}>{dateLong(r.date)}</span>
                    {r.weight_kg != null && <span className="nl-display nl-tabular text-[20px]" style={{ color: C.text }}>{fmt(r.weight_kg)} kg</span>}
                  </div>
                  <p className="text-[12px] mt-1 leading-relaxed" style={{ color: C.muted }}>
                    {MEASURES.filter(([k]) => r[k] != null).map(([k, label]) => `${label} ${fmt(r[k])}`).join(' · ') || 'Sin medidas'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  aria-label={`Eliminar el registro del ${dateLong(r.date)}`}
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors hover:text-red-400"
                  style={{ color: C.dim }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default GoldProgressView
