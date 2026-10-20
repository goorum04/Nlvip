'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Heart, MessageCircle, Flag, LoaderCircle as Loader2, Zap, Trash2, EyeOff, Eye, Ban, ShieldAlert } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/utils'
import ImageUploader from './ImageUploader'

const REPORT_REASONS = ['Contenido ofensivo', 'Acoso o bullying', 'Spam o publicidad', 'Otro motivo']

// Helper to batch-get signed URLs in a single request
const getSignedUrlsBatch = async (bucket, paths, expiresIn = 3600) => {
  if (!paths.length) return []
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn)
  return data || []
}

// Helper to upload file
const uploadFile = async (bucket, path, file, options = {}) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, options)
  return { data, error }
}

export function FeedSection({ userId, userRole = 'member', canModerate = false }) {
  const [feedPosts, setFeedPosts] = useState([])
  const [feedImageUrls, setFeedImageUrls] = useState({})
  const [newPostContent, setNewPostContent] = useState('')
  const [postImage, setPostImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [commentingPost, setCommentingPost] = useState(null)
  const [newComment, setNewComment] = useState('')
  // Denunciar / bloquear (Guideline 1.2): lo que el usuario ha denunciado o
  // bloqueado desaparece de SU feed al instante; el admin lo revisa aparte.
  const [reportingTarget, setReportingTarget] = useState(null) // { type: 'post' | 'comment', id }
  const [pendingReports, setPendingReports] = useState({}) // solo moderadores: post_id/comment_id -> [{ reason, reporter }]
  const { toast } = useToast()

  useEffect(() => {
    loadFeed()
  }, [])

  const loadFeed = async () => {
    const [{ data }, { data: blocks }, { data: myReports }, { data: openReports }] = await Promise.all([
      supabase
        .from('feed_posts')
        .select(`*, author:profiles!feed_posts_author_id_fkey(name, role), feed_likes(id, user_id), feed_comments(id, content, created_at, commenter_id, commenter:profiles!feed_comments_commenter_id_fkey(name))`)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
      supabase.from('feed_reports').select('post_id, comment_id').eq('reporter_id', userId),
      canModerate
        ? supabase.from('feed_reports').select('post_id, comment_id, reason, reporter:profiles!feed_reports_reporter_id_fkey(name)').eq('status', 'pending')
        : Promise.resolve({ data: [] }),
    ])

    if (data) {
      const blocked = new Set((blocks || []).map(b => b.blocked_id))
      const reportedPosts = new Set((myReports || []).filter(r => r.post_id).map(r => r.post_id))
      const reportedComments = new Set((myReports || []).filter(r => r.comment_id).map(r => r.comment_id))
      const visible = data
        .filter(p => !blocked.has(p.author_id) && !reportedPosts.has(p.id))
        .map(p => ({
          ...p,
          feed_comments: (p.feed_comments || []).filter(c => !blocked.has(c.commenter_id) && !reportedComments.has(c.id)),
        }))
      setFeedPosts(visible)

      const grouped = {}
      for (const r of (openReports || [])) {
        const key = r.post_id || r.comment_id
        if (!grouped[key]) grouped[key] = []
        grouped[key].push({ reason: r.reason, reporter: r.reporter?.name || 'Socio' })
      }
      setPendingReports(grouped)

      const postsWithImages = visible.filter(p => p.image_url)
      if (postsWithImages.length > 0) {
        const paths = postsWithImages.map(p => p.image_url)
        const signed = await getSignedUrlsBatch('feed_images', paths, 3600)
        const urls = {}
        for (const { path, signedUrl } of signed) {
          const post = postsWithImages.find(p => p.image_url === path)
          if (post && signedUrl) urls[post.id] = signedUrl
        }
        setFeedImageUrls(urls)
      }
    }
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!newPostContent.trim() && !postImage) return
    setLoading(true)
    setUploading(!!postImage)
    setProgress(0)

    try {
      let imagePath = null
      if (postImage) {
        const fileId = Date.now()
        const ext = postImage.name.split('.').pop()
        imagePath = `feed/${userId}/${fileId}.${ext}`
        setProgress(30)
        
        const result = await uploadFile('feed_images', imagePath, postImage, {
          contentType: postImage.type,
          upsert: true
        })
        if (result.error) throw result.error
        setProgress(70)
      }

      const { error } = await supabase.from('feed_posts').insert([{
        author_id: userId,
        content: newPostContent,
        image_url: imagePath,
        post_type: 'text'
      }])
      
      if (error) throw error
      setProgress(100)
      toast({ title: '¡Publicado!', description: 'Tu post se ha compartido' })
      setNewPostContent('')
      setPostImage(null)
      loadFeed()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  const handleLikePost = async (postId) => {
    const { data: existingLike } = await supabase.from('feed_likes').select('id').eq('post_id', postId).eq('user_id', userId).single()
    if (existingLike) {
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', userId)
    } else {
      await supabase.from('feed_likes').insert([{ post_id: postId, user_id: userId }])
    }
    loadFeed()
  }

  const handleComment = async (postId) => {
    const { error } = await supabase.from('feed_comments').insert([{ post_id: postId, commenter_id: userId, content: newComment }])
    if (!error) {
      setNewComment('')
      setCommentingPost(null)
      loadFeed()
    }
  }

  const handleHidePost = async (postId) => {
    if (!canModerate) return
    const { error } = await supabase.from('feed_posts').update({ is_hidden: true }).eq('id', postId)
    if (!error) {
      toast({ title: 'Post ocultado', description: 'El post ha sido ocultado del feed' })
      loadFeed()
    }
  }

  const handleDeletePost = async (postId) => {
    if (!canModerate) return
    const { error } = await supabase.from('feed_posts').delete().eq('id', postId)
    if (!error) {
      toast({ title: 'Post eliminado', description: 'El post ha sido eliminado permanentemente' })
      loadFeed()
    }
  }

  const handleReport = async (reason) => {
    if (!reportingTarget) return
    const { type, id } = reportingTarget
    setReportingTarget(null)
    try {
      const res = await authFetch('/api/feed/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'post' ? { postId: id, reason } : { commentId: id, reason }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'No se pudo enviar la denuncia')
      toast({ title: 'Gracias por avisar', description: 'Lo hemos ocultado para ti y el equipo lo revisará en menos de 24 horas.' })
      loadFeed()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleBlockUser = async (blockedId, name) => {
    if (!window.confirm(`¿Bloquear a ${name || 'este usuario'}? Dejarás de ver sus publicaciones y comentarios.`)) return
    const { error } = await supabase.from('user_blocks').insert([{ blocker_id: userId, blocked_id: blockedId }])
    if (error && error.code !== '23505') {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Usuario bloqueado', description: 'Ya no verás su contenido. Puedes deshacerlo desde tu perfil.' })
    loadFeed()
  }

  const handleMarkReviewed = async (targetId) => {
    if (!canModerate) return
    const { error } = await supabase
      .from('feed_reports')
      .update({ status: 'reviewed', reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .or(`post_id.eq.${targetId},comment_id.eq.${targetId}`)
      .eq('status', 'pending')
    if (!error) {
      toast({ title: 'Denuncia revisada' })
      loadFeed()
    }
  }

  const ReportReasonPicker = ({ target }) => (
    reportingTarget?.type === target.type && reportingTarget?.id === target.id ? (
      <div className="mt-2 p-3 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-2">
        <p className="text-xs text-gray-400">¿Por qué lo denuncias?</p>
        <div className="flex flex-wrap gap-2">
          {REPORT_REASONS.map(reason => (
            <Button key={reason} size="sm" variant="outline" className="rounded-xl border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => handleReport(reason)}>
              {reason}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="rounded-xl text-gray-500" onClick={() => setReportingTarget(null)}>Cancelar</Button>
        </div>
      </div>
    ) : null
  )

  const isLikedByMe = (post) => post.feed_likes?.some(l => l.user_id === userId)

  const getRoleBadge = (role) => {
    if (role === 'admin') return <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full ml-2">Admin</span>
    if (role === 'trainer') return <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full ml-2">Entrenador</span>
    return null
  }

  return (
    <div className="space-y-4">
      {/* Create Post Form */}
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-violet-500/20 rounded-3xl overflow-hidden">
        <CardContent className="p-5">
          <form onSubmit={handleCreatePost} className="space-y-4">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={userRole === 'trainer' ? "Comparte un consejo o motivación para tus socios 💪" : userRole === 'admin' ? "Publica un anuncio o novedad del gym 📢" : "¿Qué logro compartes hoy? 💪"}
              className="bg-black/50 border-violet-500/20 text-white rounded-2xl min-h-[80px] resize-none focus:border-violet-500 placeholder:text-gray-500"
            />
            <ImageUploader
              onImageSelect={setPostImage}
              onImageRemove={() => setPostImage(null)}
              disabled={loading || uploading}
            />
            <Button 
              type="submit" 
              disabled={loading || uploading || (!newPostContent.trim() && !postImage)} 
              className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 hover:opacity-90 text-black font-bold rounded-2xl py-6 shadow-lg shadow-violet-500/20"
            >
              {uploading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Subiendo {progress}%</>
              ) : (
                <><Zap className="w-5 h-5 mr-2" /> Publicar</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Posts List */}
      {feedPosts.map((post) => (
        <Card key={post.id} className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-violet-500/20 rounded-3xl overflow-hidden hover:border-violet-500/30 transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 flex items-center justify-center text-violet-500 font-bold border border-violet-500/20">
                {post.author?.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white flex items-center">
                  {post.author?.name}
                  {getRoleBadge(post.author?.role)}
                </p>
                <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              
              <div className="flex gap-1">
                {post.author_id !== userId && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => setReportingTarget({ type: 'post', id: post.id })}
                      title="Denunciar publicación"
                    >
                      <Flag className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleBlockUser(post.author_id, post.author?.name)}
                      title="Bloquear usuario"
                    >
                      <Ban className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {/* Moderation buttons */}
                {canModerate && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                      onClick={() => handleHidePost(post.id)}
                      title="Ocultar post"
                    >
                      <EyeOff className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDeletePost(post.id)}
                      title="Eliminar post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {canModerate && pendingReports[post.id] && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30">
                <p className="text-xs font-bold text-red-300 flex items-center gap-1.5 mb-1">
                  <ShieldAlert className="w-4 h-4" /> Denunciado {pendingReports[post.id].length > 1 ? `${pendingReports[post.id].length} veces` : ''}
                </p>
                <ul className="text-xs text-red-200/80 space-y-0.5">
                  {pendingReports[post.id].map((r, i) => <li key={i}>• {r.reason} — {r.reporter}</li>)}
                </ul>
                <Button size="sm" variant="outline" className="mt-2 rounded-xl border-red-500/30 text-red-200" onClick={() => handleMarkReviewed(post.id)}>
                  Marcar como revisado (sin acción)
                </Button>
              </div>
            )}
            <ReportReasonPicker target={{ type: 'post', id: post.id }} />

            {post.content && <p className="text-gray-200 mb-4 leading-relaxed">{post.content}</p>}
            
            {/* Post Image */}
            {feedImageUrls[post.id] && (
              <div className="mb-4 rounded-2xl overflow-hidden border border-violet-500/10">
                <img
                  src={feedImageUrls[post.id]}
                  alt="Post"
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}
            
            <div className="flex items-center gap-4 pt-3 border-t border-violet-500/10">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`rounded-xl ${isLikedByMe(post) ? 'text-violet-500' : 'text-gray-400'} hover:text-violet-500`} 
                onClick={() => handleLikePost(post.id)}
              >
                <Heart className="w-5 h-5 mr-2" fill={isLikedByMe(post) ? 'currentColor' : 'none'} />
                {post.feed_likes?.length || 0}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-xl text-gray-400 hover:text-violet-500" 
                onClick={() => setCommentingPost(commentingPost === post.id ? null : post.id)}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                {post.feed_comments?.length || 0}
              </Button>
            </div>
            
            {/* Comments */}
            {post.feed_comments?.length > 0 && (
              <div className="mt-4 space-y-2 pl-4 border-l-2 border-violet-500/20">
                {post.feed_comments.slice(0, 3).map((c) => (
                  <div key={c.id}>
                    <p className="text-sm flex items-start gap-2">
                      <span className="flex-1">
                        <span className="text-violet-500 font-semibold">{c.commenter?.name}</span>{' '}
                        <span className="text-gray-300">{c.content}</span>
                      </span>
                      {c.commenter_id !== userId && (
                        <button
                          type="button"
                          className="text-gray-600 hover:text-red-400 shrink-0"
                          onClick={() => setReportingTarget({ type: 'comment', id: c.id })}
                          title="Denunciar comentario"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </p>
                    {canModerate && pendingReports[c.id] && (
                      <p className="text-xs text-red-300 flex items-center gap-1 mt-0.5">
                        <ShieldAlert className="w-3 h-3" /> Denunciado: {pendingReports[c.id].map(r => r.reason).join(', ')}
                        <button type="button" className="underline ml-1" onClick={() => handleMarkReviewed(c.id)}>revisado</button>
                      </p>
                    )}
                    <ReportReasonPicker target={{ type: 'comment', id: c.id }} />
                  </div>
                ))}
              </div>
            )}
            
            {/* Comment input */}
            {commentingPost === post.id && (
              <div className="mt-4 flex gap-2">
                <Input 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)} 
                  placeholder="Comenta..." 
                  className="bg-black/50 border-violet-500/20 rounded-xl text-white" 
                />
                <Button 
                  onClick={() => handleComment(post.id)} 
                  className="bg-violet-500 text-black rounded-xl px-4"
                >
                  Enviar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      
      {feedPosts.length === 0 && (
        <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl">
          <CardContent className="p-8 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-violet-400/30 mb-3" />
            <p className="text-gray-400">No hay publicaciones todavía</p>
            <p className="text-gray-500 text-sm mt-1">¡Sé el primero en compartir algo!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
