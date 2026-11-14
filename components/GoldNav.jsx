'use client'

// Navegación del socio en el diseño negro y oro: cabecera compacta, barra
// inferior con 5 secciones y subpestañas dentro de cada sección. Las 11
// pestañas de siempre siguen existiendo (mismos valores de activeTab); aquí
// solo se agrupan.

import { Home, Dumbbell, UtensilsCrossed, TrendingUp, Users, Bell, Lock, ChevronLeft } from 'lucide-react'
import { AvatarBubble } from './UserProfile'

export const MEMBER_SECTIONS = [
  {
    id: 'hoy', label: 'Hoy', icon: Home,
    tabs: [
      { value: 'today', label: 'Resumen' },
      { value: 'activity', label: 'Actividad' },
      { value: 'bienestar', label: 'Bienestar', femaleOnly: true },
    ],
  },
  { id: 'entreno', label: 'Entreno', title: 'Entreno', icon: Dumbbell, tabs: [{ value: 'workout', label: 'Rutina', premium: true }] },
  {
    id: 'nutricion', label: 'Nutrición', title: 'Nutrición', icon: UtensilsCrossed,
    tabs: [{ value: 'diet', label: 'Mi dieta', premium: true }, { value: 'recipes', label: 'Recetas' }],
  },
  {
    id: 'progreso', label: 'Progreso', title: 'Progreso', icon: TrendingUp,
    tabs: [
      { value: 'progress', label: 'Revisión', premium: true },
      { value: 'stats', label: 'Estadísticas' },
      { value: 'badges', label: 'Logros', premium: true },
    ],
  },
  {
    id: 'comunidad', label: 'Comunidad', title: 'Comunidad', icon: Users,
    tabs: [{ value: 'feed', label: 'Feed', premium: true }, { value: 'challenges', label: 'Retos' }],
  },
]

export function sectionTabs(section, profile) {
  return section.tabs.filter(t => !t.femaleOnly || profile?.sex === 'female')
}

export function sectionForTab(tab) {
  return MEMBER_SECTIONS.find(s => s.tabs.some(t => t.value === tab))?.id || null
}

export function GoldTopBar({ profile, unreadNotices, onBell, onAvatar, bellActive }) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl"
      style={{ background: 'rgba(11, 11, 12, 0.88)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-xl mx-auto px-[18px] h-14 flex items-center justify-between">
        <img src="/logo-nl-vip.jpg" alt="NL VIP Team" className="w-9 h-9 rounded-[10px] object-cover border border-white/10" />
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBell}
            aria-label={unreadNotices > 0 ? `Avisos, ${unreadNotices} sin leer` : 'Avisos'}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${bellActive ? 'border-[color:var(--nl-accent)] text-[color:var(--nl-accent)]' : 'border-white/[0.07] text-[color:var(--nl-text)]'}`}
            style={{ background: 'var(--nl-surface)' }}
          >
            <Bell className="w-[19px] h-[19px]" strokeWidth={1.8} />
            {unreadNotices > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: 'var(--nl-accent)', color: 'var(--nl-ink)', boxShadow: '0 0 0 2px var(--nl-bg)' }}
              >
                {unreadNotices > 9 ? '9+' : unreadNotices}
              </span>
            )}
          </button>
          <AvatarBubble profile={profile} size="sm" onClick={onAvatar} />
        </div>
      </div>
    </header>
  )
}

export function GoldBottomNav({ activeSection, onSection, sections = MEMBER_SECTIONS, badges = {} }) {
  return (
    <nav
      className="nl-bottomnav fixed left-0 right-0 bottom-0 z-40 border-t border-white/[0.07] backdrop-blur-xl"
      style={{ background: 'rgba(11, 11, 12, 0.94)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-xl mx-auto flex justify-around px-2 pt-2 pb-1.5">
        {sections.map(s => {
          const on = s.id === activeSection
          const Icon = s.icon
          const badge = badges[s.id] || 0
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSection(s.id)}
              aria-current={on ? 'page' : undefined}
              className="flex flex-col items-center gap-1 w-16 py-1 text-[10.5px] font-semibold transition-colors"
              style={{ color: on ? 'var(--nl-text)' : 'var(--nl-dim)' }}
            >
              <span className="relative">
                <Icon className="w-[23px] h-[23px]" strokeWidth={on ? 2.1 : 1.8} style={{ color: on ? 'var(--nl-accent)' : undefined }} />
                {badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9.5px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--nl-accent)', color: 'var(--nl-ink)', boxShadow: '0 0 0 2px #0B0B0C' }}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {s.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// Título grande de la sección + subpestañas (si hay más de una).
export function GoldSectionHeader({ kicker, title, tabs = [], activeTab, onTab, hasPremium, onLocked, onBack }) {
  return (
    <div className="mb-4">
      {onBack && (
        <button type="button" onClick={onBack} className="flex items-center gap-1 -ml-1 mb-2 text-sm font-semibold" style={{ color: 'var(--nl-muted)' }}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
      )}
      {kicker && <p className="nl-label mb-1.5">{kicker}</p>}
      <h1 className="nl-display text-[40px] mb-4" style={{ color: 'var(--nl-text)' }}>{title}</h1>
      {tabs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-[18px] px-[18px] pb-1" role="tablist">
          {tabs.map(t => {
            const locked = t.premium && !hasPremium
            const on = t.value === activeTab
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => (locked ? onLocked?.() : onTab(t.value))}
                className="shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-colors flex items-center gap-1.5"
                style={on
                  ? { background: 'var(--nl-text)', color: 'var(--nl-bg)', borderColor: 'transparent' }
                  : { background: 'var(--nl-surface)', color: 'var(--nl-muted)', borderColor: 'var(--nl-line)', opacity: locked ? 0.55 : 1 }}
              >
                {locked && <Lock className="w-3 h-3" />}
                {t.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
