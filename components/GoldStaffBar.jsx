'use client'

// Cabecera del panel de entrenador y de administración en el diseño negro y
// oro: compacta, con el saludo debajo en la tipografía de la marca. Sustituye
// a la cabecera y al bloque de bienvenida grandes del diseño clásico.

import { LogOut } from 'lucide-react'
import { AvatarBubble } from './UserProfile'

export function GoldStaffBar({ profile, roleLabel, onAvatar, onLogout, actions = null }) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl"
      style={{ background: 'rgba(11, 11, 12, 0.88)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo-nl-vip.jpg" alt="NL VIP Team" className="w-9 h-9 rounded-[10px] object-cover border border-white/10 shrink-0" />
          <span className="nl-label truncate">{roleLabel}</span>
          {actions}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AvatarBubble profile={profile} size="sm" onClick={onAvatar} />
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="w-10 h-10 rounded-full flex items-center justify-center border border-white/[0.07] transition-colors hover:text-red-400"
            style={{ background: 'var(--nl-surface)', color: 'var(--nl-muted)' }}
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function GoldStaffGreeting({ profile, kicker }) {
  const firstName = profile?.name?.split(' ')[0]
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace(',', '').replace('.', '')
  return (
    <div className="mb-5">
      <p className="nl-label mb-1.5">{kicker ? `${kicker} · ${date}` : date}</p>
      <h1 className="nl-display text-[34px]" style={{ color: 'var(--nl-text)' }}>
        {firstName ? `Hola, ${firstName}` : 'Hola'}
      </h1>
    </div>
  )
}
