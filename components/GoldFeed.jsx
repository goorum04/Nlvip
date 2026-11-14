'use client'

// Comunidad (feed) del diseño negro y oro: publicar plegado en una barra,
// publicaciones limpias con foto a todo lo ancho, "me gusta" con animación y
// denunciar/bloquear en el menú "…". Mismas acciones que el diseño clásico
// (los manejadores vienen de MemberDashboard).

import { useEffect, useState } from 'react'
import { Heart, MessageCircle, MoreHorizontal, Flag, Ban, ImagePlus, LoaderCircle as Loader2, Send } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import ImageUploader from './ImageUploader'

const C = {
  text: 'var(--nl-text)', muted: 'var(--nl-muted)', dim: 'var(--nl-dim)', accent: 'var(--nl-accent)',
  accent2: 'var(--nl-accent2)', surface: 'var(--nl-surface)', surface2: 'var(--nl-surface2)',
  line: 'var(--nl-line)', ink: 'var(--nl-ink)', soft: 'var(--nl-soft)',
}

export function relativeTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

function Monogram({ name, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center nl-display"
      style={{ width: size, height: size, fontSize: size * 0.46, background: 'linear-gradient(145deg,#2A251B,#1A1814)', color: C.accent, border: '1px solid rgba(212,175,106,0.28)' }}
    >
      {initial}
    </span>
  )
}

export function GoldComposer({ authorName, value, onChange, image, onImage, onRemoveImage, onSubmit, busy, uploading, progress }) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Tras publicar, MemberDashboard vacía el texto y la foto: se vuelve a plegar.
  useEffect(() => {
    if (submitted && !value && !image) { setOpen(false); setSubmitted(false) }
  }, [submitted, value, image])

  if (!open && !value && !image) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="nl-card w-full flex items-center gap-3 p-3.5 text-left transition-colors active:bg-white/[0.03]">
        <Monogram name={authorName} />
        <span className="flex-1 text-[14.5px]" style={{ color: C.muted }}>¿Qué logro compartes hoy?</span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.surface2, color: C.accent }}>
          <ImagePlus className="w-[18px] h-[18px]" />
        </span>
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => { setSubmitted(true); onSubmit(e) }}
      className="nl-card p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <Monogram name={authorName} />
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="¿Qué logro compartes hoy? 💪"
          rows={3}
          className="nl-set-note flex-1"
        />
      </div>
      <ImageUploader onImageSelect={onImage} onImageRemove={onRemoveImage} disabled={busy || uploading} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { onChange(''); onRemoveImage(); setOpen(false) }}
          className="nl-btn nl-btn-ghost flex-1 h-11 text-[14.5px]"
        >
          Cancelar
        </button>
        <button type="submit" disabled={busy || uploading || (!value.trim() && !image)} className="nl-btn flex-[2] h-11 text-[14.5px] disabled:opacity-50">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo {progress}%</> : <><Send className="w-4 h-4" /> Publicar</>}
        </button>
      </div>
    </form>
  )
}

export function GoldPost({
  post, userId, imageUrl, liked, onLike, commentsOpen, onToggleComments,
  newComment, onNewComment, onComment, onReport, onBlock, renderReportPicker,
}) {
  const mine = post.author_id === userId
  const likes = post.feed_likes?.length || 0
  const comments = post.feed_comments || []
  return (
    <article className="nl-card overflow-hidden">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Monogram name={post.author?.name} />
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-semibold truncate" style={{ color: C.text }}>{post.author?.name || 'Socio'}</p>
          <p className="text-[12px]" style={{ color: C.muted }}>{relativeTime(post.created_at)}</p>
        </div>
        {!mine && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Más opciones" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: C.muted }}>
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#151517] border-white/10 rounded-2xl p-1.5 min-w-[200px]">
              <DropdownMenuItem onSelect={() => onReport({ type: 'post', id: post.id })} className="rounded-xl gap-2 py-2.5 text-[14px] text-red-300 focus:text-red-200 focus:bg-red-500/10">
                <Flag className="w-4 h-4" /> Denunciar publicación
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onBlock(post.author_id, post.author?.name)} className="rounded-xl gap-2 py-2.5 text-[14px] text-red-300 focus:text-red-200 focus:bg-red-500/10">
                <Ban className="w-4 h-4" /> Bloquear a {post.author?.name?.split(' ')[0] || 'este usuario'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      <div className="px-4">{renderReportPicker('post', post.id)}</div>

      {post.content && (
        <p className="px-4 pt-3 text-[15px] leading-relaxed whitespace-pre-line" style={{ color: 'rgba(244,241,234,0.92)' }}>{post.content}</p>
      )}

      {imageUrl && (
        <div className="mt-3 mx-3 rounded-[18px] overflow-hidden" style={{ background: '#000' }}>
          <img src={imageUrl} alt="" className="w-full max-h-[520px] object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex items-center gap-1 px-2 pt-2 pb-1.5">
        <button
          type="button"
          onClick={() => onLike(post.id)}
          aria-pressed={liked}
          aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
          className="h-10 px-2.5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold nl-tabular"
          style={{ color: liked ? C.accent : C.muted }}
        >
          <Heart className="w-[22px] h-[22px] nl-heart" data-liked={liked ? 'true' : 'false'} fill={liked ? 'currentColor' : 'none'} />
          {likes > 0 && likes}
        </button>
        <button
          type="button"
          onClick={() => onToggleComments(post.id)}
          aria-expanded={commentsOpen}
          className="h-10 px-2.5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold nl-tabular"
          style={{ color: commentsOpen ? C.text : C.muted }}
        >
          <MessageCircle className="w-[22px] h-[22px]" />
          {comments.length > 0 && comments.length}
        </button>
      </div>

      {comments.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          {comments.slice(0, 3).map(c => (
            <div key={c.id}>
              <p className="text-[13.5px] leading-snug flex items-start gap-2">
                <span className="flex-1">
                  <span className="font-semibold" style={{ color: C.accent }}>{c.commenter?.name}</span>{' '}
                  <span style={{ color: 'rgba(244,241,234,0.85)' }}>{c.content}</span>
                </span>
                {c.commenter_id !== userId && (
                  <button type="button" className="shrink-0 mt-0.5 hover:text-red-400" style={{ color: C.dim }} title="Denunciar comentario" aria-label="Denunciar comentario" onClick={() => onReport({ type: 'comment', id: c.id })}>
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}
              </p>
              {renderReportPicker('comment', c.id)}
            </div>
          ))}
        </div>
      )}

      {commentsOpen && (
        <form
          onSubmit={(e) => { e.preventDefault(); onComment(post.id) }}
          className="flex items-center gap-2 px-3 pb-3"
        >
          <input
            value={newComment}
            onChange={(e) => onNewComment(e.target.value)}
            placeholder="Escribe un comentario…"
            autoFocus
            className="flex-1 h-11 rounded-full px-4 text-[15px] outline-none"
            style={{ background: C.surface2, color: C.text, caretColor: '#D4AF6A' }}
          />
          <button type="submit" aria-label="Enviar comentario" disabled={!newComment.trim()} className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: C.accent, color: C.ink }}>
            <Send className="w-[18px] h-[18px]" />
          </button>
        </form>
      )}
    </article>
  )
}
