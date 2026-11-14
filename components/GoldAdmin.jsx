'use client'

// Panel de administración en el diseño negro y oro: cinco secciones con barra
// inferior (Hoy · Socios · Revisiones · Contenido · Más), una pantalla Hoy con
// lo que hay que hacer y una lista de socios con buscador, filtros y estado.
// Las pantallas internas (rutinas, dietas, códigos...) son las de siempre y
// todas las acciones llaman a los mismos manejadores de AdminDashboard.

import { useMemo } from 'react'
import {
  Home, Users, ClipboardCheck, Dumbbell, Settings2, Search, ChevronRight, Sparkles, Mic, Bot,
  FileCheck, Apple, AlertTriangle, MoreHorizontal, Trash2, ClipboardList, Camera, UtensilsCrossed,
  Flame, X, Activity,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MemberActivityLine } from './MemberNudge'
import { BroadcastUpdateButton } from './BroadcastUpdateButton'
import { buildAttentionMembers, buildPlanPrompt } from './AdminCommandCenter'

const C = {
  text: 'var(--nl-text)', muted: 'var(--nl-muted)', dim: 'var(--nl-dim)', accent: 'var(--nl-accent)',
  accent2: 'var(--nl-accent2)', surface: 'var(--nl-surface)', surface2: 'var(--nl-surface2)',
  line: 'var(--nl-line)', ink: 'var(--nl-ink)', soft: 'var(--nl-soft)',
}

export const ADMIN_SECTIONS = [
  { id: 'hoy', label: 'Hoy', icon: Home, tabs: [{ value: 'today', label: 'Resumen' }, { value: 'assistant', label: 'Asistente IA' }] },
  { id: 'socios', label: 'Socios', title: 'Socios', icon: Users, tabs: [{ value: 'members', label: 'Socios' }, { value: 'assignments', label: 'Asignaciones' }] },
  { id: 'revisiones', label: 'Revisiones', title: 'Revisiones', icon: ClipboardCheck, tabs: [{ value: 'checkins', label: 'Revisiones' }] },
  {
    id: 'contenido', label: 'Contenido', title: 'Contenido', icon: Dumbbell,
    tabs: [
      { value: 'workouts', label: 'Rutinas' }, { value: 'diets', label: 'Dietas' }, { value: 'recipes', label: 'Recetas' },
      { value: 'challenges', label: 'Retos' }, { value: 'feed', label: 'Feed' }, { value: 'calculator', label: 'Macros' },
    ],
  },
  {
    id: 'mas', label: 'Más', title: 'Gestión', icon: Settings2,
    tabs: [{ value: 'trainers', label: 'Entrenadores' }, { value: 'codes', label: 'Códigos' }, { value: 'moderation', label: 'Moderación' }],
  },
]

export function adminSectionForTab(tab) {
  return ADMIN_SECTIONS.find(s => s.tabs.some(t => t.value === tab))?.id || 'hoy'
}

const memberName = (m) => m?.name || m?.email?.split('@')[0] || 'Socio'

function Monogram({ name, size = 40 }) {
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center nl-display"
      style={{ width: size, height: size, fontSize: size * 0.46, background: 'linear-gradient(145deg,#2A251B,#1A1814)', color: C.accent, border: '1px solid rgba(212,175,106,0.28)' }}
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function StatusChip({ children, tone = 'gold' }) {
  const styles = tone === 'gold'
    ? { background: C.soft, color: C.accent }
    : tone === 'red'
      ? { background: 'rgba(239,68,68,0.12)', color: '#F19A9A' }
      : { background: 'rgba(255,255,255,0.06)', color: C.muted }
  return <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] px-2 py-[3px] rounded-full whitespace-nowrap" style={styles}>{children}</span>
}

// ───────────────────────── Hoy ─────────────────────────

function ActionTile({ icon: Icon, value, label, sub, onClick }) {
  const hot = value > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="nl-card text-left px-3.5 py-3 transition-transform active:scale-[0.98]"
      style={hot ? { borderColor: 'rgba(212,175,106,0.35)', background: 'linear-gradient(160deg,#211D14 0%,#151517 70%)' } : undefined}
    >
      {/* Compacta: icono y número en la misma fila (antes un cuadro alto
          con el número a 40 px, que en el ordenador quedaba enorme). */}
      <span className="flex items-center justify-between gap-2">
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: hot ? C.soft : C.surface2, color: hot ? C.accent : C.dim }}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="nl-display nl-tabular text-[30px] leading-none" style={{ color: hot ? C.text : C.dim }}>{value}</span>
      </span>
      <span className="block text-[13px] font-semibold mt-2" style={{ color: hot ? C.text : C.muted }}>{label}</span>
      {sub && <span className="block text-[11px] mt-0.5 truncate" style={{ color: C.dim }}>{sub}</span>}
    </button>
  )
}

