'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Zap, Loader2, Flag, Heart, MessageCircle, 
  Image as ImageIcon 
} from 'lucide-react'
import ImageUploader from './ImageUploader'
import { generateFileId, getFileExtension } from '@/hooks/useStorage'
import { useToast } from '@/hooks/use-toast'

export function FeedTab({ user, posts, imageUrls, loading, uploading, progress, onPostCreated, onLike, onComment, onReport, uploadFile }) {
  const [newPostContent, setNewPostContent] = useState('')
  const [postImage, setPostImage] = useState(null)
  const [commentingPost, setCommentingPost] = useState(null)
  const [newComment, setNewComment] = useState('')
  const { toast } = useToast()

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!newPostContent.trim() && !postImage) return

    try {
      let imagePath = null
      if (postImage) {
        const fileId = generateFileId()
        const ext = getFileExtension(postImage.name)
        imagePath = `feed/${user.id}/${fileId}.${ext}`
        
        const result = await uploadFile('feed_images', imagePath, postImage)
        if (!result.success) throw new Error(result.error)
      }

      const { error } = await supabase.from('feed_posts').insert([{
        author_id: user.id,
        content: newPostContent,
        image_url: imagePath
      }])

      if (error) throw error
      
      setNewPostContent('')
      setPostImage(null)
      if (onPostCreated) onPostCreated()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const isLikedByMe = (post) => post.feed_likes?.some(like => like.user_id === user.id)

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
        <CardContent className="p-5">
          <form onSubmit={handleCreatePost} className="space-y-4">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="¿Qué logro compartes hoy? 💪"
              className="bg-black/50 border-[#2a2a2a] text-white rounded-2xl min-h-[80px] resize-none focus:border-violet-500 placeholder:text-gray-500"
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

      {posts.map((post) => (
        <Card key={post.id} className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden hover:border-violet-500/30 transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 flex items-center justify-center text-violet-500 font-bold border border-violet-500/20">
                {post.author?.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white">{post.author?.name}</p>
                <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl text-gray-500 hover:text-violet-500" onClick={() => onReport(post.id)}>
                <Flag className="w-4 h-4" />
              </Button>
            </div>

            {post.content && <p className="text-gray-200 mb-4 leading-relaxed">{post.content}</p>}

            {imageUrls[post.id] && (
              <div className="mb-4 rounded-2xl overflow-hidden border border-[#2a2a2a]">
                <img
                  src={imageUrls[post.id]}
                  alt="Post"
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}

            <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
              <Button variant="ghost" size="sm" className={`rounded-xl ${isLikedByMe(post) ? 'text-violet-500' : 'text-gray-400'} hover:text-violet-500`} onClick={() => onLike(post.id)}>
                <Heart className="w-5 h-5 mr-2" fill={isLikedByMe(post) ? 'currentColor' : 'none'} />
                {post.feed_likes?.length || 0}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl text-gray-400 hover:text-violet-500" onClick={() => setCommentingPost(commentingPost === post.id ? null : post.id)}>
                <MessageCircle className="w-5 h-5 mr-2" />
                {post.feed_comments?.length || 0}
              </Button>
            </div>
            
            {post.feed_comments?.length > 0 && (
              <div className="mt-4 space-y-2 pl-4 border-l-2 border-violet-500/20">
                {post.feed_comments.slice(0, 3).map((c) => (
                  <p key={c.id} className="text-sm"><span className="text-violet-500 font-semibold">{c.commenter?.name}</span> <span className="text-gray-300">{c.content}</span></p>
                ))}
              </div>
            )}
            
            {commentingPost === post.id && (
              <div className="mt-4 flex gap-2">
                <Input 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)} 
                  placeholder="Comenta..." 
                  className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" 
                />
                <Button 
                  onClick={() => {
                    onComment(post.id, newComment)
                    setNewComment('')
                    setCommentingPost(null)
                  }} 
                  className="bg-violet-500 text-black rounded-xl px-4"
                >
                  Enviar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