export function GoldAdminToday({
  members = [], membersWithoutWorkout = [], membersWithoutDiet = [], dietRequests = [],
  pendingCheckinsCount = 0, pendingDietSubmissions = 0, memberActivity = {},
  onGo, onOpenMember, onGeneratePlan, onAssistant,
}) {
  const attention = useMemo(
    () => buildAttentionMembers(membersWithoutWorkout, membersWithoutDiet, dietRequests),
    [membersWithoutWorkout, membersWithoutDiet, dietRequests]
  )
  const withActivity = members.filter(m => memberActivity[m.id])
  const active = withActivity.filter(m => memberActivity[m.id].daysInactive != null && memberActivity[m.id].daysInactive <= 7).length
  const inactive = withActivity.length - active
  const activityLoaded = withActivity.length > 0
  const pct = members.length ? active / members.length : 0
  const allClear = pendingCheckinsCount + pendingDietSubmissions + attention.length === 0

  return (
    <div className="space-y-5 nl-stagger">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <ActionTile icon={ClipboardCheck} value={pendingCheckinsCount} label="Revisiones" sub="por revisar" onClick={() => onGo('checkins')} />
        <ActionTile icon={FileCheck} value={pendingDietSubmissions} label="Cuestionarios" sub="nutricionales nuevos" onClick={() => onGo('diets')} />
        <ActionTile icon={Dumbbell} value={membersWithoutWorkout.length} label="Sin rutina" sub="socios sin asignar" onClick={() => onGo('members', 'sin_rutina')} />
        <ActionTile icon={Apple} value={membersWithoutDiet.length} label="Sin dieta" sub="socios sin asignar" onClick={() => onGo('members', 'sin_dieta')} />
      </div>

      {/* En pantallas grandes: actividad y asistente a la izquierda,
          "Necesita atención" a la derecha. En el móvil, una columna. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <section className="nl-card p-[18px] lg:col-start-1 lg:row-start-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="nl-label">Actividad de los socios</p>
            <p className="nl-display nl-tabular text-[32px] mt-1.5 leading-none" style={{ color: C.text }}>
              {activityLoaded ? active : '—'}<span className="text-[17px] ml-1.5" style={{ color: C.muted }}>de {members.length} activos</span>
            </p>
            <p className="text-[12.5px] mt-1.5" style={{ color: C.muted }}>con actividad en los últimos 7 días</p>
          </div>
          <Activity className="w-6 h-6 shrink-0 mt-1" style={{ color: C.accent }} />
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mt-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full nl-grow-x" style={{ width: `${Math.round(pct * 100)}%`, background: 'linear-gradient(90deg,#B8914F,#E9CF97)' }} />
        </div>
        {activityLoaded && inactive > 0 && (
          <button type="button" onClick={() => onGo('members', 'inactivos')} className="mt-4 w-full flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 text-left" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-[13.5px]" style={{ color: C.text }}>
              <b className="nl-tabular">{inactive}</b> {inactive === 1 ? 'socio lleva' : 'socios llevan'} más de una semana sin actividad
            </span>
            <span className="flex items-center gap-1 text-[12.5px] font-semibold shrink-0" style={{ color: C.accent }}>Ver <ChevronRight className="w-4 h-4" /></span>
          </button>
        )}
      </section>

      <section className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <div className="flex items-end justify-between mb-2.5 px-0.5">
          <span className="nl-label flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" style={{ color: C.accent }} /> Necesita atención</span>
          {attention.length > 0 && <span className="text-[12.5px] nl-tabular" style={{ color: C.muted }}>{attention.length}</span>}
        </div>
        {members.length === 0 ? (
          <div className="nl-card h-[180px] animate-pulse" />
        ) : allClear || attention.length === 0 ? (
          <div className="nl-card px-5 py-8 text-center">
            <p className="nl-display text-[26px]" style={{ color: C.text }}>Todo al día</p>
            <p className="text-[13px] mt-1" style={{ color: C.muted }}>Todos los socios tienen rutina y dieta asignadas.</p>
          </div>
        ) : (
          <div className="nl-card overflow-hidden">
            {attention.slice(0, 6).map((m, i) => {
              const submitted = m.dietRequest?.status === 'submitted'
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <Monogram name={memberName(m)} size={38} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-semibold truncate" style={{ color: C.text }}>{memberName(m)}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.missingWorkout && <StatusChip>Sin rutina</StatusChip>}
                      {m.missingDiet && <StatusChip>Sin dieta</StatusChip>}
                      {submitted && <StatusChip tone="neutral">Formulario listo</StatusChip>}
                    </div>
                  </div>
                  {submitted ? (
                    <button
                      type="button"
                      onClick={() => onGeneratePlan(buildPlanPrompt(memberName(m), m.dietRequest?.responses))}
                      className="h-9 px-3 rounded-[12px] text-[12.5px] font-bold flex items-center gap-1 shrink-0"
                      style={{ background: C.accent, color: C.ink }}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Generar IA
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenMember(m, 'form')}
                      className="h-9 px-3 rounded-[12px] text-[12.5px] font-bold flex items-center gap-0.5 shrink-0"
                      style={{ background: C.surface2, color: C.text }}
                    >
                      Asignar <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
            {attention.length > 6 && (
              <button type="button" onClick={() => onGo('members', 'pendientes')} className="w-full px-4 py-3.5 text-[13px] font-semibold flex items-center justify-center gap-1" style={{ borderTop: `1px solid ${C.line}`, color: C.accent }}>
                Ver los {attention.length} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </section>

      <section className="nl-card relative overflow-hidden p-[18px] lg:col-start-1 lg:row-start-2" style={{ background: 'linear-gradient(160deg,#211D14 0%,#151517 65%)', borderColor: 'rgba(212,175,106,0.22)' }}>
        <Bot aria-hidden className="absolute -right-4 -top-5 w-28 h-28" style={{ color: 'rgba(212,175,106,0.07)' }} />
        <div className="relative">
          <p className="nl-label" style={{ color: C.accent }}>Asistente IA</p>
          <p className="nl-display text-[24px] mt-1.5" style={{ color: C.text }}>Pídeselo por voz o por escrito</p>
          <p className="text-[13.5px] mt-1.5 leading-relaxed" style={{ color: C.muted }}>Asignar rutinas y dietas, generar planes, buscar socios o crear códigos.</p>
          <div className="flex gap-2.5 mt-4">
            <button type="button" onClick={() => onAssistant(false)} className="nl-btn flex-1"><Sparkles className="w-[18px] h-[18px]" /> Abrir asistente</button>
            <button type="button" onClick={() => onAssistant(true)} aria-label="Hablar con el asistente" className="nl-btn nl-btn-ghost w-[52px] shrink-0" style={{ color: C.accent }}>
              <Mic className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
      </div>
    </div>
  )
}

// ───────────────────────── Socios ─────────────────────────

export function GoldAdminMembers({
  members = [], trainers = [], memberActivity = {}, refreshMemberActivity,
  membersWithoutWorkout = [], membersWithoutDiet = [], pendingCheckins = [], loading,
  search, onSearch, filter = 'todos', onFilter, onOpenMember, onAssignTrainer, onDelete,
}) {
  const noWorkout = useMemo(() => new Set(membersWithoutWorkout.map(m => m.id)), [membersWithoutWorkout])
  const noDiet = useMemo(() => new Set(membersWithoutDiet.map(m => m.id)), [membersWithoutDiet])
  const pendingReview = useMemo(
    () => new Set((pendingCheckins || []).filter(c => c && (c.status === 'draft_ready' || c.status === 'failed')).map(c => c.member_id)),
    [pendingCheckins]
  )
  const isInactive = (m) => {
    const a = memberActivity[m.id]
    return !!a && (a.daysInactive == null || a.daysInactive > 7)
  }
  const FILTERS = [
    { id: 'todos', label: 'Todos', test: () => true },
    { id: 'pendientes', label: 'Sin plan', test: m => noWorkout.has(m.id) || noDiet.has(m.id) },
    { id: 'sin_rutina', label: 'Sin rutina', test: m => noWorkout.has(m.id) },
    { id: 'sin_dieta', label: 'Sin dieta', test: m => noDiet.has(m.id) },
    { id: 'revision', label: 'Revisión pendiente', test: m => pendingReview.has(m.id) },
    { id: 'inactivos', label: 'Inactivos +7 días', test: isInactive },
    { id: 'sin_entrenador', label: 'Sin entrenador', test: m => !(m.trainer_members?.length) },
  ]
  const current = FILTERS.find(f => f.id === filter) || FILTERS[0]
  const q = (search || '').trim().toLowerCase()
  const list = members
    .filter(current.test)
    .filter(m => !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: C.muted }}><b className="nl-tabular" style={{ color: C.text }}>{members.length}</b> socios registrados</p>
        <BroadcastUpdateButton memberCount={members.length} />
      </div>

      <div className="relative">
        <Search className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2" style={{ color: C.dim }} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por nombre o email"
          className="w-full h-12 rounded-[16px] pl-11 pr-10 text-[15px] outline-none border transition-colors focus:border-[rgba(212,175,106,0.5)]"
          style={{ background: C.surface, borderColor: C.line, color: C.text, caretColor: '#D4AF6A' }}
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Borrar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.surface2, color: C.muted }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="nl-noscroll -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-1.5 w-max">
          {FILTERS.map(f => {
            const on = f.id === current.id
            const count = members.filter(f.test).length
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilter(f.id)}
                aria-pressed={on}
                className="h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 border transition-colors"
                style={on ? { background: C.text, color: '#0B0B0C', borderColor: 'transparent' } : { background: C.surface, color: C.muted, borderColor: C.line }}
              >
                {f.label}
                <span className="nl-tabular text-[11.5px]" style={{ opacity: 0.7 }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2 lg:items-start">
        {list.map(m => {
          const trainerId = m.trainer_members?.[0]?.trainer_id || m.trainer_members?.[0]?.trainer?.id || ''
          const info = memberActivity[m.id]
          return (
            <div key={m.id} className="nl-card p-3.5">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => onOpenMember(m, 'form')} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                  <Monogram name={memberName(m)} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold truncate" style={{ color: C.text }}>{memberName(m)}</span>
                      {info?.streak >= 2 && (
                        <span className="flex items-center gap-0.5 text-[12px] font-bold shrink-0" style={{ color: C.accent }}><Flame className="w-3.5 h-3.5" />{info.streak}</span>
                      )}
                    </span>
                    <span className="block text-[12px] truncate" style={{ color: C.muted }}>
                      {m.email}{m.app_version ? ` · app ${m.app_version}` : ''}
                    </span>
                    {(noWorkout.has(m.id) || noDiet.has(m.id) || pendingReview.has(m.id)) && (
                      <span className="flex flex-wrap gap-1 mt-1.5">
                        {noWorkout.has(m.id) && <StatusChip>Sin rutina</StatusChip>}
                        {noDiet.has(m.id) && <StatusChip>Sin dieta</StatusChip>}
                        {pendingReview.has(m.id) && <StatusChip tone="neutral">Revisión pendiente</StatusChip>}
                      </span>
                    )}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`Opciones de ${memberName(m)}`} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.surface2, color: C.muted }}>
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#151517] border-white/10 rounded-2xl p-1.5 min-w-[210px]">
                    <DropdownMenuItem onSelect={() => onOpenMember(m, 'form')} className="rounded-xl gap-2.5 py-2.5 text-[14px]"><ClipboardList className="w-4 h-4" /> Formulario</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenMember(m, 'photos')} className="rounded-xl gap-2.5 py-2.5 text-[14px]"><Camera className="w-4 h-4" /> Fotos y medidas</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenMember(m, 'workout')} className="rounded-xl gap-2.5 py-2.5 text-[14px]"><Dumbbell className="w-4 h-4" /> Rutina</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenMember(m, 'diet')} className="rounded-xl gap-2.5 py-2.5 text-[14px]"><UtensilsCrossed className="w-4 h-4" /> Dieta</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onSelect={() => onDelete(m.id)} className="rounded-xl gap-2.5 py-2.5 text-[14px] text-red-300 focus:text-red-200 focus:bg-red-500/10"><Trash2 className="w-4 h-4" /> Eliminar socio</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-2.5 pl-[52px] space-y-2">
                <MemberActivityLine memberId={m.id} memberName={m.name} info={info} onNudged={refreshMemberActivity} />
                <Select value={trainerId} onValueChange={(val) => onAssignTrainer(m.id, val)} disabled={loading}>
                  <SelectTrigger className="h-8 w-auto max-w-full gap-2 rounded-full border-white/10 bg-white/[0.04] text-[12.5px] px-3" style={{ color: trainerId ? C.text : C.muted }}>
                    <Users className="w-3.5 h-3.5 shrink-0" style={{ color: C.accent }} />
                    <SelectValue placeholder="Sin entrenador" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-[13px]">{t.name} ({t.role === 'admin' ? 'Admin' : 'Coach'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="nl-card px-5 py-10 text-center">
            <p className="nl-display text-[24px]" style={{ color: C.text }}>{members.length === 0 ? 'Sin socios todavía' : 'Nadie por aquí'}</p>
            <p className="text-[13px] mt-1" style={{ color: C.muted }}>
              {members.length === 0 ? 'No hay socios registrados.' : q ? 'Ningún socio coincide con la búsqueda en este filtro.' : 'Ningún socio cumple este filtro ahora mismo.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
